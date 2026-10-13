import { Button } from "../controls/ActionControls.jsx";
import { EmptyState } from "../PagePrimitives.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { ProgressBar } from "../PagePrimitives.jsx";
import { getItemsForSnapshot } from "../../domain/master-checklist.js";
import { getRoundSummary } from "../../domain/master-checklist.js";
import { getStationReadiness } from "../../domain/master-checklist.js";
import { getVehicleReviewScopeEntries } from "../../domain/vehicle-search.js";
import { getVehicleReviewState } from "../../domain/vehicle-search.js";
import { getVehicleSearchReviewSummary } from "../../domain/vehicle-search.js";
import { isVehicleReviewScopeState } from "../../domain/vehicle-search.js";
import { RoundCard, StationSelect, StationSummary, StatusBadge, formatDate, formatDateTime, profileFor, shortId } from "../page-runtime-components.jsx";

export function createRuntime() {
  const base = { Button, EmptyState, Icon, PageHeader, ProgressBar, RoundCard, StationSelect, StationSummary, StatusBadge, formatDate, formatDateTime, getItemsForSnapshot, getRoundSummary, getStationReadiness, getVehicleReviewScopeEntries, getVehicleReviewState, getVehicleSearchReviewSummary, isVehicleReviewScopeState, profileFor, shortId };
  return base;
}
