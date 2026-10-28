"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { cities, type Lang } from "@/lib/i18n";
type DriverProfile={id:string;driverType:string;approvedAt:string|null;primaryCity:{code:string;nameHy:string;nameRu:string;nameEn:string}};
type Vehicle={id:string;brand:string;model:string;year:number;plate:string;status:string;photos:{kind:string}[];serviceAreas:{location:{code:string;nameRu:string}}[]};
const bodyTypes=[["sedan","Sedan"],["hatchback","Hatchback"],["suv","SUV"],["minivan","Minivan"],["van","Van"],["wagon","Wagon"],["coupe","Coupe"],["other","Other"]] as const;
const sides=["front","back","left","right"] as const;
function cityLabel(code:string,lang:Lang){return cities.find(c=>c.id===code)?.[lang]??code;}
async function readError(res:Response){const x=await res.json().catch(()=>({error:"Request failed"}));return x.error??"Request failed"}
export default function DriverPortal({lang}:{lang:Lang}){
  const [profile,setProfile]=useState<DriverProfile|null>(null);
  const [vehicles,setVehicles]=useState<Vehicle[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [driverType,setDriverType]=useState<"PRIVATE"|"TAXI">("PRIVATE");
  const [primaryCity,setPrimaryCity]=useState("gyumri");
  const [acceptTerms,setAcceptTerms]=useState(false);
  const [brand,setBrand]=useState("");const [model,setModel]=useState("");const [year,setYear]=useState(new Date().getFullYear()-5);
  const [plate,setPlate]=useState("");const [bodyTypeCode,setBodyTypeCode]=useState("sedan");
  const [legalBasis,setLegalBasis]=useState<"OWNER"|"AUTHORIZED_DRIVER">("OWNER");
  const [ownerPermissionConfirmed,setOwnerPermissionConfirmed]=useState(false);
  const [cityCodes,setCityCodes]=useState<string[]>(["gyumri"]);
  const [photos,setPhotos]=useState<Record<string,File|undefined>>({});
  const [busy,setBusy]=useState(false);
  const [linkPhone,setLinkPhone]=useState("+374");const [phoneCode,setPhoneCode]=useState("");const [phoneUnverified,setPhoneUnverified]=useState(false);
  const refresh=useCallback(async()=>{
    const p=await fetch("/api/driver/profile",{cache:"no-store"});
    if(p.status===403){setPhoneUnverified(true);setLoading(false);return;}
    if(!p.ok){setError(await readError(p));setLoading(false);return;}
    setPhoneUnverified(false);
    setProfile((await p.json()).profile);
    const v=await fetch("/api/vehicles",{cache:"no-store"});
    if(v.ok)setVehicles((await v.json()).vehicles);
    setLoading(false);
  },[]);
  useEffect(()=>{void refresh()},[refresh]);
  async function submitDriver(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");setMessage("");
    try{const r=await fetch("/api/driver/profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({driverType,primaryCityCode:primaryCity,acceptTerms})});if(!r.ok)throw Error(await readError(r));await refresh();setMessage("Application submitted. A manager will verify your profile.");}catch(e){setError(e instanceof Error?e.message:"Submission failed");}finally{setBusy(false)}
  }
  async function submitVehicle(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");setMessage("");
    try{
      const form=new FormData();form.append("details",JSON.stringify({brand,model,year:Number(year),plate,bodyTypeCode,cityCodes,legalBasis,ownerPermissionConfirmed}));
      for(const side of sides){const photo=photos[side];if(!photo)throw Error("Upload all four vehicle photos");form.append(side,photo)}
      const r=await fetch("/api/vehicles",{method:"POST",body:form});if(!r.ok)throw Error(await readError(r));
      setMessage("Vehicle submitted. It will not be offered to clients until manager approval.");
      setBrand("");setModel("");setPlate("");setPhotos({});await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Registration failed");}finally{setBusy(false)}
  }
  async function sendCode(){
    setBusy(true);setError("");setMessage("");
    try{const r=await fetch("/api/auth/otp/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:linkPhone})});if(!r.ok)throw Error(await readError(r));setMessage("SMS code sent.");}catch(e){setError(e instanceof Error?e.message:"Unable to send code");}finally{setBusy(false)}
  }
  async function verifyPhone(){
    setBusy(true);setError("");setMessage("");
    try{const r=await fetch("/api/phone/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone:linkPhone,code:phoneCode})});if(!r.ok)throw Error(await readError(r));setPhoneUnverified(false);await refresh();setMessage("Phone verified.");}catch(e){setError(e instanceof Error?e.message:"Phone verification failed");}finally{setBusy(false)}
  }
  return <div>
    <span className="pill">RReklam · Driver portal</span>
    <h1>{lang==="ru"?"Кабинет водителя":lang==="hy"?"Վարորդի անձնական էջ":"Driver portal"}</h1>
    <p className="lead">Register your profile and vehicles. Every vehicle is checked by the responsible manager before it may accept work.</p>
    {loading&&<p role="status">Loading...</p>}
    {error&&<p role="alert" style={{color:"#ba2535",fontWeight:700}}>{error}</p>}
    {message&&<p role="status" style={{color:"#126e39",fontWeight:700}}>{message}</p>}
    {phoneUnverified&&!loading&&<div className="form" style={{maxWidth:550}}><h2>Verify your phone number</h2><p className="small">Google accounts must confirm a phone before submitting a driver application.</p><div className="field"><label>Armenian mobile number</label><input type="tel" value={linkPhone} onChange={e=>setLinkPhone(e.target.value)}/></div><button className="cta ghost" onClick={sendCode} disabled={busy}>Send SMS code</button><div className="field" style={{marginTop:20}}><label>SMS code</label><input autoComplete="one-time-code" value={phoneCode} onChange={e=>setPhoneCode(e.target.value)}/></div><button className="cta" disabled={busy||phoneCode.length!==6} onClick={verifyPhone}>Verify phone</button></div>}
    {!loading&&!phoneUnverified&&!profile&&<form className="form" onSubmit={submitDriver} style={{maxWidth:680}}><h2>Driver application</h2><div className="field"><label>Driver type</label><select value={driverType} onChange={e=>setDriverType(e.target.value as "PRIVATE"|"TAXI")}><option value="PRIVATE">Private driver</option><option value="TAXI">Taxi driver</option></select></div><div className="field"><label>Main operating city</label><select value={primaryCity} onChange={e=>setPrimaryCity(e.target.value)}>{cities.map(c=><option key={c.id} value={c.id}>{c[lang]}</option>)}</select></div><label style={{display:"flex",alignItems:"start",gap:12}}><input style={{width:"auto"}} type="checkbox" checked={acceptTerms} onChange={e=>setAcceptTerms(e.target.checked)}/><span>I confirm my application and agree to be contacted by an agency manager. Driver participation requires separate approval.</span></label><p className="small">Full contract and privacy terms must be published before public onboarding.</p><button style={{marginTop:20}} className="cta" disabled={busy||!acceptTerms} type="submit">Submit driver application</button></form>}
    {!loading&&!phoneUnverified&&profile&&<div className="form"><h2>Your driver profile</h2><p><b>Type:</b> {profile.driverType} · <b>Main city:</b> {cityLabel(profile.primaryCity.code,lang)} · <b>Status:</b> {profile.approvedAt?"Approved":"Awaiting manager approval"}</p><p className="small">You may submit vehicles while approval is pending, but you cannot accept paid assignments until your role is activated.</p><h2>Registered vehicles</h2>{vehicles.length===0?<p className="muted">No vehicles yet.</p>:<div className="cards">{vehicles.map(v=><div className="card" key={v.id}><h3>{v.brand} {v.model}</h3><p>{v.year} · {v.plate}</p><p>Status: <strong>{v.status}</strong></p><p className="small">{v.serviceAreas.map(s=>cityLabel(s.location.code,lang)).join(", ")}</p></div>)}</div>}</div>}
    {!loading&&!phoneUnverified&&profile&&<form className="form" onSubmit={submitVehicle} style={{maxWidth:850,marginTop:28}}><h2>Register another vehicle</h2><div className="cols"><div className="field"><label>Brand</label><input required maxLength={80} value={brand} onChange={e=>setBrand(e.target.value)}/></div><div className="field"><label>Model</label><input required maxLength={80} value={model} onChange={e=>setModel(e.target.value)}/></div><div className="field"><label>Year</label><input type="number" required min={1980} max={new Date().getFullYear()+1} value={year} onChange={e=>setYear(Number(e.target.value))}/></div><div className="field"><label>License plate</label><input required value={plate} onChange={e=>setPlate(e.target.value)}/></div><div className="field"><label>Body type</label><select value={bodyTypeCode} onChange={e=>setBodyTypeCode(e.target.value)}>{bodyTypes.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></div><div className="field"><label>Legal basis</label><select value={legalBasis} onChange={e=>setLegalBasis(e.target.value as "OWNER"|"AUTHORIZED_DRIVER")}><option value="OWNER">I own this vehicle</option><option value="AUTHORIZED_DRIVER">I have owner authorization</option></select></div></div><div className="field"><label>Operating cities (multiple allowed)</label><div className="cards">{cities.map(c=><label key={c.id} style={{display:"flex",gap:8,alignItems:"center"}}><input style={{width:"auto"}} type="checkbox" checked={cityCodes.includes(c.id)} onChange={e=>setCityCodes(e.target.checked?[...cityCodes,c.id]:cityCodes.filter(x=>x!==c.id))}/>{c[lang]}</label>)}</div></div><h3>Four mandatory photos</h3><div className="cols">{sides.map(side=><div className="field" key={side}><label>{side.toUpperCase()}</label><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhotos(old=>({...old,[side]:e.target.files?.[0]}))}/></div>)}</div><label style={{display:"flex",gap:12,alignItems:"start"}}><input type="checkbox" style={{width:"auto"}} checked={ownerPermissionConfirmed} onChange={e=>setOwnerPermissionConfirmed(e.target.checked)}/><span>I am the owner or have permission from the owner to place advertising on this vehicle.</span></label><p className="small">Only agency staff can inspect uploaded photos. The vehicle is not automatically approved. Maximum size: 8 MB per photo.</p><button style={{marginTop:20}} className="cta" type="submit" disabled={busy||cityCodes.length===0||!ownerPermissionConfirmed||sides.some(x=>!photos[x])}>Submit vehicle for review</button></form>}
  </div>;
}
