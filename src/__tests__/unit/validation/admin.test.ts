import {
  adminChangePasswordSchema,
  adminDeleteUserSchema,
  adminResetDataSchema,
  adminSetRoleSchema,
} from "@/lib/validation/admin";

describe("adminChangePasswordSchema", () => {
  const valid = { userId: "u1", newPassword: "NewPass1!", adminPassword: "adminpass" };

  it("accepts valid input", () => {
    expect(adminChangePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects newPassword shorter than 8 chars", () => {
    expect(adminChangePasswordSchema.safeParse({ ...valid, newPassword: "short" }).success).toBe(false);
  });

  it("rejects newPassword longer than 72 chars", () => {
    expect(adminChangePasswordSchema.safeParse({ ...valid, newPassword: "a".repeat(73) }).success).toBe(false);
  });

  it("rejects empty adminPassword", () => {
    expect(adminChangePasswordSchema.safeParse({ ...valid, adminPassword: "" }).success).toBe(false);
  });

  it("rejects empty userId", () => {
    expect(adminChangePasswordSchema.safeParse({ ...valid, userId: "" }).success).toBe(false);
  });
});

describe("adminDeleteUserSchema", () => {
  it("accepts valid input", () => {
    expect(adminDeleteUserSchema.safeParse({ userId: "u1", adminPassword: "pass" }).success).toBe(true);
  });

  it("rejects empty adminPassword", () => {
    expect(adminDeleteUserSchema.safeParse({ userId: "u1", adminPassword: "" }).success).toBe(false);
  });
});

describe("adminResetDataSchema", () => {
  it("accepts valid input", () => {
    expect(adminResetDataSchema.safeParse({ userId: "u1", adminPassword: "pass" }).success).toBe(true);
  });
});

describe("adminSetRoleSchema", () => {
  it("transforms 'true' to boolean true", () => {
    const r = adminSetRoleSchema.safeParse({ userId: "u1", makeAdmin: "true" });
    expect(r.success).toBe(true);
    expect(r.data?.makeAdmin).toBe(true);
  });

  it("transforms 'false' to boolean false", () => {
    const r = adminSetRoleSchema.safeParse({ userId: "u1", makeAdmin: "false" });
    expect(r.success).toBe(true);
    expect(r.data?.makeAdmin).toBe(false);
  });

  it("rejects any value other than 'true'/'false'", () => {
    expect(adminSetRoleSchema.safeParse({ userId: "u1", makeAdmin: "yes" }).success).toBe(false);
    expect(adminSetRoleSchema.safeParse({ userId: "u1", makeAdmin: "1" }).success).toBe(false);
  });
});
