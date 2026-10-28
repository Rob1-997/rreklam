import { Prisma } from "@prisma/client";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole, respondError } from "@/lib/access";
import { evaluateCampaignQuote } from "@/lib/quote-finance.mjs";
export const runtime="nodejs";
const costCategories=["PRINT","INSTALL","REMOVAL","LOGISTICS","OPERATIONS","PAYMENT_FEE","RESERVE","OTHER"] as const;
const quoteSchema=z.object({
  expectedQuoteVersion:z.number().int().min(0),
  startDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  discountAmd:z.number().int().min(0).max(2_147_483_647).default(0),
  costs:z.array(z.object({
    category:z.enum(costCategories),
    amountAmd:z.number().int().min(0).max(2_147_483_647),
    note:z.string().trim().max(500).optional()
  }).strict()).min(7).max(8)
}).strict();
const minMarginBps=2500;
function dateAtYerevanMidnight(day:string){
  const date=new Date(day+"T00:00:00+04:00");
  if(!Number.isFinite(date.getTime())||new Date(date.getTime()+4*3600_000).toISOString().slice(0,10)!==day)throw new ApiError(400,"Invalid start date");
  const todayYerevan=new Date(Date.now()+4*3600_000).toISOString().slice(0,10);
  if(day<todayYerevan)throw new ApiError(400,"Start date must not be in the past");
  if(date.getTime()>Date.now()+366*86400_000)throw new ApiError(400,"Date is too far ahead");
  return date;
}
function conflict(error:unknown):never{
  if(error instanceof Prisma.PrismaClientKnownRequestError&&(error.code==="P2034"||error.code==="P2002"))throw new ApiError(409,"Concurrent update: refresh and try again");
  throw error;
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await requireRole("OWNER","MANAGER");
    const {id}=await params;
    const campaign=await prisma.campaign.findFirst({
      where:{id,...(actor.isOwner?{}:{managerId:actor.id})},
      select:{
        id:true,status:true,quoteVersion:true,quotePriceAmd:true,managerId:true,
        targets:{select:{id:true,packageId:true,quantity:true,location:{select:{code:true,nameRu:true}},packageId:true}},
        quotes:{orderBy:{version:"desc"},take:20,select:{
          id:true,version:true,status:true,preparedById:true,reviewedById:true,createdAt:true,decidedAt:true,decisionReason:true,
          startsAt:true,endsAt:true,grossPriceAmd:true,discountAmd:true,priceAmd:true,driverPayoutAmd:true,manualCostAmd:true,
          directCostAmd:true,marginBps:true,exceptionRequired:true,
          lines:{select:{targetId:true,quantity:true,unitPriceAmd:true,unitDriverRateAmd:true,totalPriceAmd:true,totalDriverPayoutAmd:true}},
          costs:{select:{category:true,amountAmd:true,note:true}}
        }}
      }
    });
    if(!campaign)throw new ApiError(404,"Campaign not found");
    return NextResponse.json({campaign},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return respondError(error)}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await requireRole("OWNER","MANAGER");
    const {id}=await params;
    const parsed=quoteSchema.safeParse(await request.json());
    if(!parsed.success)throw new ApiError(400,"Invalid quote form: provide all seven direct cost categories");
    const input=parsed.data;
    const startAt=dateAtYerevanMidnight(input.startDate);
    const quote=await prisma.$transaction(async tx=>{
      const campaign=await tx.campaign.findFirst({where:{id,...(actor.isOwner?{}:{managerId:actor.id})},select:{
        id:true,status:true,quoteVersion:true,targets:{select:{id:true,packageId:true,locationId:true,quantity:true}}
      }});
      if(!campaign)throw new ApiError(404,"Campaign not found or not assigned");
      if(campaign.status!=="REVIEW")throw new ApiError(409,"Only unapproved requests can be quoted");
      if(campaign.quoteVersion!==input.expectedQuoteVersion)throw new ApiError(409,"Quote version changed; refresh");
      if(!campaign.targets.length)throw new ApiError(409,"Campaign is empty");
      const lines=[];
      let durationDays:number|null=null;
      for(const target of campaign.targets){
        const pkg=await tx.adPackage.findUnique({where:{id:target.packageId},select:{active:true,durationDays:true}});
        if(!pkg||!pkg.active||![7,14,30,90].includes(pkg.durationDays))throw new ApiError(409,"Package is not active");
        if(durationDays!==null&&pkg.durationDays!==durationDays)throw new ApiError(409,"Mixed package durations are not supported");
        durationDays=pkg.durationDays;
        const [price,rate]=await Promise.all([
          tx.packageCityPrice.findUnique({where:{packageId_locationId:{packageId:target.packageId,locationId:target.locationId}}}),
          tx.driverRate.findUnique({where:{packageId_locationId:{packageId:target.packageId,locationId:target.locationId}}})
        ]);
        if(!price?.ownerApprovedAt||!rate?.ownerApprovedAt||price.priceAmd<=0||rate.amountAmd<=0)throw new ApiError(409,"Owner-approved price and driver rate are required for every city");
        lines.push({targetId:target.id,packageId:target.packageId,quantity:target.quantity,unitPriceAmd:price.priceAmd,unitDriverRateAmd:rate.amountAmd});
      }
      const amounts=lines.map(({quantity,unitPriceAmd,unitDriverRateAmd})=>({quantity,unitPriceAmd,unitDriverRateAmd}));
      let evaluation:ReturnType<typeof evaluateCampaignQuote>;
      try{evaluation=evaluateCampaignQuote({lines:amounts,costs:input.costs,discountAmd:input.discountAmd,minimumMarginBps:minMarginBps})}
      catch(e){throw new ApiError(400,e instanceof Error?e.message:"Invalid quote amounts")}
      const endsAt=new Date(startAt.getTime()+(durationDays??0)*86400_000);
      const version=campaign.quoteVersion+1;
      const needsOwner=evaluation.requiresOwnerApproval;
      const changed=await tx.campaign.updateMany({where:{id,quoteVersion:campaign.quoteVersion,status:"REVIEW"},data:{
        quoteVersion:{increment:1},
        ...(!needsOwner?{status:"APPROVED" as const,quotePriceAmd:evaluation.priceAmd,directCostAmd:evaluation.directCostAmd,marginBps:evaluation.marginBps,startAt,endAt:endsAt}:{})
      }});
      if(changed.count!==1)throw new ApiError(409,"Request has changed; refresh");
      const created=await tx.campaignQuote.create({data:{
        campaignId:id,version,status:needsOwner?"PENDING_OWNER":"APPROVED",preparedById:actor.id,
        ...(!needsOwner?{reviewedById:null,decidedAt:new Date(),decisionReason:"Approved automatically: margin >= 25%, no discount"}:{}),
        startsAt:startAt,endsAt,grossPriceAmd:evaluation.grossPriceAmd,discountAmd:evaluation.discountAmd,priceAmd:evaluation.priceAmd,
        driverPayoutAmd:evaluation.driverPayoutAmd,manualCostAmd:evaluation.manualCostAmd,directCostAmd:evaluation.directCostAmd,
        marginBps:evaluation.marginBps,exceptionRequired:evaluation.belowMinimum,
        lines:{create:lines.map((line,i)=>({targetId:line.targetId,packageId:line.packageId,quantity:line.quantity,unitPriceAmd:line.unitPriceAmd,unitDriverRateAmd:line.unitDriverRateAmd,totalPriceAmd:evaluation.lines[i].totalPriceAmd,totalDriverPayoutAmd:evaluation.lines[i].totalDriverPayoutAmd}))},
        costs:{create:input.costs.map(c=>({category:c.category,amountAmd:c.amountAmd,note:c.note??null}))}
      },select:{id:true,version:true,status:true,priceAmd:true,directCostAmd:true,marginBps:true,exceptionRequired:true}});
      await tx.auditLog.create({data:{actorId:actor.id,action:needsOwner?"CAMPAIGN_QUOTE_SUBMITTED_FOR_OWNER":"CAMPAIGN_QUOTE_AUTO_APPROVED",entityType:"CampaignQuote",entityId:created.id,payload:{campaignId:id,version,discountAmd:evaluation.discountAmd,marginBps:evaluation.marginBps,priceAmd:evaluation.priceAmd,directCostAmd:evaluation.directCostAmd}}});
      return created;
    },{isolationLevel:"Serializable"});
    return NextResponse.json({quote},{status:201});
  }catch(error){
    try{conflict(error)}catch(e){return respondError(e)}
  }
}
