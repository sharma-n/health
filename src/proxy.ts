import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js 16 renamed the "middleware" file convention to "proxy". This uses the
// edge-safe config (no Prisma/bcrypt) for route protection; the `authorized`
// callback in authConfig decides access. `auth` doubles as the request handler.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Run on everything except Next internals, the auth API, and static assets.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
