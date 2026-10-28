"use client";
import { useCallback,useEffect,useState } from "react";
type Driver={id:string;driverType:string;termsAcceptedAt:string;user:{name:string|null;phone:string|null;phoneVerifiedAt:string|null};primaryCity:{nameRu:string}};
type Vehicle={id:string;brand:string;model:string;year:number;plate:string;ownerId:string;photos:{kind:string}[];reviewManagerId:string|null;serviceAreas:{location:{code:string}}[]};
type Stock={id:string;code:string;nameRu:string;registered:number;free:number;minimumAvailable:number;alertEnabled:boolean;belowThreshold:boolean};
async function message(res:Response){return (await res.json().catch(()=>({error:"Request failed"}))).error||"Request failed"}
export default function AdminPortal({isOwner}:{isOwner:boolean}){
  const [drivers,setDrivers]=useState<Driver[]>([]);const [vehicles,setVehicles]=useState<Vehicle[]>([]);const [stock,setStock]=useState<Stock[]>([]);
  const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState("");const [loading,setLoading]=useState(true);
  const [thresholds,setThresholds]=useState<Record<string,number>>({});
  const refresh=useCallback(async()=>{
    try {
      const results=await Promise.all(["/api/admin/drivers","/api/admin/vehicles","/api/admin/stock"].map(url=>fetch(url,{cache:"no-store"})));
      for(const res of results)if(!res.ok)throw Error(await message(res));
      const [a,b,c]=await Promise.all(results.map(r=>r.json()));
      setDrivers(a.drivers);setVehicles(b.vehicles);setStock(c.stock);
      setThresholds(Object.fromEntries(c.stock.map((x:Stock)=>[x.code,x.minimumAvailable])));
    } catch(e){setError(e instanceof Error?e.message:"Unable to load dashboard")}
    finally{setLoading(false)}
  },[]);
  useEffect(()=>{void refresh()},[refresh]);
  async function perform(url:string,body?:object){
    setBusy(url);setError("");setNotice("");
    try {
      const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body??{})});
      if(!res.ok)throw Error(await message(res));
      setNotice("Operation recorded.");
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Operation failed")}finally{setBusy("")}
  }
  async function saveThreshold(city:string){
    setBusy(city);setError("");setNotice("");
    try{
      const res=await fetch(`/api/admin/stock/${encodeURIComponent(city)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({minimumAvailable:thresholds[city],enabled:true})});
      if(!res.ok)throw Error(await message(res));
      setNotice("Minimum stock saved.");await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Save failed")}finally{setBusy("")}
  }
  return <div><span className="pill">RReklam · {isOwner?"Owner":"Manager"}</span><h1>Vehicle network</h1><p className="lead">Manage assigned drivers, review cars and monitor vehicle supply. All operations are checked again on the server.</p>{error&&<p role="alert" style={{color:"#bb2737"}}>{error}</p>}{notice&&<p role="status" style={{color:"#126e39"}}>{notice}</p>}{loading?<p>Loading network...</p>:<><section><h2>Driver applications · {drivers.length}</h2>{!drivers.length?<p className="muted">No pending applications.</p>:<div className="cards">{drivers.map(x=><div className="card" key={x.id}><h3>{x.user.name||"Applicant"}</h3><p>{x.user.phone||"No phone"} · {x.driverType} · {x.primaryCity.nameRu}</p><button disabled={!!busy||!x.user.phoneVerifiedAt} className="cta" type="button" onClick={()=>perform(`/api/admin/drivers/${x.id}/activate`)}>Approve driver</button></div>)}</div>}</section><section><h2>Vehicle applications · {vehicles.length}</h2>{!vehicles.length?<p className="muted">No vehicles awaiting review.</p>:<div className="cards">{vehicles.map(v=><div className="card" key={v.id}><h3>{v.brand} {v.model}</h3><p>{v.plate} · {v.year}</p><p className="small">Photos: {v.photos.length} / 4 · Cities: {v.serviceAreas.map(s=>s.location.code).join(", ")}</p><div className="cols">{(["FRONT","BACK","LEFT","RIGHT"] as const).map(kind=><a key={kind} href={`/api/vehicles/${v.id}/photos/${kind}`} target="_blank" rel="noopener noreferrer" className="cta ghost" style={{padding:9,justifyContent:"center"}}>{kind} photo</a>)}</div><div style={{display:"flex",gap:12,marginTop:20,flexWrap:"wrap"}}><button className="cta" type="button" disabled={!!busy} onClick={()=>perform(`/api/admin/vehicles/${v.id}/review`,{decision:"APPROVE"})}>Approve</button><button className="cta ghost" type="button" disabled={!!busy} onClick={()=>{const reason=window.prompt("Reason for rejection (minimum 10 characters):");if(reason)void perform(`/api/admin/vehicles/${v.id}/review`,{decision:"REJECT",reason})}}>Reject</button></div></div>)}</div>}</section><section><h2>Vehicle supply by city</h2><p className="small">A car may work in multiple cities; city totals can overlap. Current counts exclude occupied and already wrapped cars. Prices and driver data are not public.</p><div className="cards">{stock.map(c=><div className="card" key={c.code}><h3>{c.nameRu}</h3><p>Registered: <b>{c.registered}</b> · Free now: <b>{c.free}</b></p><p style={{color:c.belowThreshold?"#c12b40":"#61718e"}}>{c.belowThreshold?"⚠ Below configured minimum":c.alertEnabled?"Above threshold":"No active alert"}</p>{isOwner&&<><label>Minimum vehicles</label><div style={{display:"flex",gap:10}}><input aria-label={`Minimum for ${c.nameRu}`} type="number" min={0} max={100000} value={thresholds[c.code]??0} onChange={e=>setThresholds(x=>({...x,[c.code]:Number(e.target.value)}))}/><button type="button" className="cta" disabled={!!busy||!Number.isInteger(thresholds[c.code])||thresholds[c.code]<0} onClick={()=>saveThreshold(c.code)}>Save</button></div></>}</div>)}</div></section></>}</div>;
}
