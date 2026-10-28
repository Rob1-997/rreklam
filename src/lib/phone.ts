import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function normalizePhone(value: unknown): string {
  const phone = String(value ?? "").replace(/[\s()\-]/g, "");
  if (!/^\+374\d{8}$/.test(phone)) throw new Error("PHONE_INVALID");
  return phone;
}
function hashOtp(phone: string, code: string): string {
  const secret = process.env.OTP_PEPPER;
  if (!secret || secret.length < 32) throw new Error("OTP_PEPPER_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(phone + ":" + code).digest("hex");
}
async function sendSms(phone: string, message: string): Promise<void> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) throw new Error("SMS_NOT_CONFIGURED");
  const body = new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`, {
    method: "POST", headers: { Authorization: "Basic " + Buffer.from(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body, cache: "no-store"
  });
  if (!response.ok) throw new Error("SMS_DELIVERY_FAILED");
}
export async function requestPhoneCode(phone: string): Promise<void> {
  const now = new Date();
  const cooldown = new Date(now.getTime() - 60_000);
  const hour = new Date(now.getTime() - 3_600_000);
  const recent = await prisma.phoneOtp.findMany({ where: { phone, requestedAt: { gte: hour } }, select: { requestedAt: true } });
  if (recent.length >= 5 || recent.some(x => x.requestedAt >= cooldown)) throw new Error("OTP_RATE_LIMIT");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otp = await prisma.phoneOtp.create({ data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(now.getTime() + 5 * 60_000) } });
  try { await sendSms(phone, "RReklam: " + code + " (5 min). Never share this code."); }
  catch (error) { await prisma.phoneOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } }); throw error; }
}
export async function consumePhoneCode(phone: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const otp = await prisma.phoneOtp.findFirst({ where: { phone, usedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } }, orderBy: { requestedAt: "desc" } });
  if (!otp) return false;
  const submitted = Buffer.from(hashOtp(phone, code), "hex");
  const expected = Buffer.from(otp.codeHash, "hex");
  if (submitted.length !== expected.length || !timingSafeEqual(submitted, expected)) {
    await prisma.phoneOtp.updateMany({ where: { id: otp.id, usedAt: null }, data: { attempts: { increment: 1 } } }); return false;
  }
  const consumed = await prisma.phoneOtp.updateMany({ where: { id: otp.id, usedAt: null, attempts: { lt: 5 }, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  return consumed.count === 1;
}
