-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BodyMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BodyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BodyMetric" ("date", "id", "note", "type", "userId", "value") SELECT "date", "id", "note", "type", "userId", "value" FROM "BodyMetric";
DROP TABLE "BodyMetric";
ALTER TABLE "new_BodyMetric" RENAME TO "BodyMetric";
CREATE INDEX "BodyMetric_userId_type_date_idx" ON "BodyMetric"("userId", "type", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
