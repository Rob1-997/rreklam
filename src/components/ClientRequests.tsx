"use client";
import {useCallback,useEffect,useState} from "react";
import CampaignQuoteBuilder from "@/components/CampaignQuoteBuilder";
type Request={id:string;createdAt:string;status:string;client:{name:string|null;phone:string|null;email:string|null};targets:{id:string;packageId:string;quantity:number;location:{code:string;nameRu:string}}[]};
export default function ClientRequests(){
 const [requests,setRequests]=useState<Request[]>([]);
 const [open,setOpen]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{try{
   const res=await fetch("/api/admin/campaigns",{cache:"no-store"});const json=await res.json();
   if(!res.ok)throw Error(json.error??"Не удалось получить заявки");
   setRequests(json.campaigns);
  }catch(e){setError(e instanceof Error?e.message:"Ошибка заявок");}finally{setLoading(false)}},[]);
 useEffect(()=>{void refresh()},[refresh]);
 return <div><h2>Новые заявки рекламодателей · {requests.length}</h2>
  <p className="small">Утверждённые тарифы → расходы вручную → проверка 25% → согласование скидки или исключения владельцем. Заявка не резервирует машины и не списывает деньги.</p>
  {loading&&<p>Загрузка заявок…</p>}
  {error&&<p role="alert" style={{color:"#bd2439"}}>{error}</p>}
  {requests.length===0&&!loading?<p className="muted">Нет новых заявок для обработки.</p>:<div style={{display:"grid",gap:18}}>{requests.map(r=><div className="card" key={r.id}>
   <h3>{r.client.name||"Клиент"} · #{r.id.slice(0,8)}</h3>
   <p className="small">{r.client.phone||r.client.email||"Подтверждённый аккаунт"}</p>
   <p>{r.targets.map(x=>x.location.nameRu+": "+x.quantity).join(" · ")}</p>
   <p className="small">Создана {new Date(r.createdAt).toLocaleDateString("ru-RU")} · {r.status}</p>
   <button type="button" className="cta ghost" onClick={()=>setOpen(open===r.id?null:r.id)}>{open===r.id?"Скрыть смету":"Подготовить смету"}</button>
   {open===r.id&&<CampaignQuoteBuilder campaignId={r.id} targets={r.targets} onChanged={()=>void refresh()}/>}
  </div>)}</div>}
 </div>
}
