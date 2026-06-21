import { z } from "zod";
import { UNIT_PREFERENCES } from "@/lib/constants";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    displayName: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(80, "Name is too long."),
    // bcrypt silently truncates at 72 bytes, so cap here to keep what the user
    // types consistent with what actually gets hashed.
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be at most 72 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required.").max(80),
  unitPreference: z.enum(UNIT_PREFERENCES),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
