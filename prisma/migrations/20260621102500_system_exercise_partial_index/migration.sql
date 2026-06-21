-- Partial unique index (not expressible in Prisma schema): enforces one system
-- exercise per name without colliding with users' custom exercises of the same
-- name. Backs the idempotent seed (find-or-create) and the read-only system set.
CREATE UNIQUE INDEX "Exercise_system_name_key" ON "Exercise"("name") WHERE "isSystem" = true;
