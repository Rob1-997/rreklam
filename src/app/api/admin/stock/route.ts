import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, respondError } from "@/lib/access";
export const runtime = "nodejs";
export async function GET(){
  try {
    const staff = await requireRole("OWNER","MANAGER");
    const [locations,vehicles,activeAllocations,rules]=await Promise.all([
      prisma.location.findMany({where:{kind:"CITY"},select:{id:true,code:true,nameRu:true,nameHy:true,nameEn:true},orderBy:{nameRu:"asc"}}),
      prisma.vehicle.findMany({where:{status:"APPROVED"},select:{id:true,wrapStatus:true,serviceAreas:{select:{locationId:true}}}}),
      prisma.vehicleAllocation.findMany({where:{status:{in:["HELD","CONFIRMED","INSTALLING","ACTIVE","REMOVING"]},startsAt:{lte:new Date()},endsAt:{gt:new Date()}},select:{vehicleId:true}}),
      prisma.stockAlertRule.findMany({select:{locationId:true,minimumAvailable:true,enabled:true}})
    ]);
    const busy = new Set(activeAllocations.map(a=>a.vehicleId));
    const configs=new Map(rules.map(x=>[x.locationId,x]));
    const stock=locations.map(location=>{
      const eligible=vehicles.filter(v=>v.serviceAreas.some(a=>a.locationId===location.id));
      const free=eligible.filter(v=>!busy.has(v.id)&&v.wrapStatus==="NONE").length;
      const rule=configs.get(location.id);
      return { ...location, registered:eligible.length, free, minimumAvailable:rule?.minimumAvailable??0, alertEnabled:rule?.enabled??false, belowThreshold:!!rule?.enabled&&free<rule.minimumAvailable };
    });
    return NextResponse.json({ stock, scope: staff.isOwner ? "OWNER" : "MANAGER", asOf: new Date().toISOString() });
  } catch(error){return respondError(error)}
}
