"use client";
import { useState, type FormEvent } from "react";
type CityAvailability={city:string;nameRu:string;eligible:number;available:number;minimumAvailable:number|null;belowThreshold:boolean};
export default function AvailabilityPanel(){
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [cities,setCities]=useState<CityAvailability[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [hasResult,setHasResult]=useState(false);
  async function check(event:FormEvent){
    event.preventDefault();setError("");setLoading(true);setHasResult(false);
    try{
      const q=new URLSearchParams({start,end});
      const res=await fetch("/api/admin/availability?"+q,{cache:"no-store"});
      const json=await res.json();
      if(!res.ok)throw Error(json.error??"Unable to check availability");
      setCities(json.availability);setHasResult(true);
    }catch(e){setError(e instanceof Error?e.message:"Request failed")}
    finally{setLoading(false)}
  }
  return <div className="form"><h2>Availability calendar</h2><p className="small">Choose start and end dates (inclusive) in Armenia local time. All overlapping bookings and reservations are excluded. These are candidate vehicles only; suitability for a specific wrap format requires manager confirmation.</p>
    <form onSubmit={check}><div className="cols"><div className="field"><label>Start date</label><input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></div><div className="field"><label>End date</label><input required type="date" min={start||undefined} value={end} onChange={e=>setEnd(e.target.value)}/></div></div><button className="cta" disabled={loading||!start||!end} type="submit">{loading?"Checking...":"Check period"}</button></form>
    {error&&<p role="alert" style={{color:"#ba2535"}}>{error}</p>}
    {hasResult&&<div style={{marginTop:22}}><div className="cards">{cities.map(c=><div className="card" key={c.city}><h3>{c.nameRu}</h3><p>Potentially available: <b>{c.available}</b></p><p className="small">Eligible: {c.eligible}</p>{c.minimumAvailable!==null&&<p className="small" style={{color:c.belowThreshold?"#bf2433":"#366548"}}>{c.belowThreshold?"Below minimum":"Minimum met"} · threshold {c.minimumAvailable}</p>}</div>)}</div></div>}
  </div>;
}
