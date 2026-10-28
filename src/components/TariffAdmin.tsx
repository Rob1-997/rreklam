"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
type City={id:string;code:string;nameRu:string};
type Package={id:string;code:string;format:string;durationDays:number;active:boolean;prices:{locationId:string;priceAmd:number;ownerApprovedAt:string|null}[];driverRates:{locationId:string;amountAmd:number;ownerApprovedAt:string|null}[]};
type Proposal={id:string;packageId:string;locationId:string;suggestedPriceAmd:number;reason:string;createdAt:string};
type TariffData={cities:City[];packages:Package[];proposals:Proposal[]};
const money=(n:number)=>new Intl.NumberFormat("ru-RU").format(n)+" ֏";
async function problem(res:Response){const json=await res.json().catch(()=>({error:"Ошибка сети"}));return json.error??"Операция отклонена";}
export default function TariffAdmin({isOwner}:{isOwner:boolean}){
 const [data,setData]=useState<TariffData>({cities:[],packages:[],proposals:[]});
 const [city,setCity]=useState("");const [packageId,setPackageId]=useState("");
 const [price,setPrice]=useState(0);const [payout,setPayout]=useState(0);const [reason,setReason]=useState("");
 const [error,setError]=useState("");const [success,setSuccess]=useState("");
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{
  try{
   const res=await fetch("/api/admin/tariffs",{cache:"no-store"});if(!res.ok)throw Error(await problem(res));
   const result=await res.json() as TariffData;
   setData(result);setCity(old=>old||result.cities[0]?.code||"");setPackageId(old=>old||result.packages[0]?.id||"");
  }catch(e){setError(e instanceof Error?e.message:"Не удалось получить тарифы")}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 const selectedCity=data.cities.find(x=>x.code===city);
 const pkg=data.packages.find(x=>x.id===packageId);
 const current=useMemo(()=>{
  const locationId=selectedCity?.id;
  return {price:pkg?.prices.find(x=>x.locationId===locationId&&x.ownerApprovedAt)?.priceAmd,
          rate:pkg?.driverRates.find(x=>x.locationId===locationId&&x.ownerApprovedAt)?.amountAmd};
 },[pkg,selectedCity]);
 useEffect(()=>{setPrice(current.price??0);setPayout(current.rate??0)},[current.price,current.rate,city,packageId]);
 async function save(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");setSuccess("");
  try{
   const res=await fetch(isOwner?"/api/admin/tariffs":"/api/admin/tariffs/proposals",{
    method:isOwner?"PUT":"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(isOwner?{cityCode:city,packageId,priceAmd:price,driverRateAmd:payout}:{cityCode:city,packageId,suggestedPriceAmd:price,reason})
   });
   if(!res.ok)throw Error(await problem(res));
   setSuccess(isOwner?"Тариф утверждён владельцем.":"Предложение отправлено владельцу.");setReason("");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения")}finally{setBusy(false)}
 }
 async function decide(p:Proposal,decision:"APPROVE"|"REJECT"){
  let body:object;
  if(decision==="APPROVE"){
   const suggestion=data.packages.find(x=>x.id===p.packageId)?.driverRates.find(x=>x.locationId===p.locationId)?.amountAmd??0;
   const input=window.prompt("Утверждённая выплата водителю за машину (AMD):",String(suggestion));
   if(input===null)return;
   const amount=Number(input);
   if(!Number.isInteger(amount)||amount<=0){setError("Некорректная выплата водителю");return}
   body={decision,driverRateAmd:amount};
  }else{
   const reason=window.prompt("Причина отклонения (от 10 символов):");
   if(!reason)return;
   body={decision,reason};
  }
  setBusy(true);setError("");setSuccess("");
  try{
   const res=await fetch(`/api/admin/tariffs/proposals/${p.id}/decision`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(!res.ok)throw Error(await problem(res));
   setSuccess(decision==="APPROVE"?"Новую цену утвердил владелец.":"Предложение отклонено.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Ошибка решения")}finally{setBusy(false)}
 }
 return <div className="form">
  <h2>Тарифы RReklam · AMD</h2>
  <p className="small">Только подтверждённые владельцем цены и выплаты используются для смет. Цены из демонстрационной Excel-модели сюда не загружаются автоматически.</p>
  {loading&&<p>Загрузка тарифов…</p>}
  {error&&<p role="alert" style={{color:"#b91c32"}}>{error}</p>}
  {success&&<p role="status" style={{color:"#17723a"}}>{success}</p>}
  <form onSubmit={save}>
   <div className="cols">
    <div className="field"><label>Город</label><select value={city} onChange={e=>setCity(e.target.value)}>{data.cities.map(x=><option key={x.id} value={x.code}>{x.nameRu}</option>)}</select></div>
    <div className="field"><label>Формат · срок</label><select value={packageId} onChange={e=>setPackageId(e.target.value)}>{data.packages.map(x=><option key={x.id} value={x.id}>{x.format} · {x.durationDays} дней</option>)}</select></div>
   </div>
   {pkg&&<p className="small">Утверждено сейчас: цена клиенту <b>{current.price?money(current.price):"нет"}</b> · водителю <b>{current.rate?money(current.rate):"нет"}</b>.</p>}
   <div className="cols">
    <div className="field"><label>{isOwner?"Цена клиенту за 1 машину (AMD)":"Предлагаемая цена клиенту (AMD)"}</label><input type="number" min={1} max={2147483647} value={price} onChange={e=>setPrice(Number(e.target.value))} required/></div>
    {isOwner&&<div className="field"><label>Утверждённая ставка водителя (AMD)</label><input type="number" min={1} max={2147483647} value={payout} onChange={e=>setPayout(Number(e.target.value))} required/></div>}
   </div>
   {!isOwner&&<div className="field"><label>Причина предложения (не менее 10 символов)</label><textarea required minLength={10} maxLength={800} value={reason} onChange={e=>setReason(e.target.value)}/></div>}
   <button className="cta" type="submit" disabled={busy||!city||!packageId||price<=0||(isOwner?payout<=0:reason.trim().length<10)}>{isOwner?"Утвердить тариф":"Предложить изменение владельцу"}</button>
  </form>
  {!!data.proposals.length&&<div style={{marginTop:28}}><h3>{isOwner?"Предложения менеджеров на утверждение":"Мои предложения на рассмотрении"}</h3>
   <div className="cards">{data.proposals.map(p=><div className="card" key={p.id}>
    <h3>{data.cities.find(x=>x.id===p.locationId)?.nameRu??"Город"} · {data.packages.find(x=>x.id===p.packageId)?.code??"Пакет"}</h3>
    <p>Предложено: <b>{money(p.suggestedPriceAmd)}</b></p><p className="small">{p.reason}</p>
    {isOwner&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" disabled={busy} className="cta" onClick={()=>void decide(p,"APPROVE")}>Утвердить</button><button type="button" disabled={busy} className="cta ghost" onClick={()=>void decide(p,"REJECT")}>Отклонить</button></div>}
   </div>)}</div></div>}
 </div>;
}
