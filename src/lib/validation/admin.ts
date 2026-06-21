import { z } from "zod";

// Admin user-management inputs. Destructive actions require the admin to
// re-enter their own password (`adminPassword`) for re-authentication. See
// SPEC.md §8 (Admin & user management).

const userId = z.string().min(1, "User is required.");

// Re-authentication: only that the admin typed *something*; the actual check is
// a bcrypt.compare against their stored hash in the server action.
const adminPassword = z.string().min(1, "Enter your password to confirm.");

// Same rules as registerSchema (bcrypt truncates at 72 bytes).
const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.");

export const adminChangePasswordSchema = z.object({
  userId,
  newPassword,
  adminPassword,
});

export const adminDeleteUserSchema = z.object({
  userId,
  adminPassword,
});

export const adminResetDataSchema = z.object({
  userId,
  adminPassword,
});

export const adminSetRoleSchema = z.object({
  userId,
  // Checkbox/hidden inputs arrive as strings; coerce "true"/"false" cleanly.
  makeAdmin: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;
export type AdminDeleteUserInput = z.infer<typeof adminDeleteUserSchema>;
export type AdminResetDataInput = z.infer<typeof adminResetDataSchema>;
export type AdminSetRoleInput = z.infer<typeof adminSetRoleSchema>;
