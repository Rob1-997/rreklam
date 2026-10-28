import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { evaluateCampaignQuote } from "../src/lib/quote-finance.mjs";
const db=new PrismaClient();
async function test(){
 const uid=Date.now()+Math.random().toString(36).slice(2);
 const owner=await db.user.create({data:{name:"Quote owner",email:`q-owner-${uid}@example.invalid`,status:"ACTIVE"}});
 const manager=await db.user.create({data:{name:"Quote manager",email:`q-manager-${uid}@example.invalid`,status:"ACTIVE"}});
 const city=await db.location.create({data:{code:"q_city_"+uid,nameHy:"Test",nameRu:"Test",nameEn:"Test",kind:"CITY"}});
 const pkg=await db.adPackage.create({data:{code:"q_pkg_"+uid,format:"REAR_WINDOW",durationDays:30,active:true}});
 await db.packageCityPrice.create({data:{packageId:pkg.id,locationId:city.id,priceAmd:50000,ownerApprovedAt:new Date()}});
 await db.driverRate.create({data:{packageId:pkg.id,locationId:city.id,amountAmd:15000,ownerApprovedAt:new Date()}});
 const campaign=await db.campaign.create({data:{clientId:owner.id,managerId:manager.id,status:"REVIEW"}});
 const target=await db.campaignCityTarget.create({data:{campaignId:campaign.id,locationId:city.id,packageId:pkg.id,quantity:2,priceAmd:0}});
 const costs=["PRINT","INSTALL","REMOVAL","LOGISTICS","OPERATIONS","PAYMENT_FEE","RESERVE"].map((category,i)=>({category,amountAmd:[12000,6000,2000,3000,5000,2000,2000][i]})) as {category:"PRINT"|"INSTALL"|"REMOVAL"|"LOGISTICS"|"OPERATIONS"|"PAYMENT_FEE"|"RESERVE",amountAmd:number}[];
 const calc=evaluateCampaignQuote({lines:[{quantity:2,unitPriceAmd:50000,unitDriverRateAmd:15000}],costs,discountAmd:3000});
 assert.equal(calc.requiresOwnerApproval,true,"Discount requires owner approval");
 const changed=await db.campaign.updateMany({where:{id:campaign.id,quoteVersion:0},data:{quoteVersion:{increment:1}}});
 assert.equal(changed.count,1);
 const stale=await db.campaign.updateMany({where:{id:campaign.id,quoteVersion:0},data:{quoteVersion:{increment:1}}});
 assert.equal(stale.count,0,"Stale quote version must not overwrite changes");
 const quote=await db.campaignQuote.create({data:{
  campaignId:campaign.id,version:1,preparedById:manager.id,status:"PENDING_OWNER",
  startsAt:new Date("2026-11-01T00:00:00Z"),endsAt:new Date("2026-12-01T00:00:00Z"),
  grossPriceAmd:calc.grossPriceAmd,discountAmd:calc.discountAmd,priceAmd:calc.priceAmd,
  driverPayoutAmd:calc.driverPayoutAmd,manualCostAmd:calc.manualCostAmd,directCostAmd:calc.directCostAmd,marginBps:calc.marginBps,exceptionRequired:calc.belowMinimum,
  lines:{create:[{targetId:target.id,packageId:pkg.id,quantity:2,unitPriceAmd:50000,unitDriverRateAmd:15000,totalPriceAmd:100000,totalDriverPayoutAmd:30000}]},
  costs:{create:costs}
 }});
 await db.packageCityPrice.update({where:{packageId_locationId:{packageId:pkg.id,locationId:city.id}},data:{priceAmd:80000}});
 const snapshot=await db.campaignQuote.findUniqueOrThrow({where:{id:quote.id},include:{lines:true,costs:true}});
 assert.equal(snapshot.priceAmd,97000);
 assert.equal(snapshot.lines[0].unitPriceAmd,50000,"Quote must retain original owner approved price");
 assert.equal(snapshot.lines[0].unitDriverRateAmd,15000);
 assert.equal(snapshot.costs.length,7);
 let constraintRejected=false;
 try{await db.campaignQuote.create({data:{
  campaignId:campaign.id,version:2,preparedById:manager.id,status:"PENDING_OWNER",
  startsAt:new Date("2026-11-01T00:00:00Z"),endsAt:new Date("2026-12-01T00:00:00Z"),
  grossPriceAmd:1000,discountAmd:900,priceAmd:500,driverPayoutAmd:10,manualCostAmd:0,directCostAmd:10,marginBps:1000,exceptionRequired:true
 }});}catch{constraintRejected=true}
 assert.equal(constraintRejected,true,"Inconsistent quote totals must fail database constraint");
 console.log("Financial quote snapshot and SQL invariants: passed.");
}
test().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
