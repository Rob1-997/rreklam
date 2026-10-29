import { timingSafeEqual } from "node:crypto";
export const LOCAL_DEMO_EMAIL = "local-owner@rreklam.invalid";
const LOCAL_HOSTS = new Set(["localhost","127.0.0.1"]);
export function isLocalDemoConfigured(env=process.env) {
  if (env.RREKLAM_LOCAL_DEMO !== "true") return false;
  if (typeof env.RREKLAM_LOCAL_DEMO_PASSWORD !== "string" || env.RREKLAM_LOCAL_DEMO_PASSWORD.length < 20) return false;
  try {
    const db = new URL(env.DATABASE_URL ?? "");
    return db.protocol === "postgresql:" && LOCAL_HOSTS.has(db.hostname.toLowerCase());
  } catch { return false; }
}
export function isLocalDemoEnabled(env=process.env) {
  return env.NODE_ENV === "development" && isLocalDemoConfigured(env);
}
export function isLocalAuthRequest(request) {
  try {
    const requestHost=request.headers.get("host") ?? "";
    const hostname = new URL(request.url).hostname.toLowerCase();
    return LOCAL_HOSTS.has(hostname) && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestHost);
  } catch { return false; }
}
export function demoPasswordMatches(input, secret) {
  if(typeof input!=="string" || typeof secret!=="string" || secret.length<20 || input.length>1024) return false;
  const provided=Buffer.from(input,"utf8");
  const expected=Buffer.from(secret,"utf8");
  return provided.length===expected.length && timingSafeEqual(provided,expected);
}
