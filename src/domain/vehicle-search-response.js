export const DEFAULT_PLATE_KEYS = Object.freeze([
  "plateNumber",
  "licensePlate",
  "plateNo",
  "plate",
  "license_plate",
  "license_plate_number",
  "ทะเบียนรถ",
  "ป้ายทะเบียน",
]);

const DEFAULT_RESULT_KEYS = Object.freeze(["data", "results", "items", "vehicles", "records"]);

function arrayAtPath(value, path) {
  return path.reduce((current, key) => current && typeof current === "object" ? current[key] : undefined, value);
}

export function vehicleRecordsFromPayload(payload, resultPath) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && DEFAULT_PLATE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(payload, key))) {
    return [payload];
  }
  if (Array.isArray(resultPath)) {
    const explicit = arrayAtPath(payload, resultPath);
    if (Array.isArray(explicit)) return explicit;
  }
  for (const key of DEFAULT_RESULT_KEYS) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  for (const key of DEFAULT_RESULT_KEYS) {
    for (const nestedKey of DEFAULT_RESULT_KEYS) {
      if (Array.isArray(payload?.[key]?.[nestedKey])) return payload[key][nestedKey];
    }
  }
  return [];
}
