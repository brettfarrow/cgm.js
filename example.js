const Dexcom = require("./cgm");

async function main() {
  const dexcom = new Dexcom("user", "pass");
  const latestGlucoseReading = await dexcom.getLatestGlucoseReading();
  console.log(
    `Latest glucose reading: ${latestGlucoseReading.value} mg/dL at ${latestGlucoseReading.time}`,
  );
  const getCurrentGlucoseReading = await dexcom.getCurrentGlucoseReading();
  console.log("Current glucose reading: ", getCurrentGlucoseReading);
  const glucoseReadings = await dexcom.getGlucoseReadings(15, 3);
  console.log("Glucose readings: ", glucoseReadings);
}

main();
