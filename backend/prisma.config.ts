import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Prisma 7 removed `url` from the schema datasource. The connection URL
  // lives here for CLI commands (migrate, db push, studio). The runtime
  // PrismaClient gets its connection via the adapter in src/lib/db.ts.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
