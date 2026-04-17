const {
  AccountErrorEnum,
  SessionErrorEnum,
  ArgumentErrorEnum,
  ServerErrorEnum,
  DexcomError,
  AccountError,
  SessionError,
  ArgumentError,
  ServerError,
} = require("../errors");

describe("AccountErrorEnum", () => {
  test("has FAILED_AUTHENTICATION", () => {
    expect(AccountErrorEnum.FAILED_AUTHENTICATION).toBe(
      "Failed to authenticate",
    );
  });

  test("has MAX_ATTEMPTS", () => {
    expect(AccountErrorEnum.MAX_ATTEMPTS).toBe(
      "Maximum authentication attempts exceeded",
    );
  });

  test("is frozen", () => {
    expect(Object.isFrozen(AccountErrorEnum)).toBe(true);
  });
});

describe("SessionErrorEnum", () => {
  test("has NOT_FOUND", () => {
    expect(SessionErrorEnum.NOT_FOUND).toBe("Session ID not found");
  });

  test("has INVALID", () => {
    expect(SessionErrorEnum.INVALID).toBe("Session not active or timed out");
  });

  test("is frozen", () => {
    expect(Object.isFrozen(SessionErrorEnum)).toBe(true);
  });
});

describe("ArgumentErrorEnum", () => {
  test("has all expected values", () => {
    expect(ArgumentErrorEnum.MINUTES_INVALID).toBeDefined();
    expect(ArgumentErrorEnum.MAX_COUNT_INVALID).toBeDefined();
    expect(ArgumentErrorEnum.USERNAME_INVALID).toBeDefined();
    expect(ArgumentErrorEnum.USER_ID_MULTIPLE).toBeDefined();
    expect(ArgumentErrorEnum.USER_ID_REQUIRED).toBeDefined();
    expect(ArgumentErrorEnum.PASSWORD_INVALID).toBeDefined();
    expect(ArgumentErrorEnum.REGION_INVALID).toBeDefined();
    expect(ArgumentErrorEnum.ACCOUNT_ID_INVALID).toBeDefined();
    expect(ArgumentErrorEnum.ACCOUNT_ID_DEFAULT).toBeDefined();
    expect(ArgumentErrorEnum.SESSION_ID_INVALID).toBeDefined();
    expect(ArgumentErrorEnum.SESSION_ID_DEFAULT).toBeDefined();
    expect(ArgumentErrorEnum.GLUCOSE_READING_INVALID).toBeDefined();
  });

  test("has exactly 12 entries", () => {
    expect(Object.keys(ArgumentErrorEnum)).toHaveLength(12);
  });

  test("is frozen", () => {
    expect(Object.isFrozen(ArgumentErrorEnum)).toBe(true);
  });
});

describe("ServerErrorEnum", () => {
  test("has INVALID_JSON", () => {
    expect(ServerErrorEnum.INVALID_JSON).toBe(
      "Invalid or malformed JSON in server response",
    );
  });

  test("has UNKNOWN_CODE", () => {
    expect(ServerErrorEnum.UNKNOWN_CODE).toBe(
      "Unknown error code in server response",
    );
  });

  test("has UNEXPECTED", () => {
    expect(ServerErrorEnum.UNEXPECTED).toBe("Unexpected server response");
  });

  test("is frozen", () => {
    expect(Object.isFrozen(ServerErrorEnum)).toBe(true);
  });
});

describe("DexcomError", () => {
  test("is an instance of Error", () => {
    const error = new DexcomError(AccountErrorEnum.FAILED_AUTHENTICATION);
    expect(error).toBeInstanceOf(Error);
  });

  test("has name DexcomError", () => {
    const error = new DexcomError();
    expect(error.name).toBe("DexcomError");
  });

  test("sets message from enum value", () => {
    const error = new DexcomError(AccountErrorEnum.FAILED_AUTHENTICATION);
    expect(error.message).toBe("Failed to authenticate");
  });

  test("exposes enum via .enum getter", () => {
    const error = new DexcomError(AccountErrorEnum.MAX_ATTEMPTS);
    expect(error.enum).toBe(AccountErrorEnum.MAX_ATTEMPTS);
  });

  test("can be constructed with no arguments", () => {
    const error = new DexcomError();
    expect(error.enum).toBeNull();
    expect(error.message).toBe("");
  });

  test("can be constructed with null", () => {
    const error = new DexcomError(null);
    expect(error.enum).toBeNull();
    expect(error.message).toBe("");
  });
});

describe("AccountError", () => {
  test("extends DexcomError", () => {
    const error = new AccountError(AccountErrorEnum.FAILED_AUTHENTICATION);
    expect(error).toBeInstanceOf(DexcomError);
    expect(error).toBeInstanceOf(Error);
  });

  test("has name AccountError", () => {
    const error = new AccountError(AccountErrorEnum.FAILED_AUTHENTICATION);
    expect(error.name).toBe("AccountError");
  });

  test("exposes enum", () => {
    const error = new AccountError(AccountErrorEnum.MAX_ATTEMPTS);
    expect(error.enum).toBe(AccountErrorEnum.MAX_ATTEMPTS);
  });

  test("sets message from enum", () => {
    const error = new AccountError(AccountErrorEnum.FAILED_AUTHENTICATION);
    expect(error.message).toBe("Failed to authenticate");
  });
});

describe("SessionError", () => {
  test("extends DexcomError", () => {
    const error = new SessionError(SessionErrorEnum.NOT_FOUND);
    expect(error).toBeInstanceOf(DexcomError);
    expect(error).toBeInstanceOf(Error);
  });

  test("has name SessionError", () => {
    const error = new SessionError(SessionErrorEnum.NOT_FOUND);
    expect(error.name).toBe("SessionError");
  });

  test("exposes enum", () => {
    const error = new SessionError(SessionErrorEnum.INVALID);
    expect(error.enum).toBe(SessionErrorEnum.INVALID);
  });
});

describe("ArgumentError", () => {
  test("extends DexcomError", () => {
    const error = new ArgumentError(ArgumentErrorEnum.MINUTES_INVALID);
    expect(error).toBeInstanceOf(DexcomError);
    expect(error).toBeInstanceOf(Error);
  });

  test("has name ArgumentError", () => {
    const error = new ArgumentError(ArgumentErrorEnum.MINUTES_INVALID);
    expect(error.name).toBe("ArgumentError");
  });

  test("exposes enum", () => {
    const error = new ArgumentError(ArgumentErrorEnum.REGION_INVALID);
    expect(error.enum).toBe(ArgumentErrorEnum.REGION_INVALID);
  });
});

describe("ServerError", () => {
  test("extends DexcomError", () => {
    const error = new ServerError(ServerErrorEnum.INVALID_JSON);
    expect(error).toBeInstanceOf(DexcomError);
    expect(error).toBeInstanceOf(Error);
  });

  test("has name ServerError", () => {
    const error = new ServerError(ServerErrorEnum.INVALID_JSON);
    expect(error.name).toBe("ServerError");
  });

  test("exposes enum", () => {
    const error = new ServerError(ServerErrorEnum.UNEXPECTED);
    expect(error.enum).toBe(ServerErrorEnum.UNEXPECTED);
  });
});

describe("Error hierarchy - catch patterns", () => {
  test("AccountError can be caught as DexcomError", () => {
    const fn = () => {
      throw new AccountError(AccountErrorEnum.FAILED_AUTHENTICATION);
    };
    expect(fn).toThrow(DexcomError);
  });

  test("SessionError can be caught as DexcomError", () => {
    const fn = () => {
      throw new SessionError(SessionErrorEnum.NOT_FOUND);
    };
    expect(fn).toThrow(DexcomError);
  });

  test("ArgumentError can be caught as DexcomError", () => {
    const fn = () => {
      throw new ArgumentError(ArgumentErrorEnum.MINUTES_INVALID);
    };
    expect(fn).toThrow(DexcomError);
  });

  test("ServerError can be caught as DexcomError", () => {
    const fn = () => {
      throw new ServerError(ServerErrorEnum.UNEXPECTED);
    };
    expect(fn).toThrow(DexcomError);
  });

  test("error types are distinguishable from each other", () => {
    const accountErr = new AccountError(AccountErrorEnum.FAILED_AUTHENTICATION);
    const sessionErr = new SessionError(SessionErrorEnum.NOT_FOUND);
    const argumentErr = new ArgumentError(ArgumentErrorEnum.MINUTES_INVALID);
    const serverErr = new ServerError(ServerErrorEnum.UNEXPECTED);

    expect(accountErr).not.toBeInstanceOf(SessionError);
    expect(accountErr).not.toBeInstanceOf(ArgumentError);
    expect(accountErr).not.toBeInstanceOf(ServerError);

    expect(sessionErr).not.toBeInstanceOf(AccountError);
    expect(argumentErr).not.toBeInstanceOf(SessionError);
    expect(serverErr).not.toBeInstanceOf(ArgumentError);
  });
});
