import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
export const runtime="nodejs";
export async function GET(){
 try{
  const prices=await prisma.packageCityPrice.findMany({
   where:{ownerApprovedAt:{not:null},package:{active:true}},
   select:{
    priceAmd:true,
    location:{select:{code:true,nameHy:true,nameRu:true,nameEn:true}},
    package:{select:{format:true,durationDays:true}}
   }
  });
  return NextResponse.json({currency:"AMD",tariffs:prices},{headers:{"Cache-Control":"public, max-age=60"}});
 }catch{return NextResponse.json({error:"Tariffs unavailable"},{status:503})}
}
