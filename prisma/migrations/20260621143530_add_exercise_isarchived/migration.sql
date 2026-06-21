-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "equipment" TEXT NOT NULL,
    "primaryMuscles" JSONB NOT NULL,
    "secondaryMuscles" JSONB NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exercise_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Exercise" ("createdAt", "description", "equipment", "id", "isSystem", "name", "ownerId", "primaryMuscles", "secondaryMuscles") SELECT "createdAt", "description", "equipment", "id", "isSystem", "name", "ownerId", "primaryMuscles", "secondaryMuscles" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
CREATE INDEX "Exercise_ownerId_idx" ON "Exercise"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
