import assert from "node:assert/strict";
const base="http://127.0.0.1:3000";
const password=process.env.RREKLAM_LOCAL_DEMO_PASSWORD;
if(!password)throw Error("Test password not configured");
function cookies(response){
  return response.headers.getSetCookie().map(x=>x.split(";")[0]).filter(Boolean);
}
async function run(){
  const state=await fetch(base+"/api/dev/local-owner-status",{cache:"no-store"});
  assert.equal(state.status,200,"Local owner status endpoint should be reachable");
  const config=await state.json();
  assert.equal(config.ownerActive,true,"Local owner must have an active role");
  const csrfRes=await fetch(base+"/api/auth/csrf");
  assert.equal(csrfRes.status,200,"Auth.js CSRF endpoint must be reachable");
  const csrf=await csrfRes.json();
  assert.equal(typeof csrf.csrfToken,"string");
  const initialCookies=cookies(csrfRes);
  const callback=await fetch(base+"/api/auth/callback/local-owner",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded","X-Auth-Return-Redirect":"1","Cookie":initialCookies.join("; ")},
    body:new URLSearchParams({csrfToken:csrf.csrfToken,password,redirectTo:base+"/ru/admin"}),
    redirect:"manual"
  });
  const payload=await callback.text();
  const callbackCookies=cookies(callback);
  assert.equal(callback.status,200,"Auth.js callback must accept correct local password: "+callback.status+" "+payload.slice(0,300));
  const response=JSON.parse(payload);
  assert.equal(typeof response.url,"string");
  assert.equal(response.url.endsWith("/ru/admin"),true,"Auth.js redirectTo must resolve to /ru/admin: "+response.url);
  assert.equal(callbackCookies.some(x=>x.includes("session-token=")),true,"Auth.js must issue session cookie");
  const session=await fetch(base+"/api/auth/session",{headers:{"Cookie":[...initialCookies,...callbackCookies].join("; ")}});
  assert.equal(session.status,200);
  const sessionData=await session.json();
  assert.ok(sessionData.user?.id,"Session must contain user ID after local login");
  const admin=await fetch(base+"/ru/admin",{headers:{"Cookie":[...initialCookies,...callbackCookies].join("; ")},redirect:"manual"});
  assert.equal(admin.status,200,"Authenticated owner must see admin dashboard");
  const html=await admin.text();
  assert.equal(html.includes("Vehicle network"),true,"Admin dashboard should render");
  console.log("Local owner HTTP sign-in -> authenticated session -> admin dashboard: passed.");
}
run().catch(error=>{console.error(error);process.exitCode=1});
