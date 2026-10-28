import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export async function GET(){
  try {
    const types = await prisma.bodyType.findMany({ orderBy: { code: "asc" }, select: { code: true, nameRu: true } });
    return NextResponse.json({ types });
  } catch { return NextResponse.json({ error: "Vehicle body types unavailable" }, { status: 503 }); }
}
