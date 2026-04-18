import bcrypt from "bcryptjs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Build a tiny Prisma client using the generated client's wasm/edge bundle
// Use dynamic import to load the compiled module
const { PrismaClient } = await import(path.join(__dirname, "../node_modules/@prisma/client/index.js")).catch(() => {
  // fallback: use the generated client directly via ts-node or compiled
  throw new Error("Could not load PrismaClient");
});

const prisma = new PrismaClient();

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
  console.log("Login with: admin@minero.ph / admin123!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
