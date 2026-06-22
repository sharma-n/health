#!/bin/sh
set -e
echo "→ Running migrations..."
npx prisma migrate deploy
echo "→ Seeding database..."
npx prisma db seed
echo "→ Starting server..."
exec npm start
