import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser, ApiError, respondError } from "@/lib/access";
import { uploadVehiclePhoto,removeVehiclePhoto } from "@/lib/storage";
import { NextResponse } from "next/server";
export const runtime="nodejs";
const formSchema=z.object({
  brand:z.string().trim().min(1).max(80),
  model:z.string().trim().min(1).max(80),
  year:z.number().int().min(1980).max(new Date().getFullYear()+1),
  plate:z.string().trim().regex(/^[A-Za-z0-9-]{4,16}$/).transform(v=>v.toUpperCase()),
  bodyTypeCode:z.string().trim().min(2).max(40),
  cityCodes:z.array(z.string().trim().min(2).max(80)).min(1).max(20),
  legalBasis:z.enum(["OWNER","AUTHORIZED_DRIVER"]),
  ownerPermissionConfirmed:z.literal(true)
}).strict();
const sides=["FRONT","BACK","LEFT","RIGHT"] as const;
export async function GET(){
  try{
    const user=await requireVerifiedUser();
    const vehicles=await prisma.vehicle.findMany({where:{ownerId:user.id},orderBy:{createdAt:"desc"},select:{id:true,brand:true,model:true,year:true,plate:true,status:true,wrapStatus:true,createdAt:true,bodyType:{select:{code:true}},serviceAreas:{select:{location:{select:{code:true,nameRu:true,nameHy:true,nameEn:true}}}},photos:{select:{kind:true}}}});
    return NextResponse.json({vehicles});
  }catch(error){return respondError(error);}
}
export async function POST(request:Request){
  let uploaded:string[]=[];
  try{
    const user=await requireVerifiedUser();
    const driver=await prisma.driverProfile.findUnique({where:{userId:user.id},select:{id:true,managerId:true}});
    if(!driver)throw new ApiError(403,"Driver application required");
    const form=await request.formData();
    const raw=form.get("details");
    if(typeof raw!=="string")throw new ApiError(400,"Missing vehicle details");
    let json:unknown;
    try{json=JSON.parse(raw)}catch{throw new ApiError(400,"Invalid JSON")}
    const parsed=formSchema.safeParse(json);
    if(!parsed.success)throw new ApiError(400,"Invalid vehicle details");
    const input=parsed.data;
    if(new Set(input.cityCodes).size!==input.cityCodes.length)throw new ApiError(400,"Duplicate cities");
    const [bodyType,locations]=await Promise.all([
      prisma.bodyType.findUnique({where:{code:input.bodyTypeCode},select:{id:true}}),
      prisma.location.findMany({where:{code:{in:input.cityCodes},kind:"CITY"},select:{id:true,code:true}})
    ]);
    if(!bodyType||locations.length!==input.cityCodes.length)throw new ApiError(400,"Unknown body type or city");
    const already=await prisma.vehicle.findUnique({where:{plate:input.plate},select:{id:true}});
    if(already)throw new ApiError(409,"Vehicle registration already exists");
    const photos = sides.map(kind=>({kind,file:form.get(kind.toLowerCase())}));
    if(photos.some(p=>!(p.file instanceof File)))throw new ApiError(400,"Four vehicle photos are required");
    const vehicleId=randomUUID();
    const keys=photos.map(p=>({kind:p.kind,key:`vehicle-photos/${vehicleId}/${p.kind.toLowerCase()}.jpg`,file:p.file as File}));
    for(const p of keys){await uploadVehiclePhoto(p.key,p.file);uploaded.push(p.key)}
    const vehicle=await prisma.$transaction(async tx=>{
      const entry=await tx.vehicle.create({data:{
        id:vehicleId,ownerId:user.id,brand:input.brand,model:input.model,year:input.year,plate:input.plate,bodyTypeId:bodyType.id,
        reviewManagerId:driver.managerId,ownerConsentAt:new Date(),status:"PENDING",
        photos:{create:keys.map(p=>({kind:p.kind,privateStorageKey:p.key}))},
        serviceAreas:{create:locations.map(l=>({locationId:l.id}))},
        drivers:{create:{driverId:driver.id}}
      },select:{id:true,status:true}});
      await tx.auditLog.create({data:{actorId:user.id,action:"VEHICLE_SUBMITTED",entityType:"Vehicle",entityId:entry.id,payload:{cityCodes:input.cityCodes,legalBasis:input.legalBasis,photoCount:4}}});
      return entry;
    });
    return NextResponse.json(vehicle,{status:201});
  }catch(error){
    await Promise.allSettled(uploaded.map(key=>removeVehiclePhoto(key)));
    if(error instanceof Error && error.message==="INVALID_IMAGE")return NextResponse.json({error:"Invalid image or image too large"},{status:400});
    return respondError(error);
  }
}
