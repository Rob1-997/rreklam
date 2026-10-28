import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { rreklamPrisma?: PrismaClient };
export const prisma = globalForPrisma.rreklamPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.rreklamPrisma = prisma;
