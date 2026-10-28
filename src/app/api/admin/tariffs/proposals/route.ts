import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole, respondError } from "@/lib/access";
export const runtime="nodejs";
const proposalSchema=z.object({
  cityCode:z.string().trim().min(2).max(80),
  packageId:z.string().uuid(),
  suggestedPriceAmd:z.number().int().min(1).max(2_147_483_647),
  reason:z.string().trim().min(10).max(800)
}).strict();
export async function POST(request:Request){
  try{
    const actor=await requireRole("OWNER","MANAGER");
    const parsed=proposalSchema.safeParse(await request.json());
    if(!parsed.success)throw new ApiError(400,"Invalid proposal");
    const {cityCode,packageId,suggestedPriceAmd,reason}=parsed.data;
    const [location,pkg]=await Promise.all([
      prisma.location.findUnique({where:{code:cityCode},select:{id:true,kind:true}}),
      prisma.adPackage.findUnique({where:{id:packageId},select:{id:true}})
    ]);
    if(!location||location.kind!=="CITY"||!pkg)throw new ApiError(400,"Unknown city or package");
    const proposal=await prisma.$transaction(async tx=>{
      const created=await tx.tariffProposal.create({data:{proposedById:actor.id,packageId,locationId:location.id,suggestedPriceAmd,reason,status:"SUBMITTED"}});
      await tx.auditLog.create({data:{actorId:actor.id,action:"TARIFF_CHANGE_PROPOSED",entityType:"TariffProposal",entityId:created.id,payload:{cityCode,suggestedPriceAmd}}});
      return created;
    });
    return NextResponse.json({id:proposal.id,status:proposal.status},{status:201});
  }catch(error){return respondError(error)}
}
