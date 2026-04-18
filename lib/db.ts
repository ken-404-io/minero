import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Use DATABASE_URL_RUNTIME for the libsql adapter (needs file:// absolute URL)
// Falls back to DATABASE_URL for environments that set it as an absolute file:// URL
const DB_URL =
  process.env.DATABASE_URL_RUNTIME ??
  process.env.DATABASE_URL ??
  "file:///home/user/minero/dev.db";

function createPrismaClient() {
  const adapter = new PrismaLibSql({ url: DB_URL });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
