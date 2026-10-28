import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser, respondError, ApiError } from "@/lib/access";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
const schema = z.object({
  driverType: z.enum(["PRIVATE","TAXI"]),
  primaryCityCode: z.string().trim().min(2).max(80),
  acceptTerms: z.literal(true)
}).strict();
export async function GET() {
  try {
    const user = await requireVerifiedUser();
    const profile = await prisma.driverProfile.findUnique({ where: { userId: user.id }, select: { id:true,driverType:true,approvedAt:true,primaryCity:{select:{code:true,nameHy:true,nameRu:true,nameEn:true}},assignments:{select:{vehicleId:true}} } });
    return NextResponse.json({ profile });
  } catch (error) { return respondError(error); }
}
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400,"Invalid driver profile");
    const existing = await prisma.driverProfile.findUnique({ where: {userId:user.id},select:{id:true} });
    if (existing) throw new ApiError(409,"Driver application already exists");
    const city = await prisma.location.findUnique({ where:{code:parsed.data.primaryCityCode},select:{id:true,kind:true} });
    if (!city || city.kind!=="CITY") throw new ApiError(400,"City not found");
    const managers = await prisma.userRole.findMany({where:{role:"MANAGER",activatedAt:{not:null},user:{status:"ACTIVE"}},select:{userId:true},orderBy:{userId:"asc"}});
    const ids=managers.map(x=>x.userId);
    const loads=ids.length?await prisma.driverProfile.groupBy({by:["managerId"],where:{managerId:{in:ids}},_count:{_all:true}}):[];
    const counts=new Map(loads.map(x=>[x.managerId,x._count._all]));
    const managerId=ids.sort((a,b)=>(counts.get(a)??0)-(counts.get(b)??0)||a.localeCompare(b))[0]??null;
    const profile = await prisma.$transaction(async tx=>{
      await tx.userRole.upsert({where:{userId_role:{userId:user.id,role:"PERFORMER"}},update:{},create:{userId:user.id,role:"PERFORMER"}});
      const record=await tx.driverProfile.create({data:{userId:user.id,driverType:parsed.data.driverType,termsAcceptedAt:new Date(),primaryCityId:city.id,managerId}});
      await tx.auditLog.create({data:{actorId:user.id,action:"DRIVER_APPLICATION",entityType:"DriverProfile",entityId:record.id,payload:{driverType:record.driverType,primaryCityCode:parsed.data.primaryCityCode}}});
      return record;
    });
    return NextResponse.json({ id:profile.id, status:"PENDING", managerAssigned:!!managerId },{status:201});
  } catch(error) { return respondError(error); }
}
