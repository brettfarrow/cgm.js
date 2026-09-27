import {
  Region,
  DEXCOM_APPLICATION_IDS,
  DEXCOM_BASE_URLS,
  DEXCOM_AUTHENTICATE_ENDPOINT,
  DEXCOM_LOGIN_ID_ENDPOINT,
  DEXCOM_GLUCOSE_READINGS_ENDPOINT,
  HEADERS,
  DEXCOM_TREND_DIRECTIONS,
  TREND_DESCRIPTIONS,
  TREND_ARROWS,
  DEFAULT_UUID,
  MAX_MINUTES,
  MAX_MAX_COUNT,
  MMOL_L_CONVERSION_FACTOR,
  type Trend,
  type TrendDirection,
} from "./constants.js";

import {
  AccountError,
  AccountErrorEnum,
  ArgumentError,
  ArgumentErrorEnum,
  SessionError,
  SessionErrorEnum,
  ServerError,
  ServerErrorEnum,
  type DexcomError,
} from "./errors.js";

export { Region };

/** A raw glucose reading as returned by the Dexcom Share API. */
export interface GlucoseReadingJson {
  WT?: string;
  ST?: string;
  DT: string;
  Value: number | string;
  Trend: TrendDirection | Trend;
}

export interface DexcomOptions {
  password: string;
  username?: string | null;
  accountId?: string | null;
  region?: Region;
  requestTimeout?: number;
}

const TREND_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(DEXCOM_TREND_DIRECTIONS).map(([name, code]) => [code, name]),
  ) as Record<number, TrendDirection>,
);

function validUuid(uuid: unknown): uuid is string {
  if (typeof uuid !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    uuid,
  );
}

export class GlucoseReading {
  private readonly _value: number;
  private readonly _trend: Trend;
  private readonly _trendDirection: TrendDirection;
  private readonly _time: Date;
  private readonly _json: GlucoseReadingJson;

  constructor(jsonGlucoseReading: GlucoseReadingJson) {
    try {
      const value: unknown = jsonGlucoseReading.Value;
      if (
        typeof value !== "number" &&
        !(typeof value === "string" && /^\d+$/.test(value))
      ) {
        throw new Error("Invalid glucose value");
      }
      this._value = Number(value);
      const trendDirection: unknown = jsonGlucoseReading.Trend;

      // Dexcom Share returns string directions; older responses used integer codes.
      if (typeof trendDirection === "string") {
        if (!Object.hasOwn(DEXCOM_TREND_DIRECTIONS, trendDirection)) {
          throw new Error("Invalid trend");
        }
        this._trendDirection = trendDirection as TrendDirection;
        this._trend = DEXCOM_TREND_DIRECTIONS[this._trendDirection];
      } else {
        if (
          !Number.isInteger(trendDirection) ||
          !Object.hasOwn(TREND_NAMES, trendDirection as number)
        ) {
          throw new Error("Invalid trend");
        }
        this._trend = trendDirection as Trend;
        this._trendDirection = TREND_NAMES[this._trend]!;
      }

      if (!Number.isSafeInteger(this._value) || this._value < 0) {
        throw new Error("Invalid glucose value");
      }

      const match = jsonGlucoseReading.DT.match(/Date\((\d+)([+-]\d{4})\)/);
      if (match) {
        this._time = new Date(parseInt(match[1]!, 10));
        if (Number.isNaN(this._time.getTime())) {
          throw new Error("Invalid date");
        }
      } else {
        throw new Error("Invalid date format");
      }
    } catch {
      throw new ArgumentError(ArgumentErrorEnum.GLUCOSE_READING_INVALID);
    }

    this._json = jsonGlucoseReading;
  }

  get value(): number {
    return this._value;
  }
  get mgdL(): number {
    return this._value;
  }
  get mmolL(): number {
    return parseFloat((this._value * MMOL_L_CONVERSION_FACTOR).toFixed(1));
  }
  get trend(): Trend {
    return this._trend;
  }
  get trendDirection(): TrendDirection {
    return this._trendDirection;
  }
  get trendDescription(): string {
    return TREND_DESCRIPTIONS[this._trend];
  }
  get trendArrow(): string {
    return TREND_ARROWS[this._trend];
  }
  get time(): Date {
    return this._time;
  }
  get json(): GlucoseReadingJson {
    return this._json;
  }

  toString(): string {
    return String(this._value);
  }
}

export class Dexcom {
  /** @internal */
  _baseUrl: string;
  /** @internal */
  _applicationId: string;
  /** @internal */
  _password: string;
  /** @internal */
  _username: string | null;
  /** @internal */
  _accountId: string | null;
  /** @internal */
  _sessionId: string | null;
  /** @internal */
  _sessionPromise: Promise<void> | null;
  /** @internal */
  _requestTimeout: number;

  constructor(options: DexcomOptions) {
    // JavaScript callers may omit options; let validation report what is missing.
    const {
      password,
      username = null,
      accountId = null,
      region = Region.US,
      requestTimeout = 30000,
    } = options ?? ({} as DexcomOptions);
    this._validateRegion(region);
    this._validateUserIds(accountId, username);
    if (
      !Number.isInteger(requestTimeout) ||
      requestTimeout < 1 ||
      requestTimeout > 2147483647
    ) {
      throw new ArgumentError(ArgumentErrorEnum.REQUEST_TIMEOUT_INVALID);
    }

    this._baseUrl = DEXCOM_BASE_URLS[region];
    this._applicationId = DEXCOM_APPLICATION_IDS[region];
    this._password = password;
    this._username = username;
    this._accountId = accountId;
    this._sessionId = null;
    this._sessionPromise = null;
    this._requestTimeout = requestTimeout;
  }

  get username(): string | null {
    return this._username;
  }
  get accountId(): string | null {
    return this._accountId;
  }

  /** @internal */
  async _post(
    endpoint: string,
    params: Record<string, string | number | null> | null = null,
    json: Record<string, unknown> | null = null,
  ): Promise<unknown> {
    const url = `${this._baseUrl}${endpoint}`;

    let queryString = "";
    if (params) {
      const stringParams = Object.entries(params).map(
        ([key, value]) => [key, String(value)] as [string, string],
      );
      queryString = "?" + new URLSearchParams(stringParams).toString();
    }

    const signal = AbortSignal.timeout(this._requestTimeout);
    let response: Response;
    try {
      response = await fetch(`${url}${queryString}`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(json || {}),
        // Follow no redirects so credentials are never sent to another URL.
        redirect: "manual",
        signal,
      });
    } catch {
      if (signal.aborted) throw new ServerError(ServerErrorEnum.TIMEOUT);
      throw new ServerError(ServerErrorEnum.UNEXPECTED);
    }

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => {});
      throw new ServerError(ServerErrorEnum.REDIRECT);
    }

    let responseJson: unknown;
    try {
      responseJson = await response.json();
    } catch {
      if (signal.aborted) throw new ServerError(ServerErrorEnum.TIMEOUT);
      throw new ServerError(ServerErrorEnum.INVALID_JSON);
    }

    if (!response.ok) {
      throw this._handleErrorCode(responseJson);
    }

    return responseJson;
  }

  /** @internal */
  _handleErrorCode(json: unknown): DexcomError {
    const body = json as { Code?: unknown; Message?: unknown } | null;
    const code = typeof body?.Code === "string" ? body.Code : "";
    const message = typeof body?.Message === "string" ? body.Message : "";

    if (code === "SessionIdNotFound") {
      return new SessionError(SessionErrorEnum.NOT_FOUND);
    }
    if (code === "SessionNotValid") {
      return new SessionError(SessionErrorEnum.INVALID);
    }
    if (code === "AccountPasswordInvalid") {
      return new AccountError(AccountErrorEnum.FAILED_AUTHENTICATION);
    }
    if (code === "SSO_AuthenticateMaxAttemptsExceeded") {
      return new AccountError(AccountErrorEnum.MAX_ATTEMPTS);
    }
    if (code === "SSO_InternalError") {
      if (
        message &&
        (message.includes("Cannot Authenticate by AccountName") ||
          message.includes("Cannot Authenticate by AccountId"))
      ) {
        return new AccountError(AccountErrorEnum.FAILED_AUTHENTICATION);
      }
    }
    if (code === "InvalidArgument") {
      if (message && message.includes("accountName")) {
        return new ArgumentError(ArgumentErrorEnum.USERNAME_INVALID);
      }
      if (message && message.includes("password")) {
        return new ArgumentError(ArgumentErrorEnum.PASSWORD_INVALID);
      }
      if (message && message.includes("UUID")) {
        return new ArgumentError(ArgumentErrorEnum.ACCOUNT_ID_INVALID);
      }
    }
    if (code && message) {
      return new ServerError(ServerErrorEnum.UNKNOWN_CODE);
    }
    return new ServerError(ServerErrorEnum.UNEXPECTED);
  }

  /** @internal */
  _validateRegion(region: unknown): asserts region is Region {
    if (!Object.values(Region).includes(region as Region)) {
      throw new ArgumentError(ArgumentErrorEnum.REGION_INVALID);
    }
  }

  /** @internal */
  _validateUserIds(accountId: unknown, username: unknown): void {
    const provided = [accountId, username].filter((id) => id != null).length;
    if (provided === 0) {
      throw new ArgumentError(ArgumentErrorEnum.USER_ID_REQUIRED);
    }
    if (provided > 1) {
      throw new ArgumentError(ArgumentErrorEnum.USER_ID_MULTIPLE);
    }
  }

  /** @internal */
  _validateSessionId(sessionId: unknown): asserts sessionId is string {
    if (!validUuid(sessionId)) {
      throw new ArgumentError(ArgumentErrorEnum.SESSION_ID_INVALID);
    }
    if (sessionId === DEFAULT_UUID) {
      throw new ArgumentError(ArgumentErrorEnum.SESSION_ID_DEFAULT);
    }
  }

  /** @internal */
  _validateUsername(): void {
    if (!this._username || typeof this._username !== "string") {
      throw new ArgumentError(ArgumentErrorEnum.USERNAME_INVALID);
    }
  }

  /** @internal */
  _validatePassword(): void {
    if (!this._password || typeof this._password !== "string") {
      throw new ArgumentError(ArgumentErrorEnum.PASSWORD_INVALID);
    }
  }

  /** @internal */
  _validateAccountId(accountId: unknown): asserts accountId is string {
    if (!validUuid(accountId)) {
      throw new ArgumentError(ArgumentErrorEnum.ACCOUNT_ID_INVALID);
    }
    if (accountId === DEFAULT_UUID) {
      throw new ArgumentError(ArgumentErrorEnum.ACCOUNT_ID_DEFAULT);
    }
  }

  async createSession(): Promise<void> {
    if (!this._sessionPromise) {
      this._sessionPromise = this._createSession().finally(() => {
        this._sessionPromise = null;
      });
    }
    await this._sessionPromise;
  }

  /** @internal */
  async _createSession(): Promise<void> {
    this._validatePassword();

    if (this._accountId == null) {
      this._validateUsername();
      const accountId = await this._post(
        DEXCOM_AUTHENTICATE_ENDPOINT,
        null,
        {
          accountName: this._username,
          password: this._password,
          applicationId: this._applicationId,
        },
      );
      this._validateAccountId(accountId);
      this._accountId = accountId;
    }

    this._validateAccountId(this._accountId);

    const sessionId = await this._post(DEXCOM_LOGIN_ID_ENDPOINT, null, {
      accountId: this._accountId,
      password: this._password,
      applicationId: this._applicationId,
    });

    this._validateSessionId(sessionId);
    this._sessionId = sessionId;
  }

  async getGlucoseReadings(
    minutes: number = MAX_MINUTES,
    maxCount: number = MAX_MAX_COUNT,
  ): Promise<GlucoseReading[]> {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) {
      throw new ArgumentError(ArgumentErrorEnum.MINUTES_INVALID);
    }
    if (
      !Number.isInteger(maxCount) ||
      maxCount < 1 ||
      maxCount > MAX_MAX_COUNT
    ) {
      throw new ArgumentError(ArgumentErrorEnum.MAX_COUNT_INVALID);
    }

    let jsonGlucoseReadings: unknown;
    const sessionId = this._sessionId;
    try {
      this._validateSessionId(sessionId);
      jsonGlucoseReadings = await this._post(
        DEXCOM_GLUCOSE_READINGS_ENDPOINT,
        { sessionId, minutes, maxCount },
      );
    } catch (error) {
      if (
        error instanceof SessionError ||
        (error instanceof ArgumentError &&
          (error.enum === ArgumentErrorEnum.SESSION_ID_INVALID ||
            error.enum === ArgumentErrorEnum.SESSION_ID_DEFAULT))
      ) {
        // A concurrent request may already have replaced the expired session,
        // and may still be replacing it again.
        if (this._sessionId === sessionId) {
          await this.createSession();
        } else if (this._sessionPromise) {
          await this._sessionPromise;
        }
        jsonGlucoseReadings = await this._post(
          DEXCOM_GLUCOSE_READINGS_ENDPOINT,
          { sessionId: this._sessionId, minutes, maxCount },
        );
      } else {
        throw error;
      }
    }

    if (!Array.isArray(jsonGlucoseReadings)) {
      throw new ServerError(ServerErrorEnum.UNEXPECTED);
    }

    return jsonGlucoseReadings.map(
      (jsonReading: GlucoseReadingJson) => new GlucoseReading(jsonReading),
    );
  }

  async getLatestGlucoseReading(): Promise<GlucoseReading | null> {
    const readings = await this.getGlucoseReadings(5, 1);
    return readings.length > 0 ? readings[0]! : null;
  }

  async getLatestGlucoseReadings(
    maxCount: number = MAX_MAX_COUNT,
  ): Promise<GlucoseReading[]> {
    return this.getGlucoseReadings(MAX_MINUTES, maxCount);
  }

  async getCurrentGlucoseReading(): Promise<GlucoseReading | null> {
    const readings = await this.getGlucoseReadings(10, 1);
    return readings.length > 0 ? readings[0]! : null;
  }
}
