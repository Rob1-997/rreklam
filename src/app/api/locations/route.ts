import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export async function GET(){
  try {
    const cities = await prisma.location.findMany({
      where: { kind: "CITY" },
      select: { code: true, nameHy: true, nameRu: true, nameEn: true, parent: { select: { code: true, nameHy: true, nameRu: true, nameEn: true } } },
      orderBy: { nameEn: "asc" }
    });
    const body = NextResponse.json({ cities });
    body.headers.set("Cache-Control", "public, max-age=60");
    return body;
  } catch { return NextResponse.json({ error: "Locations unavailable" }, { status: 503 }); }
}
