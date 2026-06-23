import { toKg, fromKg, toCm, fromCm, weightUnitLabel, lengthUnitLabel } from "@/lib/units";

describe("toKg", () => {
  it("returns value unchanged for KG", () => {
    expect(toKg(100, "KG")).toBe(100);
  });

  it("converts lbs to kg", () => {
    expect(toKg(220.46226218487757, "LBS")).toBeCloseTo(100, 5);
  });

  it("handles zero", () => {
    expect(toKg(0, "KG")).toBe(0);
    expect(toKg(0, "LBS")).toBe(0);
  });
});

describe("fromKg", () => {
  it("returns kg unchanged for KG", () => {
    expect(fromKg(100, "KG")).toBe(100);
  });

  it("converts kg to lbs", () => {
    expect(fromKg(100, "LBS")).toBeCloseTo(220.462, 2);
  });

  it("round-trips through toKg for LBS", () => {
    expect(fromKg(toKg(185.5, "LBS"), "LBS")).toBeCloseTo(185.5, 8);
  });

  it("round-trips through toKg for KG", () => {
    expect(fromKg(toKg(100, "KG"), "KG")).toBe(100);
  });
});

describe("toCm", () => {
  it("returns value unchanged for KG (metric)", () => {
    expect(toCm(180, "KG")).toBe(180);
  });

  it("converts inches to cm for LBS (imperial)", () => {
    expect(toCm(70, "LBS")).toBeCloseTo(177.8, 4);
  });

  it("handles zero", () => {
    expect(toCm(0, "LBS")).toBe(0);
  });
});

describe("fromCm", () => {
  it("returns cm unchanged for KG", () => {
    expect(fromCm(180, "KG")).toBe(180);
  });

  it("converts cm to inches for LBS", () => {
    expect(fromCm(177.8, "LBS")).toBeCloseTo(70, 4);
  });

  it("round-trips through toCm for LBS", () => {
    const inches = 72.5;
    expect(fromCm(toCm(inches, "LBS"), "LBS")).toBeCloseTo(inches, 8);
  });
});

describe("weightUnitLabel", () => {
  it('returns "kg" for KG', () => expect(weightUnitLabel("KG")).toBe("kg"));
  it('returns "lbs" for LBS', () => expect(weightUnitLabel("LBS")).toBe("lbs"));
});

describe("lengthUnitLabel", () => {
  it('returns "cm" for KG', () => expect(lengthUnitLabel("KG")).toBe("cm"));
  it('returns "in" for LBS', () => expect(lengthUnitLabel("LBS")).toBe("in"));
});
