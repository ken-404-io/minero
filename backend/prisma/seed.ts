import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: "admin@minero.ph" },
  });
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
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
