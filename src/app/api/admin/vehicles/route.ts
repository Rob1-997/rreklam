import { prisma } from "@/lib/prisma";
import { requireRole,respondError } from "@/lib/access";
import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(){
  try{
    const staff=await requireRole("OWNER","MANAGER");
    const vehicles=await prisma.vehicle.findMany({
      where:{status:"PENDING",...(staff.isOwner?{}:{reviewManagerId:staff.id})},
      take:100,orderBy:{createdAt:"asc"},
      select:{id:true,brand:true,model:true,year:true,plate:true,createdAt:true,ownerConsentAt:true,ownerId:true,reviewManagerId:true,owner:{select:{driver:{select:{id:true,approvedAt:true}}}},bodyType:{select:{code:true}},serviceAreas:{select:{location:{select:{code:true}}}},photos:{select:{kind:true}}}
    });
    return NextResponse.json({vehicles});
  }catch(error){return respondError(error)}
}
