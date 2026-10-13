import { Button } from "../controls/ActionControls.jsx";
import CustomSelect from "../CustomSelect.jsx";
import { EmptyState } from "../PagePrimitives.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { getActivePhysicalEquipment } from "../../domain/master-checklist.js";
import { getStationFormatDefinition } from "../../domain/master-checklist.js";
import { getStationReadiness } from "../../domain/master-checklist.js";
import { useMemo } from "react";
import { useState } from "react";
import { StatusBadge, formatDateTime } from "../page-runtime-components.jsx";

export function createRuntime() {
  const base = { Button, CustomSelect, EmptyState, Icon, PageHeader, StatusBadge, formatDateTime, getActivePhysicalEquipment, getStationFormatDefinition, getStationReadiness, useMemo, useState };
  return base;
}
