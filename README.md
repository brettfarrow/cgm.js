# cgm.js

A JavaScript library for the Dexcom Share API. Port of [pydexcom](https://github.com/gagebenne/pydexcom).

## Requirements

Node.js 18 or later.

## Installation

```bash
npm install cgm.js
```

## Upgrading from v1 to v2

Version 2.0.0 changes the runtime requirements and HTTP implementation:

- **Node.js 18 or later is required**, up from Node.js 14. Update your local
  runtime, CI configuration, and deployment environment before upgrading.
- **Requests use the built-in global `fetch`.** The `isomorphic-fetch` dependency
  and its automatic polyfill have been removed. Environments without global
  `fetch` must supply their own compatible implementation.
- **Tests that mock `isomorphic-fetch` must mock global `fetch` instead.** For
  example, replace `jest.mock("isomorphic-fetch", () => mockFetch)` with
  `jest.spyOn(globalThis, "fetch").mockImplementation(mockFetch)`, and restore
  the spy after each test with `jest.restoreAllMocks()`.

The v1 constructor options, exports, reading methods, and error classes are
unchanged in the 2.0.0 release. Applications using the public API generally only
need to update their runtime and any HTTP mocks.

## Quick Start

```js
const { Dexcom, Region } = require("cgm.js");

async function main() {
  const dexcom = new Dexcom({ username: "username", password: "password" });
  const reading = await dexcom.getCurrentGlucoseReading();

  if (!reading) {
    console.log("No recent glucose reading available");
    return;
  }

  console.log(reading.value);            // 120
  console.log(reading.mmolL);            // 6.7
  console.log(reading.trendDirection);   // "Flat"
  console.log(reading.trendDescription); // "steady"
  console.log(reading.trendArrow);       // "→"
  console.log(reading.time);             // 2025-08-07T20:40:58.000Z
}

main();
```

## Usage

### Importing

```js
const { Dexcom, Region } = require("cgm.js");
```

### Authentication

By username (email, phone number, or account name):

```js
const dexcom = new Dexcom({ username: "user@email.com", password: "password" });
const dexcom = new Dexcom({ username: "+11234567890", password: "password" });
```

By account ID (found in the URL after logging in to Dexcom Account Management):

```js
const dexcom = new Dexcom({ accountId: "12345678-90ab-cdef-1234-567890abcdef", password: "password" });
```

### Regions

```js
// United States (default)
const dexcom = new Dexcom({ username: "user", password: "pass" });
const dexcom = new Dexcom({ username: "user", password: "pass", region: Region.US });

// Outside US
const dexcom = new Dexcom({ username: "user", password: "pass", region: Region.OUS });

// Japan
const dexcom = new Dexcom({ username: "user", password: "pass", region: Region.JP });
```

### Get a Single Reading

```js
// Most recent reading within the last 10 minutes
const current = await dexcom.getCurrentGlucoseReading();

// Most recent reading within the last 5 minutes
const latest = await dexcom.getLatestGlucoseReading();
```

Both return a single `GlucoseReading` or `null` if no reading is available in the time window.

### Request Behavior

Each HTTP request has a 30-second timeout, including reading the response body.
Set `requestTimeout` in milliseconds to change it:

```js
const dexcom = new Dexcom({
  username: "user",
  password: "pass",
  requestTimeout: 15000,
});
```

Timeouts throw `ServerError` with `ServerErrorEnum.TIMEOUT`. HTTP redirects are
never followed, to prevent forwarding credentials to another destination; they
throw `ServerError` with `ServerErrorEnum.REDIRECT`. Concurrent
calls on the same client share session creation; expired sessions are refreshed
with at most one retry per reading request.

### Get Multiple Readings

```js
// Last 24 hours of readings (defaults)
const readings = await dexcom.getGlucoseReadings();

// Last 60 minutes, up to 12 readings
const readings = await dexcom.getGlucoseReadings(60, 12);

// Last 24 hours of readings, convenience method
const readings = await dexcom.getLatestGlucoseReadings();

// Last 24 hours, up to 5 readings
const readings = await dexcom.getLatestGlucoseReadings(5);
```

The API returns the minimum of the two parameters (`minutes` and `maxCount`), so if readings occur every 5 minutes and you request 30 minutes with `maxCount: 3`, you'll get 3 readings.

### GlucoseReading Properties

```js
const reading = await dexcom.getCurrentGlucoseReading();

reading.value            // 120 (mg/dL)
reading.mgdL             // 120 (alias for value)
reading.mmolL            // 6.7 (converted)
reading.trend            // 4 (numeric code)
reading.trendDirection   // "Flat" (raw API string)
reading.trendDescription // "steady"
reading.trendArrow       // "→"
reading.time             // Date object
reading.json             // raw API response object
```

### Error Handling

```js
const { AccountError, SessionError, ArgumentError, ServerError, DexcomError } = require("cgm.js/errors");
const { AccountErrorEnum } = require("cgm.js/errors");

try {
  const dexcom = new Dexcom({ username: "user", password: "pass" });
  const reading = await dexcom.getCurrentGlucoseReading();
} catch (error) {
  if (error instanceof AccountError) {
    if (error.enum === AccountErrorEnum.MAX_ATTEMPTS) {
      console.log("Too many attempts, try again later");
    } else {
      console.log("Authentication failed:", error.message);
    }
  } else if (error instanceof ServerError) {
    console.log("Server error:", error.message);
  } else if (error instanceof DexcomError) {
    console.log("Dexcom error:", error.message);
  }
}
```

## API Documentation

See [API.md](API.md) for complete API reference including all classes, methods, enums, constants, and error types.

## Tests

```bash
npm test                # run tests
npm run test:coverage   # run tests with coverage report
```

## Troubleshooting

**Why is my password not working?**

1. Verify your credentials at your region's Dexcom Account Management site:
   - US: [uam1.dexcom.com](https://uam1.dexcom.com)
   - Outside US: [uam2.dexcom.com](https://uam2.dexcom.com)
   - Japan: [uam.dexcom.jp](https://uam.dexcom.jp)
2. Make sure you're using the correct `region` parameter.
3. Format phone numbers with country code: `"+11234567890"`.
4. Use *your* Dexcom Share credentials, not the follower's.
5. Ensure at least one follower is set up on Dexcom Share.
6. Try authenticating with your `accountId` instead of `username`.

## License

MIT
