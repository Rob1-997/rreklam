import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LOCAL_DEMO_EMAIL, isLocalDemoEnabled, isLocalAuthRequest } from "@/lib/local-demo.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Local development diagnostics only. No personal data or credentials are returned.
export async function GET(request:Request){
  if(!isLocalDemoEnabled()||!isLocalAuthRequest(request)){
    return NextResponse.json({error:"Not found"},{status:404});
  }
  try{
    const user=await prisma.user.findUnique({where:{email:LOCAL_DEMO_EMAIL},select:{
      status:true,phoneVerifiedAt:true,roles:{where:{role:"OWNER",activatedAt:{not:null}},select:{role:true}}
    }});
    return NextResponse.json({
      localDemoEnabled:true,
      ownerCreated:!!user,
      ownerActive:user?.status==="ACTIVE"&&!!user?.phoneVerifiedAt&&!!user?.roles.length,
      nextStep:!user?"Run: npx tsx scripts/bootstrap-local-owner.ts":user?.status!=="ACTIVE"||!user?.phoneVerifiedAt||!user?.roles.length?"Re-run bootstrap on a fresh local development database or inspect the account":"Use the password from .env on /ru/login"
    },{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({error:"Local database unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
