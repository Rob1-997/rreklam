"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import type { Lang } from "@/lib/i18n";
export default function LoginForm({ lang, returnTo, showLocalDemo }: { lang: Lang; returnTo: string; showLocalDemo: boolean }) {
  const [localPassword,setLocalPassword]=useState("");
  const [localStatus,setLocalStatus]=useState("");
  const [phone,setPhone]=useState("+374");const [code,setCode]=useState("");const [status,setStatus]=useState("");const [busy,setBusy]=useState(false);
  const send=async()=>{setBusy(true);setStatus("");try{const r=await fetch("/api/auth/otp/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone})});setStatus(r.ok?"SMS code sent":"SMS temporarily unavailable or rate limited");}catch{setStatus("Unable to send SMS");}finally{setBusy(false)}};
  const loginLocal=async()=>{
    if(busy||!localPassword)return;
    setBusy(true);setLocalStatus("Проверяем локальный вход…");
    try{
      const result=await signIn("local-owner",{password:localPassword,redirect:false,redirectTo:`/${lang}/admin`});
      if(!result?.ok || result.error){
        setLocalStatus(result?.error==="CredentialsSignin"
          ?"Вход отклонён. Проверь пароль и создание тестового владельца (команда ниже)."
          :"Не удалось войти. Проверь настройки .env и сообщения PowerShell.");
        return;
      }
      setLocalStatus("Вход выполнен. Открываю панель владельца…");
      window.location.replace(`/${lang}/admin`);
    }catch{
      setLocalStatus("Ошибка подключения. Проверь, запущен ли сервер Next.js, и посмотри сообщения в PowerShell.");
    }finally{setBusy(false);}
  };
  return <div className="form" style={{maxWidth:520,margin:"auto"}}><h1>{lang==="ru"?"Вход":lang==="hy"?"Մուտք":"Sign in"}</h1>{showLocalDemo&&<div className="card" style={{marginBottom:24,borderColor:"#c5d6fb"}}>
    <span className="pill">LOCAL DEVELOPMENT ONLY</span>
    <h2 style={{fontSize:23}}>Тестовый вход владельца</h2>
    <p className="small">Работает только локально. Пароль находится в файле .env твоего компьютера.</p>
    <div className="field"><label>Локальный пароль</label><input type="password" autoComplete="off" value={localPassword} onChange={e=>setLocalPassword(e.target.value)} /></div>
    <button type="button" className="cta" disabled={busy||!localPassword} onClick={loginLocal}>{busy?"Выполняется вход…":"Войти как владелец"}</button>
    {localStatus&&<p role="status" aria-live="polite" style={{color:localStatus.includes("Вход выполнен")?"#126e39":"#a52c34",fontWeight:700}}>{localStatus}</p>}
    <p className="small">Если вход отклонён: в PowerShell из папки проекта выполни <code>npx tsx scripts/bootstrap-local-owner.ts</code>. Пароль никому не отправляй.</p>
  </div>}
  <button className="cta ghost" onClick={()=>signIn("google",{callbackUrl:returnTo})}>Google</button><div className="field" style={{marginTop:24}}><label>Телефон / Phone +374</label><input type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></div><button className="cta ghost" type="button" disabled={busy} onClick={send}>SMS code</button><div className="field" style={{marginTop:18}}><label>SMS code</label><input autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}/></div><button className="cta" disabled={busy||code.length!==6} type="button" onClick={()=>signIn("sms",{phone,code,callbackUrl:returnTo})}>Sign in</button><p role="status" className="small">{status}</p></div>;
}
