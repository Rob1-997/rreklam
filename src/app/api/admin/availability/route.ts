import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole, respondError } from "@/lib/access";
export const runtime="nodejs";
const active=["HELD","CONFIRMED","INSTALLING","ACTIVE","REMOVING"] as const;
function dateAtArmenianMidnight(text: string): Date {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw new ApiError(400,"Use YYYY-MM-DD dates");
  const date=new Date(text+"T00:00:00+04:00");
  if(!Number.isFinite(date.getTime())||new Date(date.getTime()+4*60*60*1000).toISOString().slice(0,10)!==text)throw new ApiError(400,"Invalid calendar date");
  return date;
}
export async function GET(request:Request){
  try {
    await requireRole("OWNER","MANAGER");
    const q=new URL(request.url).searchParams;
    const startText=q.get("start")??"",endText=q.get("end")??"",cityCode=q.get("city")??"";
    const start=dateAtArmenianMidnight(startText);
    const lastDay=dateAtArmenianMidnight(endText);
    const end=new Date(lastDay.getTime()+24*60*60*1000);
    if(end<=start||end.getTime()-start.getTime()>120*24*60*60*1000)throw new ApiError(400,"Date range must be 1–120 days");
    const cities=await prisma.location.findMany({where:{kind:"CITY",...(cityCode?{code:cityCode}:{})},select:{id:true,code:true,nameRu:true,nameHy:true,nameEn:true},orderBy:{nameRu:"asc"}});
    if(cityCode&&cities.length===0)throw new ApiError(404,"Unknown city");
    const [vehicles,overlap,rules]=await Promise.all([
      prisma.vehicle.findMany({where:{status:"APPROVED",wrapStatus:"NONE"},select:{id:true,serviceAreas:{select:{locationId:true}}}}),
      prisma.vehicleAllocation.findMany({where:{status:{in:[...active]},startsAt:{lt:end},endsAt:{gt:start}},select:{vehicleId:true}}),
      prisma.stockAlertRule.findMany({where:{enabled:true},select:{locationId:true,minimumAvailable:true}})
    ]);
    const busy=new Set(overlap.map(x=>x.vehicleId));
    const limits=new Map(rules.map(x=>[x.locationId,x.minimumAvailable]));
    const results=cities.map(city=>{
      const eligible=vehicles.filter(v=>v.serviceAreas.some(a=>a.locationId===city.id));
      const free=eligible.filter(v=>!busy.has(v.id)).length;
      const minimum=limits.get(city.id)??null;
      return {city:city.code,nameRu:city.nameRu,nameHy:city.nameHy,nameEn:city.nameEn,eligible:eligible.length,available:free,minimumAvailable:minimum,belowThreshold:minimum!==null&&free<minimum};
    });
    return NextResponse.json({start:startText,end:endText,timezone:"Asia/Yerevan",availability:results,disclaimer:"Candidates only; final availability must be verified by a manager for the selected format and campaign."},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return respondError(error)}
}
