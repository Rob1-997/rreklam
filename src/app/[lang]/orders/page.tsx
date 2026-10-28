import Link from "next/link";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {validLang} from "@/lib/i18n";
import {redirect,notFound} from "next/navigation";
export const dynamic="force-dynamic";
const amount=(n:number)=>new Intl.NumberFormat("ru-RU").format(n)+" AMD";
export default async function Orders({params}:{params:Promise<{lang:string}>}){
 const {lang}=await params;if(!validLang(lang))notFound();
 const session=await auth();
 if(!session?.user?.id)redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/orders`)}`);
 const user=await prisma.user.findUnique({where:{id:session.user.id},select:{phoneVerifiedAt:true,status:true}});
 if(!user?.phoneVerifiedAt||user.status==="SUSPENDED")return <div className="shell"><section><h1>{lang==="ru"?"Подтвердите телефон":lang==="hy"?"Հաստատեք հեռախոսը":"Verify your phone"}</h1><Link className="cta" href={`/${lang}/driver`}>Verify phone</Link></section></div>;
 const campaigns=await prisma.campaign.findMany({where:{clientId:session.user.id},take:50,orderBy:{createdAt:"desc"},select:{
  id:true,status:true,createdAt:true,quotePriceAmd:true,marginBps:false,
  targets:{select:{quantity:true,location:{select:{nameRu:true,nameHy:true,nameEn:true}},packageId:true}},
  quotes:{where:{status:"APPROVED"},take:1,orderBy:{version:"desc"},select:{version:true,startsAt:true,endsAt:true,priceAmd:true}}
 }});
 return <div className="shell"><section><span className="pill">RReklam</span><h1>{lang==="ru"?"Мои заявки":lang==="hy"?"Իմ հայտերը":"My requests"}</h1><p className="lead">{lang==="ru"?"Менеджер проверяет доступность, стоимость и сроки. Отправленная заявка не резервирует машины и не является оплатой.":lang==="hy"?"Ձեր հայտերի կարգավիճակը և հաստատված առաջարկները։":"Review your requests and manager-approved quotations."}</p>
 {campaigns.length===0?<div className="card"><p>Заявок пока нет.</p><Link className="cta" href={`/${lang}/request`}>Создать заявку</Link></div>:<div style={{display:"grid",gap:18}}>{campaigns.map(c=><div className="card" key={c.id}>
  <h3>#{c.id.slice(0,8)} · {c.status}</h3>
  <p className="small">{new Date(c.createdAt).toLocaleDateString("ru-RU")}</p>
  <p>{c.targets.map(t=>`${t.location[lang==="ru"?"nameRu":lang==="hy"?"nameHy":"nameEn"]}: ${t.quantity}`).join(" · ")}</p>
  {c.quotes[0]&&c.quotePriceAmd!==null?<><p>Утверждённая стоимость: <b>{amount(c.quotePriceAmd)}</b></p><p className="small">Срок кампании согласован менеджером. Онлайн-оплата пока не подключена, деньги не списывались.</p></>:<p className="small">Ожидает расчёта и подтверждения менеджера. Итоговая цена ещё не утверждена.</p>}
 </div>)}</div>}</section></div>;
}
