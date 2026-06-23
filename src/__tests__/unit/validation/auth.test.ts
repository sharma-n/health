import { loginSchema, registerSchema, updateProfileSchema } from "@/lib/validation/auth";

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "secret" }).success).toBe(true);
  });

  it("normalises email to lowercase", () => {
    const result = loginSchema.safeParse({ email: "User@Example.COM", password: "x" });
    expect(result.success && result.data.email).toBe("user@example.com");
  });

  it("rejects invalid email", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(r.success).toBe(false);
  });

  it("rejects empty password", () => {
    const r = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(r.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    email: "new@example.com",
    displayName: "Alice",
    password: "Password1!",
    confirmPassword: "Password1!",
  };

  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects passwords that do not match", () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(r.success).toBe(false);
    expect(r.error?.flatten().fieldErrors.confirmPassword).toBeDefined();
  });

  it("rejects password shorter than 8 chars", () => {
    const r = registerSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" });
    expect(r.success).toBe(false);
  });

  it("rejects password longer than 72 chars", () => {
    const long = "a".repeat(73);
    const r = registerSchema.safeParse({ ...valid, password: long, confirmPassword: long });
    expect(r.success).toBe(false);
  });

  it("rejects blank displayName", () => {
    const r = registerSchema.safeParse({ ...valid, displayName: "" });
    expect(r.success).toBe(false);
    expect(r.error?.flatten().fieldErrors.displayName).toBeDefined();
  });

  it("rejects displayName longer than 80 chars", () => {
    const r = registerSchema.safeParse({ ...valid, displayName: "x".repeat(81) });
    expect(r.success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("accepts valid displayName and KG", () => {
    expect(updateProfileSchema.safeParse({ displayName: "Bob", unitPreference: "KG" }).success).toBe(true);
  });

  it("accepts LBS unit preference", () => {
    expect(updateProfileSchema.safeParse({ displayName: "Bob", unitPreference: "LBS" }).success).toBe(true);
  });

  it("rejects unknown unit preference", () => {
    const r = updateProfileSchema.safeParse({ displayName: "Bob", unitPreference: "STONES" });
    expect(r.success).toBe(false);
  });
});
