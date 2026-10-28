"use client";
import {useCallback,useEffect,useState} from "react";
type PendingQuote={
 id:string;version:number;createdAt:string;discountAmd:number;priceAmd:number;driverPayoutAmd:number;manualCostAmd:number;directCostAmd:number;marginBps:number;exceptionRequired:boolean;startsAt:string;endsAt:string;
 campaign:{id:string;status:string;quoteVersion:number;client:{name:string|null;email:string|null};targets:{quantity:number;location:{nameRu:string}}[]};
 costs:{category:string;amountAmd:number}[];lines:{quantity:number;unitPriceAmd:number;unitDriverRateAmd:number}[];
};
const amount=(x:number)=>new Intl.NumberFormat("ru-RU").format(x)+" ֏";
async function problem(res:Response){const x=await res.json().catch(()=>({error:"Ошибка запроса"}));return x.error??"Ошибка запроса"}
export default function OwnerQuoteApprovals(){
 const [quotes,setQuotes]=useState<PendingQuote[]>([]);
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState("");
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  try{const res=await fetch("/api/admin/quotes/pending",{cache:"no-store"});if(!res.ok)throw Error(await problem(res));
   setQuotes((await res.json()).quotes);
  }catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить сметы");}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 async function decide(quote:PendingQuote,decision:"APPROVE"|"REJECT"){
  setBusy(quote.id);setError("");setNotice("");
  try{
   const res=await fetch(`/api/admin/campaigns/${quote.campaign.id}/quotes/${quote.id}/decision`,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({decision,expectedVersion:quote.version,reason:notes[quote.id]?.trim()??""})
   });
   if(!res.ok)throw Error(await problem(res));
   setNotice(decision==="APPROVE"?"Смета утверждена. Платёж не выполнялся.":"Смета отклонена; менеджер может подготовить новую.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Не удалось обработать решение")}
  finally{setBusy("")}
 }
 return <div className="form">
  <h2>Сметы, ожидающие решения владельца</h2>
  <p className="small">Обязательно объясни решение. Любая скидка и маржинальность ниже 25% требуют твоего утверждения; действие сохраняется в журнале аудита.</p>
  {loading&&<p>Загрузка…</p>}
  {error&&<p role="alert" style={{color:"#ba2538"}}>{error}</p>}
  {notice&&<p role="status" style={{color:"#16783b"}}>{notice}</p>}
  {!loading&&quotes.length===0&&<p className="muted">Нет смет на утверждении.</p>}
  <div style={{display:"grid",gap:16}}>{quotes.map(q=><div className="card" key={q.id}>
    <h3>Заявка #{q.campaign.id.slice(0,8)} · смета №{q.version}</h3>
    <p className="small">{q.campaign.client.name??q.campaign.client.email??"Клиент"} · {q.campaign.targets.map(t=>t.location.nameRu+": "+t.quantity).join(", ")}</p>
    <p>Цена: <b>{amount(q.priceAmd)}</b> · Скидка: <b>{amount(q.discountAmd)}</b></p>
    <p>Водителям: {amount(q.driverPayoutAmd)} · Остальные прямые расходы: {amount(q.manualCostAmd)}</p>
    <p>Маржинальность: <b style={{color:q.marginBps<2500?"#bc2335":"#16763c"}}>{(q.marginBps/100).toFixed(2)}%</b>
    {q.exceptionRequired?" · Ниже допустимого уровня 25%":q.discountAmd>0?" · Скидка требует утверждения":""}</p>
    <p className="small">Период: {new Date(q.startsAt).toLocaleDateString("ru-RU")} – {new Date(q.endsAt).toLocaleDateString("ru-RU")}, окончание не включается. Версия №{q.version}, запрос {new Date(q.createdAt).toLocaleDateString("ru-RU")}.</p>
    <div className="field"><label>Причина решения (не менее 10 символов)</label><textarea minLength={10} maxLength={1000} value={notes[q.id]??""} placeholder="Например: согласована специальная скидка на запуск кампании…" onChange={e=>setNotes(old=>({...old,[q.id]:e.target.value}))}/></div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button type="button" disabled={!!busy||(notes[q.id]?.trim().length??0)<10} className="cta" onClick={()=>void decide(q,"APPROVE")}>Утвердить</button>
     <button type="button" disabled={!!busy||(notes[q.id]?.trim().length??0)<10} className="cta ghost" onClick={()=>void decide(q,"REJECT")}>Отклонить</button></div>
  </div>)}</div>
 </div>
}
