import { prisma } from "@/lib/prisma";
import { requireRole,respondError,ApiError } from "@/lib/access";
import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await requireRole("OWNER","MANAGER");
    const {id}=await params;
    const driver=await prisma.driverProfile.findUnique({where:{id},select:{id:true,approvedAt:true,userId:true,managerId:true,termsAcceptedAt:true,user:{select:{phoneVerifiedAt:true}}}});
    if(!driver)throw new ApiError(404,"Driver not found");
    if(!actor.isOwner&&driver.managerId!==actor.id)throw new ApiError(403,"Not assigned to this manager");
    if(!driver.user.phoneVerifiedAt||!driver.termsAcceptedAt)throw new ApiError(409,"Driver requires verified phone and consent");
    if(driver.approvedAt)throw new ApiError(409,"Driver already activated");
    await prisma.$transaction(async tx=>{
      const changed=await tx.driverProfile.updateMany({where:{id,approvedAt:null},data:{approvedAt:new Date()}});
      if(changed.count!==1)throw new ApiError(409,"Already activated");
      await tx.userRole.upsert({where:{userId_role:{userId:driver.userId,role:"PERFORMER"}},update:{activatedAt:new Date()},create:{userId:driver.userId,role:"PERFORMER",activatedAt:new Date()}});
      await tx.user.update({where:{id:driver.userId},data:{status:"ACTIVE"}});
      await tx.auditLog.create({data:{actorId:actor.id,action:"DRIVER_ACTIVATED",entityType:"DriverProfile",entityId:id,payload:{}}});
    });
    return NextResponse.json({ok:true});
  }catch(error){return respondError(error)}
}
