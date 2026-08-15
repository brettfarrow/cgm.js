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
  MAX_POST_ATTEMPTS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  BASE_RETRY_DELAY_MS,
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

function abortError(signal) {
  if (signal && signal.reason !== undefined) return signal.reason;
  return new DOMException("The operation was aborted", "AbortError");
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) throw abortError(signal);
}

function sleep(ms, signal) {
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    let timeoutId;

    function onAbort() {
      clearTimeout(timeoutId);
      reject(abortError(signal));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
    timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
  });
}

function requestSignal(externalSignal, timeoutMs) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!externalSignal) return { signal: timeoutSignal, cleanup() {} };

  const controller = new AbortController();
  const signals = [externalSignal, timeoutSignal];
  const listeners = signals.map((signal) => {
    const listener = () => controller.abort(signal.reason);
    if (signal.aborted) {
      listener();
    } else {
      signal.addEventListener("abort", listener, { once: true });
    }
    return { signal, listener };
  });

  return {
    signal: controller.signal,
    cleanup() {
      for (const entry of listeners) {
        entry.signal.removeEventListener("abort", entry.listener);
      }
    },
  };
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryAfterMs(response) {
  const value = response?.headers?.get?.("retry-after");
  if (!value) return 0;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

function retryDelayMs(attempt, response) {
  const exponentialDelay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
  return Math.max(exponentialDelay, retryAfterMs(response));
}

function parseGlucoseValue(value) {
  if (Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  throw new Error("Invalid glucose value");
}

class GlucoseReading {
  constructor(jsonGlucoseReading) {
    try {
      this._value = parseGlucoseValue(jsonGlucoseReading.Value);
      this._trendDirection = jsonGlucoseReading.Trend;

      if (typeof this._trendDirection === "string") {
        if (Object.hasOwn(DEXCOM_TREND_DIRECTIONS, this._trendDirection)) {
          this._trend = DEXCOM_TREND_DIRECTIONS[this._trendDirection];
        } else {
          this._trend = DEXCOM_TREND_DIRECTIONS.None;
          this._trendDirection = "None";
        }
      } else {
        const direction = Object.keys(DEXCOM_TREND_DIRECTIONS).find(
          (key) => DEXCOM_TREND_DIRECTIONS[key] === this._trendDirection,
        );
        this._trendDirection = direction || "None";
        this._trend = direction
          ? DEXCOM_TREND_DIRECTIONS[direction]
          : DEXCOM_TREND_DIRECTIONS.None;
      }

      const match = jsonGlucoseReading.DT.match(
        /^Date\((\d+)([+-]\d{4})\)$/,
      );
      if (match) {
        const timestamp = Number(match[1]);
        this._time = new Date(timestamp);
        if (
          !Number.isSafeInteger(timestamp) ||
          Number.isNaN(this._time.getTime())
        ) {
          throw new Error("Invalid date value");
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
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  } = {}) {
    this._validateRegion(region);
    this._validateUserIds(accountId, username);
    this._validateRequestTimeout(requestTimeoutMs);

    this._baseUrl = DEXCOM_BASE_URLS[region];
    this._applicationId = DEXCOM_APPLICATION_IDS[region];
    this._username = username;
    this._accountId = accountId;
    this._requestTimeoutMs = requestTimeoutMs;

    // Keep credentials and bearer-like session IDs out of JSON.stringify(),
    // console.log(), and structured loggers that enumerate object properties.
    Object.defineProperties(this, {
      _password: {
        value: password,
        writable: true,
        enumerable: false,
      },
      _sessionId: {
        value: null,
        writable: true,
        enumerable: false,
      },
    });
  }

  get username() {
    return this._username;
  }
  get accountId() {
    return this._accountId;
  }

  async _post(endpoint, params = null, json = null, { signal } = {}) {
    const url = `${this._baseUrl}${endpoint}`;

    let queryString = "";
    if (params) {
      queryString = "?" + new URLSearchParams(params).toString();
    }

    // Authentication requests are not replayed automatically because a
    // dropped response is ambiguous and repeated login attempts can trigger
    // account throttling. Read requests retry transient failures only.
    const isAuthentication =
      endpoint === DEXCOM_AUTHENTICATE_ENDPOINT ||
      endpoint === DEXCOM_LOGIN_ID_ENDPOINT;
    const maxAttempts = isAuthentication ? 1 : MAX_POST_ATTEMPTS;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      throwIfAborted(signal);
      const canRetry = attempt < maxAttempts;
      const attemptSignal = requestSignal(signal, this._requestTimeoutMs);

      let response;
      try {
        response = await fetch(`${url}${queryString}`, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify(json || {}),
          signal: attemptSignal.signal,
        });
      } catch (error) {
        attemptSignal.cleanup();
        throwIfAborted(signal);
        if (canRetry) {
          await sleep(retryDelayMs(attempt), signal);
          continue;
        }
        throw new ServerError(ServerErrorEnum.UNEXPECTED, { cause: error });
      }

      let responseJson;
      try {
        responseJson = await response.json();
      } catch (error) {
        attemptSignal.cleanup();
        throwIfAborted(signal);
        if (canRetry && (response.ok || isRetryableStatus(response.status))) {
          await sleep(retryDelayMs(attempt, response), signal);
          continue;
        }
        throw new ServerError(ServerErrorEnum.INVALID_JSON, { cause: error });
      }
      attemptSignal.cleanup();

      if (!response.ok) {
        const error = this._handleErrorCode(responseJson);
        if (
          canRetry &&
          error instanceof ServerError &&
          isRetryableStatus(response.status)
        ) {
          await sleep(retryDelayMs(attempt, response), signal);
          continue;
        }
        throw error;
      }

      return responseJson;
    }
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

  _validateRequestTimeout(requestTimeoutMs) {
    if (
      !Number.isInteger(requestTimeoutMs) ||
      requestTimeoutMs < 1 ||
      requestTimeoutMs > 2147483647
    ) {
      throw new ArgumentError(ArgumentErrorEnum.REQUEST_TIMEOUT_INVALID);
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

  async createSession({ signal } = {}) {
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
        { signal },
      );
    }

    this._validateAccountId();

    this._sessionId = await this._post(
      DEXCOM_LOGIN_ID_ENDPOINT,
      null,
      {
        accountId: this._accountId,
        password: this._password,
        applicationId: this._applicationId,
      },
      { signal },
    );

    this._validateSessionId();
  }

  async getGlucoseReadings(
    minutes = MAX_MINUTES,
    maxCount = MAX_MAX_COUNT,
    { signal } = {},
  ) {
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
        null,
        { signal },
      );
    } catch (error) {
      if (
        error instanceof SessionError ||
        (error instanceof ArgumentError &&
          (error.enum === ArgumentErrorEnum.SESSION_ID_INVALID ||
            error.enum === ArgumentErrorEnum.SESSION_ID_DEFAULT))
      ) {
        await this.createSession({ signal });
        jsonGlucoseReadings = await this._post(
          DEXCOM_GLUCOSE_READINGS_ENDPOINT,
          { sessionId: this._sessionId, minutes, maxCount },
          null,
          { signal },
        );
      } else {
        throw error;
      }
    }

    return jsonGlucoseReadings.map(
      (jsonReading) => new GlucoseReading(jsonReading),
    );
  }

  async getLatestGlucoseReading({ signal } = {}) {
    const readings = await this.getGlucoseReadings(5, 1, { signal });
    return readings.length > 0 ? readings[0] : null;
  }

  async getLatestGlucoseReadings(maxCount = MAX_MAX_COUNT, { signal } = {}) {
    return this.getGlucoseReadings(MAX_MINUTES, maxCount, { signal });
  }

  async getCurrentGlucoseReading({ signal } = {}) {
    const readings = await this.getGlucoseReadings(10, 1, { signal });
    return readings.length > 0 ? readings[0] : null;
  }
}

module.exports = { Dexcom, GlucoseReading, Region };
