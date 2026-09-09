import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PrismaClient } from "./generated/client.js";

// Run explicitly with bun run db:seed; keep seed data aligned with the schema.

// Load env using the same rule as prisma.config.ts.
const isTest = process.env.NODE_ENV === "test";
config({ path: isTest ? ".env.test" : ".env", override: isTest });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

// TODO(template): Replace sample data.
const EMAILS = ["ada@example.com", "grace@example.com"];

async function seed() {
  await Promise.all(
    EMAILS.map((email) =>
      prisma.user.upsert({ where: { email }, update: {}, create: { email } }),
    ),
  );

  console.log(`seeded: ${EMAILS.join(", ")}`);
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  // Close the pool even if seeding fails.
  .finally(() => prisma.$disconnect());
