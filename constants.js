// Dexcom Share API base urls
const DEXCOM_BASE_URL = "https://share2.dexcom.com/ShareWebServices/Services";
const DEXCOM_BASE_URL_OUS =
  "https://shareous1.dexcom.com/ShareWebServices/Services";

// Dexcom Share API endpoints
const DEXCOM_LOGIN_ID_ENDPOINT = "General/LoginPublisherAccountById";
const DEXCOM_AUTHENTICATE_ENDPOINT = "General/AuthenticatePublisherAccount";
const DEXCOM_VERIFY_SERIAL_NUMBER_ENDPOINT =
  "Publisher/CheckMonitoredReceiverAssignmentStatus";
const DEXCOM_GLUCOSE_READINGS_ENDPOINT =
  "Publisher/ReadPublisherLatestGlucoseValues";

const DEXCOM_APPLICATION_ID = "d89443d2-327c-4a6f-89e5-496bbb0317db";

// Dexcom error strings
const ACCOUNT_ERROR_USERNAME_NULL_EMPTY = "Username null or empty";
const ACCOUNT_ERROR_PASSWORD_NULL_EMPTY = "Password null or empty";
const SESSION_ERROR_ACCOUNT_ID_NULL_EMPTY = "Accound ID null or empty";
const SESSION_ERROR_ACCOUNT_ID_DEFAULT = "Accound ID default";
const ACCOUNT_ERROR_ACCOUNT_NOT_FOUND = "Account not found";
const ACCOUNT_ERROR_PASSWORD_INVALID = "Password not valid";
const ACCOUNT_ERROR_MAX_ATTEMPTS = "Maximum authentication attempts exceeded";
const ACCOUNT_ERROR_UNKNOWN = "Account error";

const SESSION_ERROR_SESSION_ID_NULL = "Session ID null";
const SESSION_ERROR_SESSION_ID_DEFAULT = "Session ID default";
const SESSION_ERROR_SESSION_NOT_VALID = "Session ID not valid";
const SESSION_ERROR_SESSION_NOT_FOUND = "Session ID not found";

const ARGUMENT_ERROR_MINUTES_INVALID = "Minutes must be between 1 and 1440";
const ARGUMENT_ERROR_MAX_COUNT_INVALID = "Max count must be between 1 and 288";
const ARGUMENT_ERROR_SERIAL_NUMBER_NULL_EMPTY = "Serial number null or empty";

// Other
const DEXCOM_TREND_DESCRIPTIONS = [
  "",
  "rising quickly",
  "rising",
  "rising slightly",
  "steady",
  "falling slightly",
  "falling",
  "falling quickly",
  "unable to determine trend",
  "trend unavailable",
];

const DEXCOM_TREND_DIRECTIONS = {
  None: 0, // unconfirmed
  DoubleUp: 1,
  SingleUp: 2,
  FortyFiveUp: 3,
  Flat: 4,
  FortyFiveDown: 5,
  SingleDown: 6,
  DoubleDown: 7,
  NotComputable: 8, // unconfirmed
  RateOutOfRange: 9, // unconfirmed
};

const DEXCOM_TREND_ARROWS = ["", "↑↑", "↑", "↗", "→", "↘", "↓", "↓↓", "?", "-"];

const DEFAULT_SESSION_ID = "00000000-0000-0000-0000-000000000000";

const MMOL_L_CONVERTION_FACTOR = 0.0555;

module.exports = {
  DEXCOM_BASE_URL,
  DEXCOM_BASE_URL_OUS,
  DEXCOM_LOGIN_ID_ENDPOINT,
  DEXCOM_AUTHENTICATE_ENDPOINT,
  DEXCOM_VERIFY_SERIAL_NUMBER_ENDPOINT,
  DEXCOM_GLUCOSE_READINGS_ENDPOINT,
  DEXCOM_APPLICATION_ID,
  ACCOUNT_ERROR_USERNAME_NULL_EMPTY,
  ACCOUNT_ERROR_PASSWORD_NULL_EMPTY,
  SESSION_ERROR_ACCOUNT_ID_NULL_EMPTY,
  SESSION_ERROR_ACCOUNT_ID_DEFAULT,
  ACCOUNT_ERROR_ACCOUNT_NOT_FOUND,
  ACCOUNT_ERROR_PASSWORD_INVALID,
  ACCOUNT_ERROR_MAX_ATTEMPTS,
  ACCOUNT_ERROR_UNKNOWN,
  SESSION_ERROR_SESSION_ID_NULL,
  SESSION_ERROR_SESSION_ID_DEFAULT,
  SESSION_ERROR_SESSION_NOT_VALID,
  SESSION_ERROR_SESSION_NOT_FOUND,
  ARGUMENT_ERROR_MINUTES_INVALID,
  ARGUMENT_ERROR_MAX_COUNT_INVALID,
  ARGUMENT_ERROR_SERIAL_NUMBER_NULL_EMPTY,
  DEXCOM_TREND_DESCRIPTIONS,
  DEXCOM_TREND_DIRECTIONS,
  DEXCOM_TREND_ARROWS,
  DEFAULT_SESSION_ID,
  MMOL_L_CONVERTION_FACTOR,
};
