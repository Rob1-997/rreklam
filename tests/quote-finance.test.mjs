import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCampaignQuote, MIN_MARGIN_BPS } from "../src/lib/quote-finance.mjs";
const inputs=()=>({
 lines:[{quantity:2,unitPriceAmd:50000,unitDriverRateAmd:15000}],
 costs:[
  {category:"PRINT",amountAmd:12000},{category:"INSTALL",amountAmd:6000},
  {category:"REMOVAL",amountAmd:2000},{category:"LOGISTICS",amountAmd:3000},
  {category:"OPERATIONS",amountAmd:5000},{category:"PAYMENT_FEE",amountAmd:2000},
  {category:"RESERVE",amountAmd:2000}
 ]});
test("snapshot uses all required costs and driver payouts",()=>{
 const q=evaluateCampaignQuote(inputs());
 assert.equal(q.grossPriceAmd,100000);
 assert.equal(q.driverPayoutAmd,30000);
 assert.equal(q.manualCostAmd,32000);
 assert.equal(q.directCostAmd,62000);
 assert.equal(q.marginBps,3800);
 assert.equal(q.requiresOwnerApproval,false);
});
test("any discount requires owner approval",()=>{
 const q=evaluateCampaignQuote({...inputs(),discountAmd:3000});
 assert.equal(q.discountAmd,3000);
 assert.equal(q.requiresOwnerApproval,true);
 assert.equal(q.belowMinimum,false);
});
test("below 25 percent requires owner approval",()=>{
 const q=evaluateCampaignQuote({...inputs(),discountAmd:20000});
 assert.equal(q.marginBps,2250);
 assert.equal(q.belowMinimum,true);
 assert.equal(q.requiresOwnerApproval,true);
 assert.equal(MIN_MARGIN_BPS,2500);
});
test("cost category cannot be omitted, even with zero value",()=>{
 const input=inputs(); input.costs.pop();
 assert.throws(()=>evaluateCampaignQuote(input),/Missing manual cost RESERVE/);
});
test("same category cannot appear twice",()=>{
 const input=inputs(); input.costs.push(input.costs[0]);
 assert.throws(()=>evaluateCampaignQuote(input),/Duplicate cost category/);
});
test("discount cannot exceed gross price",()=>{
 assert.throws(()=>evaluateCampaignQuote({...inputs(),discountAmd:100000}),/Discount cannot consume whole price/);
});
test("reject non-integer and overflowing values",()=>{
 assert.throws(()=>evaluateCampaignQuote({...inputs(),discountAmd:1.5}));
 assert.throws(()=>evaluateCampaignQuote({lines:[{quantity:1000,unitPriceAmd:10000000,unitDriverRateAmd:1}],costs:inputs().costs}));
});
