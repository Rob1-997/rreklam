import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { consumePhoneCode, normalizePhone } from "@/lib/phone";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let phone: string, code: string;
  try {
    const body = await request.json();
    phone = normalizePhone(body.phone); code = String(body.code ?? "");
  } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const existing = await prisma.user.findFirst({ where: { phone, id: { not: session.user.id } }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Phone already linked" }, { status: 409 });
  if (!await consumePhoneCode(phone, code)) return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { phone, phoneVerifiedAt: new Date() } });
  } catch { return NextResponse.json({ error: "Phone already linked" }, { status: 409 }); }
  return NextResponse.json({ ok: true });
}
