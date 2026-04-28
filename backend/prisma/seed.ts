import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

function generatePassword(): string {
  // URL-safe base64, trimmed to 16 chars — strong enough, easy to copy-paste.
  return crypto.randomBytes(12).toString("base64url").slice(0, 16);
}

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: "admin@minero.ph" },
  });
  if (existing) {
    console.log("Admin user already exists — skipping seed.");
    console.log("To reset the admin password use: POST /auth/forgot-password");
    return;
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      name: "Strong Fund Inc",
      email: "admin@minero.ph",
      passwordHash,
      referralCode: "ADMIN0",
      role: "admin",
    },
  });

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║           ADMIN CREDENTIALS (one-time)       ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Email:    ${admin.email.padEnd(34)}║`);
  console.log(`║  Password: ${password.padEnd(34)}║`);
  console.log("╠══════════════════════════════════════════════╣");
  console.log("║  Save this password — it will not be shown   ║");
  console.log("║  again. Change it after first login.         ║");
  console.log("╚══════════════════════════════════════════════╝");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
