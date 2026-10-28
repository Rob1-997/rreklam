import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, respondError } from "@/lib/access";
export const runtime="nodejs";
export async function GET(){
  try{
    await requireRole("OWNER");
    const quotes=await prisma.campaignQuote.findMany({
      where:{status:"PENDING_OWNER"},take:100,orderBy:{createdAt:"asc"},
      select:{
        id:true,version:true,createdAt:true,discountAmd:true,priceAmd:true,driverPayoutAmd:true,manualCostAmd:true,
        directCostAmd:true,marginBps:true,exceptionRequired:true,startsAt:true,endsAt:true,
        campaign:{select:{id:true,status:true,quoteVersion:true,client:{select:{name:true,email:true}},targets:{select:{quantity:true,location:{select:{nameRu:true}}}}}},
        costs:{select:{category:true,amountAmd:true}},
        lines:{select:{quantity:true,unitPriceAmd:true,unitDriverRateAmd:true}}
      }
    });
    return NextResponse.json({quotes},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return respondError(error)}
}
