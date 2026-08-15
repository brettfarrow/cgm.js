const mockFetch = jest.fn();
global.fetch = mockFetch;

const { inspect } = require("node:util");

const { Dexcom, GlucoseReading, Region } = require("../cgm");
const {
  AccountError,
  AccountErrorEnum,
  ArgumentError,
  ArgumentErrorEnum,
  SessionError,
  SessionErrorEnum,
  ServerError,
  ServerErrorEnum,
  DexcomError,
} = require("../errors");
const {
  DEFAULT_UUID,
  MAX_MINUTES,
  MAX_MAX_COUNT,
  DEXCOM_TREND_DIRECTIONS,
  TREND_DESCRIPTIONS,
  TREND_ARROWS,
  MMOL_L_CONVERSION_FACTOR,
  MAX_POST_ATTEMPTS,
  DEFAULT_REQUEST_TIMEOUT_MS,
} = require("../constants");

// --- Helpers ---

const VALID_ACCOUNT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const VALID_SESSION_ID = "11111111-2222-3333-4444-555555555555";

function mockResponse(body, { ok = true, status = 200, headers = {} } = {}) {
  return Promise.resolve({
    ok,
    status,
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(body),
  });
}

function mockJsonError({ ok = false, status = 500 } = {}) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.reject(new SyntaxError("Unexpected token")),
  });
}

function sampleGlucoseJson(overrides = {}) {
  return {
    WT: "Date(1691455258000)",
    ST: "Date(1691455258000)",
    DT: "Date(1691455258000-0400)",
    Value: 120,
    Trend: "Flat",
    ...overrides,
  };
}

function createAuthenticatedDexcom(opts = {}) {
  const dexcom = new Dexcom({
    username: "testuser",
    password: "testpass",
    ...opts,
  });
  dexcom._accountId = VALID_ACCOUNT_ID;
  dexcom._sessionId = VALID_SESSION_ID;
  return dexcom;
}

function mockSuccessfulAuth() {
  mockFetch
    .mockReturnValueOnce(mockResponse(VALID_ACCOUNT_ID))
    .mockReturnValueOnce(mockResponse(VALID_SESSION_ID));
}

beforeEach(() => {
  mockFetch.mockReset();
});

// =============================================================================
// GlucoseReading
// =============================================================================

describe("GlucoseReading", () => {
  describe("constructor with string trend", () => {
    test("parses a standard glucose reading", () => {
      const reading = new GlucoseReading(sampleGlucoseJson());
      expect(reading.value).toBe(120);
      expect(reading.mgdL).toBe(120);
      expect(reading.trend).toBe(4);
      expect(reading.trendDirection).toBe("Flat");
      expect(reading.trendDescription).toBe("steady");
      expect(reading.trendArrow).toBe("\u2192");
      expect(reading.time).toBeInstanceOf(Date);
      expect(reading.time.getTime()).toBe(1691455258000);
    });

    test.each([
      ["None", 0],
      ["DoubleUp", 1],
      ["SingleUp", 2],
      ["FortyFiveUp", 3],
      ["Flat", 4],
      ["FortyFiveDown", 5],
      ["SingleDown", 6],
      ["DoubleDown", 7],
      ["NotComputable", 8],
      ["RateOutOfRange", 9],
    ])("parses trend direction %s as %i", (direction, expectedTrend) => {
      const reading = new GlucoseReading(
        sampleGlucoseJson({ Trend: direction }),
      );
      expect(reading.trend).toBe(expectedTrend);
      expect(reading.trendDirection).toBe(direction);
      expect(reading.trendDescription).toBe(
        TREND_DESCRIPTIONS[expectedTrend],
      );
      expect(reading.trendArrow).toBe(TREND_ARROWS[expectedTrend]);
    });
  });

  describe("constructor with numeric trend", () => {
    test("accepts numeric trend and resolves direction string", () => {
      const reading = new GlucoseReading(sampleGlucoseJson({ Trend: 4 }));
      expect(reading.trend).toBe(4);
      expect(reading.trendDirection).toBe("Flat");
    });

    test("resolves unknown numeric trend to None", () => {
      const reading = new GlucoseReading(sampleGlucoseJson({ Trend: 99 }));
      expect(reading.trend).toBe(0);
      expect(reading.trendDirection).toBe("None");
      expect(reading.trendDescription).toBe("");
      expect(reading.trendArrow).toBe("");
    });

    test("resolves unknown string trend to None", () => {
      const reading = new GlucoseReading(
        sampleGlucoseJson({ Trend: "UnknownFutureTrend" }),
      );
      expect(reading.trend).toBe(0);
      expect(reading.trendDirection).toBe("None");
    });
  });

  describe("value properties", () => {
    test("value and mgdL are the same", () => {
      const reading = new GlucoseReading(sampleGlucoseJson({ Value: 85 }));
      expect(reading.value).toBe(85);
      expect(reading.mgdL).toBe(85);
    });

    test("mmolL converts correctly", () => {
      const reading = new GlucoseReading(sampleGlucoseJson({ Value: 100 }));
      expect(reading.mmolL).toBe(
        parseFloat((100 * MMOL_L_CONVERSION_FACTOR).toFixed(1)),
      );
      expect(reading.mmolL).toBe(5.5);
    });

    test("mmolL for low value", () => {
      const reading = new GlucoseReading(sampleGlucoseJson({ Value: 40 }));
      expect(reading.mmolL).toBe(
        parseFloat((40 * MMOL_L_CONVERSION_FACTOR).toFixed(1)),
      );
    });

    test("mmolL for high value", () => {
      const reading = new GlucoseReading(sampleGlucoseJson({ Value: 400 }));
      expect(reading.mmolL).toBe(
        parseFloat((400 * MMOL_L_CONVERSION_FACTOR).toFixed(1)),
      );
    });
  });

  describe("timestamp parsing", () => {
    test("parses DT field with negative timezone offset", () => {
      const reading = new GlucoseReading(
        sampleGlucoseJson({ DT: "Date(1691455258000-0400)" }),
      );
      expect(reading.time.getTime()).toBe(1691455258000);
    });

    test("parses DT field with positive timezone offset", () => {
      const reading = new GlucoseReading(
        sampleGlucoseJson({ DT: "Date(1691455258000+0530)" }),
      );
      expect(reading.time.getTime()).toBe(1691455258000);
    });

    test("parses DT field with zero timezone offset", () => {
      const reading = new GlucoseReading(
        sampleGlucoseJson({ DT: "Date(1691455258000+0000)" }),
      );
      expect(reading.time.getTime()).toBe(1691455258000);
    });
  });

  describe("json property", () => {
    test("preserves original JSON", () => {
      const json = sampleGlucoseJson();
      const reading = new GlucoseReading(json);
      expect(reading.json).toBe(json);
      expect(reading.json.Value).toBe(120);
      expect(reading.json.DT).toBe("Date(1691455258000-0400)");
    });
  });

  describe("toString", () => {
    test("returns value as string", () => {
      const reading = new GlucoseReading(sampleGlucoseJson({ Value: 120 }));
      expect(reading.toString()).toBe("120");
    });
  });

  describe("invalid input", () => {
    test("throws ArgumentError for missing Value", () => {
      const json = sampleGlucoseJson();
      delete json.Value;
      expect(() => new GlucoseReading(json)).toThrow(ArgumentError);
      try {
        new GlucoseReading(json);
      } catch (e) {
        expect(e.enum).toBe(ArgumentErrorEnum.GLUCOSE_READING_INVALID);
      }
    });

    test("throws ArgumentError for missing DT", () => {
      const json = sampleGlucoseJson();
      delete json.DT;
      expect(() => new GlucoseReading(json)).toThrow(ArgumentError);
    });

    test("throws ArgumentError for malformed DT", () => {
      expect(
        () => new GlucoseReading(sampleGlucoseJson({ DT: "not-a-date" })),
      ).toThrow(ArgumentError);
    });

    test.each([
      "120oops",
      "120.5",
      120.5,
      Infinity,
      0,
      -1,
      Number.MAX_SAFE_INTEGER + 1,
    ])(
      "throws ArgumentError for invalid glucose value %p",
      (value) => {
        expect(
          () => new GlucoseReading(sampleGlucoseJson({ Value: value })),
        ).toThrow(ArgumentError);
      },
    );

    test("accepts a complete integer string", () => {
      expect(
        new GlucoseReading(sampleGlucoseJson({ Value: "120" })).value,
      ).toBe(120);
    });

    test("rejects a timestamp with extra surrounding text", () => {
      expect(
        () =>
          new GlucoseReading(
            sampleGlucoseJson({ DT: "prefixDate(1691455258000-0400)suffix" }),
          ),
      ).toThrow(ArgumentError);
    });

    test("rejects an out-of-range timestamp", () => {
      expect(
        () =>
          new GlucoseReading(
            sampleGlucoseJson({ DT: "Date(9999999999999999-0400)" }),
          ),
      ).toThrow(ArgumentError);
    });

    test("throws ArgumentError for null input", () => {
      expect(() => new GlucoseReading(null)).toThrow(ArgumentError);
    });

    test("throws ArgumentError for empty object", () => {
      expect(() => new GlucoseReading({})).toThrow(ArgumentError);
    });
  });
});

// =============================================================================
// Dexcom constructor
// =============================================================================

describe("Dexcom constructor", () => {
  describe("valid construction", () => {
    test("with username and password (US default)", () => {
      const dexcom = new Dexcom({ username: "user", password: "pass" });
      expect(dexcom.username).toBe("user");
      expect(dexcom.accountId).toBeNull();
      expect(dexcom._sessionId).toBeNull();
    });

    test("with accountId and password", () => {
      const dexcom = new Dexcom({
        accountId: VALID_ACCOUNT_ID,
        password: "pass",
      });
      expect(dexcom.username).toBeNull();
      expect(dexcom.accountId).toBe(VALID_ACCOUNT_ID);
    });

    test("with region US", () => {
      const dexcom = new Dexcom({
        username: "user",
        password: "pass",
        region: Region.US,
      });
      expect(dexcom._baseUrl).toContain("share2.dexcom.com");
    });

    test("with region OUS", () => {
      const dexcom = new Dexcom({
        username: "user",
        password: "pass",
        region: Region.OUS,
      });
      expect(dexcom._baseUrl).toContain("shareous1.dexcom.com");
    });

    test("with region JP", () => {
      const dexcom = new Dexcom({
        username: "user",
        password: "pass",
        region: Region.JP,
      });
      expect(dexcom._baseUrl).toContain("share.dexcom.jp");
    });

    test("JP uses different application ID", () => {
      const jp = new Dexcom({
        username: "user",
        password: "pass",
        region: Region.JP,
      });
      const us = new Dexcom({
        username: "user",
        password: "pass",
        region: Region.US,
      });
      expect(jp._applicationId).not.toBe(us._applicationId);
    });

    test("does not expose the password or session ID when logged", () => {
      const dexcom = createAuthenticatedDexcom();

      expect(JSON.stringify(dexcom)).not.toContain("testpass");
      expect(JSON.stringify(dexcom)).not.toContain(VALID_SESSION_ID);
      expect(inspect(dexcom)).not.toContain("testpass");
      expect(inspect(dexcom)).not.toContain(VALID_SESSION_ID);
    });

    test("uses the default request timeout", () => {
      const dexcom = new Dexcom({ username: "user", password: "pass" });
      expect(dexcom._requestTimeoutMs).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
    });

    test("accepts a custom request timeout", () => {
      const dexcom = new Dexcom({
        username: "user",
        password: "pass",
        requestTimeoutMs: 5000,
      });
      expect(dexcom._requestTimeoutMs).toBe(5000);
    });
  });

  describe("validation errors", () => {
    test("throws USER_ID_REQUIRED with no username or accountId", () => {
      expect(() => new Dexcom({ password: "pass" })).toThrow(ArgumentError);
      try {
        new Dexcom({ password: "pass" });
      } catch (e) {
        expect(e.enum).toBe(ArgumentErrorEnum.USER_ID_REQUIRED);
      }
    });

    test("throws USER_ID_MULTIPLE with both username and accountId", () => {
      expect(
        () =>
          new Dexcom({
            username: "user",
            accountId: VALID_ACCOUNT_ID,
            password: "pass",
          }),
      ).toThrow(ArgumentError);
      try {
        new Dexcom({
          username: "user",
          accountId: VALID_ACCOUNT_ID,
          password: "pass",
        });
      } catch (e) {
        expect(e.enum).toBe(ArgumentErrorEnum.USER_ID_MULTIPLE);
      }
    });

    test.each([0, -1, 1.5, "1000", null, 2147483648])(
      "throws REQUEST_TIMEOUT_INVALID for timeout %p",
      (requestTimeoutMs) => {
        expect(
          () =>
            new Dexcom({
              username: "user",
              password: "pass",
              requestTimeoutMs,
            }),
        ).toThrow(ArgumentError);
      },
    );

    test("throws REGION_INVALID with invalid region", () => {
      expect(
        () =>
          new Dexcom({
            username: "user",
            password: "pass",
            region: "invalid",
          }),
      ).toThrow(ArgumentError);
      try {
        new Dexcom({
          username: "user",
          password: "pass",
          region: "invalid",
        });
      } catch (e) {
        expect(e.enum).toBe(ArgumentErrorEnum.REGION_INVALID);
      }
    });
  });

  describe("getter properties", () => {
    test("username getter returns username", () => {
      const dexcom = new Dexcom({ username: "myuser", password: "pass" });
      expect(dexcom.username).toBe("myuser");
    });

    test("accountId getter returns accountId", () => {
      const dexcom = new Dexcom({
        accountId: VALID_ACCOUNT_ID,
        password: "pass",
      });
      expect(dexcom.accountId).toBe(VALID_ACCOUNT_ID);
    });

    test("username getter returns null when using accountId", () => {
      const dexcom = new Dexcom({
        accountId: VALID_ACCOUNT_ID,
        password: "pass",
      });
      expect(dexcom.username).toBeNull();
    });

    test("accountId getter returns null when using username (before session)", () => {
      const dexcom = new Dexcom({ username: "user", password: "pass" });
      expect(dexcom.accountId).toBeNull();
    });
  });
});

// =============================================================================
// Dexcom._handleErrorCode
// =============================================================================

describe("Dexcom._handleErrorCode", () => {
  let dexcom;

  beforeEach(() => {
    dexcom = new Dexcom({ username: "user", password: "pass" });
  });

  test("SessionIdNotFound returns SessionError NOT_FOUND", () => {
    const err = dexcom._handleErrorCode({
      Code: "SessionIdNotFound",
      Message: "Session ID not found",
    });
    expect(err).toBeInstanceOf(SessionError);
    expect(err.enum).toBe(SessionErrorEnum.NOT_FOUND);
  });

  test("SessionNotValid returns SessionError INVALID", () => {
    const err = dexcom._handleErrorCode({
      Code: "SessionNotValid",
      Message: "Session not valid",
    });
    expect(err).toBeInstanceOf(SessionError);
    expect(err.enum).toBe(SessionErrorEnum.INVALID);
  });

  test("AccountPasswordInvalid returns AccountError FAILED_AUTHENTICATION", () => {
    const err = dexcom._handleErrorCode({
      Code: "AccountPasswordInvalid",
      Message: "Password invalid",
    });
    expect(err).toBeInstanceOf(AccountError);
    expect(err.enum).toBe(AccountErrorEnum.FAILED_AUTHENTICATION);
  });

  test("SSO_AuthenticateMaxAttemptsExceeded returns AccountError MAX_ATTEMPTS", () => {
    const err = dexcom._handleErrorCode({
      Code: "SSO_AuthenticateMaxAttemptsExceeded",
      Message: "Max attempts",
    });
    expect(err).toBeInstanceOf(AccountError);
    expect(err.enum).toBe(AccountErrorEnum.MAX_ATTEMPTS);
  });

  test("SSO_InternalError with AccountName message returns AccountError", () => {
    const err = dexcom._handleErrorCode({
      Code: "SSO_InternalError",
      Message: "Cannot Authenticate by AccountName",
    });
    expect(err).toBeInstanceOf(AccountError);
    expect(err.enum).toBe(AccountErrorEnum.FAILED_AUTHENTICATION);
  });

  test("SSO_InternalError with AccountId message returns AccountError", () => {
    const err = dexcom._handleErrorCode({
      Code: "SSO_InternalError",
      Message: "Cannot Authenticate by AccountId",
    });
    expect(err).toBeInstanceOf(AccountError);
    expect(err.enum).toBe(AccountErrorEnum.FAILED_AUTHENTICATION);
  });

  test("InvalidArgument with accountName returns ArgumentError USERNAME_INVALID", () => {
    const err = dexcom._handleErrorCode({
      Code: "InvalidArgument",
      Message: "accountName is invalid",
    });
    expect(err).toBeInstanceOf(ArgumentError);
    expect(err.enum).toBe(ArgumentErrorEnum.USERNAME_INVALID);
  });

  test("InvalidArgument with password returns ArgumentError PASSWORD_INVALID", () => {
    const err = dexcom._handleErrorCode({
      Code: "InvalidArgument",
      Message: "password is invalid",
    });
    expect(err).toBeInstanceOf(ArgumentError);
    expect(err.enum).toBe(ArgumentErrorEnum.PASSWORD_INVALID);
  });

  test("InvalidArgument with UUID returns ArgumentError ACCOUNT_ID_INVALID", () => {
    const err = dexcom._handleErrorCode({
      Code: "InvalidArgument",
      Message: "UUID is not valid",
    });
    expect(err).toBeInstanceOf(ArgumentError);
    expect(err.enum).toBe(ArgumentErrorEnum.ACCOUNT_ID_INVALID);
  });

  test("unknown code with message returns ServerError UNKNOWN_CODE", () => {
    const err = dexcom._handleErrorCode({
      Code: "SomeNewCode",
      Message: "Something happened",
    });
    expect(err).toBeInstanceOf(ServerError);
    expect(err.enum).toBe(ServerErrorEnum.UNKNOWN_CODE);
  });

  test("no code or message returns ServerError UNEXPECTED", () => {
    const err = dexcom._handleErrorCode({});
    expect(err).toBeInstanceOf(ServerError);
    expect(err.enum).toBe(ServerErrorEnum.UNEXPECTED);
  });

  test("SSO_InternalError without auth message falls through to UNKNOWN_CODE", () => {
    const err = dexcom._handleErrorCode({
      Code: "SSO_InternalError",
      Message: "Some other internal error",
    });
    expect(err).toBeInstanceOf(ServerError);
    expect(err.enum).toBe(ServerErrorEnum.UNKNOWN_CODE);
  });
});

// =============================================================================
// Dexcom._post
// =============================================================================

describe("Dexcom._post", () => {
  let dexcom;
  let setTimeoutSpy;
  let backoffDelays;

  beforeEach(() => {
    dexcom = createAuthenticatedDexcom();
    // Skip real backoff delays between retries, recording them instead
    backoffDelays = [];
    setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback, ms) => {
        backoffDelays.push(ms);
        callback();
        return 0;
      });
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
  });

  test("returns parsed JSON on success", async () => {
    mockFetch.mockReturnValueOnce(mockResponse({ result: "ok" }));
    const result = await dexcom._post("TestEndpoint", null, { key: "val" });
    expect(result).toEqual({ result: "ok" });
  });

  test("sends POST with correct headers", async () => {
    mockFetch.mockReturnValueOnce(mockResponse("ok"));
    await dexcom._post("TestEndpoint", null, { key: "val" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("TestEndpoint"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
      }),
    );
  });

  test("appends query params when provided", async () => {
    mockFetch.mockReturnValueOnce(mockResponse("ok"));
    await dexcom._post("TestEndpoint", { sessionId: "abc", minutes: 10 });
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("?");
    expect(calledUrl).toContain("sessionId=abc");
    expect(calledUrl).toContain("minutes=10");
  });

  test("no query string when params is null", async () => {
    mockFetch.mockReturnValueOnce(mockResponse("ok"));
    await dexcom._post("TestEndpoint", null, {});
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).not.toContain("?");
  });

  test("sends empty JSON body when json is null", async () => {
    mockFetch.mockReturnValueOnce(mockResponse("ok"));
    await dexcom._post("TestEndpoint");
    const calledBody = mockFetch.mock.calls[0][1].body;
    expect(calledBody).toBe("{}");
  });

  test("throws ServerError UNEXPECTED on network error", async () => {
    const networkError = new Error("Network failed");
    mockFetch.mockImplementation(() => Promise.reject(networkError));
    await expect(dexcom._post("TestEndpoint")).rejects.toThrow(ServerError);
    try {
      await dexcom._post("TestEndpoint");
    } catch (e) {
      expect(e.enum).toBe(ServerErrorEnum.UNEXPECTED);
      expect(e.cause).toBe(networkError);
    }
  });

  test("throws ServerError INVALID_JSON when response is not JSON", async () => {
    mockFetch.mockImplementation(() => mockJsonError());
    await expect(dexcom._post("TestEndpoint")).rejects.toThrow(ServerError);
    try {
      await dexcom._post("TestEndpoint");
    } catch (e) {
      expect(e.enum).toBe(ServerErrorEnum.INVALID_JSON);
      expect(e.cause).toBeInstanceOf(SyntaxError);
    }
  });

  test("retries transient failures and returns on success", async () => {
    mockFetch
      .mockReturnValueOnce(Promise.reject(new Error("Network failed")))
      .mockReturnValueOnce(mockJsonError())
      .mockReturnValueOnce(mockResponse({ result: "ok" }));

    const result = await dexcom._post("TestEndpoint");

    expect(result).toEqual({ result: "ok" });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test("retries unknown server error codes", async () => {
    mockFetch
      .mockReturnValueOnce(
        mockResponse(
          { Code: "SomeNewCode", Message: "Something happened" },
          { ok: false, status: 500 },
        ),
      )
      .mockReturnValueOnce(mockResponse({ result: "ok" }));

    const result = await dexcom._post("TestEndpoint");

    expect(result).toEqual({ result: "ok" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("does not retry an unknown client error", async () => {
    mockFetch.mockImplementation(() =>
      mockResponse(
        { Code: "UnknownClientError", Message: "Bad request" },
        { ok: false, status: 400 },
      ),
    );

    await expect(dexcom._post("TestEndpoint")).rejects.toThrow(ServerError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(backoffDelays).toEqual([]);
  });

  test("does not retry malformed JSON from a client error", async () => {
    mockFetch.mockImplementation(() => mockJsonError({ status: 403 }));

    await expect(dexcom._post("TestEndpoint")).rejects.toThrow(ServerError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("honors Retry-After when it exceeds exponential backoff", async () => {
    mockFetch
      .mockReturnValueOnce(
        mockResponse(
          { Code: "RateLimited", Message: "Try later" },
          {
            ok: false,
            status: 429,
            headers: { "retry-after": "10" },
          },
        ),
      )
      .mockReturnValueOnce(mockResponse({ result: "ok" }));

    await expect(dexcom._post("TestEndpoint")).resolves.toEqual({
      result: "ok",
    });
    expect(backoffDelays).toEqual([10000]);
  });

  test("honors an HTTP-date Retry-After value", async () => {
    const now = 2000000000000;
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);
    mockFetch
      .mockReturnValueOnce(
        mockResponse(
          { Code: "RateLimited", Message: "Try later" },
          {
            ok: false,
            status: 429,
            headers: {
              "retry-after": new Date(now + 12000).toUTCString(),
            },
          },
        ),
      )
      .mockReturnValueOnce(mockResponse({ result: "ok" }));

    try {
      await expect(dexcom._post("TestEndpoint")).resolves.toEqual({
        result: "ok",
      });
      expect(backoffDelays).toEqual([12000]);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  test("ignores an invalid Retry-After value", async () => {
    mockFetch
      .mockReturnValueOnce(
        mockResponse(
          { Code: "RateLimited", Message: "Try later" },
          {
            ok: false,
            status: 429,
            headers: { "retry-after": "not-a-date" },
          },
        ),
      )
      .mockReturnValueOnce(mockResponse({ result: "ok" }));

    await expect(dexcom._post("TestEndpoint")).resolves.toEqual({
      result: "ok",
    });
    expect(backoffDelays).toEqual([2000]);
  });

  test("gives up after MAX_POST_ATTEMPTS on persistent failure", async () => {
    mockFetch.mockImplementation(() => mockJsonError());

    await expect(dexcom._post("TestEndpoint")).rejects.toThrow(ServerError);
    expect(mockFetch).toHaveBeenCalledTimes(MAX_POST_ATTEMPTS);
  });

  test("waits with exponential backoff between retries (2s, 4s, 8s)", async () => {
    mockFetch.mockImplementation(() => mockJsonError());

    await expect(dexcom._post("TestEndpoint")).rejects.toThrow(ServerError);
    expect(backoffDelays).toEqual([2000, 4000, 8000]);
  });

  test("does not retry session errors", async () => {
    mockFetch.mockImplementation(() =>
      mockResponse(
        { Code: "SessionNotValid", Message: "Session not valid" },
        { ok: false, status: 500 },
      ),
    );

    await expect(dexcom._post("TestEndpoint")).rejects.toThrow(SessionError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("stops retrying when the caller aborts during backoff", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Cancelled", "AbortError");
    mockFetch.mockRejectedValue(new Error("Network failed"));
    setTimeoutSpy.mockImplementation((callback, ms) => {
      backoffDelays.push(ms);
      controller.abort(reason);
      callback();
      return 0;
    });

    await expect(
      dexcom._post("TestEndpoint", null, null, {
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("does not start a request when the caller already aborted", async () => {
    const controller = new AbortController();
    const reason = new DOMException("Cancelled", "AbortError");
    controller.abort(reason);

    await expect(
      dexcom._post("TestEndpoint", null, null, {
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("aborts a hung request after the configured timeout", async () => {
    dexcom = createAuthenticatedDexcom({ requestTimeoutMs: 5 });
    mockFetch.mockImplementation((_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
    );

    await expect(dexcom._post("TestEndpoint")).rejects.toMatchObject({
      name: "ServerError",
      enum: ServerErrorEnum.UNEXPECTED,
      cause: expect.objectContaining({ name: "TimeoutError" }),
    });
    expect(mockFetch).toHaveBeenCalledTimes(MAX_POST_ATTEMPTS);
  });

  test("throws error from _handleErrorCode on non-OK response", async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse(
        { Code: "SessionNotValid", Message: "Session not valid" },
        { ok: false, status: 500 },
      ),
    );
    await expect(dexcom._post("TestEndpoint")).rejects.toThrow(SessionError);
  });

  test("handles 400 errors (not just 500)", async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse(
        { Code: "InvalidArgument", Message: "accountName is bad" },
        { ok: false, status: 400 },
      ),
    );
    await expect(dexcom._post("TestEndpoint")).rejects.toThrow(ArgumentError);
  });

  test("handles 401 errors", async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse(
        { Code: "AccountPasswordInvalid", Message: "Unauthorized" },
        { ok: false, status: 401 },
      ),
    );
    await expect(dexcom._post("TestEndpoint")).rejects.toThrow(AccountError);
  });
});

// =============================================================================
// Dexcom.createSession
// =============================================================================

describe("Dexcom.createSession", () => {
  test("with username: calls authenticate then login", async () => {
    const dexcom = new Dexcom({ username: "user", password: "pass" });
    mockSuccessfulAuth();

    await dexcom.createSession();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(dexcom._accountId).toBe(VALID_ACCOUNT_ID);
    expect(dexcom._sessionId).toBe(VALID_SESSION_ID);
  });

  test("with accountId: skips authenticate, calls only login", async () => {
    const dexcom = new Dexcom({
      accountId: VALID_ACCOUNT_ID,
      password: "pass",
    });
    mockFetch.mockReturnValueOnce(mockResponse(VALID_SESSION_ID));

    await dexcom.createSession();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(dexcom._sessionId).toBe(VALID_SESSION_ID);
  });

  test("does not retry a failed authentication request", async () => {
    const dexcom = new Dexcom({ username: "user", password: "pass" });
    mockFetch.mockRejectedValue(new Error("Connection dropped"));

    await expect(dexcom.createSession()).rejects.toThrow(ServerError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("sends correct JSON body for authenticate", async () => {
    const dexcom = new Dexcom({ username: "myuser", password: "mypass" });
    mockSuccessfulAuth();

    await dexcom.createSession();

    const authCall = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(authCall.accountName).toBe("myuser");
    expect(authCall.password).toBe("mypass");
    expect(authCall.applicationId).toBeDefined();
  });

  test("sends correct JSON body for login", async () => {
    const dexcom = new Dexcom({ username: "myuser", password: "mypass" });
    mockSuccessfulAuth();

    await dexcom.createSession();

    const loginCall = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(loginCall.accountId).toBe(VALID_ACCOUNT_ID);
    expect(loginCall.password).toBe("mypass");
    expect(loginCall.applicationId).toBeDefined();
  });

  test("uses region-specific application ID", async () => {
    const dexcom = new Dexcom({
      username: "user",
      password: "pass",
      region: Region.JP,
    });
    mockSuccessfulAuth();

    await dexcom.createSession();

    const authCall = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(authCall.applicationId).toBe(
      "d8665ade-9673-4e27-9ff6-92db4ce13d13",
    );
  });

  test("uses region-specific base URL", async () => {
    const dexcom = new Dexcom({
      username: "user",
      password: "pass",
      region: Region.OUS,
    });
    mockSuccessfulAuth();

    await dexcom.createSession();

    expect(mockFetch.mock.calls[0][0]).toContain("shareous1.dexcom.com");
  });

  test("throws ArgumentError PASSWORD_INVALID if password is empty", async () => {
    const dexcom = new Dexcom({ username: "user", password: "valid" });
    dexcom._password = "";
    await expect(dexcom.createSession()).rejects.toThrow(ArgumentError);
    try {
      await dexcom.createSession();
    } catch (e) {
      expect(e.enum).toBe(ArgumentErrorEnum.PASSWORD_INVALID);
    }
  });

  test("throws ArgumentError USERNAME_INVALID if username is invalid during session", async () => {
    const dexcom = new Dexcom({ username: "user", password: "pass" });
    dexcom._username = "";
    dexcom._accountId = null;
    await expect(dexcom.createSession()).rejects.toThrow(ArgumentError);
    try {
      dexcom._username = "";
      dexcom._accountId = null;
      await dexcom.createSession();
    } catch (e) {
      expect(e.enum).toBe(ArgumentErrorEnum.USERNAME_INVALID);
    }
  });

  test("throws ArgumentError ACCOUNT_ID_INVALID if authenticate returns non-UUID", async () => {
    const dexcom = new Dexcom({ username: "user", password: "pass" });
    mockFetch.mockReturnValueOnce(mockResponse("not-a-uuid"));
    await expect(dexcom.createSession()).rejects.toThrow(ArgumentError);
  });

  test("throws ArgumentError ACCOUNT_ID_DEFAULT if authenticate returns default UUID", async () => {
    const dexcom = new Dexcom({ username: "user", password: "pass" });
    mockFetch.mockReturnValueOnce(mockResponse(DEFAULT_UUID));
    await expect(dexcom.createSession()).rejects.toThrow(ArgumentError);
    try {
      dexcom._accountId = null;
      mockFetch.mockReturnValueOnce(mockResponse(DEFAULT_UUID));
      await dexcom.createSession();
    } catch (e) {
      expect(e.enum).toBe(ArgumentErrorEnum.ACCOUNT_ID_DEFAULT);
    }
  });

  test("throws ArgumentError SESSION_ID_INVALID if login returns non-UUID", async () => {
    const dexcom = new Dexcom({ username: "user", password: "pass" });
    mockFetch
      .mockReturnValueOnce(mockResponse(VALID_ACCOUNT_ID))
      .mockReturnValueOnce(mockResponse("bad-session"));
    await expect(dexcom.createSession()).rejects.toThrow(ArgumentError);
  });

  test("throws ArgumentError SESSION_ID_DEFAULT if login returns default UUID", async () => {
    const dexcom = new Dexcom({ username: "user", password: "pass" });
    mockFetch
      .mockReturnValueOnce(mockResponse(VALID_ACCOUNT_ID))
      .mockReturnValueOnce(mockResponse(DEFAULT_UUID));
    await expect(dexcom.createSession()).rejects.toThrow(ArgumentError);
    try {
      dexcom._accountId = null;
      mockFetch
        .mockReturnValueOnce(mockResponse(VALID_ACCOUNT_ID))
        .mockReturnValueOnce(mockResponse(DEFAULT_UUID));
      await dexcom.createSession();
    } catch (e) {
      expect(e.enum).toBe(ArgumentErrorEnum.SESSION_ID_DEFAULT);
    }
  });
});

// =============================================================================
// Dexcom.getGlucoseReadings
// =============================================================================

describe("Dexcom.getGlucoseReadings", () => {
  describe("with valid session", () => {
    test("returns array of GlucoseReading", async () => {
      const dexcom = createAuthenticatedDexcom();
      mockFetch.mockReturnValueOnce(
        mockResponse([sampleGlucoseJson(), sampleGlucoseJson({ Value: 85 })]),
      );

      const readings = await dexcom.getGlucoseReadings(1440, 288);
      expect(readings).toHaveLength(2);
      expect(readings[0]).toBeInstanceOf(GlucoseReading);
      expect(readings[0].value).toBe(120);
      expect(readings[1].value).toBe(85);
    });

    test("returns empty array when API returns empty list", async () => {
      const dexcom = createAuthenticatedDexcom();
      mockFetch.mockReturnValueOnce(mockResponse([]));

      const readings = await dexcom.getGlucoseReadings();
      expect(readings).toEqual([]);
    });

    test("uses default parameters (MAX_MINUTES, MAX_MAX_COUNT)", async () => {
      const dexcom = createAuthenticatedDexcom();
      mockFetch.mockReturnValueOnce(mockResponse([]));

      await dexcom.getGlucoseReadings();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(`minutes=${MAX_MINUTES}`);
      expect(calledUrl).toContain(`maxCount=${MAX_MAX_COUNT}`);
    });

    test("passes custom minutes and maxCount", async () => {
      const dexcom = createAuthenticatedDexcom();
      mockFetch.mockReturnValueOnce(mockResponse([]));

      await dexcom.getGlucoseReadings(15, 3);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain("minutes=15");
      expect(calledUrl).toContain("maxCount=3");
    });

    test("passes sessionId in query params", async () => {
      const dexcom = createAuthenticatedDexcom();
      mockFetch.mockReturnValueOnce(mockResponse([]));

      await dexcom.getGlucoseReadings();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(`sessionId=${VALID_SESSION_ID}`);
    });
  });

  describe("parameter validation", () => {
    let dexcom;
    beforeEach(() => {
      dexcom = createAuthenticatedDexcom();
    });

    test("throws MINUTES_INVALID for 0 minutes", async () => {
      await expect(dexcom.getGlucoseReadings(0, 1)).rejects.toThrow(
        ArgumentError,
      );
    });

    test("throws MINUTES_INVALID for negative minutes", async () => {
      await expect(dexcom.getGlucoseReadings(-1, 1)).rejects.toThrow(
        ArgumentError,
      );
    });

    test("throws MINUTES_INVALID for minutes > 1440", async () => {
      await expect(dexcom.getGlucoseReadings(1441, 1)).rejects.toThrow(
        ArgumentError,
      );
    });

    test("throws MINUTES_INVALID for float minutes", async () => {
      await expect(dexcom.getGlucoseReadings(5.5, 1)).rejects.toThrow(
        ArgumentError,
      );
    });

    test("throws MAX_COUNT_INVALID for 0 maxCount", async () => {
      await expect(dexcom.getGlucoseReadings(10, 0)).rejects.toThrow(
        ArgumentError,
      );
    });

    test("throws MAX_COUNT_INVALID for negative maxCount", async () => {
      await expect(dexcom.getGlucoseReadings(10, -1)).rejects.toThrow(
        ArgumentError,
      );
    });

    test("throws MAX_COUNT_INVALID for maxCount > 288", async () => {
      await expect(dexcom.getGlucoseReadings(10, 289)).rejects.toThrow(
        ArgumentError,
      );
    });

    test("accepts boundary value minutes=1", async () => {
      mockFetch.mockReturnValueOnce(mockResponse([]));
      await expect(dexcom.getGlucoseReadings(1, 1)).resolves.toEqual([]);
    });

    test("accepts boundary value minutes=1440", async () => {
      mockFetch.mockReturnValueOnce(mockResponse([]));
      await expect(dexcom.getGlucoseReadings(1440, 1)).resolves.toEqual([]);
    });

    test("accepts boundary value maxCount=1", async () => {
      mockFetch.mockReturnValueOnce(mockResponse([]));
      await expect(dexcom.getGlucoseReadings(10, 1)).resolves.toEqual([]);
    });

    test("accepts boundary value maxCount=288", async () => {
      mockFetch.mockReturnValueOnce(mockResponse([]));
      await expect(dexcom.getGlucoseReadings(10, 288)).resolves.toEqual([]);
    });
  });

  describe("session recovery", () => {
    test("creates session automatically when no session exists", async () => {
      const dexcom = new Dexcom({ username: "user", password: "pass" });
      // createSession: authenticate + login, then glucose readings
      mockFetch
        .mockReturnValueOnce(mockResponse(VALID_ACCOUNT_ID))
        .mockReturnValueOnce(mockResponse(VALID_SESSION_ID))
        .mockReturnValueOnce(mockResponse([sampleGlucoseJson()]));

      const readings = await dexcom.getGlucoseReadings(10, 1);
      expect(readings).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test("recreates session on SessionError from API", async () => {
      const dexcom = createAuthenticatedDexcom();
      mockFetch
        // First attempt: session expired
        .mockReturnValueOnce(
          mockResponse(
            { Code: "SessionNotValid", Message: "Session not valid" },
            { ok: false, status: 500 },
          ),
        )
        // createSession: accountId already set, so only login (no authenticate)
        .mockReturnValueOnce(mockResponse(VALID_SESSION_ID))
        // Retry glucose readings
        .mockReturnValueOnce(mockResponse([sampleGlucoseJson()]));

      const readings = await dexcom.getGlucoseReadings(10, 1);
      expect(readings).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test("recreates session on SessionIdNotFound", async () => {
      const dexcom = createAuthenticatedDexcom();
      mockFetch
        .mockReturnValueOnce(
          mockResponse(
            { Code: "SessionIdNotFound", Message: "Not found" },
            { ok: false, status: 500 },
          ),
        )
        // createSession: accountId already set, so only login
        .mockReturnValueOnce(mockResponse(VALID_SESSION_ID))
        .mockReturnValueOnce(mockResponse([sampleGlucoseJson()]));

      const readings = await dexcom.getGlucoseReadings(10, 1);
      expect(readings).toHaveLength(1);
    });

    test("does not retry on non-session errors", async () => {
      const dexcom = createAuthenticatedDexcom();
      mockFetch.mockReturnValueOnce(
        mockResponse(
          {
            Code: "AccountPasswordInvalid",
            Message: "Password invalid",
          },
          { ok: false, status: 500 },
        ),
      );

      await expect(dexcom.getGlucoseReadings(10, 1)).rejects.toThrow(
        AccountError,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("with accountId: skips authenticate on session recreation", async () => {
      const dexcom = createAuthenticatedDexcom({
        username: undefined,
        accountId: VALID_ACCOUNT_ID,
      });
      dexcom._sessionId = null;

      // createSession (login only) + glucose readings
      mockFetch
        .mockReturnValueOnce(mockResponse(VALID_SESSION_ID))
        .mockReturnValueOnce(mockResponse([sampleGlucoseJson()]));

      const readings = await dexcom.getGlucoseReadings(10, 1);
      expect(readings).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});

// =============================================================================
// Dexcom.getLatestGlucoseReading
// =============================================================================

describe("Dexcom.getLatestGlucoseReading", () => {
  test("returns single reading from 5-minute window", async () => {
    const dexcom = createAuthenticatedDexcom();
    mockFetch.mockReturnValueOnce(
      mockResponse([sampleGlucoseJson({ Value: 95 })]),
    );

    const reading = await dexcom.getLatestGlucoseReading();
    expect(reading).toBeInstanceOf(GlucoseReading);
    expect(reading.value).toBe(95);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("minutes=5");
    expect(calledUrl).toContain("maxCount=1");
  });

  test("returns null when no readings", async () => {
    const dexcom = createAuthenticatedDexcom();
    mockFetch.mockReturnValueOnce(mockResponse([]));

    const reading = await dexcom.getLatestGlucoseReading();
    expect(reading).toBeNull();
  });
});

// =============================================================================
// Dexcom.getLatestGlucoseReadings
// =============================================================================

describe("Dexcom.getLatestGlucoseReadings", () => {
  test("returns readings from full 24h window with default maxCount", async () => {
    const dexcom = createAuthenticatedDexcom();
    const readings = [
      sampleGlucoseJson({ Value: 100 }),
      sampleGlucoseJson({ Value: 110 }),
    ];
    mockFetch.mockReturnValueOnce(mockResponse(readings));

    const result = await dexcom.getLatestGlucoseReadings();
    expect(result).toHaveLength(2);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain(`minutes=${MAX_MINUTES}`);
    expect(calledUrl).toContain(`maxCount=${MAX_MAX_COUNT}`);
  });

  test("accepts custom maxCount", async () => {
    const dexcom = createAuthenticatedDexcom();
    mockFetch.mockReturnValueOnce(
      mockResponse([sampleGlucoseJson({ Value: 100 })]),
    );

    const result = await dexcom.getLatestGlucoseReadings(1);
    expect(result).toHaveLength(1);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain(`minutes=${MAX_MINUTES}`);
    expect(calledUrl).toContain("maxCount=1");
  });

  test("returns empty array when no readings", async () => {
    const dexcom = createAuthenticatedDexcom();
    mockFetch.mockReturnValueOnce(mockResponse([]));

    const result = await dexcom.getLatestGlucoseReadings();
    expect(result).toEqual([]);
  });
});

// =============================================================================
// Dexcom.getCurrentGlucoseReading
// =============================================================================

describe("Dexcom.getCurrentGlucoseReading", () => {
  test("returns single reading from 10-minute window", async () => {
    const dexcom = createAuthenticatedDexcom();
    mockFetch.mockReturnValueOnce(
      mockResponse([sampleGlucoseJson({ Value: 88 })]),
    );

    const reading = await dexcom.getCurrentGlucoseReading();
    expect(reading).toBeInstanceOf(GlucoseReading);
    expect(reading.value).toBe(88);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("minutes=10");
    expect(calledUrl).toContain("maxCount=1");
  });

  test("returns null when no readings", async () => {
    const dexcom = createAuthenticatedDexcom();
    mockFetch.mockReturnValueOnce(mockResponse([]));

    const reading = await dexcom.getCurrentGlucoseReading();
    expect(reading).toBeNull();
  });
});

// =============================================================================
// Module exports
// =============================================================================

describe("module exports", () => {
  test("exports Dexcom", () => {
    expect(Dexcom).toBeDefined();
    expect(typeof Dexcom).toBe("function");
  });

  test("exports GlucoseReading", () => {
    expect(GlucoseReading).toBeDefined();
    expect(typeof GlucoseReading).toBe("function");
  });

  test("exports Region", () => {
    expect(Region).toBeDefined();
    expect(Region.US).toBe("us");
    expect(Region.OUS).toBe("ous");
    expect(Region.JP).toBe("jp");
  });
});
