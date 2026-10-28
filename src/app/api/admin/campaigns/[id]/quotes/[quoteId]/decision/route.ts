import { Prisma } from "@prisma/client";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole, respondError } from "@/lib/access";
export const runtime="nodejs";
const inputSchema=z.object({
  decision:z.enum(["APPROVE","REJECT"]),
  reason:z.string().trim().min(10).max(1000),
  expectedVersion:z.number().int().min(1)
}).strict();
export async function POST(request:Request,{params}:{params:Promise<{id:string;quoteId:string}>}){
  try{
    const owner=await requireRole("OWNER");
    const {id,quoteId}=await params;
    const parsed=inputSchema.safeParse(await request.json());
    if(!parsed.success)throw new ApiError(400,"Decision requires a reason (at least 10 characters)");
    const {decision,reason,expectedVersion}=parsed.data;
    const result=await prisma.$transaction(async tx=>{
      const quote=await tx.campaignQuote.findFirst({where:{id:quoteId,campaignId:id,version:expectedVersion,status:"PENDING_OWNER"},select:{
        id:true,version:true,priceAmd:true,directCostAmd:true,marginBps:true,startsAt:true,endsAt:true,
        discountAmd:true,exceptionRequired:true
      }});
      if(!quote)throw new ApiError(409,"Quote is not pending owner approval or version is outdated");
      const changed=await tx.campaign.updateMany({where:{id,status:"REVIEW",quoteVersion:expectedVersion},data:decision==="APPROVE"?{
        status:"APPROVED",quotePriceAmd:quote.priceAmd,directCostAmd:quote.directCostAmd,marginBps:quote.marginBps,
        startAt:quote.startsAt,endAt:quote.endsAt
      }:{status:"REVIEW"}});
      if(changed.count!==1)throw new ApiError(409,"Campaign changed; refresh");
      const reviewed=await tx.campaignQuote.updateMany({where:{id:quoteId,campaignId:id,version:expectedVersion,status:"PENDING_OWNER"},data:{
        status:decision==="APPROVE"?"APPROVED":"REJECTED",reviewedById:owner.id,decidedAt:new Date(),decisionReason:reason
      }});
      if(reviewed.count!==1)throw new ApiError(409,"Quote already reviewed");
      await tx.auditLog.create({data:{actorId:owner.id,action:decision==="APPROVE"?"CAMPAIGN_QUOTE_APPROVED_BY_OWNER":"CAMPAIGN_QUOTE_REJECTED_BY_OWNER",entityType:"CampaignQuote",entityId:quoteId,payload:{
        campaignId:id,version:expectedVersion,discountAmd:quote.discountAmd,marginBps:quote.marginBps,belowMinimum:quote.exceptionRequired,reason
      }}});
      return {quoteId,decision,campaignStatus:decision==="APPROVE"?"APPROVED":"REVIEW",priceAmd:decision==="APPROVE"?quote.priceAmd:null};
    },{isolationLevel:"Serializable"});
    return NextResponse.json(result);
  }catch(error){
    if(error instanceof Prisma.PrismaClientKnownRequestError&&(error.code==="P2034"||error.code==="P2002"))return respondError(new ApiError(409,"Concurrent change; refresh"));
    return respondError(error)
  }
}
