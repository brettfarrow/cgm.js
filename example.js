const { Dexcom, Region } = require("./cgm");

async function main() {
  // US account (default)
  const dexcom = new Dexcom({
    username: process.env.DEXCOM_USERNAME,
    password: process.env.DEXCOM_PASSWORD,
  });

  // Outside US: new Dexcom({ username: "user", password: "pass", region: Region.OUS })
  // Japan: new Dexcom({ username: "user", password: "pass", region: Region.JP })
  // By account ID: new Dexcom({ accountId: "12345678-90ab-cdef-1234-567890abcdef", password: "pass" })

  const latestGlucoseReading = await dexcom.getLatestGlucoseReading();
  if (latestGlucoseReading) {
    console.log(
      `Latest glucose reading: ${latestGlucoseReading.value} mg/dL at ${latestGlucoseReading.time}`,
    );
  } else {
    console.log("No glucose reading available in the last 5 minutes");
  }

  const currentGlucoseReading = await dexcom.getCurrentGlucoseReading();
  console.log("Current glucose reading:", currentGlucoseReading);

  const glucoseReadings = await dexcom.getGlucoseReadings(15, 3);
  console.log("Glucose readings:", glucoseReadings);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
