import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration. Contains NO database or bcrypt access so it
 * can run in middleware (edge runtime). The Credentials provider with its
 * Prisma-backed `authorize` is added in `src/auth.ts` (Node runtime only).
 * See SPEC.md §8.
 */
export const authConfig = {
  // Self-hosted behind an arbitrary host/reverse proxy: trust the incoming
  // Host header instead of requiring AUTH_URL. See SPEC.md §8.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    // Route protection. Runs in middleware on every matched request.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname === "/login" || nextUrl.pathname === "/register";

      if (isAuthPage) {
        // Signed-in users shouldn't see login/register.
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // Everything else requires a session.
      return isLoggedIn;
    },
    // Persist user id + unit preference into the JWT.
    jwt({ token, user }) {
      // `user` is only present on sign-in; our authorize() always sets id.
      if (user?.id) {
        token.id = user.id;
        token.unitPreference = user.unitPreference;
      }
      return token;
    },
    // Expose id + unit preference on the session.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.unitPreference = token.unitPreference;
      }
      return session;
    },
  },
  providers: [], // populated in src/auth.ts
} satisfies NextAuthConfig;
