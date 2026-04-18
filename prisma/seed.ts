import bcrypt from "bcryptjs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../app/generated/prisma/client.ts";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbAbsPath = path.resolve(projectRoot, "dev.db");
const adapter = new PrismaLibSql({ url: `file://${dbAbsPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "admin@minero.ph" } });
  if (existing) {
    console.log("Admin user already exists");
    return;
  }

  const passwordHash = await bcrypt.hash("admin123!", 12);
  const admin = await prisma.user.create({
    data: {
      name: "Halvex Admin",
      email: "admin@minero.ph",
      passwordHash,
      referralCode: "ADMIN0",
      role: "admin",
    },
  });

  console.log("Created admin user:", admin.email);
  console.log("Login: admin@minero.ph / admin123!");
  console.log("IMPORTANT: Change the password before going live!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
