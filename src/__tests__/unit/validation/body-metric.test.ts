import { bodyMetricSchema } from "@/lib/validation/body-metric";

describe("bodyMetricSchema", () => {
  const valid = {
    date: new Date("2026-07-01"),
    type: "BODYWEIGHT",
    value: 80,
  };

  it("accepts a valid bodyweight entry", () => {
    expect(bodyMetricSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all metric types", () => {
    const types = ["BODYWEIGHT", "WAIST", "HIPS", "CHEST", "ARM_LEFT", "ARM_RIGHT",
                   "THIGH_LEFT", "THIGH_RIGHT", "CALF", "NECK", "BODY_FAT_PCT"];
    for (const type of types) {
      expect(bodyMetricSchema.safeParse({ ...valid, type }).success).toBe(true);
    }
  });

  it("accepts an optional note", () => {
    expect(bodyMetricSchema.safeParse({ ...valid, note: "Morning weight" }).success).toBe(true);
  });

  it("rejects unknown metric type", () => {
    expect(bodyMetricSchema.safeParse({ ...valid, type: "WINGSPAN" }).success).toBe(false);
  });

  it("rejects zero value", () => {
    expect(bodyMetricSchema.safeParse({ ...valid, value: 0 }).success).toBe(false);
  });

  it("rejects negative value", () => {
    expect(bodyMetricSchema.safeParse({ ...valid, value: -1 }).success).toBe(false);
  });

  it("coerces string date", () => {
    const r = bodyMetricSchema.safeParse({ ...valid, date: "2026-07-01" });
    expect(r.success).toBe(true);
    expect(r.data?.date).toBeInstanceOf(Date);
  });

  it("coerces string value", () => {
    const r = bodyMetricSchema.safeParse({ ...valid, value: "82.5" });
    expect(r.success).toBe(true);
    expect(r.data?.value).toBe(82.5);
  });
});
