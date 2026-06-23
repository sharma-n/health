import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "./auth.config";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";
import type { UnitPreference } from "@/lib/constants";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Override the edge-safe jwt callback with a Node-runtime version that
    // re-reads mutable user fields from the DB on every token access. This
    // ensures profile changes (unitPreference, displayName, isAdmin, onboardingComplete) take
    // effect immediately without requiring re-login.
    async jwt({ token, user }) {
      if (user?.id) {
        // Sign-in: populate token from authorize() return value.
        token.id = user.id;
        token.unitPreference = user.unitPreference;
        token.isAdmin = user.isAdmin;
        token.onboardingComplete = user.onboardingComplete;
        token.timezone = user.timezone;
        return token;
      }
      // Subsequent accesses: refresh mutable fields so DB changes are live.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { unitPreference: true, displayName: true, isAdmin: true, onboardingComplete: true, timezone: true },
        });
        if (dbUser) {
          token.unitPreference = dbUser.unitPreference as UnitPreference;
          token.name = dbUser.displayName;
          token.isAdmin = dbUser.isAdmin;
          token.onboardingComplete = dbUser.onboardingComplete;
          token.timezone = dbUser.timezone;
        }
      }
      return token;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            displayName: true,
            passwordHash: true,
            unitPreference: true,
            isAdmin: true,
            onboardingComplete: true,
            timezone: true,
          },
        });
        if (!user) return null;

        const passwordMatches = await bcrypt.compare(
          password,
          user.passwordHash,
        );
        if (!passwordMatches) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          unitPreference: user.unitPreference as UnitPreference,
          isAdmin: user.isAdmin,
          onboardingComplete: user.onboardingComplete,
          timezone: user.timezone,
        };
      },
    }),
  ],
});
