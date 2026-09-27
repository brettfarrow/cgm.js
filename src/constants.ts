type ValueOf<T> = T[keyof T];

export const Region = Object.freeze({
  US: "us",
  OUS: "ous",
  JP: "jp",
} as const);
export type Region = ValueOf<typeof Region>;

// Per-region Dexcom Share API application IDs
const DEXCOM_APPLICATION_ID_US = "d89443d2-327c-4a6f-89e5-496bbb0317db";
const DEXCOM_APPLICATION_ID_OUS = DEXCOM_APPLICATION_ID_US;
const DEXCOM_APPLICATION_ID_JP = "d8665ade-9673-4e27-9ff6-92db4ce13d13";

export const DEXCOM_APPLICATION_IDS = Object.freeze({
  [Region.US]: DEXCOM_APPLICATION_ID_US,
  [Region.OUS]: DEXCOM_APPLICATION_ID_OUS,
  [Region.JP]: DEXCOM_APPLICATION_ID_JP,
} as const);

// Per-region Dexcom Share API base URLs
const DEXCOM_BASE_URL =
  "https://share2.dexcom.com/ShareWebServices/Services/";
const DEXCOM_BASE_URL_OUS =
  "https://shareous1.dexcom.com/ShareWebServices/Services/";
const DEXCOM_BASE_URL_JP =
  "https://share.dexcom.jp/ShareWebServices/Services/";

export const DEXCOM_BASE_URLS = Object.freeze({
  [Region.US]: DEXCOM_BASE_URL,
  [Region.OUS]: DEXCOM_BASE_URL_OUS,
  [Region.JP]: DEXCOM_BASE_URL_JP,
} as const);

// Dexcom Share API endpoints
export const DEXCOM_LOGIN_ID_ENDPOINT = "General/LoginPublisherAccountById";
export const DEXCOM_AUTHENTICATE_ENDPOINT = "General/AuthenticatePublisherAccount";
export const DEXCOM_GLUCOSE_READINGS_ENDPOINT =
  "Publisher/ReadPublisherLatestGlucoseValues";

// Headers for all Dexcom Share API requests
export const HEADERS = Object.freeze({
  "Content-Type": "application/json",
  Accept: "application/json",
} as const);

// Trend directions returned by the Dexcom Share API mapped to integers
export const DEXCOM_TREND_DIRECTIONS = Object.freeze({
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
} as const);
export type TrendDirection = keyof typeof DEXCOM_TREND_DIRECTIONS;
export type Trend = (typeof DEXCOM_TREND_DIRECTIONS)[TrendDirection];

// Trend descriptions ordered identically to DEXCOM_TREND_DIRECTIONS
export const TREND_DESCRIPTIONS = Object.freeze([
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
] as const);

// Trend arrows ordered identically to DEXCOM_TREND_DIRECTIONS
export const TREND_ARROWS = Object.freeze([
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
] as const);

// UUID consisting of all zeros, likely error if returned by Dexcom Share API
export const DEFAULT_UUID = "00000000-0000-0000-0000-000000000000";

// Maximum minutes to use when retrieving glucose values (1 day)
export const MAX_MINUTES = 1440;

// Maximum count to use when retrieving glucose values (1 reading per 5 minutes)
export const MAX_MAX_COUNT = 288;

// Conversion factor between mg/dL and mmol/L
export const MMOL_L_CONVERSION_FACTOR = 0.0555;
