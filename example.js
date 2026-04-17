const { Dexcom, Region } = require("./cgm");

async function main() {
  // US account (default)
  const dexcom = new Dexcom({ username: "user", password: "pass" });

  // Outside US: new Dexcom({ username: "user", password: "pass", region: Region.OUS })
  // Japan: new Dexcom({ username: "user", password: "pass", region: Region.JP })
  // By account ID: new Dexcom({ accountId: "12345678-90ab-cdef-1234-567890abcdef", password: "pass" })

  const latestGlucoseReading = await dexcom.getLatestGlucoseReading();
  console.log(
    `Latest glucose reading: ${latestGlucoseReading.value} mg/dL at ${latestGlucoseReading.time}`,
  );

  const currentGlucoseReading = await dexcom.getCurrentGlucoseReading();
  console.log("Current glucose reading:", currentGlucoseReading);

  const glucoseReadings = await dexcom.getGlucoseReadings(15, 3);
  console.log("Glucose readings:", glucoseReadings);
}

main();
