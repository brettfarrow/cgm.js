# cgm.js

A TypeScript library for the Dexcom Share API. Port of [pydexcom](https://github.com/gagebenne/pydexcom).

Published as an ES module with bundled type definitions.

## Requirements

Node.js 22 or later.

## Installation

```bash
npm install cgm.js
```

## Upgrading from v3 to v4

Version 4.0.0 rewrites the library in TypeScript and publishes it as an ES
module only. Runtime behavior is unchanged, but packaging changed:

- **Node.js 22 or later is required**, up from Node.js 18.
- **The package is ESM-only.** Use `import { Dexcom } from "cgm.js"`. CommonJS
  code on Node.js 22.12 or later can still `require("cgm.js")`, because Node.js
  can load ES modules synchronously. On older 22.x releases, use dynamic
  `import()`.
- **Imports go through the package `exports` map.** `cgm.js`, `cgm.js/errors`
  and `cgm.js/constants` are the supported entry points. Deep imports such as
  `cgm.js/cgm.js` or `cgm.js/errors.js` now fail with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **Everything is exported from the package root.** Error classes, error enums,
  and constants can now be imported from `cgm.js` directly, alongside `Dexcom`,
  `GlucoseReading` and `Region`.
- **Type definitions are included.** Remove any hand-written `declare module
  "cgm.js"` shims. See [TypeScript](#typescript).

## Upgrading from v2 to v3

Version 3.0.0 hardens HTTP requests and response parsing. Calls that succeeded
in v2 can now throw:

- **Glucose readings are validated strictly.** `Value` must be a nonnegative
  integer or a string of decimal digits (`"120.5"` and `"120mg"` are rejected),
  and `DT` must be a valid date. Malformed readings throw `ArgumentError` with
  `ArgumentErrorEnum.GLUCOSE_READING_INVALID`.
- **Unknown trends are rejected**, matching pydexcom. Trends must be one of the
  known direction strings or integer codes 0-9. In v2, unknown strings mapped to
  trend 0 and unknown integers kept their code with direction `"None"`.
- **Requests time out after 30 seconds** by default, including reading the
  response body, and throw `ServerError` with `ServerErrorEnum.TIMEOUT`. Pass
  `requestTimeout` (milliseconds) to the constructor to change it.
- **Redirects are not followed.** A redirect response throws `ServerError` with
  `ServerErrorEnum.REDIRECT`, so credentials are never sent to another URL.
- **Non-array reading responses throw** `ServerError` with
  `ServerErrorEnum.UNEXPECTED` instead of failing with a `TypeError`.
- **The exported `HEADERS` constant changed.** It now sends
  `Accept: application/json` instead of the incorrect
  `Accept-Encoding: application/json`.
- **Tests that assert exact `fetch` options may need updating.** Each request now
  also passes `redirect: "manual"` and an `AbortSignal` as `signal`.

Constructor options, exports, reading methods, and error classes are otherwise
unchanged. Concurrent calls on one client now share a single login instead of
each authenticating separately.

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
import { Dexcom } from "cgm.js";

const dexcom = new Dexcom({ username: "username", password: "password" });
const reading = await dexcom.getCurrentGlucoseReading();

if (reading) {
  console.log(reading.value);            // 120
  console.log(reading.mmolL);            // 6.7
  console.log(reading.trendDirection);   // "Flat"
  console.log(reading.trendDescription); // "steady"
  console.log(reading.trendArrow);       // "→"
  console.log(reading.time);             // 2025-08-07T20:40:58.000Z
} else {
  console.log("No recent glucose reading available");
}
```

## Usage

### Importing

```js
import { Dexcom, Region } from "cgm.js";
```

### TypeScript

Type definitions ship with the package, so no `@types` package is needed.
Besides the classes, the package exports these types:

```ts
import {
  Dexcom,
  type DexcomOptions,      // constructor options
  type GlucoseReading,     // reading class (also usable as a value)
  type GlucoseReadingJson, // raw reading shape from the Share API
  type Region,             // "us" | "ous" | "jp"
  type Trend,              // numeric trend code, 0-9
  type TrendDirection,     // "Flat" | "SingleUp" | ...
} from "cgm.js";

const options: DexcomOptions = { username: "user", password: "pass" };
const dexcom = new Dexcom(options);
const readings: GlucoseReading[] = await dexcom.getGlucoseReadings(60, 12);
```

Each error class narrows `error.enum` to its own enum. For example,
`AccountError["enum"]` is `AccountErrorEnum | null`. Use `moduleResolution`
`"nodenext"` or `"bundler"` so TypeScript reads the package `exports` map.

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
import {
  AccountError,
  AccountErrorEnum,
  DexcomError,
  ServerError,
} from "cgm.js"; // also available from "cgm.js/errors"

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
npm test                # run unit and type tests (Vitest)
npm run test:coverage   # run tests with coverage; fails below 100%
npm run typecheck       # type-check sources, tests and examples
npm run build           # compile to dist/
```

See [examples/example.ts](examples/example.ts) for a runnable example. After
`npm run build`, run it with `node examples/example.ts`.

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
