import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, respondError } from "@/lib/access";
export const runtime="nodejs";
export async function GET(){
  try{
    const staff=await requireRole("OWNER","MANAGER");
    const campaigns=await prisma.campaign.findMany({
      where:{status:"REVIEW",...(staff.isOwner?{}:{managerId:staff.id})},
      orderBy:{createdAt:"asc"},take:100,
      select:{
        id:true,createdAt:true,status:true,
        client:{select:{id:true,name:true,phone:true,email:true}},
        targets:{select:{quantity:true,packageId:true,location:{select:{code:true,nameRu:true}}}}
      }
    });
    return NextResponse.json({campaigns},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return respondError(error)}
}
