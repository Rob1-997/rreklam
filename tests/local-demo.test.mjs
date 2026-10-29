import test from "node:test";
import assert from "node:assert/strict";
import { isLocalDemoConfigured, isLocalDemoEnabled, isLocalAuthRequest, demoPasswordMatches } from "../src/lib/local-demo.mjs";
const valid={
  NODE_ENV:"development",
  DATABASE_URL:"postgresql://dev:pass@localhost:5432/rreklam",
  RREKLAM_LOCAL_DEMO:"true",
  RREKLAM_LOCAL_DEMO_PASSWORD:"secure-local-demo-password-very-long-123"
};
test("local demo requires explicit opt-in and local PostgreSQL",()=>{
 assert.equal(isLocalDemoEnabled(valid),true);
 assert.equal(isLocalDemoEnabled({...valid,RREKLAM_LOCAL_DEMO:"false"}),false);
 assert.equal(isLocalDemoEnabled({...valid,DATABASE_URL:"postgresql://dev:pass@public.example.com:5432/prod"}),false);
 assert.equal(isLocalDemoEnabled({...valid,RREKLAM_LOCAL_DEMO_PASSWORD:"123"}),false);
});
test("local demo never activates under production NODE_ENV",()=>{
 assert.equal(isLocalDemoEnabled({...valid,NODE_ENV:"production"}),false);
 assert.equal(isLocalDemoEnabled({...valid,NODE_ENV:"test"}),false);
 assert.equal(isLocalDemoConfigured({...valid,NODE_ENV:"production"}),true);
});
test("local login accepts only localhost request",()=>{
 assert.equal(isLocalAuthRequest(new Request("http://localhost:3000/api/auth/callback/local-owner",{headers:{host:"localhost:3000"}})),true);
 assert.equal(isLocalAuthRequest(new Request("http://127.0.0.1:3000/api/auth/callback/local-owner",{headers:{host:"127.0.0.1:3000"}})),true);
 assert.equal(isLocalAuthRequest(new Request("http://192.168.1.5:3000/api/auth/callback/local-owner",{headers:{host:"192.168.1.5:3000"}})),false);
 assert.equal(isLocalAuthRequest(new Request("http://localhost:3000/api/auth/callback/local-owner",{headers:{host:"evil.example.com"}})),false);
});
test("local password uses constant-time match",()=>{
 assert.equal(demoPasswordMatches("secure-local-demo-password-very-long-123",valid.RREKLAM_LOCAL_DEMO_PASSWORD),true);
 assert.equal(demoPasswordMatches("wrong",valid.RREKLAM_LOCAL_DEMO_PASSWORD),false);
});
