"use client";
import Link from "next/link";
import { useState } from "react";
import { cities, copy, type Lang } from "@/lib/i18n";
type Target={key:number;cityId:string;quantity:number};
const formatOptions=[["REAR_WINDOW","Rear window"],["DOORS","Doors"],["PARTIAL","Partial wrap"],["FULL","Full wrap"]] as const;
const words={
  ru:{city:"Города и количество машин",add:"Добавить город",format:"Формат размещения",period:"Период",days:"дней",preview:"Предпросмотр заявки",send:"Отправить заявку менеджеру",login:"Войдите, чтобы отправить заявку",pending:"Заявка сохранена. Менеджер проверит наличие машин и согласует цену.",notice:"Отправка заявки не означает бронирование машин или оплату. Цены ещё не утверждены.",sending:"Отправляем..."},
  hy:{city:"Քաղաքներ և մեքենաների քանակ",add:"Ավելացնել քաղաք",format:"Գովազդի տեսակ",period:"Տևողություն",days:"օր",preview:"Հայտի նախադիտում",send:"Ուղարկել հարցում",login:"Մուտք գործեք հայտ ուղարկելու համար",pending:"Հայտը գրանցվել է։ Մենեջերը կհաստատի մեքենաներն ու գինը։",notice:"Հայտի ուղարկումը ամրագրում կամ վճարում չէ։ Գները դեռ հաստատված չեն։",sending:"Ուղարկվում է..."},
  en:{city:"Cities and number of vehicles",add:"Add city",format:"Advertising format",period:"Duration",days:"days",preview:"Preview request",send:"Send request to manager",login:"Sign in to submit a request",pending:"Request saved. A manager will confirm vehicles and final price.",notice:"A request is not a reservation or payment. Prices are not yet approved.",sending:"Submitting..."}
};
export default function RequestForm({lang}:{lang:Lang}){
  const t=copy[lang],w=words[lang];
  const [targets,setTargets]=useState<Target[]>([{key:1,cityId:"yerevan",quantity:5}]);
  const [nextKey,setNextKey]=useState(2);
  const [period,setPeriod]=useState(30);
  const [format,setFormat]=useState<typeof formatOptions[number][0]>("REAR_WINDOW");
  const [preview,setPreview]=useState(false);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");const [savedId,setSavedId]=useState("");
  const [loginRequired,setLoginRequired]=useState(false);
  const valid=targets.length>0&&targets.every(x=>Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=1000)&&new Set(targets.map(x=>x.cityId)).size===targets.length;
  const invalidate=()=>{setPreview(false);setSavedId("");setError("");setLoginRequired(false)};
  const add=()=>{const next=cities.find(c=>!targets.some(t=>t.cityId===c.id));if(!next)return;setTargets([...targets,{key:nextKey,cityId:next.id,quantity:1}]);setNextKey(nextKey+1);invalidate()};
  async function submit(){
    if(!valid)return;setSending(true);setError("");setLoginRequired(false);
    try{
      const response=await fetch("/api/client/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        format,durationDays:period,cities:targets.map(x=>({cityCode:x.cityId,quantity:x.quantity}))
      })});
      if(!response.ok){
        if(response.status===401||response.status===403)setLoginRequired(true);
        const json=await response.json().catch(()=>({error:"Request failed"}));
        throw Error(json.error??"Request failed");
      }
      const data=await response.json();setSavedId(data.id);
    }catch(e){setError(e instanceof Error?e.message:"Request failed");}finally{setSending(false)}
  }
  return <div className="cols"><div><span className="pill">RReklam</span><h1>{t.order}</h1><p className="lead">{t.intro}</p><p className="small">{t.private}</p></div><div className="form"><h2>{t.order}</h2>
    <label>{w.city}</label>{targets.map(x=><div className="cityrow" key={x.key}>
      <select aria-label="City" value={x.cityId} onChange={e=>{setTargets(targets.map(v=>v.key===x.key?{...v,cityId:e.target.value}:v));invalidate()}}>
      {cities.map(c=><option key={c.id} value={c.id} disabled={targets.some(y=>y.key!==x.key&&y.cityId===c.id)}>{c[lang]}</option>)}</select>
      <input aria-label="Vehicle quantity" type="number" min={1} max={1000} value={x.quantity} onChange={e=>{setTargets(targets.map(v=>v.key===x.key?{...v,quantity:Number(e.target.value)}:v));invalidate()}}/>
      <button className="cta ghost" disabled={targets.length===1} onClick={()=>{setTargets(targets.filter(y=>y.key!==x.key));invalidate()}} aria-label="Remove city" type="button">×</button>
    </div>)}
    <button className="cta ghost" disabled={targets.length===cities.length} type="button" onClick={add}>+ {w.add}</button>
    <div className="cols" style={{marginTop:24}}><div className="field"><label>{w.format}</label><select value={format} onChange={e=>{setFormat(e.target.value as typeof format);invalidate()}}>{formatOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><div className="field"><label>{w.period}</label><select value={period} onChange={e=>{setPeriod(Number(e.target.value));invalidate()}}>{[7,14,30,90].map(d=><option key={d} value={d}>{d} {w.days}</option>)}</select></div></div>
    <p className="small">{w.notice}</p>
    <button type="button" className="cta ghost" disabled={!valid} onClick={()=>setPreview(true)}>{w.preview}</button>
    {preview&&<div className="card" style={{marginTop:15}}><h3>{w.preview}</h3><p>{targets.map(x=>`${cities.find(c=>c.id===x.cityId)?.[lang]}: ${x.quantity}`).join(" · ")}</p><p>{formatOptions.find(x=>x[0]===format)?.[1]} · {period} {w.days}</p><p className="small">{w.notice}</p>
      {!savedId&&<button className="cta" type="button" disabled={sending||!valid} onClick={submit}>{sending?w.sending:w.send}</button>}
      {savedId&&<p role="status" style={{color:"#16783e"}}><b>{w.pending}</b><br/><small>Request ID: {savedId}</small></p>}
    </div>}
    {error&&<p role="alert" style={{color:"#ba2535"}}>{error}</p>}
    {loginRequired&&<Link className="cta ghost" href={`/${lang}/login?next=${encodeURIComponent(`/${lang}/request`)}`}>{w.login}</Link>}
  </div></div>;
}
