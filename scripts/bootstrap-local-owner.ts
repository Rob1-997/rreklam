import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { isLocalDemoConfigured, LOCAL_DEMO_EMAIL } from "../src/lib/local-demo.mjs";
if(existsSync(".env"))loadEnvFile(".env");
const prisma=new PrismaClient();
async function run(){
  if (process.env.NODE_ENV==="production" || !isLocalDemoConfigured()) {
    throw new Error("Local demo disabled. Set RREKLAM_LOCAL_DEMO=true and a strong RREKLAM_LOCAL_DEMO_PASSWORD (20+ chars) in .env; DATABASE_URL must point to localhost.");
  }
  const user=await prisma.$transaction(async tx=>{
    const already=await tx.userRole.count({where:{role:"OWNER",activatedAt:{not:null}}});
    const existing=await tx.user.findUnique({where:{email:LOCAL_DEMO_EMAIL},select:{id:true}});
    if(already>0 && !existing)throw Error("Another active owner exists. Never use this script on an existing business database.");
    if(already>0 && existing){
      const owns=await tx.userRole.findUnique({where:{userId_role:{userId:existing.id,role:"OWNER"}}});
      if(!owns?.activatedAt)throw Error("Another owner exists; local demo cannot take over.");
      return existing;
    }
    const record=await tx.user.upsert({
      where:{email:LOCAL_DEMO_EMAIL},
      create:{name:"Local development owner",email:LOCAL_DEMO_EMAIL,status:"ACTIVE",phoneVerifiedAt:new Date()},
      update:{name:"Local development owner",status:"ACTIVE",phoneVerifiedAt:new Date()}
    });
    await tx.userRole.upsert({
      where:{userId_role:{userId:record.id,role:"OWNER"}},
      create:{userId:record.id,role:"OWNER",activatedAt:new Date()},
      update:{activatedAt:new Date()}
    });
    await tx.auditLog.create({data:{
      actorId:record.id,action:"LOCAL_DEMO_OWNER_CREATED",entityType:"User",entityId:record.id,
      payload:{developmentOnly:true,simulatedPhoneVerification:true}
    }});
    return record;
  },{isolationLevel:"Serializable"});
  console.log("Local RReklam demo owner is ready. Open http://localhost:3000/ru/login and use the password in .env. Demo user ID:",user.id);
  console.log("This account is for development only. Do not reuse this database for production.");
}
run().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1}).finally(()=>prisma.$disconnect());
