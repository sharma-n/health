import type { DefaultSession } from "next-auth";
import type { UnitPreference } from "@/lib/constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      unitPreference: UnitPreference;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    unitPreference: UnitPreference;
    isAdmin: boolean;
  }
}

// `next-auth/jwt` only re-exports `@auth/core/jwt`, so the JWT interface must be
// augmented on the original module for declaration merging to take effect.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    unitPreference: UnitPreference;
    isAdmin: boolean;
  }
}
