import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const suffix=String(Date.now())+Math.random().toString(16).slice(2);
  const user=await db.user.create({data:{name:"Test owner",email:"ci-"+suffix+"@example.invalid",status:"ACTIVE"}});
  const city=await db.location.create({data:{code:"test_city_"+suffix,nameHy:"Test",nameRu:"Test",nameEn:"Test",kind:"CITY"}});
  const body=await db.bodyType.create({data:{code:"test_type_"+suffix,nameRu:"Test"}});
  const vehicle=await db.vehicle.create({data:{ownerId:user.id,bodyTypeId:body.id,brand:"Test",model:"Car",plate:"CI"+suffix.slice(0,10),year:2020,status:"APPROVED",ownerConsentAt:new Date(),serviceAreas:{create:{locationId:city.id}}}});
  const pkg=await db.adPackage.create({data:{code:"CI_TEST_"+suffix,format:"DOORS",durationDays:14}});
  const campaign=await db.campaign.create({data:{clientId:user.id,status:"PAID"}});
  const target=await db.campaignCityTarget.create({data:{campaignId:campaign.id,locationId:city.id,packageId:pkg.id,quantity:1,priceAmd:100000}});
  const first={vehicleId:vehicle.id,campaignId:campaign.id,targetId:target.id};
  await db.vehicleAllocation.create({data:{...first,startsAt:new Date("2026-11-01T00:00:00Z"),endsAt:new Date("2026-11-15T00:00:00Z"),status:"CONFIRMED"}});
  let conflictRejected=false;
  try {
    await db.vehicleAllocation.create({data:{...first,startsAt:new Date("2026-11-08T00:00:00Z"),endsAt:new Date("2026-11-18T00:00:00Z"),status:"HELD"}});
  } catch { conflictRejected=true; }
  assert.equal(conflictRejected,true,"PostgreSQL must prevent overlapping vehicle allocations");
  // Adjacent periods are allowed: end is exclusive.
  await db.vehicleAllocation.create({data:{...first,startsAt:new Date("2026-11-15T00:00:00Z"),endsAt:new Date("2026-11-22T00:00:00Z"),status:"HELD"}});
  // Cancelled allocations should not block availability.
  await db.vehicleAllocation.create({data:{...first,startsAt:new Date("2026-11-05T00:00:00Z"),endsAt:new Date("2026-11-07T00:00:00Z"),status:"CANCELLED"}});
  console.log("PostgreSQL overlap constraint: passed.");
}
main().catch(err=>{console.error(err);process.exitCode=1}).finally(()=>db.$disconnect());
