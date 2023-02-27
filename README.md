# cgm.js

A JavaScript port of [pydexcom](https://github.com/gagebenne/pydexcom)

## Requirements

This has been tested from Node 14 to Node 18, but may work in earlier versions as well.

## Usage (Single Reading)

Most recent reading:

```js
const dexcom = new Dexcom("user", "pass");
const latestGlucoseReading = await dexcom.getLatestGlucoseReading();
```

`getCurrentGlucoseReading()` should return the same result but is maintained for parity with the original package.

### Example Output

```js
GlucoseReading {
    value: 143,
    mgdL: 143,
    mmolL: 7.9,
    trend: 4,
    trendDescription: 'steady',
    trendArrow: '→',
    time: 2023-02-26T00:48:54.000Z,
    json: { WT: 'Date(1677372534000)', Value: 143, Trend: 'Flat' }
}
```

## Usage (Multiple Readings)

```js
const dexcom = new Dexcom("user", "pass");
const glucoseReadings = await dexcom.getGlucoseReadings(15, 3); // minutes and number of readings readings
```

The service will return the minimum of the two parameters (`minutes` and `maxCount` of readings), so if your readings take place every five minutes and you request `30` minutes and `3` readings, you will only see three readings returned.

### Example Output

```js
[
  GlucoseReading {
    value: 112,
    mgdL: 112,
    mmolL: 6.2,
    trend: 3,
    trendDescription: 'rising slightly',
    trendArrow: '↗',
    time: 2023-02-27T03:23:59.000Z,
    json: { WT: 'Date(1677468239000)', Value: 112, Trend: 'FortyFiveUp' }
  },
  GlucoseReading {
    value: 105,
    mgdL: 105,
    mmolL: 5.8,
    trend: 3,
    trendDescription: 'rising slightly',
    trendArrow: '↗',
    time: 2023-02-27T03:18:59.000Z,
    json: { WT: 'Date(1677467939000)', Value: 105, Trend: 'FortyFiveUp' }
  },
  GlucoseReading {
    value: 93,
    mgdL: 93,
    mmolL: 5.2,
    trend: 4,
    trendDescription: 'steady',
    trendArrow: '→',
    time: 2023-02-27T03:14:00.000Z,
    json: { WT: 'Date(1677467640000)', Value: 93, Trend: 'Flat' }
  },
]
```
