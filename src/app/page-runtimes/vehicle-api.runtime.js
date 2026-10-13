import { Button } from "../controls/ActionControls.jsx";
import { EmptyState } from "../PagePrimitives.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { UI_VEHICLE_DEMO_ROUND_ID } from "../../domain/demo-fixture.js";
import { VEHICLE_API_REVIEW_VERSION } from "../../domain/vehicle-search.js";
import { VEHICLE_REVIEW_CONTEXT_OPTIONS } from "../../domain/vehicle-search.js";
import { VEHICLE_REVIEW_SCOPE_VERSION } from "../../domain/vehicle-search.js";
import { buildInspectionSections } from "../../domain/master-checklist.js";
import { createId } from "../../domain/master-checklist.js";
import { createUiVehicleDemoRound } from "../../domain/demo-fixture.js";
import { deleteStoredAttachment } from "../../domain/attachments.js";
import { getStoredAttachment } from "../../domain/attachments.js";
import { getVehicleReviewContext } from "../../domain/vehicle-search.js";
import { getVehicleReviewContextByKey } from "../../domain/vehicle-search.js";
import { getVehicleReviewScopeState } from "../../domain/vehicle-search.js";
import { isVehicleReviewScopeState } from "../../domain/vehicle-search.js";
import { normalizeVehicleReviewState } from "../../domain/vehicle-search.js";
import { normalizeVehicleSearchState } from "../../domain/vehicle-search.js";
import { saveStoredAttachment } from "../../domain/attachments.js";
import { updateVehicleSearchScope } from "../../domain/vehicle-search.js";
import { useCallback } from "react";
import { useEffect } from "react";
import { useMemo } from "react";
import { useRef } from "react";
import { useState } from "react";
import { MAX_ATTACHMENT_BYTES, StatusBadge, roundFor, vehicleApiHref } from "../page-runtime-components.jsx";
import { createVehicleApiRuntime } from "./vehicle-api.js";
import { ThaiDateTimePicker } from "../date-picker.jsx";

export function createRuntime() {
  const base = { Button, EmptyState, Icon, MAX_ATTACHMENT_BYTES, PageHeader, StatusBadge, UI_VEHICLE_DEMO_ROUND_ID, VEHICLE_API_REVIEW_VERSION, VEHICLE_REVIEW_CONTEXT_OPTIONS, VEHICLE_REVIEW_SCOPE_VERSION, buildInspectionSections, createId, createUiVehicleDemoRound, deleteStoredAttachment, getStoredAttachment, getVehicleReviewContext, getVehicleReviewContextByKey, getVehicleReviewScopeState, isVehicleReviewScopeState, normalizeVehicleReviewState, normalizeVehicleSearchState, roundFor, saveStoredAttachment, updateVehicleSearchScope, useCallback, useEffect, useMemo, useRef, useState, vehicleApiHref };
  return { ...base, ...createVehicleApiRuntime(base, { ThaiDateTimePicker }) };
}
