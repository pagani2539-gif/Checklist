import { Breadcrumb } from "../PagePrimitives.jsx";
import { Button } from "../controls/ActionControls.jsx";
import { CHECKLIST_POLICY_VERSION } from "../../domain/master-checklist.js";
import { CLEANING_POLICY_VERSION } from "../../domain/master-checklist.js";
import CustomSelect from "../CustomSelect.jsx";
import { EQUIPMENT_ORDER_VERSION } from "../../domain/ordering.js";
import { EVIDENCE_CHECKLIST_SECTIONS } from "../../domain/master-checklist.js";
import { EmptyState } from "../PagePrimitives.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { STATION_DRAFT_TEMPLATE_VERSION } from "../../domain/master-checklist.js";
import { ThaiDatePicker } from "../date-picker.jsx";
import { createInspectionRound } from "../../domain/master-checklist.js";
import { getActivePhysicalEquipment } from "../../domain/master-checklist.js";
import { getChecklistCoverageSummary } from "../../domain/master-checklist.js";
import { getEquipmentDisplayLabel } from "../../domain/master-checklist.js";
import { getNewRoundChecklistItems } from "../../domain/master-checklist.js";
import { getStationChecklistItems } from "../../domain/master-checklist.js";
import { getStationChecklistSections } from "../../domain/master-checklist.js";
import { getStationReadiness } from "../../domain/master-checklist.js";
import { navigate } from "../navigation.js";
import { sortEquipmentForDisplay } from "../../domain/ordering.js";
import { useEffect } from "react";
import { useState } from "react";
import { ChecklistCoverageSummary, Stepper } from "../page-runtime-checklist.jsx";
import { StatusBadge, getChecklistScopeMeta, formatDate } from "../page-runtime-components.jsx";

export function createRuntime() {
  const base = { Breadcrumb, Button, CHECKLIST_POLICY_VERSION, CLEANING_POLICY_VERSION, ChecklistCoverageSummary, CustomSelect, EQUIPMENT_ORDER_VERSION, EVIDENCE_CHECKLIST_SECTIONS, EmptyState, Icon, PageHeader, STATION_DRAFT_TEMPLATE_VERSION, StatusBadge, Stepper, ThaiDatePicker, createInspectionRound, getActivePhysicalEquipment, getChecklistCoverageSummary, getChecklistScopeMeta, getEquipmentDisplayLabel, getNewRoundChecklistItems, getStationChecklistItems, getStationChecklistSections, getStationReadiness, formatDate, navigate, sortEquipmentForDisplay, useEffect, useState };
  return base;
}
