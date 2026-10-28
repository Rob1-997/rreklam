import { prisma } from "@/lib/prisma";
import { requireVerifiedUser,ApiError,respondError } from "@/lib/access";
import { readVehiclePhoto } from "@/lib/storage";
import { NextResponse } from "next/server";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;kind:string}>}){
  try{
    const actor=await requireVerifiedUser();
    const {id,kind}=await params;
    if(!["FRONT","BACK","LEFT","RIGHT"].includes(kind.toUpperCase()))throw new ApiError(404,"Not found");
    const vehicle=await prisma.vehicle.findUnique({where:{id},select:{ownerId:true,reviewManagerId:true,photos:{where:{kind:kind.toUpperCase() as "FRONT"|"BACK"|"LEFT"|"RIGHT"},select:{privateStorageKey:true},take:1}}});
    if(!vehicle)throw new ApiError(404,"Not found");
    if(vehicle.ownerId!==actor.id){
      const staff=await prisma.userRole.findFirst({where:{userId:actor.id,role:{in:["MANAGER","OWNER"]},activatedAt:{not:null}},select:{role:true}});
      if(!staff || (staff.role!=="OWNER" && vehicle.reviewManagerId!==actor.id))throw new ApiError(403,"Access denied");
    }
    const key=vehicle.photos[0]?.privateStorageKey;
    if(!key)throw new ApiError(404,"Photo not found");
    const buffer=await readVehiclePhoto(key);
    return new Response(Buffer.from(buffer),{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){return respondError(error)}
}
