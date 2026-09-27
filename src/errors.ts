type ValueOf<T> = T[keyof T];

export const AccountErrorEnum = Object.freeze({
  FAILED_AUTHENTICATION: "Failed to authenticate",
  MAX_ATTEMPTS: "Maximum authentication attempts exceeded",
} as const);
export type AccountErrorEnum = ValueOf<typeof AccountErrorEnum>;

export const SessionErrorEnum = Object.freeze({
  NOT_FOUND: "Session ID not found",
  INVALID: "Session not active or timed out",
} as const);
export type SessionErrorEnum = ValueOf<typeof SessionErrorEnum>;

export const ArgumentErrorEnum = Object.freeze({
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
  REQUEST_TIMEOUT_INVALID:
    "Request timeout must be an integer between 1 and 2147483647 milliseconds",
} as const);
export type ArgumentErrorEnum = ValueOf<typeof ArgumentErrorEnum>;

export const ServerErrorEnum = Object.freeze({
  INVALID_JSON: "Invalid or malformed JSON in server response",
  UNKNOWN_CODE: "Unknown error code in server response",
  UNEXPECTED: "Unexpected server response",
  TIMEOUT: "Request timed out",
  REDIRECT:
    "Server responded with a redirect, which is not followed to protect credentials",
} as const);
export type ServerErrorEnum = ValueOf<typeof ServerErrorEnum>;

export type DexcomErrorEnum =
  | AccountErrorEnum
  | SessionErrorEnum
  | ArgumentErrorEnum
  | ServerErrorEnum;

export class DexcomError<
  E extends DexcomErrorEnum = DexcomErrorEnum,
> extends Error {
  private readonly _enum: E | null;

  constructor(errorEnum: E | null = null) {
    if (errorEnum !== null) {
      super(errorEnum);
    } else {
      super();
    }
    this.name = "DexcomError";
    this._enum = errorEnum;
  }

  get enum(): E | null {
    return this._enum;
  }
}

export class AccountError extends DexcomError<AccountErrorEnum> {
  constructor(errorEnum: AccountErrorEnum) {
    super(errorEnum);
    this.name = "AccountError";
  }
}

export class SessionError extends DexcomError<SessionErrorEnum> {
  constructor(errorEnum: SessionErrorEnum) {
    super(errorEnum);
    this.name = "SessionError";
  }
}

export class ArgumentError extends DexcomError<ArgumentErrorEnum> {
  constructor(errorEnum: ArgumentErrorEnum) {
    super(errorEnum);
    this.name = "ArgumentError";
  }
}

export class ServerError extends DexcomError<ServerErrorEnum> {
  constructor(errorEnum: ServerErrorEnum) {
    super(errorEnum);
    this.name = "ServerError";
  }
}
