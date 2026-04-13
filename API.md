# cgm.js API Reference

## Table of Contents

- [Classes](#classes)
  - [Dexcom](#dexcom)
  - [GlucoseReading](#glucosereading)
- [Enums and Constants](#enums-and-constants)
  - [Region](#region)
  - [Error Enums](#error-enums)
- [Error Classes](#error-classes)
  - [DexcomError](#dexcomerror)
  - [AccountError](#accounterror)
  - [SessionError](#sessionerror)
  - [ArgumentError](#argumenterror)
  - [ServerError](#servererror)
- [Constants](#constants)

---

## Classes

### Dexcom

The main class for communicating with the Dexcom Share API.

#### Constructor

```js
const { Dexcom, Region } = require("cgm.js");

const dexcom = new Dexcom({ username, password, region });
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `password` | `string` | Yes | | Password for the Dexcom Share user (not follower). |
| `username` | `string` | One of `username` or `accountId` | `null` | Username, email, or phone number for the Dexcom Share user. |
| `accountId` | `string` | One of `username` or `accountId` | `null` | Account ID (UUID) for the Dexcom Share user. |
| `region` | `Region` | No | `Region.US` | The Dexcom Share region. One of `Region.US`, `Region.OUS`, or `Region.JP`. |

**Throws:**
- `ArgumentError` (`USER_ID_REQUIRED`) if neither `username` nor `accountId` is provided.
- `ArgumentError` (`USER_ID_MULTIPLE`) if both `username` and `accountId` are provided.
- `ArgumentError` (`REGION_INVALID`) if `region` is not a valid `Region` value.

**Notes:**
- Use `username` with your Dexcom account credentials (the account that *publishes* readings, not a follower).
- Use `accountId` if you already know your account UUID (found in the URL after logging in at your region's Dexcom Account Management site).
- The constructor does **not** create a session automatically. Sessions are created lazily on the first API call, or by calling `createSession()` explicitly.

---

#### `dexcom.username`

**Type:** `string | null` (getter)

Returns the username provided at construction, or `null` if authenticating via `accountId`.

---

#### `dexcom.accountId`

**Type:** `string | null` (getter)

Returns the account ID. This is `null` until a session has been created (at which point it is populated by the authenticate endpoint), unless `accountId` was provided at construction.

---

#### `async dexcom.createSession()`

Authenticates with the Dexcom Share API and establishes a session.

**Returns:** `Promise<void>`

**Throws:**
- `ArgumentError` (`PASSWORD_INVALID`) if the password is missing or not a string.
- `ArgumentError` (`USERNAME_INVALID`) if authenticating by username and it is missing or not a string.
- `ArgumentError` (`ACCOUNT_ID_INVALID`) if the API returns a non-UUID account ID.
- `ArgumentError` (`ACCOUNT_ID_DEFAULT`) if the API returns the all-zeros UUID.
- `ArgumentError` (`SESSION_ID_INVALID`) if the API returns a non-UUID session ID.
- `ArgumentError` (`SESSION_ID_DEFAULT`) if the API returns the all-zeros UUID.
- `AccountError` if authentication fails (wrong credentials, max attempts, etc.).
- `ServerError` if the API returns an unexpected response.

**Notes:**
- When using `username`, this makes two API calls: one to get the `accountId`, then one to get the `sessionId`.
- When using `accountId`, this skips the first call and goes directly to login.
- You typically don't need to call this directly. `getGlucoseReadings()` and the convenience methods call it automatically when needed.

---

#### `async dexcom.getGlucoseReadings(minutes?, maxCount?)`

Retrieves glucose readings from the Dexcom Share API.

```js
const readings = await dexcom.getGlucoseReadings(60, 12);
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `minutes` | `integer` | `1440` | Number of minutes to look back (1--1440). |
| `maxCount` | `integer` | `288` | Maximum number of readings to return (1--288). |

**Returns:** `Promise<GlucoseReading[]>` -- An array of `GlucoseReading` objects. May be empty if no readings are available in the specified window.

**Throws:**
- `ArgumentError` (`MINUTES_INVALID`) if `minutes` is not an integer between 1 and 1440.
- `ArgumentError` (`MAX_COUNT_INVALID`) if `maxCount` is not an integer between 1 and 288.
- `AccountError` if authentication fails during session creation.
- `ServerError` if the API returns an unexpected response.

**Notes:**
- The API returns the *minimum* of the two parameters. For example, if you request 30 minutes and 3 readings, you'll get at most 3 readings (or fewer if fewer exist in the 30-minute window).
- If no session exists or the session has expired, this method automatically calls `createSession()` before retrying.

---

#### `async dexcom.getLatestGlucoseReading()`

Returns the single most recent glucose reading within the last 5 minutes.

**Returns:** `Promise<GlucoseReading | null>` -- The latest reading, or `null` if no reading is available within the 5-minute window.

Equivalent to:
```js
const readings = await dexcom.getGlucoseReadings(5, 1);
return readings.length > 0 ? readings[0] : null;
```

---

#### `async dexcom.getLatestGlucoseReadings(maxCount?)`

Returns glucose readings from the last 24 hours.

```js
const readings = await dexcom.getLatestGlucoseReadings(12);
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxCount` | `integer` | `288` | Maximum number of readings to return (1--288). |

**Returns:** `Promise<GlucoseReading[]>` -- An array of `GlucoseReading` objects from the full 24-hour window.

Equivalent to:
```js
return dexcom.getGlucoseReadings(1440, maxCount);
```

---

#### `async dexcom.getCurrentGlucoseReading()`

Returns the single most recent glucose reading within the last 10 minutes.

**Returns:** `Promise<GlucoseReading | null>` -- The current reading, or `null` if no reading is available within the 10-minute window.

Equivalent to:
```js
const readings = await dexcom.getGlucoseReadings(10, 1);
return readings.length > 0 ? readings[0] : null;
```

---

### GlucoseReading

Represents a single parsed glucose reading from the Dexcom Share API.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `value` | `number` | Blood glucose value in mg/dL. |
| `mgdL` | `number` | Alias for `value`. Blood glucose value in mg/dL. |
| `mmolL` | `number` | Blood glucose value in mmol/L (converted, rounded to 1 decimal). |
| `trend` | `number` | Numeric trend code (0--9). See [Trend Values](#trend-values). |
| `trendDirection` | `string` | Raw trend direction string from the API (e.g., `"Flat"`, `"SingleUp"`). |
| `trendDescription` | `string` | Human-readable trend description (e.g., `"steady"`, `"rising"`). |
| `trendArrow` | `string` | Unicode arrow representing the trend (e.g., `"\u2192"`, `"\u2191"`). |
| `time` | `Date` | JavaScript `Date` object for when the reading was recorded. |
| `json` | `object` | The original JSON object from the Dexcom Share API. |

#### `glucoseReading.toString()`

Returns the glucose value as a string.

```js
const reading = await dexcom.getLatestGlucoseReading();
console.log(`${reading}`); // "120"
```

#### Trend Values

| Code | Direction | Description | Arrow |
|------|-----------|-------------|-------|
| 0 | `None` | *(unknown)* | |
| 1 | `DoubleUp` | rising quickly | &#8593;&#8593; |
| 2 | `SingleUp` | rising | &#8593; |
| 3 | `FortyFiveUp` | rising slightly | &#8599; |
| 4 | `Flat` | steady | &#8594; |
| 5 | `FortyFiveDown` | falling slightly | &#8600; |
| 6 | `SingleDown` | falling | &#8595; |
| 7 | `DoubleDown` | falling quickly | &#8595;&#8595; |
| 8 | `NotComputable` | unable to determine trend | ? |
| 9 | `RateOutOfRange` | trend unavailable | - |

---

## Enums and Constants

### Region

Determines which Dexcom Share regional server to use.

```js
const { Region } = require("cgm.js");
```

| Value | String | Base URL |
|-------|--------|----------|
| `Region.US` | `"us"` | `https://share2.dexcom.com/ShareWebServices/Services/` |
| `Region.OUS` | `"ous"` | `https://shareous1.dexcom.com/ShareWebServices/Services/` |
| `Region.JP` | `"jp"` | `https://share.dexcom.jp/ShareWebServices/Services/` |

**How to choose:**
- **US**: Dexcom accounts managed at [uam1.dexcom.com](https://uam1.dexcom.com).
- **OUS** (Outside US): Accounts managed at [uam2.dexcom.com](https://uam2.dexcom.com).
- **JP** (Japan): Accounts managed at [uam.dexcom.jp](https://uam.dexcom.jp).

---

### Error Enums

Error enums are frozen objects whose values are the human-readable error messages. They are passed to error class constructors and exposed via the `.enum` property for programmatic error handling.

#### `AccountErrorEnum`

| Key | Value |
|-----|-------|
| `FAILED_AUTHENTICATION` | `"Failed to authenticate"` |
| `MAX_ATTEMPTS` | `"Maximum authentication attempts exceeded"` |

#### `SessionErrorEnum`

| Key | Value |
|-----|-------|
| `NOT_FOUND` | `"Session ID not found"` |
| `INVALID` | `"Session not active or timed out"` |

#### `ArgumentErrorEnum`

| Key | Value |
|-----|-------|
| `MINUTES_INVALID` | `"Minutes must be an integer between 1 and 1440"` |
| `MAX_COUNT_INVALID` | `"Max count must be an integer between 1 and 288"` |
| `USERNAME_INVALID` | `"Username must be non-empty string"` |
| `USER_ID_MULTIPLE` | `"Only one of accountId, username should be provided"` |
| `USER_ID_REQUIRED` | `"At least one of accountId, username should be provided"` |
| `PASSWORD_INVALID` | `"Password must be non-empty string"` |
| `REGION_INVALID` | `"Region must be 'us', 'ous', or 'jp'"` |
| `ACCOUNT_ID_INVALID` | `"Account ID must be UUID"` |
| `ACCOUNT_ID_DEFAULT` | `"Account ID default"` |
| `SESSION_ID_INVALID` | `"Session ID must be UUID"` |
| `SESSION_ID_DEFAULT` | `"Session ID default"` |
| `GLUCOSE_READING_INVALID` | `"JSON glucose reading incorrectly formatted"` |

#### `ServerErrorEnum`

| Key | Value |
|-----|-------|
| `INVALID_JSON` | `"Invalid or malformed JSON in server response"` |
| `UNKNOWN_CODE` | `"Unknown error code in server response"` |
| `UNEXPECTED` | `"Unexpected server response"` |

---

## Error Classes

All error classes extend `DexcomError`, which extends the built-in `Error`. This allows you to catch all library errors with a single `catch` or be specific.

```js
const { DexcomError, AccountError, AccountErrorEnum } = require("cgm.js/errors");

try {
  await dexcom.getGlucoseReadings();
} catch (error) {
  if (error instanceof AccountError) {
    if (error.enum === AccountErrorEnum.MAX_ATTEMPTS) {
      console.log("Too many login attempts, try again later");
    }
  }
}
```

### DexcomError

Base class for all cgm.js errors.

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | `"DexcomError"` (or the subclass name). |
| `message` | `string` | The human-readable error message (from the enum value). |
| `enum` | `*ErrorEnum \| null` | The error enum value, for programmatic checking. |

Can be constructed with no arguments (`.enum` will be `null`, `.message` will be empty).

### AccountError

Errors related to Dexcom Share API credentials (wrong password, account not found, max attempts exceeded).

**Extends:** `DexcomError`

### SessionError

Errors related to the Dexcom Share API session (session expired, session not found).

**Extends:** `DexcomError`

### ArgumentError

Errors related to invalid arguments passed to cgm.js methods (bad minutes/maxCount, missing credentials, invalid region).

**Extends:** `DexcomError`

### ServerError

Errors related to unexpected or malformed responses from the Dexcom Share API (invalid JSON, unknown error codes).

**Extends:** `DexcomError`

---

## Constants

Available from `require("cgm.js/constants")`.

| Constant | Type | Value | Description |
|----------|------|-------|-------------|
| `DEFAULT_UUID` | `string` | `"00000000-0000-0000-0000-000000000000"` | All-zeros UUID, indicates an error if returned by the API. |
| `MAX_MINUTES` | `number` | `1440` | Maximum minutes parameter (24 hours). |
| `MAX_MAX_COUNT` | `number` | `288` | Maximum reading count (one per 5 minutes for 24 hours). |
| `MMOL_L_CONVERSION_FACTOR` | `number` | `0.0555` | Multiplier to convert mg/dL to mmol/L. |
| `DEXCOM_TREND_DIRECTIONS` | `object` | See [Trend Values](#trend-values) | Maps direction strings to numeric codes. |
| `TREND_DESCRIPTIONS` | `string[]` | | Human-readable descriptions indexed by trend code. |
| `TREND_ARROWS` | `string[]` | | Unicode arrows indexed by trend code. |
| `HEADERS` | `object` | `{ "Content-Type": "application/json", "Accept-Encoding": "application/json" }` | HTTP headers used for all API requests. |
| `DEXCOM_BASE_URLS` | `object` | | Maps `Region` values to base URL strings. |
| `DEXCOM_APPLICATION_IDS` | `object` | | Maps `Region` values to application ID strings. |
| `DEXCOM_AUTHENTICATE_ENDPOINT` | `string` | `"General/AuthenticatePublisherAccount"` | API endpoint for authentication. |
| `DEXCOM_LOGIN_ID_ENDPOINT` | `string` | `"General/LoginPublisherAccountById"` | API endpoint for session login. |
| `DEXCOM_GLUCOSE_READINGS_ENDPOINT` | `string` | `"Publisher/ReadPublisherLatestGlucoseValues"` | API endpoint for glucose readings. |
