class DexcomError extends Error {
  constructor(message) {
    super(message);
    this.name = "DexcomError";
  }
}

class AccountError extends DexcomError {
  constructor(message) {
    super(message);
    this.name = "AccountError";
  }
}

class SessionError extends DexcomError {
  constructor(message) {
    super(message);
    this.name = "SessionError";
  }
}

class ArgumentError extends DexcomError {
  constructor(message) {
    super(message);
    this.name = "ArgumentError";
  }
}

module.exports = {
  DexcomError,
  AccountError,
  SessionError,
  ArgumentError,
};
