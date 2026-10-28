import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, requireVerifiedUser, respondError } from "@/lib/access";
export const runtime="nodejs";
const inputSchema=z.object({
  cities:z.array(z.object({
    cityCode:z.string().trim().min(2).max(80),
    quantity:z.number().int().min(1).max(1000)
  }).strict()).min(1).max(15),
  format:z.enum(["REAR_WINDOW","DOORS","PARTIAL","FULL"]),
  durationDays:z.union([z.literal(7),z.literal(14),z.literal(30),z.literal(90)])
}).strict();
async function pendingManager(){
  const roleRecords=await prisma.userRole.findMany({where:{role:"MANAGER",activatedAt:{not:null},user:{status:"ACTIVE"}},select:{userId:true}});
  const ids=roleRecords.map(x=>x.userId).sort();
  if(!ids.length)return null;
  const loads=await prisma.clientProfile.groupBy({by:["managerId"],where:{managerId:{in:ids}},_count:{_all:true}});
  const map=new Map(loads.map(x=>[x.managerId,x._count._all]));
  return ids.sort((a,b)=>(map.get(a)??0)-(map.get(b)??0)||a.localeCompare(b))[0]??null;
}
export async function GET(){
  try{
    const user=await requireVerifiedUser();
    const campaigns=await prisma.campaign.findMany({
      where:{clientId:user.id},take:50,orderBy:{createdAt:"desc"},
      select:{id:true,status:true,createdAt:true,quotePriceAmd:true,targets:{select:{quantity:true,location:{select:{code:true,nameRu:true,nameHy:true,nameEn:true}}}}}
    });
    return NextResponse.json({campaigns},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return respondError(error)}
}
export async function POST(request:Request){
  try{
    const user=await requireVerifiedUser();
    const parsed=inputSchema.safeParse(await request.json());
    if(!parsed.success)throw new ApiError(400,"Invalid campaign request");
    const body=parsed.data;
    const unique=new Set(body.cities.map(c=>c.cityCode));
    if(unique.size!==body.cities.length)throw new ApiError(400,"Duplicate cities");
    const [cities,pkg,previous]=await Promise.all([
      prisma.location.findMany({where:{kind:"CITY",code:{in:[...unique]}},select:{id:true,code:true}}),
      prisma.adPackage.findUnique({where:{format_durationDays:{format:body.format,durationDays:body.durationDays}},select:{id:true}}),
      prisma.campaign.count({where:{clientId:user.id,createdAt:{gte:new Date(Date.now()-3600_000)}}})
    ]);
    if(cities.length!==body.cities.length)throw new ApiError(400,"Unknown city");
    if(!pkg)throw new ApiError(503,"Advertising package unavailable");
    if(previous>=5)throw new ApiError(429,"Too many requests. Try later.");
    const existing=await prisma.clientProfile.findUnique({where:{userId:user.id},select:{managerId:true}});
    const managerId=existing?existing.managerId:await pendingManager();
    const campaign=await prisma.$transaction(async tx=>{
      const client=await tx.clientProfile.upsert({where:{userId:user.id},create:{userId:user.id,managerId},update:{},select:{managerId:true}});
      await tx.userRole.upsert({where:{userId_role:{userId:user.id,role:"CLIENT"}},update:{},create:{userId:user.id,role:"CLIENT"}});
      const record=await tx.campaign.create({data:{
        clientId:user.id,managerId:client.managerId,status:"REVIEW",
        targets:{create:body.cities.map(t=>({locationId:cities.find(c=>c.code===t.cityCode)!.id,packageId:pkg.id,quantity:t.quantity,priceAmd:0}))}
      },select:{id:true,status:true}});
      await tx.auditLog.create({data:{actorId:user.id,action:"CLIENT_CAMPAIGN_REQUEST",entityType:"Campaign",entityId:record.id,payload:{cities:body.cities,format:body.format,durationDays:body.durationDays}}});
      return record;
    });
    return NextResponse.json({id:campaign.id,status:campaign.status,message:"Manager will confirm availability and price. No payment collected."},{status:201});
  }catch(error){return respondError(error)}
}
