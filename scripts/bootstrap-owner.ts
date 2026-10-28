import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient();
async function run(){
  const email=process.env.BOOTSTRAP_OWNER_EMAIL;
  if(!email||process.env.BOOTSTRAP_CONFIRM!=="GRANT_INITIAL_OWNER")throw Error("Set BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_CONFIRM=GRANT_INITIAL_OWNER for this one-time CLI task");
  const user=await prisma.user.findUnique({where:{email}});
  if(!user||!user.phoneVerifiedAt)throw Error("Owner account must exist with a verified phone");
  const existing=await prisma.userRole.count({where:{role:"OWNER",activatedAt:{not:null}}});
  if(existing>0)throw Error("An owner already exists; do not use bootstrap again");
  await prisma.$transaction(async tx=>{
    await tx.userRole.upsert({where:{userId_role:{userId:user.id,role:"OWNER"}},update:{activatedAt:new Date()},create:{userId:user.id,role:"OWNER",activatedAt:new Date()}});
    await tx.user.update({where:{id:user.id},data:{status:"ACTIVE"}});
    await tx.auditLog.create({data:{actorId:user.id,action:"INITIAL_OWNER_BOOTSTRAP",entityType:"User",entityId:user.id,payload:{}}});
  });
  console.log("Initial owner activated:",user.id);
}
run().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
