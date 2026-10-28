import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole, respondError } from "@/lib/access";
export const runtime="nodejs";
const schema=z.discriminatedUnion("decision",[
  z.object({decision:z.literal("APPROVE"),driverRateAmd:z.number().int().min(1).max(2_147_483_647).optional()}).strict(),
  z.object({decision:z.literal("REJECT"),reason:z.string().trim().min(10).max(800)}).strict()
]);
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const owner=await requireRole("OWNER");
    const {id}=await params;
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success)throw new ApiError(400,"Invalid decision");
    const proposal=await prisma.tariffProposal.findUnique({where:{id},select:{id:true,packageId:true,locationId:true,suggestedPriceAmd:true,status:true}});
    if(!proposal)throw new ApiError(404,"Proposal not found");
    if(proposal.status!=="SUBMITTED")throw new ApiError(409,"Proposal already decided");
    await prisma.$transaction(async tx=>{
      const changed=await tx.tariffProposal.updateMany({where:{id,status:"SUBMITTED"},data:{status:parsed.data.decision==="APPROVE"?"APPROVED":"REJECTED",decidedById:owner.id,decidedAt:new Date()}});
      if(changed.count!==1)throw new ApiError(409,"Proposal already decided");
      if(parsed.data.decision==="APPROVE"){
        const payout=parsed.data.driverRateAmd??(await tx.driverRate.findUnique({where:{packageId_locationId:{packageId:proposal.packageId,locationId:proposal.locationId}}}))?.amountAmd;
        if(!payout)throw new ApiError(409,"Approved driver rate required");
        await tx.packageCityPrice.upsert({where:{packageId_locationId:{packageId:proposal.packageId,locationId:proposal.locationId}},create:{packageId:proposal.packageId,locationId:proposal.locationId,priceAmd:proposal.suggestedPriceAmd,ownerApprovedAt:new Date()},update:{priceAmd:proposal.suggestedPriceAmd,ownerApprovedAt:new Date()}});
        await tx.driverRate.upsert({where:{packageId_locationId:{packageId:proposal.packageId,locationId:proposal.locationId}},create:{packageId:proposal.packageId,locationId:proposal.locationId,amountAmd:payout,ownerApprovedAt:new Date()},update:{amountAmd:payout,ownerApprovedAt:new Date()}});
        await tx.adPackage.update({where:{id:proposal.packageId},data:{active:true}});
      }
      await tx.auditLog.create({data:{actorId:owner.id,action:parsed.data.decision==="APPROVE"?"TARIFF_PROPOSAL_APPROVED":"TARIFF_PROPOSAL_REJECTED",entityType:"TariffProposal",entityId:id,payload:parsed.data.decision==="APPROVE"?{priceAmd:proposal.suggestedPriceAmd,driverRateAmd:parsed.data.driverRateAmd??null}:{reason:parsed.data.reason}}});
    },{isolationLevel:"Serializable"});
    return NextResponse.json({ok:true,status:parsed.data.decision==="APPROVE"?"APPROVED":"REJECTED"});
  }catch(error){return respondError(error)}
}
