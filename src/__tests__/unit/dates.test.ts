import { describe, it, expect } from "vitest";
import { formatDateOnly, todayInTz, dayOfWeekInTz } from "@/lib/dates";

describe("formatDateOnly", () => {
  it("formats a YYYY-MM-DD string without shifting the day", () => {
    const result = formatDateOnly("2024-06-24");
    // The exact format depends on locale, but the date should include "24" and "Jun" or "6"
    expect(result).toContain("24");
    expect(result).toMatch(/Jun|6/);
  });

  it("formats a Date object (UTC midnight) as the UTC calendar date", () => {
    // 2024-06-24T00:00:00Z — should display as June 24, not June 23
    const utcMidnight = new Date("2024-06-24T00:00:00Z");
    const result = formatDateOnly(utcMidnight);
    expect(result).toContain("24");
    // Must NOT contain "23" (which would be the off-by-one UTC-5 bug)
    expect(result).not.toContain("23");
  });

  it("accepts custom Intl options", () => {
    const result = formatDateOnly("2024-06-24", { month: "short", day: "numeric" });
    expect(result).toContain("24");
    expect(result).toMatch(/Jun/i);
  });

  it("handles string with time component by taking only the date part", () => {
    // Some APIs return ISO strings — should take only YYYY-MM-DD
    const result = formatDateOnly("2024-06-24T10:30:00.000Z");
    expect(result).toContain("24");
  });
});

describe("todayInTz", () => {
  it("returns a YYYY-MM-DD formatted string", () => {
    const result = todayInTz("UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a valid date string for common timezones", () => {
    for (const tz of ["America/New_York", "Asia/Tokyo", "Europe/London", "Asia/Kolkata"]) {
      const result = todayInTz(tz);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("falls back gracefully for an invalid timezone", () => {
    const result = todayInTz("Invalid/Timezone");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("dayOfWeekInTz", () => {
  it("returns a number between 0 and 6", () => {
    const result = dayOfWeekInTz("UTC");
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(6);
  });

  it("returns a valid day index for common timezones", () => {
    for (const tz of ["America/New_York", "Asia/Tokyo", "Europe/London"]) {
      const result = dayOfWeekInTz(tz);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  it("falls back gracefully for an invalid timezone", () => {
    const result = dayOfWeekInTz("Invalid/Timezone");
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(6);
  });
});
