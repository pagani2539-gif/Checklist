export const VEHICLE_API_PROFILES = Object.freeze({
  LEGACY_V1: "legacy-v1",
  IMPS_V2: "imps-v2",
});

export const VEHICLE_API_PROFILE_OPTIONS = Object.freeze([
  { value: VEHICLE_API_PROFILES.LEGACY_V1, label: "Legacy Vehicle API" },
  { value: VEHICLE_API_PROFILES.IMPS_V2, label: "IMPS API v2" },
]);

const VEHICLE_API_PROFILE_VALUES = new Set(Object.values(VEHICLE_API_PROFILES));
const VEHICLE_API_ADAPTERS = Object.freeze({
  [VEHICLE_API_PROFILES.LEGACY_V1]: Object.freeze({
    searchPath: "/api/vehicle/search",
    imagePath: "/api/vehicle/image",
    healthPath: null,
    configurationPath: null,
    hourlyCountPath: null,
    requestFields: Object.freeze({ dateFrom: "startDate", dateTo: "endDate" }),
  }),
  [VEHICLE_API_PROFILES.IMPS_V2]: Object.freeze({
    searchPath: "/api/v2/vehicles/search",
    imagePath: "/api/v2/vehicles/image",
    healthPath: "/api/v2/health",
    configurationPath: "/api/v2/configurations",
    hourlyCountPath: "/api/v2/vehicles/count/hourly",
    requestFields: Object.freeze({ dateFrom: "startDateTime", dateTo: "endDateTime" }),
  }),
});

export function isVehicleApiProfile(value) {
  return VEHICLE_API_PROFILE_VALUES.has(value);
}

export function getVehicleApiAdapter(apiProfile = VEHICLE_API_PROFILES.LEGACY_V1) {
  return VEHICLE_API_ADAPTERS[isVehicleApiProfile(apiProfile) ? apiProfile : VEHICLE_API_PROFILES.LEGACY_V1];
}

export function getVehicleApiProfileByImagePath(pathname) {
  return Object.entries(VEHICLE_API_ADAPTERS).find(([, adapter]) => adapter.imagePath === pathname)?.[0] || null;
}
