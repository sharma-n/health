import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 7 connects through a driver adapter. The better-sqlite3 adapter reads
// the SQLite file path from DATABASE_URL (it strips the leading `file:`).
//
// Foreign-key enforcement: better-sqlite3 enables `PRAGMA foreign_keys` by
// default (unlike the sqlite3 CLI), so the schema's onDelete Cascade/Restrict/
// SetNull rules are honoured at the DB layer — no explicit pragma needed here.
// Verified empirically against @prisma/adapter-better-sqlite3@7.8 (M2).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  const adapter = new PrismaBetterSqlite3({ url });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
