const {
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
} = require("./constants.js");

const {
  AccountError,
  AccountErrorEnum,
  ArgumentError,
  ArgumentErrorEnum,
  SessionError,
  SessionErrorEnum,
  ServerError,
  ServerErrorEnum,
} = require("./errors.js");

const TREND_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(DEXCOM_TREND_DIRECTIONS).map(([name, code]) => [code, name]),
  ),
);

function validUuid(uuid) {
  if (typeof uuid !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    uuid,
  );
}

class GlucoseReading {
  constructor(jsonGlucoseReading) {
    try {
      const value = jsonGlucoseReading.Value;
      if (
        typeof value !== "number" &&
        !(typeof value === "string" && /^\d+$/.test(value))
      ) {
        throw new Error("Invalid glucose value");
      }
      this._value = Number(value);
      this._trendDirection = jsonGlucoseReading.Trend;

      if (typeof this._trendDirection === "string") {
        this._trend = Object.hasOwn(DEXCOM_TREND_DIRECTIONS, this._trendDirection)
          ? DEXCOM_TREND_DIRECTIONS[this._trendDirection]
          : 0;
      } else {
        if (!Number.isInteger(this._trendDirection)) {
          throw new Error("Invalid trend");
        }
        this._trend = this._trendDirection;
        this._trendDirection = TREND_NAMES[this._trend] || "None";
      }

      if (!Number.isSafeInteger(this._value) || this._value < 0) {
        throw new Error("Invalid glucose value");
      }

      const match = jsonGlucoseReading.DT.match(/Date\((\d+)([+-]\d{4})\)/);
      if (match) {
        this._time = new Date(parseInt(match[1], 10));
        if (Number.isNaN(this._time.getTime())) {
          throw new Error("Invalid date");
        }
      } else {
        throw new Error("Invalid date format");
      }
    } catch (error) {
      if (error instanceof ArgumentError) throw error;
      throw new ArgumentError(ArgumentErrorEnum.GLUCOSE_READING_INVALID);
    }

    this._json = jsonGlucoseReading;
  }

  get value() {
    return this._value;
  }
  get mgdL() {
    return this._value;
  }
  get mmolL() {
    return parseFloat((this._value * MMOL_L_CONVERSION_FACTOR).toFixed(1));
  }
  get trend() {
    return this._trend;
  }
  get trendDirection() {
    return this._trendDirection;
  }
  get trendDescription() {
    return TREND_DESCRIPTIONS[this._trend];
  }
  get trendArrow() {
    return TREND_ARROWS[this._trend];
  }
  get time() {
    return this._time;
  }
  get json() {
    return this._json;
  }

  toString() {
    return String(this._value);
  }
}

class Dexcom {
  constructor({
    password,
    username = null,
    accountId = null,
    region = Region.US,
    requestTimeout = 30000,
  } = {}) {
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

  get username() {
    return this._username;
  }
  get accountId() {
    return this._accountId;
  }

  async _post(endpoint, params = null, json = null) {
    const url = `${this._baseUrl}${endpoint}`;

    let queryString = "";
    if (params) {
      queryString = "?" + new URLSearchParams(params).toString();
    }

    const signal = AbortSignal.timeout(this._requestTimeout);
    let response;
    try {
      response = await fetch(`${url}${queryString}`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(json || {}),
        redirect: "error",
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw new ServerError(ServerErrorEnum.TIMEOUT);
      throw new ServerError(ServerErrorEnum.UNEXPECTED);
    }

    let responseJson;
    try {
      responseJson = await response.json();
    } catch (error) {
      if (signal.aborted) throw new ServerError(ServerErrorEnum.TIMEOUT);
      throw new ServerError(ServerErrorEnum.INVALID_JSON);
    }

    if (!response.ok) {
      throw this._handleErrorCode(responseJson);
    }

    return responseJson;
  }

  _handleErrorCode(json) {
    const code = typeof json?.Code === "string" ? json.Code : "";
    const message = typeof json?.Message === "string" ? json.Message : "";

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

  _validateRegion(region) {
    if (!Object.values(Region).includes(region)) {
      throw new ArgumentError(ArgumentErrorEnum.REGION_INVALID);
    }
  }

  _validateUserIds(accountId, username) {
    const provided = [accountId, username].filter((id) => id != null).length;
    if (provided === 0) {
      throw new ArgumentError(ArgumentErrorEnum.USER_ID_REQUIRED);
    }
    if (provided > 1) {
      throw new ArgumentError(ArgumentErrorEnum.USER_ID_MULTIPLE);
    }
  }

  _validateSessionId(sessionId) {
    if (!validUuid(sessionId)) {
      throw new ArgumentError(ArgumentErrorEnum.SESSION_ID_INVALID);
    }
    if (sessionId === DEFAULT_UUID) {
      throw new ArgumentError(ArgumentErrorEnum.SESSION_ID_DEFAULT);
    }
  }

  _validateUsername() {
    if (!this._username || typeof this._username !== "string") {
      throw new ArgumentError(ArgumentErrorEnum.USERNAME_INVALID);
    }
  }

  _validatePassword() {
    if (!this._password || typeof this._password !== "string") {
      throw new ArgumentError(ArgumentErrorEnum.PASSWORD_INVALID);
    }
  }

  _validateAccountId(accountId) {
    if (!validUuid(accountId)) {
      throw new ArgumentError(ArgumentErrorEnum.ACCOUNT_ID_INVALID);
    }
    if (accountId === DEFAULT_UUID) {
      throw new ArgumentError(ArgumentErrorEnum.ACCOUNT_ID_DEFAULT);
    }
  }

  async createSession() {
    if (!this._sessionPromise) {
      this._sessionPromise = this._createSession().finally(() => {
        this._sessionPromise = null;
      });
    }
    await this._sessionPromise;
  }

  async _createSession() {
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

  async getGlucoseReadings(minutes = MAX_MINUTES, maxCount = MAX_MAX_COUNT) {
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

    let jsonGlucoseReadings;
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
        // A concurrent request may already have replaced the expired session.
        if (this._sessionId === sessionId) {
          await this.createSession();
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
      (jsonReading) => new GlucoseReading(jsonReading),
    );
  }

  async getLatestGlucoseReading() {
    const readings = await this.getGlucoseReadings(5, 1);
    return readings.length > 0 ? readings[0] : null;
  }

  async getLatestGlucoseReadings(maxCount = MAX_MAX_COUNT) {
    return this.getGlucoseReadings(MAX_MINUTES, maxCount);
  }

  async getCurrentGlucoseReading() {
    const readings = await this.getGlucoseReadings(10, 1);
    return readings.length > 0 ? readings[0] : null;
  }
}

module.exports = { Dexcom, GlucoseReading, Region };
