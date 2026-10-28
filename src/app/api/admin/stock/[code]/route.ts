import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, ApiError, respondError } from "@/lib/access";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
const schema=z.object({minimumAvailable:z.number().int().min(0).max(100000),enabled:z.boolean()}).strict();
export async function PUT(request:Request,{params}:{params:Promise<{code:string}>}){
  try {
    const owner=await requireRole("OWNER");
    const {code}=await params;
    const parsed=schema.safeParse(await request.json());
    if(!parsed.success)throw new ApiError(400,"Invalid alert threshold");
    const location=await prisma.location.findUnique({where:{code},select:{id:true,kind:true}});
    if(!location||location.kind!=="CITY")throw new ApiError(404,"City not found");
    const saved=await prisma.$transaction(async tx=>{
      const rule=await tx.stockAlertRule.upsert({where:{locationId:location.id},update:parsed.data,create:{locationId:location.id,...parsed.data}});
      await tx.auditLog.create({data:{actorId:owner.id,action:"STOCK_ALERT_THRESHOLD_UPDATED",entityType:"Location",entityId:location.id,payload:{minimumAvailable:parsed.data.minimumAvailable,enabled:parsed.data.enabled}}});
      return rule;
    });
    return NextResponse.json({ code, minimumAvailable:saved.minimumAvailable, enabled:saved.enabled });
  } catch(error){return respondError(error)}
}
