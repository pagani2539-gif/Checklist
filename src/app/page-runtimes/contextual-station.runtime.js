import { Breadcrumb } from "../PagePrimitives.jsx";
import { Button } from "../controls/ActionControls.jsx";
import CustomSelect from "../CustomSelect.jsx";
import { DEFAULT_STATION_FORMAT } from "../../domain/master-checklist.js";
import { AppIcon as Icon } from "../icon-system.jsx";
import { ITEM_LIBRARY_CATEGORIES } from "../../domain/master-checklist.js";
import { MasterSelect } from "../MasterSelect.jsx";
import { STATION_ASSET_CATEGORIES } from "../../domain/master-checklist.js";
import { STATION_FORMATS } from "../../domain/master-checklist.js";
import { createId } from "../../domain/master-checklist.js";
import { createStationDraft } from "../../domain/master-checklist.js";
import { createStationProfileFromDraft } from "../../domain/master-checklist.js";
import { getCanonicalItemsForFormat } from "../../domain/canonical-station-catalog.js";
import { getCentralChecklistSectionName } from "../../domain/equipment-names.js";
import { getCentralEquipmentName } from "../../domain/equipment-names.js";
import { getCentralSystemCategoryName } from "../../domain/equipment-names.js";
import { getCentralSystemNameForRecord } from "../../domain/equipment-names.js";
import { getNextEquipmentIndex } from "../../domain/master-checklist.js";
import { synchronizeGeneratedAssetNos } from "../../domain/master-checklist.js";
import { getStationChecklistItems } from "../../domain/master-checklist.js";
import { getStationReadiness } from "../../domain/master-checklist.js";
import { makeEquipmentFromCatalogItem } from "../../domain/master-checklist.js";
import { makeLane } from "../../domain/master-checklist.js";
import { navigate } from "../navigation.js";
import { normalizeItemCatalog } from "../../domain/master-checklist.js";
import { setStationChecklistItemEnabled } from "../../domain/master-checklist.js";
import { formatCentralNameEnglishFirst } from "../../domain/equipment-names.js";
import { useEffect } from "react";
import { useMemo } from "react";
import { useState } from "react";
import { validateStationDraft } from "../../domain/master-checklist.js";
import { StatusBadge } from "../page-runtime-components.jsx";
import { VehicleSearchConfigPanel } from "../page-runtime-vehicleConfig.jsx";

export function createRuntime() {
  const base = { Breadcrumb, Button, CustomSelect, DEFAULT_STATION_FORMAT, Icon, ITEM_LIBRARY_CATEGORIES, MasterSelect, STATION_ASSET_CATEGORIES, STATION_FORMATS, StatusBadge, VehicleSearchConfigPanel, createId, createStationDraft, createStationProfileFromDraft, getCanonicalItemsForFormat, getCentralChecklistSectionName, getCentralEquipmentName, getCentralSystemCategoryName, getCentralSystemNameForRecord, getNextEquipmentIndex, synchronizeGeneratedAssetNos, getStationChecklistItems, getStationReadiness, makeEquipmentFromCatalogItem, makeLane, navigate, normalizeItemCatalog, setStationChecklistItemEnabled, formatCentralNameEnglishFirst, useEffect, useMemo, useState, validateStationDraft };
  return base;
}
