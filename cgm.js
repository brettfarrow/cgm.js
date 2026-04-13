const fetch = require("isomorphic-fetch");

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

function validUuid(uuid) {
  if (typeof uuid !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    uuid,
  );
}

class GlucoseReading {
  constructor(jsonGlucoseReading) {
    try {
      this._value = parseInt(jsonGlucoseReading.Value, 10);
      this._trendDirection = jsonGlucoseReading.Trend;

      if (typeof this._trendDirection === "string") {
        this._trend = DEXCOM_TREND_DIRECTIONS[this._trendDirection] || 0;
      } else {
        this._trend = this._trendDirection;
        this._trendDirection =
          Object.keys(DEXCOM_TREND_DIRECTIONS).find(
            (key) => DEXCOM_TREND_DIRECTIONS[key] === this._trend,
          ) || "None";
      }

      if (isNaN(this._value)) {
        throw new Error("Invalid glucose value");
      }

      const match = jsonGlucoseReading.DT.match(/Date\((\d+)([+-]\d{4})\)/);
      if (match) {
        this._time = new Date(parseInt(match[1], 10));
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
  } = {}) {
    this._validateRegion(region);
    this._validateUserIds(accountId, username);

    this._baseUrl = DEXCOM_BASE_URLS[region];
    this._applicationId = DEXCOM_APPLICATION_IDS[region];
    this._password = password;
    this._username = username;
    this._accountId = accountId;
    this._sessionId = null;
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

    let response;
    try {
      response = await fetch(`${url}${queryString}`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(json || {}),
      });
    } catch (error) {
      throw new ServerError(ServerErrorEnum.UNEXPECTED);
    }

    let responseJson;
    try {
      responseJson = await response.json();
    } catch (error) {
      throw new ServerError(ServerErrorEnum.INVALID_JSON);
    }

    if (!response.ok) {
      throw this._handleErrorCode(responseJson);
    }

    return responseJson;
  }

  _handleErrorCode(json) {
    const code = json.Code;
    const message = json.Message;

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

  _validateSessionId() {
    if (
      !this._sessionId ||
      typeof this._sessionId !== "string" ||
      !validUuid(this._sessionId)
    ) {
      throw new ArgumentError(ArgumentErrorEnum.SESSION_ID_INVALID);
    }
    if (this._sessionId === DEFAULT_UUID) {
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

  _validateAccountId() {
    if (
      !this._accountId ||
      typeof this._accountId !== "string" ||
      !validUuid(this._accountId)
    ) {
      throw new ArgumentError(ArgumentErrorEnum.ACCOUNT_ID_INVALID);
    }
    if (this._accountId === DEFAULT_UUID) {
      throw new ArgumentError(ArgumentErrorEnum.ACCOUNT_ID_DEFAULT);
    }
  }

  async createSession() {
    this._validatePassword();

    if (this._accountId == null) {
      this._validateUsername();
      this._accountId = await this._post(
        DEXCOM_AUTHENTICATE_ENDPOINT,
        null,
        {
          accountName: this._username,
          password: this._password,
          applicationId: this._applicationId,
        },
      );
    }

    this._validateAccountId();

    this._sessionId = await this._post(DEXCOM_LOGIN_ID_ENDPOINT, null, {
      accountId: this._accountId,
      password: this._password,
      applicationId: this._applicationId,
    });

    this._validateSessionId();
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
    try {
      this._validateSessionId();
      jsonGlucoseReadings = await this._post(
        DEXCOM_GLUCOSE_READINGS_ENDPOINT,
        { sessionId: this._sessionId, minutes, maxCount },
      );
    } catch (error) {
      if (
        error instanceof SessionError ||
        (error instanceof ArgumentError &&
          (error.enum === ArgumentErrorEnum.SESSION_ID_INVALID ||
            error.enum === ArgumentErrorEnum.SESSION_ID_DEFAULT))
      ) {
        await this.createSession();
        jsonGlucoseReadings = await this._post(
          DEXCOM_GLUCOSE_READINGS_ENDPOINT,
          { sessionId: this._sessionId, minutes, maxCount },
        );
      } else {
        throw error;
      }
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
