import { describe, test, expectTypeOf } from "vitest";
import {
  Dexcom,
  GlucoseReading,
  Region,
  ArgumentError,
  ArgumentErrorEnum,
  DexcomError,
  type DexcomOptions,
  type GlucoseReadingJson,
  type Trend,
  type TrendDirection,
} from "../src/index.js";

describe("public types", () => {
  test("Region is a union of region codes", () => {
    expectTypeOf<Region>().toEqualTypeOf<"us" | "ous" | "jp">();
    expectTypeOf(Region.OUS).toEqualTypeOf<"ous">();
  });

  test("Dexcom options require a password", () => {
    expectTypeOf<DexcomOptions["password"]>().toEqualTypeOf<string>();
    expectTypeOf<DexcomOptions>().toHaveProperty("region");
    // @ts-expect-error options are required
    new Dexcom();
    // @ts-expect-error region must be a known Region
    new Dexcom({ username: "u", password: "p", region: "eu" });
  });

  test("reading methods return GlucoseReading values", () => {
    expectTypeOf<Dexcom["getGlucoseReadings"]>().returns.resolves.toEqualTypeOf<
      GlucoseReading[]
    >();
    expectTypeOf<
      Dexcom["getCurrentGlucoseReading"]
    >().returns.resolves.toEqualTypeOf<GlucoseReading | null>();
  });

  test("GlucoseReading exposes typed trend data", () => {
    expectTypeOf<GlucoseReading["trend"]>().toEqualTypeOf<Trend>();
    expectTypeOf<Trend>().toEqualTypeOf<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9>();
    expectTypeOf<GlucoseReading["trendDirection"]>().toEqualTypeOf<TrendDirection>();
    expectTypeOf<GlucoseReading["json"]>().toEqualTypeOf<GlucoseReadingJson>();
  });

  test("error enums narrow per error class", () => {
    expectTypeOf<ArgumentError["enum"]>().toEqualTypeOf<ArgumentErrorEnum | null>();
    expectTypeOf<ArgumentError>().toExtend<DexcomError>();
    expectTypeOf(
      ArgumentErrorEnum.MINUTES_INVALID,
    ).toEqualTypeOf<"Minutes must be an integer between 1 and 1440">();
  });
});
