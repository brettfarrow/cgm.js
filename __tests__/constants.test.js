const {
  Region,
  DEXCOM_APPLICATION_IDS,
  DEXCOM_BASE_URLS,
  DEXCOM_LOGIN_ID_ENDPOINT,
  DEXCOM_AUTHENTICATE_ENDPOINT,
  DEXCOM_GLUCOSE_READINGS_ENDPOINT,
  HEADERS,
  DEXCOM_TREND_DIRECTIONS,
  TREND_DESCRIPTIONS,
  TREND_ARROWS,
  DEFAULT_UUID,
  MAX_MINUTES,
  MAX_MAX_COUNT,
  MMOL_L_CONVERSION_FACTOR,
} = require("../constants");

describe("Region", () => {
  test("has US, OUS, and JP values", () => {
    expect(Region.US).toBe("us");
    expect(Region.OUS).toBe("ous");
    expect(Region.JP).toBe("jp");
  });

  test("is frozen", () => {
    expect(Object.isFrozen(Region)).toBe(true);
  });

  test("has exactly 3 regions", () => {
    expect(Object.keys(Region)).toHaveLength(3);
  });
});

describe("DEXCOM_APPLICATION_IDS", () => {
  test("maps each region to an application ID", () => {
    expect(DEXCOM_APPLICATION_IDS[Region.US]).toBeDefined();
    expect(DEXCOM_APPLICATION_IDS[Region.OUS]).toBeDefined();
    expect(DEXCOM_APPLICATION_IDS[Region.JP]).toBeDefined();
  });

  test("US and OUS share the same application ID", () => {
    expect(DEXCOM_APPLICATION_IDS[Region.US]).toBe(
      DEXCOM_APPLICATION_IDS[Region.OUS],
    );
  });

  test("JP has a different application ID", () => {
    expect(DEXCOM_APPLICATION_IDS[Region.JP]).not.toBe(
      DEXCOM_APPLICATION_IDS[Region.US],
    );
    expect(DEXCOM_APPLICATION_IDS[Region.JP]).toBe(
      "d8665ade-9673-4e27-9ff6-92db4ce13d13",
    );
  });

  test("is frozen", () => {
    expect(Object.isFrozen(DEXCOM_APPLICATION_IDS)).toBe(true);
  });
});

describe("DEXCOM_BASE_URLS", () => {
  test("maps each region to a base URL", () => {
    expect(DEXCOM_BASE_URLS[Region.US]).toBe(
      "https://share2.dexcom.com/ShareWebServices/Services/",
    );
    expect(DEXCOM_BASE_URLS[Region.OUS]).toBe(
      "https://shareous1.dexcom.com/ShareWebServices/Services/",
    );
    expect(DEXCOM_BASE_URLS[Region.JP]).toBe(
      "https://share.dexcom.jp/ShareWebServices/Services/",
    );
  });

  test("all URLs end with trailing slash", () => {
    Object.values(DEXCOM_BASE_URLS).forEach((url) => {
      expect(url.endsWith("/")).toBe(true);
    });
  });

  test("all URLs use HTTPS", () => {
    Object.values(DEXCOM_BASE_URLS).forEach((url) => {
      expect(url.startsWith("https://")).toBe(true);
    });
  });

  test("is frozen", () => {
    expect(Object.isFrozen(DEXCOM_BASE_URLS)).toBe(true);
  });
});

describe("API endpoints", () => {
  test("authenticate endpoint", () => {
    expect(DEXCOM_AUTHENTICATE_ENDPOINT).toBe(
      "General/AuthenticatePublisherAccount",
    );
  });

  test("login endpoint", () => {
    expect(DEXCOM_LOGIN_ID_ENDPOINT).toBe(
      "General/LoginPublisherAccountById",
    );
  });

  test("glucose readings endpoint", () => {
    expect(DEXCOM_GLUCOSE_READINGS_ENDPOINT).toBe(
      "Publisher/ReadPublisherLatestGlucoseValues",
    );
  });
});

describe("HEADERS", () => {
  test("includes Content-Type", () => {
    expect(HEADERS["Content-Type"]).toBe("application/json");
  });

  test("includes Accept-Encoding", () => {
    expect(HEADERS["Accept-Encoding"]).toBe("application/json");
  });

  test("is frozen", () => {
    expect(Object.isFrozen(HEADERS)).toBe(true);
  });
});

describe("DEXCOM_TREND_DIRECTIONS", () => {
  test("maps all 10 direction strings to integers 0-9", () => {
    expect(DEXCOM_TREND_DIRECTIONS.None).toBe(0);
    expect(DEXCOM_TREND_DIRECTIONS.DoubleUp).toBe(1);
    expect(DEXCOM_TREND_DIRECTIONS.SingleUp).toBe(2);
    expect(DEXCOM_TREND_DIRECTIONS.FortyFiveUp).toBe(3);
    expect(DEXCOM_TREND_DIRECTIONS.Flat).toBe(4);
    expect(DEXCOM_TREND_DIRECTIONS.FortyFiveDown).toBe(5);
    expect(DEXCOM_TREND_DIRECTIONS.SingleDown).toBe(6);
    expect(DEXCOM_TREND_DIRECTIONS.DoubleDown).toBe(7);
    expect(DEXCOM_TREND_DIRECTIONS.NotComputable).toBe(8);
    expect(DEXCOM_TREND_DIRECTIONS.RateOutOfRange).toBe(9);
  });

  test("has exactly 10 entries", () => {
    expect(Object.keys(DEXCOM_TREND_DIRECTIONS)).toHaveLength(10);
  });

  test("is frozen", () => {
    expect(Object.isFrozen(DEXCOM_TREND_DIRECTIONS)).toBe(true);
  });
});

describe("TREND_DESCRIPTIONS", () => {
  test("has 10 entries matching trend direction indices", () => {
    expect(TREND_DESCRIPTIONS).toHaveLength(10);
  });

  test("index 0 is empty string (None)", () => {
    expect(TREND_DESCRIPTIONS[0]).toBe("");
  });

  test("known descriptions", () => {
    expect(TREND_DESCRIPTIONS[1]).toBe("rising quickly");
    expect(TREND_DESCRIPTIONS[4]).toBe("steady");
    expect(TREND_DESCRIPTIONS[7]).toBe("falling quickly");
  });

  test("is frozen", () => {
    expect(Object.isFrozen(TREND_DESCRIPTIONS)).toBe(true);
  });
});

describe("TREND_ARROWS", () => {
  test("has 10 entries matching trend direction indices", () => {
    expect(TREND_ARROWS).toHaveLength(10);
  });

  test("index 0 is empty string (None)", () => {
    expect(TREND_ARROWS[0]).toBe("");
  });

  test("known arrows", () => {
    expect(TREND_ARROWS[1]).toBe("\u2191\u2191"); // ↑↑
    expect(TREND_ARROWS[4]).toBe("\u2192"); // →
    expect(TREND_ARROWS[7]).toBe("\u2193\u2193"); // ↓↓
  });

  test("is frozen", () => {
    expect(Object.isFrozen(TREND_ARROWS)).toBe(true);
  });
});

describe("TREND_DESCRIPTIONS and TREND_ARROWS alignment", () => {
  test("same length as DEXCOM_TREND_DIRECTIONS", () => {
    const directionCount = Object.keys(DEXCOM_TREND_DIRECTIONS).length;
    expect(TREND_DESCRIPTIONS).toHaveLength(directionCount);
    expect(TREND_ARROWS).toHaveLength(directionCount);
  });
});

describe("DEFAULT_UUID", () => {
  test("is all-zero UUID", () => {
    expect(DEFAULT_UUID).toBe("00000000-0000-0000-0000-000000000000");
  });

  test("is valid UUID format", () => {
    expect(DEFAULT_UUID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe("MAX_MINUTES", () => {
  test("is 1440 (24 hours)", () => {
    expect(MAX_MINUTES).toBe(1440);
  });
});

describe("MAX_MAX_COUNT", () => {
  test("is 288 (one reading per 5 minutes for 24 hours)", () => {
    expect(MAX_MAX_COUNT).toBe(288);
  });
});

describe("MMOL_L_CONVERSION_FACTOR", () => {
  test("is 0.0555", () => {
    expect(MMOL_L_CONVERSION_FACTOR).toBe(0.0555);
  });

  test("converts 100 mg/dL to approximately 5.5 mmol/L", () => {
    expect(parseFloat((100 * MMOL_L_CONVERSION_FACTOR).toFixed(1))).toBe(5.5);
  });
});
