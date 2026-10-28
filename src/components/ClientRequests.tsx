"use client";
import {useEffect,useState} from "react";
type Request={id:string;createdAt:string;status:string;client:{name:string|null;phone:string|null;email:string|null};targets:{quantity:number;location:{code:string;nameRu:string}}[]};
export default function ClientRequests(){
  const [requests,setRequests]=useState<Request[]>([]);
  const [error,setError]=useState("");
  useEffect(()=>{let live=true;fetch("/api/admin/campaigns",{cache:"no-store"}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error??"Could not load requests");if(live)setRequests(x.campaigns)}).catch(e=>{if(live)setError(e instanceof Error?e.message:"Failed")});return()=>{live=false}},[]);
  return <div><h2>New customer campaigns · {requests.length}</h2><p className="small">These are unpriced requests. No reservations or payments have been made. Each request needs a manager’s quote and owner-controlled financial approval workflow.</p>{error&&<p role="alert">{error}</p>}{requests.length===0?<p className="muted">No campaign requests assigned.</p>:<div className="cards">{requests.map(r=><div className="card" key={r.id}><h3>{r.client.name||"Customer"}</h3><p className="small">{r.client.phone||r.client.email||"Verified account"}</p><p>{r.targets.map(x=>x.location.nameRu+": "+x.quantity).join(" · ")}</p><p className="small">Request #{r.id.slice(0,8)} · {new Date(r.createdAt).toLocaleDateString()}</p><span className="pill">{r.status}</span></div>)}</div>}</div>;
}
