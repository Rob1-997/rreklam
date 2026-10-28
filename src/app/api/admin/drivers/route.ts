import { prisma } from "@/lib/prisma";
import { requireRole, respondError } from "@/lib/access";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(){
  try {
    const staff = await requireRole("OWNER", "MANAGER");
    const drivers = await prisma.driverProfile.findMany({
      where: { approvedAt: null, ...(staff.isOwner ? {} : { managerId: staff.id }) },
      orderBy: { termsAcceptedAt: "asc" },
      take: 100,
      select: {
        id: true, driverType: true, termsAcceptedAt: true, managerId: true,
        primaryCity: { select: { code: true, nameRu: true, nameHy: true, nameEn: true } },
        user: { select: { name: true, phone: true, email: true, phoneVerifiedAt: true } }
      }
    });
    return NextResponse.json({ drivers });
  } catch (error) { return respondError(error); }
}
