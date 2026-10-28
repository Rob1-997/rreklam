"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import type { Lang } from "@/lib/i18n";
export default function LoginForm({ lang }: { lang: Lang }) {
  const [phone,setPhone]=useState("+374");const [code,setCode]=useState("");const [status,setStatus]=useState("");const [busy,setBusy]=useState(false);
  const send=async()=>{setBusy(true);setStatus("");try{const r=await fetch("/api/auth/otp/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone})});setStatus(r.ok?"SMS code sent":"SMS temporarily unavailable or rate limited");}catch{setStatus("Unable to send SMS");}finally{setBusy(false)}};
  return <div className="form" style={{maxWidth:520,margin:"auto"}}><h1>{lang==="ru"?"Вход":lang==="hy"?"Մուտք":"Sign in"}</h1><button className="cta ghost" onClick={()=>signIn("google",{callbackUrl:`/${lang}/driver`})}>Google</button><div className="field" style={{marginTop:24}}><label>Телефон / Phone +374</label><input type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></div><button className="cta ghost" type="button" disabled={busy} onClick={send}>SMS code</button><div className="field" style={{marginTop:18}}><label>SMS code</label><input autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}/></div><button className="cta" disabled={busy||code.length!==6} type="button" onClick={()=>signIn("sms",{phone,code,callbackUrl:`/${lang}/driver`})}>Sign in</button><p role="status" className="small">{status}</p></div>;
}
