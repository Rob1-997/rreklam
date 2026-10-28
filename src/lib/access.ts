import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { RoleCode } from "@prisma/client";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new ApiError(401, "Sign-in required");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, status: true, phoneVerifiedAt: true, name: true, email: true } });
  if (!user || user.status === "SUSPENDED") throw new ApiError(403, "Account disabled");
  return user;
}
export async function requireVerifiedUser() {
  const user = await requireUser();
  if (!user.phoneVerifiedAt) throw new ApiError(403, "Phone verification required");
  return user;
}
export async function requireRole(...roles: RoleCode[]) {
  const user = await requireVerifiedUser();
  const activeRoles = await prisma.userRole.findMany({ where: { userId: user.id, role: { in: roles }, activatedAt: { not: null } }, select: { role: true } });
  if (!activeRoles.length) throw new ApiError(403, "Insufficient permissions");
  return { ...user, roles: activeRoles.map(r => r.role), isOwner: activeRoles.some(r => r.role === "OWNER") };
}
export function respondError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("RReklam request failed", error instanceof Error ? error.name : "Unknown error");
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
