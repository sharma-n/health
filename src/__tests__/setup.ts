import { vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
  cookies: vi.fn().mockResolvedValue(new Map()),
}));

// Default: unauthenticated. Integration tests override per-test.
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Integration tests set (globalThis as any).__testDb in beforeAll.
// Analytics tests never import @/lib/db (analytics fns accept prisma as param).
vi.mock("@/lib/db", () => ({
  get prisma() {
    return (globalThis as any).__testDb;
  },
}));
