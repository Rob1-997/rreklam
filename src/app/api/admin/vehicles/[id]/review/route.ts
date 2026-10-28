import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireRole,respondError,ApiError } from "@/lib/access";
import { NextResponse } from "next/server";
export const runtime="nodejs";
const bodySchema=z.discriminatedUnion("decision",[
  z.object({decision:z.literal("APPROVE"),permissionCheckNote:z.string().trim().min(10).max(500)}).strict(),
  z.object({decision:z.literal("REJECT"),reason:z.string().trim().min(10).max(500)}).strict()
]);
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await requireRole("OWNER","MANAGER");
    const {id}=await params;
    const parsed=bodySchema.safeParse(await request.json());
    if(!parsed.success)throw new ApiError(400,"Invalid decision");
    const vehicle=await prisma.vehicle.findUnique({where:{id},select:{ownerId:true,status:true,reviewManagerId:true,ownerConsentAt:true,photos:{select:{kind:true}},serviceAreas:{select:{locationId:true}},owner:{select:{driver:{select:{approvedAt:true}}}}}});
    if(!vehicle)throw new ApiError(404,"Vehicle not found");
    if(!actor.isOwner&&vehicle.reviewManagerId!==actor.id)throw new ApiError(403,"Not assigned to this manager");
    if(vehicle.status!=="PENDING")throw new ApiError(409,"Vehicle is not pending");
    if(parsed.data.decision==="APPROVE"){
      if(!vehicle.ownerConsentAt||vehicle.serviceAreas.length===0||!vehicle.owner.driver?.approvedAt||!["FRONT","BACK","LEFT","RIGHT"].every(kind=>vehicle.photos.some(x=>x.kind===kind)))throw new ApiError(409,"Vehicle or driver is not ready");
    }
    await prisma.$transaction(async tx=>{
      const changed=await tx.vehicle.updateMany({where:{id,status:"PENDING"},data:{status:parsed.data.decision==="APPROVE"?"APPROVED":"REJECTED",approvedAt:parsed.data.decision==="APPROVE"?new Date():null,ownerPermissionVerifiedAt:parsed.data.decision==="APPROVE"?new Date():null}});
      if(changed.count!==1)throw new ApiError(409,"Already reviewed");
      await tx.auditLog.create({data:{actorId:actor.id,action:"VEHICLE_"+parsed.data.decision,entityType:"Vehicle",entityId:id,payload:parsed.data.decision==="APPROVE"?{permissionCheckNote:parsed.data.permissionCheckNote}:{reason:parsed.data.reason}}});
    });
    return NextResponse.json({ok:true,decision:parsed.data.decision});
  }catch(error){return respondError(error)}
}
