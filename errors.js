const AccountErrorEnum = Object.freeze({
  FAILED_AUTHENTICATION: "Failed to authenticate",
  MAX_ATTEMPTS: "Maximum authentication attempts exceeded",
});

const SessionErrorEnum = Object.freeze({
  NOT_FOUND: "Session ID not found",
  INVALID: "Session not active or timed out",
});

const ArgumentErrorEnum = Object.freeze({
  MINUTES_INVALID: "Minutes must be an integer between 1 and 1440",
  MAX_COUNT_INVALID: "Max count must be an integer between 1 and 288",
  USERNAME_INVALID: "Username must be non-empty string",
  USER_ID_MULTIPLE: "Only one of accountId, username should be provided",
  USER_ID_REQUIRED: "At least one of accountId, username should be provided",
  PASSWORD_INVALID: "Password must be non-empty string",
  REGION_INVALID: "Region must be 'us', 'ous', or 'jp'",
  ACCOUNT_ID_INVALID: "Account ID must be UUID",
  ACCOUNT_ID_DEFAULT: "Account ID default",
  SESSION_ID_INVALID: "Session ID must be UUID",
  SESSION_ID_DEFAULT: "Session ID default",
  GLUCOSE_READING_INVALID: "JSON glucose reading incorrectly formatted",
});

const ServerErrorEnum = Object.freeze({
  INVALID_JSON: "Invalid or malformed JSON in server response",
  UNKNOWN_CODE: "Unknown error code in server response",
  UNEXPECTED: "Unexpected server response",
});

class DexcomError extends Error {
  constructor(errorEnum = null) {
    if (errorEnum !== null) {
      super(errorEnum);
    } else {
      super();
    }
    this.name = "DexcomError";
    this._enum = errorEnum;
  }

  get enum() {
    return this._enum;
  }
}

class AccountError extends DexcomError {
  constructor(errorEnum) {
    super(errorEnum);
    this.name = "AccountError";
  }
}

class SessionError extends DexcomError {
  constructor(errorEnum) {
    super(errorEnum);
    this.name = "SessionError";
  }
}

class ArgumentError extends DexcomError {
  constructor(errorEnum) {
    super(errorEnum);
    this.name = "ArgumentError";
  }
}

class ServerError extends DexcomError {
  constructor(errorEnum) {
    super(errorEnum);
    this.name = "ServerError";
  }
}

module.exports = {
  AccountErrorEnum,
  SessionErrorEnum,
  ArgumentErrorEnum,
  ServerErrorEnum,
  DexcomError,
  AccountError,
  SessionError,
  ArgumentError,
  ServerError,
};
