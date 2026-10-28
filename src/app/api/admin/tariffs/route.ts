import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole, respondError } from "@/lib/access";
export const runtime = "nodejs";
const money = z.number().int().min(1).max(2_147_483_647);
const bodySchema = z.object({
  cityCode: z.string().trim().min(2).max(80),
  packageId: z.string().uuid(),
  priceAmd: money,
  driverRateAmd: money
}).strict();
export async function GET(){
  try {
    const actor = await requireRole("OWNER","MANAGER");
    const [cities, packages, proposals] = await Promise.all([
      prisma.location.findMany({where:{kind:"CITY"},select:{id:true,code:true,nameRu:true,nameHy:true,nameEn:true},orderBy:{nameRu:"asc"}}),
      prisma.adPackage.findMany({select:{
        id:true,code:true,format:true,durationDays:true,active:true,
        prices:{select:{locationId:true,priceAmd:true,ownerApprovedAt:true}},
        driverRates:{select:{locationId:true,amountAmd:true,ownerApprovedAt:true}}
      },orderBy:[{durationDays:"asc"},{format:"asc"}]}),
      prisma.tariffProposal.findMany({where:actor.isOwner?{status:"SUBMITTED"}:{status:"SUBMITTED",proposedById:actor.id},orderBy:{createdAt:"asc"},take:100,
        select:{id:true,locationId:true,packageId:true,suggestedPriceAmd:true,reason:true,createdAt:true,proposedById:true}})
    ]);
    return NextResponse.json({cities,packages,proposals},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error){return respondError(error)}
}
export async function PUT(request:Request){
  try {
    const owner=await requireRole("OWNER");
    const parsed=bodySchema.safeParse(await request.json());
    if(!parsed.success)throw new ApiError(400,"Invalid tariff");
    const {cityCode,packageId,priceAmd,driverRateAmd}=parsed.data;
    const [location,pkg]=await Promise.all([
      prisma.location.findUnique({where:{code:cityCode},select:{id:true,kind:true}}),
      prisma.adPackage.findUnique({where:{id:packageId},select:{id:true,durationDays:true}})
    ]);
    if(!location||location.kind!=="CITY"||!pkg||![7,14,30,90].includes(pkg.durationDays))throw new ApiError(400,"Unknown city or package");
    await prisma.$transaction(async tx=>{
      await tx.packageCityPrice.upsert({where:{packageId_locationId:{packageId,locationId:location.id}},create:{packageId,locationId:location.id,priceAmd,ownerApprovedAt:new Date()},update:{priceAmd,ownerApprovedAt:new Date()}});
      await tx.driverRate.upsert({where:{packageId_locationId:{packageId,locationId:location.id}},create:{packageId,locationId:location.id,amountAmd:driverRateAmd,ownerApprovedAt:new Date()},update:{amountAmd:driverRateAmd,ownerApprovedAt:new Date()}});
      await tx.adPackage.update({where:{id:packageId},data:{active:true}});
      await tx.auditLog.create({data:{actorId:owner.id,action:"TARIFF_APPROVED_BY_OWNER",entityType:"AdPackage",entityId:packageId,payload:{cityCode,priceAmd,driverRateAmd}}});
    });
    return NextResponse.json({ok:true,cityCode,packageId,priceAmd,driverRateAmd});
  }catch(error){return respondError(error)}
}
