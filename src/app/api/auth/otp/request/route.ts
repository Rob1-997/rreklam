import { NextResponse } from "next/server";
import { normalizePhone, requestPhoneCode } from "@/lib/phone";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = normalizePhone(body?.phone);
    await requestPhoneCode(phone);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PHONE_INVALID") return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
    if (message === "OTP_RATE_LIMIT") return NextResponse.json({ error: "Try again later" }, { status: 429 });
    if (message === "SMS_NOT_CONFIGURED" || message === "OTP_PEPPER_NOT_CONFIGURED") return NextResponse.json({ error: "SMS sign-in is not configured" }, { status: 503 });
    return NextResponse.json({ error: "Unable to send code" }, { status: 503 });
  }
}
