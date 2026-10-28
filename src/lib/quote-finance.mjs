export const MIN_MARGIN_BPS = 2500;
export const REQUIRED_MANUAL_CATEGORIES = Object.freeze(["PRINT","INSTALL","REMOVAL","LOGISTICS","OPERATIONS","PAYMENT_FEE","RESERVE"]);
const MAX_AMD = 2_147_483_647;
function amd(n,label,{zero=false}={}) {
  if (!Number.isSafeInteger(n) || n < (zero?0:1) || n>MAX_AMD) throw new Error(label + " must be a valid AMD amount");
  return n;
}
function safeAdd(a,b,label) {const n=a+b;return amd(n,label,{zero:true});}
export function evaluateCampaignQuote({lines,costs,discountAmd=0,minimumMarginBps=MIN_MARGIN_BPS}){
  if (!Array.isArray(lines)||!lines.length||!Array.isArray(costs)) throw new Error("Lines and costs are required");
  if(!Number.isInteger(minimumMarginBps)||minimumMarginBps<0||minimumMarginBps>10000)throw new Error("Invalid margin threshold");
  let grossPriceAmd=0,driverPayoutAmd=0;
  const mapped=lines.map((line,i)=>{
    const quantity=amd(line.quantity,"Quantity #"+i);
    const unitPriceAmd=amd(line.unitPriceAmd,"Unit price #"+i);
    const unitDriverRateAmd=amd(line.unitDriverRateAmd,"Driver payout #"+i);
    const totalPriceAmd=amd(quantity*unitPriceAmd,"Total price #"+i);
    const totalDriverPayoutAmd=amd(quantity*unitDriverRateAmd,"Total driver payout #"+i);
    grossPriceAmd=safeAdd(grossPriceAmd,totalPriceAmd,"Gross price");
    driverPayoutAmd=safeAdd(driverPayoutAmd,totalDriverPayoutAmd,"Driver payout");
    return {quantity,unitPriceAmd,unitDriverRateAmd,totalPriceAmd,totalDriverPayoutAmd};
  });
  const categories=new Set();
  let manualCostAmd=0;
  const manualCosts=costs.map((cost)=>{
    if(!["PRINT","INSTALL","REMOVAL","LOGISTICS","OPERATIONS","PAYMENT_FEE","RESERVE","OTHER"].includes(cost.category))throw new Error("Unknown cost category");
    if(categories.has(cost.category))throw new Error("Duplicate cost category");
    categories.add(cost.category);
    const amountAmd=amd(cost.amountAmd,"Cost "+cost.category,{zero:true});
    manualCostAmd=safeAdd(manualCostAmd,amountAmd,"Manual costs");
    return {category:cost.category,amountAmd};
  });
  for(const category of REQUIRED_MANUAL_CATEGORIES)if(!categories.has(category))throw new Error("Missing manual cost "+category);
  const discount=amd(discountAmd,"Discount",{zero:true});
  if(discount>=grossPriceAmd)throw new Error("Discount cannot consume whole price");
  const priceAmd=amd(grossPriceAmd-discount,"Final price");
  const directCostAmd=safeAdd(driverPayoutAmd,manualCostAmd,"Direct costs");
  const profitAmd=priceAmd-directCostAmd;
  const marginBps=Math.floor(profitAmd*10000/priceAmd);
  return {grossPriceAmd,discountAmd:discount,priceAmd,driverPayoutAmd,manualCostAmd,directCostAmd,profitAmd,marginBps,belowMinimum:marginBps<minimumMarginBps,requiresOwnerApproval:discount>0||marginBps<minimumMarginBps,lines:mapped,costs:manualCosts};
}
