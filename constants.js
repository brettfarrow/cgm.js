const Region = Object.freeze({
  US: "us",
  OUS: "ous",
  JP: "jp",
});

// Per-region Dexcom Share API application IDs
const DEXCOM_APPLICATION_ID_US = "d89443d2-327c-4a6f-89e5-496bbb0317db";
const DEXCOM_APPLICATION_ID_OUS = DEXCOM_APPLICATION_ID_US;
const DEXCOM_APPLICATION_ID_JP = "d8665ade-9673-4e27-9ff6-92db4ce13d13";

const DEXCOM_APPLICATION_IDS = Object.freeze({
  [Region.US]: DEXCOM_APPLICATION_ID_US,
  [Region.OUS]: DEXCOM_APPLICATION_ID_OUS,
  [Region.JP]: DEXCOM_APPLICATION_ID_JP,
});

// Per-region Dexcom Share API base URLs
const DEXCOM_BASE_URL =
  "https://share2.dexcom.com/ShareWebServices/Services/";
const DEXCOM_BASE_URL_OUS =
  "https://shareous1.dexcom.com/ShareWebServices/Services/";
const DEXCOM_BASE_URL_JP =
  "https://share.dexcom.jp/ShareWebServices/Services/";

const DEXCOM_BASE_URLS = Object.freeze({
  [Region.US]: DEXCOM_BASE_URL,
  [Region.OUS]: DEXCOM_BASE_URL_OUS,
  [Region.JP]: DEXCOM_BASE_URL_JP,
});

// Dexcom Share API endpoints
const DEXCOM_LOGIN_ID_ENDPOINT = "General/LoginPublisherAccountById";
const DEXCOM_AUTHENTICATE_ENDPOINT = "General/AuthenticatePublisherAccount";
const DEXCOM_GLUCOSE_READINGS_ENDPOINT =
  "Publisher/ReadPublisherLatestGlucoseValues";

// Headers for all Dexcom Share API requests
const HEADERS = Object.freeze({
  "Content-Type": "application/json",
  "Accept-Encoding": "application/json",
});

// Trend directions returned by the Dexcom Share API mapped to integers
const DEXCOM_TREND_DIRECTIONS = Object.freeze({
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
});

// Trend descriptions ordered identically to DEXCOM_TREND_DIRECTIONS
const TREND_DESCRIPTIONS = Object.freeze([
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
]);

// Trend arrows ordered identically to DEXCOM_TREND_DIRECTIONS
const TREND_ARROWS = Object.freeze([
  "",
  "\u2191\u2191",
  "\u2191",
  "\u2197",
  "\u2192",
  "\u2198",
  "\u2193",
  "\u2193\u2193",
  "?",
  "-",
]);

// UUID consisting of all zeros, likely error if returned by Dexcom Share API
const DEFAULT_UUID = "00000000-0000-0000-0000-000000000000";

// Maximum minutes to use when retrieving glucose values (1 day)
const MAX_MINUTES = 1440;

// Maximum count to use when retrieving glucose values (1 reading per 5 minutes)
const MAX_MAX_COUNT = 288;

// Conversion factor between mg/dL and mmol/L
const MMOL_L_CONVERSION_FACTOR = 0.0555;

module.exports = {
  Region,
  DEXCOM_APPLICATION_IDS,
  DEXCOM_BASE_URLS,
  DEXCOM_LOGIN_ID_ENDPOINT,
  DEXCOM_AUTHENTICATE_ENDPOINT,
  DEXCOM_GLUCOSE_READINGS_ENDPOINT,
  HEADERS,
  DEXCOM_TREND_DIRECTIONS,
  TREND_DESCRIPTIONS,
  TREND_ARROWS,
  DEFAULT_UUID,
  MAX_MINUTES,
  MAX_MAX_COUNT,
  MMOL_L_CONVERSION_FACTOR,
};
