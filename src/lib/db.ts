import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getDb() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  process.env.DATABASE_URL = env.DATABASE_URL;
  if (env.DIRECT_URL) process.env.DIRECT_URL = env.DIRECT_URL;

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return globalForPrisma.prisma;
}
