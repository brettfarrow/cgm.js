const fetch = require("isomorphic-fetch");

const {
  ACCOUNT_ERROR_ACCOUNT_NOT_FOUND,
  ACCOUNT_ERROR_PASSWORD_INVALID,
  ACCOUNT_ERROR_PASSWORD_NULL_EMPTY,
  ACCOUNT_ERROR_MAX_ATTEMPTS,
  ACCOUNT_ERROR_UNKNOWN,
  ACCOUNT_ERROR_USERNAME_NULL_EMPTY,
  ARGUMENT_ERROR_MAX_COUNT_INVALID,
  ARGUMENT_ERROR_MINUTES_INVALID,
  ARGUMENT_ERROR_SERIAL_NUMBER_NULL_EMPTY,
  DEFAULT_SESSION_ID,
  DEXCOM_APPLICATION_ID,
  DEXCOM_AUTHENTICATE_ENDPOINT,
  DEXCOM_BASE_URL,
  DEXCOM_BASE_URL_OUS,
  DEXCOM_GLUCOSE_READINGS_ENDPOINT,
  DEXCOM_LOGIN_ID_ENDPOINT,
  DEXCOM_TREND_ARROWS,
  DEXCOM_TREND_DESCRIPTIONS,
  DEXCOM_TREND_DIRECTIONS,
  DEXCOM_VERIFY_SERIAL_NUMBER_ENDPOINT,
  MMOL_L_CONVERTION_FACTOR,
  SESSION_ERROR_SESSION_ID_DEFAULT,
  SESSION_ERROR_SESSION_ID_NULL,
  SESSION_ERROR_ACCOUNT_ID_NULL_EMPTY,
  SESSION_ERROR_ACCOUNT_ID_DEFAULT,
} = require("./constants.js");
const { AccountError, ArgumentError, SessionError } = require("./errors");

class GlucoseReading {
  constructor(jsonGlucoseReading) {
    this.value = jsonGlucoseReading.Value;
    this.mgdL = this.value;
    this.mmolL = parseFloat((this.value * MMOL_L_CONVERTION_FACTOR).toFixed(1));
    this.trend = jsonGlucoseReading.Trend;
    if (typeof this.trend !== "number") {
      this.trend = DEXCOM_TREND_DIRECTIONS[this.trend] || 0;
    }
    this.trendDescription = DEXCOM_TREND_DESCRIPTIONS[this.trend];
    this.trendArrow = DEXCOM_TREND_ARROWS[this.trend];
    this.time = new Date(
      parseInt(jsonGlucoseReading.WT.replace(/[^0-9]/g, "") / 1000) * 1000,
    );

    // Drop the redundant timestamp fields
    delete jsonGlucoseReading.DT;
    delete jsonGlucoseReading.ST;
    // Allow access to raw JSON for serializing to file:
    this.json = jsonGlucoseReading;
  }
}

// TODO: Replace underscore vars with camelCase

class Dexcom {
  constructor(username, password, ous = false) {
    this.baseURL = ous ? DEXCOM_BASE_URL_OUS : DEXCOM_BASE_URL;
    this.username = username;
    this.password = password;
    this.sessionId = null;
    this.accountId = null;
    this.createSession();
  }

  async _request(method, endpoint, params = {}, json = {}) {
    try {
      const url = `${this.baseURL}/${endpoint}`;
      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      const jsonResponse = await response.json();
      if (!response.ok) {
        console.error(`json:`, jsonResponse);
        if (response.status === 500) {
          if (jsonResponse.Code === "SessionNotValid") {
            console.log("session not valid error being throw");
            throw new SessionError(SESSION_ERROR_SESSION_NOT_VALID);
          } else if (jsonResponse.Code === "sessionIdNotFound") {
            console.log("session id not found error being throw");
            throw new SessionError(SESSION_ERROR_SESSION_NOT_FOUND);
          } else if (jsonResponse.Code === "SSO_AuthenticateAccountNotFound") {
            throw new AccountError(ACCOUNT_ERROR_ACCOUNT_NOT_FOUND);
          } else if (jsonResponse.Code === "AccountPasswordInvalid") {
            throw new AccountError(ACCOUNT_ERROR_PASSWORD_INVALID);
          } else if (
            jsonResponse.Code === "SSO_AuthenticateMaxAttemptsExceeed"
          ) {
            throw new AccountError(ACCOUNT_ERROR_MAX_ATTEMPTS);
          } else if (jsonResponse.Code === "InvalidArgument") {
            if (jsonResponse.Message.includes("accountName")) {
              throw new AccountError(ACCOUNT_ERROR_USERNAME_NULL_EMPTY);
            } else if (jsonResponse.Message.includes("password")) {
              throw new AccountError(ACCOUNT_ERROR_PASSWORD_NULL_EMPTY);
            }
          } else {
            console.error(`${jsonResponse.Code}: ${jsonResponse.Message}`);
          }
        } else {
          console.error(`${response.status}:`, jsonResponse);
        }
      }
      return jsonResponse;
    } catch (error) {
      console.error(error);
    }
  }

  _validatesessionId() {
    if (!this.sessionId) {
      throw new SessionError(SESSION_ERROR_SESSION_ID_NULL);
    }
    if (this.sessionId === DEFAULT_SESSION_ID) {
      throw new SessionError(SESSION_ERROR_SESSION_ID_DEFAULT);
    }
  }

  _validateAccount() {
    if (!this.username) {
      console.error(ACCOUNT_ERROR_USERNAME_NULL_EMPTY);
      throw new AccountError(ACCOUNT_ERROR_USERNAME_NULL_EMPTY);
    }
    if (!this.password) {
      console.error(ACCOUNT_ERROR_PASSWORD_NULL_EMPTY);
      throw new AccountError(ACCOUNT_ERROR_PASSWORD_NULL_EMPTY);
    }
  }

  _validateAccountID() {
    if (!this.accountId) {
      console.error(SESSION_ERROR_ACCOUNT_ID_NULL_EMPTY);
      throw new AccountError(SESSION_ERROR_ACCOUNT_ID_NULL_EMPTY);
    }
    if (this.accountId == DEFAULT_SESSION_ID) {
      console.error(SESSION_ERROR_ACCOUNT_ID_DEFAULT);
      throw new AccountError(SESSION_ERROR_ACCOUNT_ID_DEFAULT);
    }
  }

  async createSession() {
    this._validateAccount();

    const json = {
      accountName: this.username,
      password: this.password,
      applicationId: DEXCOM_APPLICATION_ID,
    };

    try {
      const endpoint1 = DEXCOM_AUTHENTICATE_ENDPOINT;
      const endpoint2 = DEXCOM_LOGIN_ID_ENDPOINT;

      const accountId = await this._request("post", endpoint1, json);
      this.accountId = accountId;

      this._validateAccountID();

      const json2 = {
        accountId: this.accountId,
        password: this.password,
        applicationId: DEXCOM_APPLICATION_ID,
      };

      const sessionId = await this._request("post", endpoint2, json2);
      this.sessionId = sessionId;
      this._validatesessionId();
    } catch (error) {
      if (error instanceof SessionError) {
        throw new AccountError(ACCOUNT_ERROR_UNKNOWN);
      }
      throw error;
    }
  }

  async verifySerialNumber(serialNumber) {
    this._validatesessionId();
    if (!serialNumber) {
      throw new ArgumentError(ARGUMENT_ERROR_SERIAL_NUMBER_NULL_EMPTY);
    }
    const params = { sessionId: this.sessionId, serialNumber };
    try {
      const response = await this._request(
        "post",
        DEXCOM_VERIFY_SERIAL_NUMBER_ENDPOINT,
        { params },
      );
      return response.json() === "AssignedToYou";
    } catch (error) {
      if (error.message === SESSION_ERROR_SESSION_NOT_VALID) {
        this.createSession();
        const response = await this._request(
          "post",
          DEXCOM_VERIFY_SERIAL_NUMBER_ENDPOINT,
          { params },
        );
        return response.json() === "AssignedToYou";
      }
      throw error;
    }
  }

  async getGlucoseReadings(minutes = 1440, maxCount = 288) {
    try {
      this._validatesessionId();
    } catch (error) {
      await this.createSession();
    }

    if (minutes < 1 || minutes > 1440) {
      throw new ArgumentError(ARGUMENT_ERROR_MINUTES_INVALID);
    }

    if (maxCount < 1 || maxCount > 288) {
      throw new ArgumentError(ARGUMENT_ERROR_MAX_COUNT_INVALID);
    }

    const params = {
      sessionId: this.sessionId,
      minutes,
      maxCount,
    };

    try {
      const jsonGlucoseReadings = await this._request(
        "post",
        DEXCOM_GLUCOSE_READINGS_ENDPOINT,
        params,
      );
      const glucoseReadings = jsonGlucoseReadings.map(
        (jsonGlucoseReading) => new GlucoseReading(jsonGlucoseReading),
      );
      if (glucoseReadings.length === 0) {
        return null;
      }
      return glucoseReadings;
    } catch (error) {
      if (error instanceof SessionError) {
        this.createSession();
        const jsonGlucoseReadings = await this._request(
          "post",
          DEXCOM_GLUCOSE_READINGS_ENDPOINT,
          null,
          params,
        );
        const glucoseReadings = jsonGlucoseReadings.map(
          (jsonGlucoseReading) => new GlucoseReading(jsonGlucoseReading),
        );
        if (glucoseReadings.length === 0) {
          return null;
        }
        return glucoseReadings;
      }
      throw error;
    }
  }

  async getLatestGlucoseReading() {
    const glucoseReadings = await this.getGlucoseReadings(5, 1);
    if (!glucoseReadings) {
      return null;
    }
    return glucoseReadings[0];
  }

  async getCurrentGlucoseReading() {
    try {
      const glucoseReadings = await this.getGlucoseReadings(10, 1);
      if (!glucoseReadings || glucoseReadings.length === 0) {
        return null;
      }
      return glucoseReadings[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Dexcom;
