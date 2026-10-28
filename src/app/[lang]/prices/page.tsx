import Link from "next/link";
import {notFound} from "next/navigation";
import {prisma} from "@/lib/prisma";
import {copy,validLang} from "@/lib/i18n";
export const dynamic="force-dynamic";
const amount=(n:number)=>new Intl.NumberFormat("ru-RU").format(n)+" AMD";
export default async function Prices({params,searchParams}:{params:Promise<{lang:string}>,searchParams:Promise<{city?:string}>}){
 const {lang}=await params;if(!validLang(lang))notFound();
 const {city}=await searchParams;const t=copy[lang];
 let cities:{code:string;nameHy:string;nameRu:string;nameEn:string}[]=[];
 let rows:{priceAmd:number;package:{format:string;durationDays:number};location:{code:string;nameHy:string;nameRu:string;nameEn:string}}[]=[];
 let unavailable=false;
 try{
  cities=await prisma.location.findMany({where:{kind:"CITY"},select:{code:true,nameHy:true,nameRu:true,nameEn:true},orderBy:{nameRu:"asc"}});
  rows=await prisma.packageCityPrice.findMany({
   where:{ownerApprovedAt:{not:null},package:{active:true}},
   select:{priceAmd:true,location:{select:{code:true,nameHy:true,nameRu:true,nameEn:true}},package:{select:{format:true,durationDays:true}}}
  });
 }catch{unavailable=true}
 const selected=city&&cities.some(c=>c.code===city)?city:cities[0]?.code;
 const priced=rows.filter(x=>x.location.code===selected).sort((a,b)=>a.package.durationDays-b.package.durationDays||a.package.format.localeCompare(b.package.format));
 const caption=lang==="ru"?"Стоимость за один автомобиль, включая изготовление и оклейку. Все цены в AMD. Менеджер подтверждает доступность и окончательные условия.":lang==="hy"?"Մեկ մեքենայի արժեքը՝ ներառյալ պատրաստումն ու փակցնելը։ Վերջնական պայմանները հաստատում է մենեջերը։":"Price per vehicle, including manufacturing and installation. A manager confirms availability and final terms.";
 const empty=lang==="ru"?"Для выбранного города утверждённых тарифов пока нет. Менеджер может подготовить индивидуальное предложение.":lang==="hy"?"Այս քաղաքի հաստատված սակագները դեռ հասանելի չեն։":"Approved tariffs for this city are not available yet.";
 return <div className="shell"><section><span className="pill">RReklam · Armenia</span><h1>{t.prices}</h1><p className="lead">{caption}</p>
  <div className="form"><form method="GET" style={{maxWidth:450}}><label>{lang==="ru"?"Город":lang==="hy"?"Քաղաք":"City"}</label><div style={{display:"flex",gap:12}}><select name="city" defaultValue={selected}>{cities.map(c=><option key={c.code} value={c.code}>{c[lang==="hy"?"nameHy":lang==="ru"?"nameRu":"nameEn"]}</option>)}</select><button type="submit" className="cta">{lang==="ru"?"Выбрать":lang==="hy"?"Ընտրել":"Select"}</button></div></form>
   {unavailable?<p className="small">Цены временно недоступны. Попробуйте позднее.</p>:priced.length===0?<p className="small">{empty}</p>:
   <div style={{overflowX:"auto",marginTop:24}}><table style={{width:"100%",textAlign:"left",borderSpacing:"0 12px"}}><thead><tr><th>Формат</th><th>Срок</th><th>За автомобиль</th></tr></thead><tbody>
    {priced.map(x=><tr key={x.package.format+"-"+x.package.durationDays}><td>{x.package.format.replaceAll("_"," ")}</td><td>{x.package.durationDays}</td><td><b>{amount(x.priceAmd)}</b></td></tr>)}
   </tbody></table></div>}
   <p className="small">{lang==="ru"?"Здесь показаны только официально утверждённые владельцем тарифы. Количество доступных автомобилей не раскрывается.":lang==="hy"?"Ցուցադրված են միայն հաստատված սակագները։ Մեքենաների քանակը գաղտնի է։":"Only owner-approved prices are listed. Available vehicle counts remain private."}</p>
   <Link href={`/${lang}/request`} className="cta">{t.order}</Link>
  </div></section></div>
}
