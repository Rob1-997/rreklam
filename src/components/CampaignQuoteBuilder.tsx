"use client";
import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
type Target={id:string;packageId:string;quantity:number;location:{code:string;nameRu:string}};
type Campaign={id:string;status:string;quoteVersion:number;quotes:{id:string;version:number;status:string;priceAmd:number;discountAmd:number;marginBps:number;exceptionRequired:boolean}[]};
type Package={id:string;code:string;active:boolean;prices:{locationId:string;priceAmd:number;ownerApprovedAt:string|null}[];driverRates:{locationId:string;amountAmd:number;ownerApprovedAt:string|null}[]};
type City={id:string;code:string;nameRu:string};
type FinanceCategory="PRINT"|"INSTALL"|"REMOVAL"|"LOGISTICS"|"OPERATIONS"|"PAYMENT_FEE"|"RESERVE"|"OTHER";
const costInputs:{category:FinanceCategory;label:string}[]=[
 {category:"PRINT",label:"Печать и материалы"},
 {category:"INSTALL",label:"Монтаж / оклейка"},
 {category:"REMOVAL",label:"Снятие рекламы"},
 {category:"LOGISTICS",label:"Логистика"},
 {category:"OPERATIONS",label:"Контроль / операции"},
 {category:"PAYMENT_FEE",label:"Комиссия оплаты"},
 {category:"RESERVE",label:"Резерв на обслуживание"},
 {category:"OTHER",label:"Прочие прямые расходы"}
];
const formatAMD=(n:number)=>new Intl.NumberFormat("ru-RU").format(n)+" AMD";
async function fetchError(res:Response){return (await res.json().catch(()=>({error:"Ошибка запроса"}))).error??"Ошибка запроса";}
export default function CampaignQuoteBuilder({campaignId,targets,onChanged}:{campaignId:string;targets:Target[];onChanged:()=>void}){
 const [campaign,setCampaign]=useState<Campaign|null>(null);
 const [cityMap,setCityMap]=useState<City[]>([]);
 const [packages,setPackages]=useState<Package[]>([]);
 const [startDate,setStartDate]=useState("");
 const [discount,setDiscount]=useState(0);
 const [costValues,setCostValues]=useState<Record<FinanceCategory,string>>({
  PRINT:"",INSTALL:"",REMOVAL:"",LOGISTICS:"",OPERATIONS:"",PAYMENT_FEE:"",RESERVE:"",OTHER:""
 });
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const refresh=useCallback(async()=>{
  try{
   const responses=await Promise.all([fetch(`/api/admin/campaigns/${campaignId}/quotes`,{cache:"no-store"}),fetch("/api/admin/tariffs",{cache:"no-store"})]);
   for(const res of responses)if(!res.ok)throw Error(await fetchError(res));
   const [quoteResult,tariffs]=await Promise.all(responses.map(x=>x.json()));
   setCampaign(quoteResult.campaign);setPackages(tariffs.packages);setCityMap(tariffs.cities);
  }catch(e){setError(e instanceof Error?e.message:"Смета недоступна");}finally{setLoading(false)}
 },[campaignId]);
 useEffect(()=>{void refresh()},[refresh]);
 const rows=useMemo(()=>targets.map(t=>{
  const city=cityMap.find(c=>c.code===t.location.code);
  const pkg=packages.find(p=>p.id===t.packageId);
  const price=pkg?.prices.find(p=>p.locationId===city?.id&&!!p.ownerApprovedAt)?.priceAmd;
  const payout=pkg?.driverRates.find(r=>r.locationId===city?.id&&!!r.ownerApprovedAt)?.amountAmd;
  return {...t,unitPriceAmd:price,unitDriverRateAmd:payout,packageName:pkg?.code??"Пакет"};
 }),[targets,cityMap,packages]);
 const allPriced=rows.length>0&&rows.every(r=>r.unitPriceAmd!==undefined&&r.unitDriverRateAmd!==undefined);
 const gross=rows.reduce((sum,x)=>sum+(x.unitPriceAmd??0)*x.quantity,0);
 const payouts=rows.reduce((sum,x)=>sum+(x.unitDriverRateAmd??0)*x.quantity,0);
 const manual=costInputs.reduce((sum,x)=>sum+(costValues[x.category]||0),0);
 const net=gross-discount,paymentCosts=manual+payouts;
 const margin=net>0?(net-paymentCosts)*100/net:null;
 const needsOwner=discount>0||(margin!==null&&margin<25);
 const pending=campaign?.quotes[0]?.status==="PENDING_OWNER";
 const canCreate=campaign?.status==="REVIEW"&&!pending&&allPriced&&startDate.length===10&&net>0&&!busy&&costInputs.every(c=>costValues[c.category]!==""&&Number.isSafeInteger(Number(costValues[c.category]))&&Number(costValues[c.category])>=0);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");setMessage("");
  try{
   const res=await fetch(`/api/admin/campaigns/${campaignId}/quotes`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    expectedQuoteVersion:campaign?.quoteVersion,startDate,discountAmd:discount,
    costs:costInputs.map(x=>({category:x.category,amountAmd:Number(costValues[x.category])}))
   })});
   if(!res.ok)throw Error(await fetchError(res));
   const saved=(await res.json()).quote;
   setMessage(saved.status==="PENDING_OWNER"?"Смета передана владельцу для утверждения.":"Смета согласована по стандартным правилам. Оплата пока не подключена.");
   await refresh();onChanged();
  }catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить смету");}finally{setBusy(false)}
 }
 return <div className="form" style={{marginTop:15,background:"#f8fbff"}}>
  <h3>Смета для заявки #{campaignId.slice(0,8)}</h3>
  {loading&&<p className="small">Загрузка утверждённых тарифов…</p>}
  {error&&<p role="alert" style={{color:"#bb2735"}}>{error}</p>}
  {message&&<p role="status" style={{color:"#12783e"}}>{message}</p>}
  {campaign?.quotes[0]&&<p className="small">Последняя версия: №{campaign.quotes[0].version} · {campaign.quotes[0].status} · {formatAMD(campaign.quotes[0].priceAmd)} · {((campaign.quotes[0].marginBps)/100).toFixed(2)}%</p>}
  {pending&&<p className="small"><b>Ожидает владельца.</b> До решения новая версия запрещена.</p>}
  <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderSpacing:"0 10px",fontSize:13}}>
  <thead><tr><th>Город</th><th>Машин</th><th>Цена / 1</th><th>Водителю / 1</th></tr></thead>
  <tbody>{rows.map(row=><tr key={row.id}><td>{row.location.nameRu}</td><td>{row.quantity}</td><td>{row.unitPriceAmd!==undefined?formatAMD(row.unitPriceAmd):"Нет тарифа"}</td><td>{row.unitDriverRateAmd!==undefined?formatAMD(row.unitDriverRateAmd):"Нет ставки"}</td></tr>)}</tbody>
  </table></div>
  {!allPriced&&<p className="small" style={{color:"#a51e36"}}>Утвердите цену и выплату водителю для всех указанных городов во вкладке тарифов.</p>}
  <form onSubmit={submit}>
   <div className="cols">
    <div className="field"><label>Дата начала рекламы (Армения)</label><input type="date" required value={startDate} onChange={e=>setStartDate(e.target.value)}/></div>
    <div className="field"><label>Предлагаемая скидка (AMD, требует владельца)</label><input type="number" min={0} max={2147483647} required value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></div>
   </div>
   <h3>Прямые расходы по кампании · ручной ввод</h3>
   <p className="small">Каждую категорию необходимо проверить; ноль означает подтверждённое отсутствие затрат. Выплаты водителям рассчитываются из утверждённых ставок автоматически.</p>
   <div className="cols">{costInputs.map(x=><div className="field" key={x.category}><label>{x.label} (AMD)</label><input type="number" min={0} max={2147483647} required value={costValues[x.category]} placeholder="0 — если затрат нет" onChange={e=>setCostValues(old=>({...old,[x.category]:e.target.value}))}/></div>)}</div>
   <div className="card" style={{marginBottom:18}}><h3>Предварительная экономика</h3>
    <p>Тарифы: <b>{formatAMD(gross)}</b> · Скидка: {formatAMD(discount)}</p>
    <p>Водителям: {formatAMD(payouts)} · Остальные расходы: {formatAMD(manual)}</p>
    <p>Предварительная цена: <b>{formatAMD(net)}</b></p>
    <p>Маржинальность: <b style={{color:margin!==null&&margin<25?"#bf2336":"#18713d"}}>{margin===null?"—":margin.toFixed(2)+"%"}</b></p>
    <p className="small">{needsOwner?"Нужно персональное решение владельца с причиной.":"При отсутствии скидки и марже от 25% действует стандартное согласование."}</p>
   </div>
   <button className="cta" disabled={!canCreate} type="submit">{busy?"Сохраняем…":"Сохранить смету и направить на согласование"}</button>
  </form>
  <p className="small">Это расчёт маржинального дохода, не чистой прибыли. Налоги и общехозяйственные расходы здесь не рассчитываются.</p>
 </div>;
}
