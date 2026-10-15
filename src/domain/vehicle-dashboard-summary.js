import { createVehicleReviewState, getDaytimeVehicleClassificationDataset, getVehicleReviewDimensions, getVehicleReviewScopeEntries, getVehicleReviewState, isVehicleReviewScopeState } from "./vehicle-search.js";
import { getVehicleSystemLabel } from "./vehicle-review-systems.js";

// Presentation only: keep systems, review tasks and dayparts separate.
export function getVehicleDashboardSummary(round) {
  if (!round?.vehicleSearch) return [];
  const result = [];
  const reviewVersion = round.snapshot?.vehicleReviewVersion;
  function append(value, context, systemKey = "") {
    if (!value) return;
    const dataset = context === "classification" && !value.independentContext && isVehicleReviewScopeState(value)
      ? getDaytimeVehicleClassificationDataset(value) : value;
    for (const scope of getVehicleReviewScopeEntries(dataset)) {
      const state = getVehicleReviewState(scope.state, { reviewVersion, context });
      const summary = state.summary;
      const dimensions = Object.values(summary.dimensions);
      result.push({
        key: `${systemKey || "legacy"}:${context}:${scope.key}`,
        label: [getVehicleSystemLabel(systemKey), context === "plate" ? "ตรวจป้ายทะเบียน" : "ตรวจประเภทรถ", scope.key !== "all" ? scope.label : ""].filter(Boolean).join(" · "),
        total: summary.totalChecks,
        recorded: dimensions.reduce((count, dimension) => count + dimension.decided, 0),
        pending: summary.pendingChecks,
        unableToVerify: summary.unableToVerifyChecks,
        state: state.key,
      });
    }
  }
  const search = round.vehicleSearch;
  if (search.systems) {
    const systems = round.snapshot?.vehicleReviewSystems || Object.keys(search.systems).map(key => ({ key }));
    for (const system of systems) {
      for (const context of ["plate", "classification"]) {
        const value = search.systems[system.key]?.[context];
        append({ ...(value || createVehicleReviewState()), independentContext: context }, context, system.key);
      }
    }
  } else {
    for (const { key } of getVehicleReviewDimensions(reviewVersion)) {
      const dataset = key === "classification" && search.classification ? search.classification : search;
      append(dataset, key);
    }
  }
  return result;
}
