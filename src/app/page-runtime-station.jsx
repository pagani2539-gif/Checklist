import { AppIcon as Icon, getEquipmentIconName, getScIconName } from "./icon-system.jsx";
import { Button } from "./controls/ActionControls.jsx";
import { Breadcrumb, EmptyState } from "./PagePrimitives.jsx";
import StationRelationshipRegister from "./StationRelationshipRegister.jsx";
import StationRelationshipInlineEditor from "./StationRelationshipInlineEditor.jsx";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import CustomSelect from "./CustomSelect.jsx";
import { MasterSelect } from "./MasterSelect.jsx";
import { getEquipmentType, getEquipmentEnglishLabel, getEquipmentDisplayLabel, getEquipmentCategoryCode, getStationSystemLabel, getStationSystemEnglishLabel, getStationSystemDisplayLabel, buildStationSystemSummaryModel, WIM_SORTING_SYSTEM_CANONICAL_ID, isWimSortingSystemRecord, getWimSortingSystemInstances, getWimSortingInstalledQuantity, getWimSortingSystemById, ITEM_LIBRARY_CATEGORIES, getDefaultStationEquipmentCounts, getStationFormatDefinition, validateEquipmentDraft, getChecklistCoverageSummary, getStationReadiness } from "../domain/master-checklist.js";
import { buildStationRelationshipTree, getRelationshipCategoryForAsset, getRelationshipCategoryForSystem, getRelationshipPath, getStationRelationshipSystemCount } from "../domain/station-relationship-tree.js";
import { findStationWorkpoint } from "../domain/station-workpoint-layout.js";
import { sortEquipmentForDisplay, sortWimEquipment } from "../domain/ordering.js";
import { getStationTorPresentationItems, summarizeStationTorItems } from "../domain/station-tor-catalog.js";
import { BOQ_CHECKLIST_GROUPS, filterCatalogItemsByBoqGroup, getBoqAddCategory, getBoqScopeForGroup } from "../domain/boq-checklist-groups.js";
import { getCanonicalItemsForFormat } from "../domain/canonical-station-catalog.js";
import { isWimElectronicsSubEquipmentType, getWimElectronicsHierarchyIssue } from "../domain/wim-electronics.js";
import { getLaneScope } from "../domain/station-lane-scope.js";
import { CENTRAL_EQUIPMENT_MAIN_CATEGORIES, getCentralChecklistSectionName, formatCentralNameEnglishFirst } from "../domain/equipment-names.js";
import { formatDateTime, statusClass, StatusBadge, StationSelect, getChecklistScopeMeta } from "./page-runtime-components.jsx";
import { VehicleSearchConfigPanel } from "./page-runtime-vehicleConfig.jsx";
import { ChecklistCoverageSummary } from "./page-runtime-checklist.jsx";



export const StationProfileEquipmentContext = createContext({ canonicalItems: [], stationEquipment: [], stationSystems: [] });

export function getEquipmentTypeDisplayLabel(type) {
  return type?.nameEn || type?.label || type?.value || "อุปกรณ์";
}

export function getCatalogItemDisplayLabel(item) {
  return item?.nameEn || item?.label || item?.id || "รายการอุปกรณ์";
}

export function StationSystemsSummary({ systems = [], equipment = [], compact = false, collapsible = false }) {
  const summary = buildStationSystemSummaryModel(systems, equipment);
  const torReferenceSummary = summary.referenceTotals.map((entry) => `${entry.quantity} ${entry.unit}`).join(" · ");
  const statusLabels = { mapped: "ผูกตรง", additional: "อุปกรณ์เพิ่มเติม", unmapped: "ไม่มี mapping", "system-only": "ระบบแยก", "installed-system": "ติดตั้งจริง" };
  const statusClass = { mapped: "is-mapped", additional: "is-additional", unmapped: "is-unmapped", "system-only": "is-system-only" };
  const renderMetric = (record, className = "") => <output className={`ops-system-summary-count ${className}`} aria-label={`ยอดจริง ${record.label}`}><strong>{record.actualCount === null ? "—" : `${record.actualCount} ${record.kind === "system" ? "ระบบ" : "อุปกรณ์"}`}</strong><span>{record.referenceLabel}</span></output>;
  const renderAssetRow = (record) => <article className={`ops-system-summary-child ${statusClass[record.status] || ""}`} key={record.id}>
    <div className="ops-system-summary-child-main"><span className="ops-system-summary-child-mark"><Icon name={getEquipmentIconName(record.assetType)} size="small" /></span><div><strong>{[record.nameEn, record.label].filter(Boolean).join(" · ")}</strong><span>อ้างอิง {record.sourceRefs?.join(", ") || "-"}</span></div></div>
    <div className="ops-system-summary-child-meta"><span className={`ops-system-summary-status ${statusClass[record.status] || ""}`}>{statusLabels[record.status] || "ตรวจสอบ"}</span>{renderMetric(record)}</div>
  </article>;
  const renderGroup = (group) => <details className="ops-system-summary-group" key={group.id} open={group.defaultOpen}>
    <summary className="ops-system-summary-group-toggle"><span className="ops-system-summary-group-icon"><Icon name={group.icon} /></span><div className="ops-system-summary-group-title"><strong>{[group.nameEn, group.label].filter(Boolean).join(" · ")}</strong><span>{group.sourceLabel} · อ้างอิง {group.sourceRefs.join(", ")}</span></div><div className="ops-system-summary-group-metric"><strong>{group.actualCount} อุปกรณ์</strong><span>{group.referenceLabel}</span></div><span className="ops-system-summary-status is-mapped">ผูกตรง</span></summary>
    <div className="ops-system-summary-children">{group.children.map(renderAssetRow)}</div>
  </details>;
  const renderUnmapped = (record) => <article className="ops-system-summary-child is-unmapped" key={record.id}>
    <div className="ops-system-summary-child-main"><span className="ops-system-summary-child-mark"><Icon name="info" size="small" /></span><div><strong>{[record.nameEn, record.label].filter(Boolean).join(" · ")}</strong><span>อ้างอิง {record.sourceRefs?.join(", ") || "-"}</span></div></div>
    <div className="ops-system-summary-child-meta"><span className="ops-system-summary-status is-unmapped">ไม่มี mapping</span>{renderMetric(record)}</div>
  </article>;
  const renderSystemOnly = (record) => <article className={`ops-system-summary-child ${record.status === "installed-system" ? "is-installed-system" : "is-system-only"}`} key={record.id}>
    <div className="ops-system-summary-child-main"><span className="ops-system-summary-child-mark"><Icon name="archive" size="small" /></span><div><strong>{[record.nameEn, record.label].filter(Boolean).join(" · ")}</strong><span>อ้างอิง {record.sourceRefs?.join(", ") || "-"}</span></div></div>
    <div className="ops-system-summary-child-meta"><span className={`ops-system-summary-status ${record.status === "installed-system" ? "is-mapped" : "is-system-only"}`}>{record.status === "installed-system" ? "ติดตั้งจริง" : "ระบบแยก"}</span>{renderMetric(record)}</div>
  </article>;
  const content = summary.visibleSystemCount || summary.activeAssetCount ? <div className="ops-system-summary-content">
    <div className="ops-system-summary-heading"><div><strong>ความสัมพันธ์ระบบกับทะเบียนอุปกรณ์</strong><span>ยอดจริงนับเฉพาะอุปกรณ์ที่ใช้งานอยู่ · TOR แยกตามหน่วยเดิม</span></div><div className="ops-system-summary-totals"><strong>{summary.activeAssetCount} อุปกรณ์</strong><span>{torReferenceSummary ? `TOR ${torReferenceSummary}` : `${summary.groups.length} กลุ่มระบบ`}</span></div></div>
    <div className="ops-system-summary-legend" aria-label="คำอธิบายสถานะ mapping"><span><i className="ops-system-summary-legend-dot is-mapped" />ผูกตรง</span><span><i className="ops-system-summary-legend-dot is-additional" />อุปกรณ์เพิ่มเติม</span><span><i className="ops-system-summary-legend-dot is-unmapped" />ไม่มี mapping</span><span><i className="ops-system-summary-legend-dot is-system-only" />ระบบแยก</span></div>
    <div className="ops-system-summary-table-head" aria-hidden="true"><span>ระบบ / กลุ่มระบบ</span><span>จำนวนอุปกรณ์ (ที่ใช้งาน)</span><span>อ้างอิง TOR</span></div>
    <div className="ops-system-summary-list">{summary.groups.map(renderGroup)}{summary.systemOnly.length > 0 && <section className="ops-system-summary-system-only"><div className="ops-system-summary-unmapped-heading"><div><strong>ระบบจากเอกสาร / ระบบติดตั้งจริง</strong><span>แยกจำนวน WIM Sorting System ที่ติดตั้งจริงออกจากยอด TOR</span></div><span className="ops-system-summary-status is-system-only">{summary.systemOnly.length} รายการ</span></div>{summary.systemOnly.map(renderSystemOnly)}</section>}{summary.unmapped.length > 0 && <section className="ops-system-summary-unmapped"><div className="ops-system-summary-unmapped-heading"><div><strong>รายการจาก Present MA ที่ยังไม่ผูกกับอุปกรณ์</strong><span>แสดงไว้เพื่อให้ตรวจสอบ ไม่เดาจากอุปกรณ์ใกล้เคียง</span></div><span className="ops-system-summary-status is-unmapped">{summary.unmapped.length} รายการ</span></div>{summary.unmapped.map(renderUnmapped)}</section>}</div>
    <div className="ops-system-summary-note"><Icon name="info" size="small" /><span>อุปกรณ์ในหมวด 3.1 และ 5.2 นับรวมในทะเบียนอุปกรณ์จริงตามรายการที่ใช้งานอยู่</span></div>
  </div> : <p className="ops-empty-note">ยังไม่มีข้อมูลระบบหรืออุปกรณ์จากเอกสารต้นทาง</p>;
  if (collapsible) return <details className={`ops-system-summary ops-system-summary-collapsible ${compact ? "is-compact" : ""}`}>
    <summary className="ops-system-summary-toggle"><div><strong>ระบบและอุปกรณ์จริง</strong><span>สรุปความสัมพันธ์ของระบบกับทะเบียนหน้างาน</span></div><span className="ops-count-badge">{summary.groups.length}</span></summary>
    <div className="ops-system-summary-body">{content}</div>
  </details>;
  return <section className={`ops-system-summary ${compact ? "is-compact" : ""}`} aria-labelledby={compact ? undefined : "station-system-summary-title"}>
    {!compact && <div className="ops-subsection-heading"><strong id="station-system-summary-title">ระบบและอุปกรณ์จริง</strong><span>ยอดอุปกรณ์ที่ใช้งานอยู่เป็นตัวหลัก และ TOR เป็นยอดอ้างอิงตามหน่วยเดิม</span></div>}
    {content}
  </section>;
}

export function isEquipmentDetailComplete(equipment) {
  const serialNo = String(equipment?.serialNo || "").trim();
  const serialStatus = equipment?.serialStatus;
  return Boolean(
    (serialStatus === "present" && serialNo)
    || serialStatus === "not-available",
  );
}

export function countIncompleteEquipment(equipment = []) {
  return (Array.isArray(equipment) ? equipment : []).filter((item) => !isEquipmentDetailComplete(item)).length;
}

export function isWimEquipment(equipment) {
  return equipment?.type === "WIM_SENSOR" || equipment?.type === "WIM_LOOP";
}

export function LaneAssignmentStep({ stationFormat = "SC", lanes = [], equipment = [], stationSystems = [], laneErrors = {}, onChangeLanes, onAssignLane, onAssignParentSystem, onAddLane, onRemoveLane, disabled = false, headingEyebrow = "STEP 3 / 5", headingTitle = "กำหนดเลนและผูกอุปกรณ์", headingDescription = "LPR หนึ่งระบบต่อหนึ่ง Lane; WIM ใช้ Lane ผูก Sensor และ Loop", showHeading = true }) {
  const activeEquipment = (Array.isArray(equipment) ? equipment : []).filter((item) => item?.active !== false);
  const activeLanes = (Array.isArray(lanes) ? lanes : []).filter((lane) => lane?.active !== false);
  const wimEquipment = sortWimEquipment(activeEquipment.filter(isWimEquipment), activeLanes);
  const wimSystems = getWimSortingSystemInstances(stationSystems);
  const laneScopeOptions = String(stationFormat).toUpperCase() === "IMPS" ? ["ImPS", "3D"] : ["High Speed", "Low Speed", "3D"];
  const laneCounts = (laneId, type) => wimEquipment.filter((item) => item.laneId === laneId && item.type === type).length;
  const lprSystems = (Array.isArray(stationSystems) ? stationSystems : []).filter((system) => system?.active !== false && (system.canonicalItemId || system.systemId) === "lpr-control");
  return <div className="ops-lane-assignment-step">
    {showHeading && <div className="ops-equipment-step-heading"><div><p className="ops-eyebrow">{headingEyebrow === "STEP 3 / 5" ? "ส่วนทะเบียนอุปกรณ์ · ขั้นที่ 3 จาก 5" : headingEyebrow}</p><h4>{headingTitle}</h4><span>{headingDescription}</span></div><span className="ops-count-badge">{activeLanes.length} เลน</span></div>}
     <div className="ops-lane-toolbar"><div><strong>ช่องจราจรของสถานี</strong><small>เพิ่ม Lane ตาม Scope ที่ติดตั้งจริง · LPR ใช้ Lane ของระบบโดยตรง · WIM ใช้ผูก Sensor/Loop</small></div><div>{laneScopeOptions.map((scope) => <button type="button" key={scope} className="ops-button ops-button-secondary" onClick={() => onAddLane?.(scope)} disabled={disabled}><Icon name="plus" />เพิ่ม Lane {scope}</button>)}</div></div>
     {activeLanes.length ? <div className="ops-lane-list">{activeLanes.map((lane) => { const linkedLpr = lprSystems.filter((system) => system.laneId === lane.id); return <article className="ops-lane-card" key={lane.id}><div className="ops-lane-card-heading"><div><span className="ops-config-section-code">Lane {lane.laneNo} · {getLaneScope(lane, stationSystems) || "ไม่ระบุ Scope"}</span><strong>{lane.label}</strong><small>{lane.direction || "ยังไม่ระบุทิศทาง"}</small></div><button type="button" className="ops-button ops-button-danger-ghost" onClick={() => onRemoveLane?.(lane)} disabled={disabled}><Icon name="delete" />ลบเลน</button></div><div className="ops-lane-card-counts"><span><strong>{linkedLpr.length}</strong> LPR System</span><span><strong>{laneCounts(lane.id, "WIM_SENSOR")}</strong> Sensor</span><span><strong>{laneCounts(lane.id, "WIM_LOOP")}</strong> Loop</span></div><div className="ops-lane-card-fields"><label className="ops-field"><span>ชื่อเลน</span><input value={lane.label || ""} disabled={disabled} onChange={(event) => onChangeLanes?.(activeLanes.map((entry) => entry.id === lane.id ? { ...entry, label: event.target.value } : entry))} placeholder={`ช่องจราจร ${lane.laneNo}`} /></label><label className="ops-field"><span>ทิศทาง</span><CustomSelect label="ทิศทางของ Lane" value={lane.direction || "unspecified"} disabled={disabled} onChange={(event) => onChangeLanes?.(activeLanes.map((entry) => entry.id === lane.id ? { ...entry, direction: event.target.value } : entry))}><option value="unspecified">ไม่ระบุ</option><option value="inbound">ขาเข้า</option><option value="outbound">ขาออก</option><option value="both">สองทิศทาง</option></CustomSelect></label></div></article>; })}</div> : <EmptyState icon="list" title="ยังไม่มีเลน" action={<div>{laneScopeOptions.map((scope) => <button type="button" key={scope} className="ops-button ops-button-primary" onClick={() => onAddLane?.(scope)} disabled={disabled}><Icon name="plus" />เพิ่ม Lane {scope}</button>)}</div>}>ต้องมี Lane ก่อนผูก LPR System หรือ Sensor/Loop กับหน้างาน</EmptyState>}
     <div className="ops-lane-asset-assignment"><div className="ops-subsection-heading"><strong>ผูก Sensor และ Loop กับ WIM Sorting System</strong><span>{wimEquipment.length} อุปกรณ์ WIM ในร่าง · {wimSystems.length} ระบบแม่</span></div>{wimEquipment.length ? <div className="ops-lane-asset-list">{wimEquipment.map((item) => { const parent = getWimSortingSystemById(stationSystems, item.parentSystemId); const lane = activeLanes.find((entry) => entry.id === parent?.laneId); return <label className="ops-lane-asset-row" key={item.id}><span className="ops-equipment-icon"><Icon name={getEquipmentIconName(item.type)} /></span><span><strong>{getEquipmentDisplayLabel(item)}</strong><small>{item.assetNo} · {lane ? `Lane ${lane.laneNo}` : "ยังไม่ทราบ Lane"}</small></span><CustomSelect label={`เลือก WIM Sorting System สำหรับ ${item.assetNo}`} value={item.parentSystemId || ""} disabled={disabled} onChange={(event) => (onAssignParentSystem || onAssignLane)?.(item.id, event.target.value)} aria-invalid={Boolean(laneErrors[item.id])}><option value="">ยังไม่ผูกระบบแม่</option>{wimSystems.map((system) => { const systemLane = activeLanes.find((entry) => entry.id === system.laneId); return <option key={system.id} value={system.id}>WIM Sorting System #{system.instanceNo || "?"} · Lane {systemLane?.laneNo || "?"} · {getLaneScope(systemLane, stationSystems) || "ไม่ระบุ Scope"}</option>; })}</CustomSelect>{laneErrors[item.id] && <small className="ops-field-error">{laneErrors[item.id]}</small>}</label>; })}</div> : <p className="ops-empty-note">ยังไม่มี Sensor หรือ Loop ให้ผูกระบบแม่ เพิ่ม WIM Sorting System ก่อนเพิ่มอุปกรณ์</p>}</div>
    <div className="ops-equipment-step-note"><Icon name="info" /><span>จำนวน Sensor และ Loop เป็นข้อมูลจริงของแต่ละ WIM Sorting System ไม่บังคับให้เท่ากัน และ Lane ของลูกจะตามระบบแม่อัตโนมัติ</span></div>
  </div>;
}

export function StationTorSummary({ items = [], equipment = [], compact = false }) {
  const summary = summarizeStationTorItems(items);
  const presentationItems = getStationTorPresentationItems(items);
  const scopeLabels = { "high-speed": "High Speed", "low-speed": "Low Speed", station: "Station-wide", central: "Central", imps: "ImPS", image: "Image Processing", "3d": "3D" };
  const unitSummary = Object.entries(summary.quantityByUnit).map(([unit, quantity]) => `${quantity} ${unit}`).join(" · ");
  const kindLabels = { asset: "อุปกรณ์", system: "ระบบ", service: "งานบริการ" };
  const activeCounts = (Array.isArray(equipment) ? equipment : []).filter((entry) => entry?.active !== false).reduce((totals, entry) => ({ ...totals, [entry.type]: (totals[entry.type] || 0) + 1 }), {});
  const normalizedScope = (scope) => String(scope || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const activeCountsByScope = (Array.isArray(equipment) ? equipment : []).filter((entry) => entry?.active !== false).reduce((totals, entry) => {
    const key = normalizedScope(entry.scope);
    if (!key) return totals;
    const typeTotals = totals[entry.type] || {};
    return { ...totals, [entry.type]: { ...typeTotals, [key]: (typeTotals[key] || 0) + 1 } };
  }, {});
  const scopeAwareCounts = new Set(["highspeed", "lowspeed", "3d", "imps", "image", "imageprocessing", "central", "stationwide"]);
  const installedCountFor = (entry) => {
    if (!entry.assetType) return null;
    const scopeKey = normalizedScope(entry.scope);
    return scopeAwareCounts.has(scopeKey)
      ? (activeCountsByScope[entry.assetType]?.[scopeKey] || 0)
      : (activeCounts[entry.assetType] || 0);
  };
  const groups = Object.entries(presentationItems.reduce((result, entry) => {
    const category = entry.category || "อื่น ๆ";
    return { ...result, [category]: [...(result[category] || []), entry] };
  }, {}));
  return <details className={`ops-system-summary ops-system-summary-collapsible ${compact ? "is-compact" : ""}`}>
    <summary className="ops-system-summary-toggle"><div><strong>รายการ TOR ประจำสถานี</strong><span>ชื่อ หมวด ขอบเขต ปริมาณและหน่วยจากเอกสาร แยกจากทะเบียนอุปกรณ์จริง</span></div><span className="ops-count-badge">{summary.lineCount} รายการ</span></summary>
    <div className="ops-system-summary-body"><div className="ops-system-summary-content">
      <div className="ops-system-summary-heading"><div><strong>ยอดอ้างอิงตาม TOR</strong><span>ไม่รวมหน่วยต่างชนิดเป็นจำนวนอุปกรณ์เดียว</span></div><div className="ops-system-summary-totals"><strong>{summary.lineCount} บรรทัด</strong><span>{unitSummary || "ไม่มีข้อมูล"}</span></div></div>
      <div className="ops-system-summary-list">{groups.map(([category, entries]) => <details className="ops-system-summary-group" key={category}><summary className="ops-system-summary-group-toggle"><span className="ops-config-section-code">{category}</span><div className="ops-system-summary-group-title"><strong>หมวด {category}</strong><span>{entries.length} รายการ</span></div></summary><div className="ops-system-summary-children">{entries.map((entry) => <article className={`ops-system-summary-child is-${entry.kind}`} key={entry.id}><div className="ops-system-summary-child-main"><span className="ops-system-summary-child-mark"><Icon name={entry.kind === "asset" ? "equipment" : entry.kind === "service" ? "refresh" : "archive"} size="small" /></span><div><strong>{entry.displayName}</strong><span>{entry.sourceName} · {scopeLabels[entry.scope] || entry.scope}</span></div></div><div className="ops-system-summary-child-meta"><span className={`ops-system-summary-status is-${entry.kind}`}>{kindLabels[entry.kind] || entry.kind}</span><output className="ops-system-summary-count"><strong>{entry.quantity} {entry.unit}</strong><span>{entry.kind === "asset" ? (entry.assetType ? `ติดตั้งจริง ${installedCountFor(entry) || 0} รายการ` : "ยังไม่ผูกกับทะเบียนอุปกรณ์") : "อ้างอิง TOR"}</span></output></div></article>)}</div></details>)}</div>
    </div></div>
  </details>;
}

export function EquipmentCatalogAddPanel({ catalog, canonicalItems = [], stationEquipment = [], lanes = [], stationFormat = "SC", stationSystems = [], disabled = false, onAdd }) {
  const stationProfileContext = useContext(StationProfileEquipmentContext);
  const currentCanonicalItems = canonicalItems.length ? canonicalItems : stationProfileContext.canonicalItems;
  const currentStationEquipment = stationProfileContext.stationEquipment || stationEquipment;
  const activeCatalog = (Array.isArray(catalog) ? catalog : []).filter((item) => item.active !== false && !getEquipmentType(item.type)?.legacyOnly);
  const [selectedId, setSelectedId] = useState(activeCatalog[0]?.id || "");
  const [ownerSystemId, setOwnerSystemId] = useState("");
  const [parentCabinetId, setParentCabinetId] = useState("");
  const [wimParentId, setWimParentId] = useState("");
  const selected = activeCatalog.find((item) => item.id === selectedId) || null;
  const isWimChild = isWimEquipment(selected);
  const isElectronicsChild = isWimElectronicsSubEquipmentType(selected?.type);
  const wimParents = getWimSortingSystemInstances(stationSystems);
  const wimParent = wimParents.find((item) => item.id === wimParentId);
  const definition = currentCanonicalItems.find((item) => item.kind === "asset" && item.equipmentType === selected?.type)
    || getCanonicalItemsForFormat(stationFormat).find((item) => item.kind === "asset" && item.equipmentType === selected?.type);
  const ownerIds = definition?.systemIds || [];
  const ownerSystemOptions = stationSystems.filter((system) => system.active !== false && Number(system.quantity ?? 1) > 0
    && ownerIds.includes(system.canonicalItemId || (system.systemId === "wim" && system.componentId === "electronics" ? "wim-electronics-system" : system.systemId)));
  const parentCabinetOptions = currentStationEquipment.filter((asset) => asset.type === "CONTROL_CABINET" && asset.active !== false);
  const parentCabinet = parentCabinetOptions.find((asset) => asset.id === parentCabinetId) || null;
  const cabinetOwnerOptions = ownerSystemOptions.filter((system) => !parentCabinet?.scope || !system.scope
    || String(system.scope).trim().toLowerCase() === String(parentCabinet.scope).trim().toLowerCase());
  const ownerSystem = ownerSystemOptions.find((system) => system.id === ownerSystemId) || null;
  const electronicsParentSystem = cabinetOwnerOptions.find((system) => system.id === parentCabinet?.parentSystemId)
    || cabinetOwnerOptions.find((system) => system.id === ownerSystemId)
    || (cabinetOwnerOptions.length === 1 ? cabinetOwnerOptions[0] : null);
  const resolvedParentSystem = isWimChild ? wimParent : isElectronicsChild ? electronicsParentSystem : ownerSystem;
  const allowedScopes = definition?.scopeVariants?.length ? definition.scopeVariants : definition?.allowedScopes || [];
  const selectedScope = isWimChild ? wimParent?.scope || "" : isElectronicsChild ? parentCabinet?.scope || resolvedParentSystem?.scope || "" : resolvedParentSystem?.scope || (allowedScopes.length === 1 ? allowedScopes[0] : "");
  const displayCategory = getBoqAddCategory({ stationFormat, type: selected?.type, categoryCode: selected?.categoryCode, scope: selectedScope });

  useEffect(() => {
    if (!activeCatalog.some((item) => item.id === selectedId)) setSelectedId(activeCatalog[0]?.id || "");
  }, [catalog, selectedId]);

  return <section className="ops-detail-asset-add" aria-labelledby="detail-asset-add-title">
    <div className="ops-detail-asset-add-heading"><div><p className="ops-eyebrow">เพิ่มอุปกรณ์</p><h4 id="detail-asset-add-title">เพิ่มอุปกรณ์</h4><span>เลือกจากระบบหรือคลังอุปกรณ์กำหนดเอง (Custom) ระบบจะสร้างรหัสอุปกรณ์ (Asset No.) ถัดไปให้ไม่ซ้ำในสถานีนี้</span></div><span className="ops-count-badge">{activeCatalog.length}</span></div>
    <div className="ops-detail-asset-add-controls">
      <label className="ops-field ops-field-wide" htmlFor="station-detail-catalog-item"><span>ไอเทมจากคลัง</span><CustomSelect id="station-detail-catalog-item" label="ไอเทมจากคลัง" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setScope(""); setWimParentId(""); }} disabled={disabled || !activeCatalog.length}><option value="">เลือกไอเทม</option>{ITEM_LIBRARY_CATEGORIES.map((group) => { const items = activeCatalog.filter((item) => item.categoryCode === group.code); return items.length ? <optgroup key={group.code} label={`${group.code} · ${group.title}`}>{items.map((item) => <option key={item.id} value={item.id}>{item.nameEn || item.label} · {item.label} · {item.prefix}</option>)}</optgroup> : null; })}</CustomSelect></label>
      {selected && isWimChild && <label className="ops-field"><span>WIM Sorting System แม่</span><CustomSelect label="WIM Sorting System แม่" value={wimParentId} onChange={(event) => setWimParentId(event.target.value)}><option value="">เลือกระบบแม่</option>{wimParents.map((parent) => <option key={parent.id} value={parent.id}>#{parent.instanceNo || "?"} · {parent.scope || "ไม่ระบุชุด"}</option>)}</CustomSelect></label>}
      {selected && !isWimChild && !isElectronicsChild && ownerSystemOptions.length > 0 && <label className="ops-field"><span>System แม่</span><CustomSelect label="System แม่" value={ownerSystem?.id || ""} onChange={(event) => setOwnerSystemId(event.target.value)}><option value="">เลือกระบบแม่</option>{ownerSystemOptions.map((system) => <option key={system.id} value={system.id}>{system.displayLabel || system.nameEn || system.canonicalItemId} · {system.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
      {selected && isElectronicsChild && parentCabinetOptions.length > 0 && <label className="ops-field"><span>WIM Electronics Cabinet</span><CustomSelect label="WIM Electronics Cabinet" value={parentCabinet?.id || ""} onChange={(event) => { setParentCabinetId(event.target.value); setOwnerSystemId(""); }}><option value="">เลือก Cabinet แม่</option>{parentCabinetOptions.map((cabinet) => <option key={cabinet.id} value={cabinet.id}>{cabinet.assetNo || "ไม่มี Asset No."} · {cabinet.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
      {selected && isElectronicsChild && parentCabinet && !parentCabinet.parentSystemId && cabinetOwnerOptions.length > 1 && <label className="ops-field"><span>WIM Electronics System แม่</span><CustomSelect label="WIM Electronics System แม่" value={electronicsParentSystem?.id || ""} onChange={(event) => setOwnerSystemId(event.target.value)}><option value="">เลือกระบบแม่</option>{cabinetOwnerOptions.map((system) => <option key={system.id} value={system.id}>{system.displayLabel || system.nameEn || system.canonicalItemId} · {system.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
      {selected && !isWimChild && !isElectronicsChild && !ownerIds.length && allowedScopes.length > 1 && <small className="ops-field-helper">เลือกกลุ่มหรือ System ที่เกี่ยวข้องก่อน เพื่อกำหนด Scope อัตโนมัติ</small>}
      <div className="ops-detail-asset-add-preview">{selected ? <><strong>{[selected.nameEn, selected.label].filter(Boolean).join(" · ")}</strong><span>{displayCategory.code || "เลือกชุดระบบ"} · {displayCategory.title}</span><small>BOQ/TOR {selected.categoryCode} · Prefix {selected.prefix}</small></> : <span>ยังไม่มีไอเทมที่เปิดใช้ในคลัง</span>}</div>
      {selected && (ownerIds.length > 0 || isElectronicsChild) && <div className="sc-readonly-field"><span>Scope</span><strong>{selectedScope || "ยังระบุไม่ได้"}</strong><small>กำหนดจาก System หรือ Cabinet แม่</small></div>}
      <Button onClick={() => selected && onAdd(selected, 1, { scope: selectedScope, wimSystemIds: isWimChild ? [wimParentId] : [], parentSystemId: resolvedParentSystem?.id || null, parentAssetId: isElectronicsChild ? parentCabinet?.id || null : null })} variant="primary" icon="plus" disabled={disabled || !selected || !displayCategory.code || (isWimChild && !wimParent) || (!isWimChild && ownerIds.length > 0 && !resolvedParentSystem) || (isElectronicsChild && !parentCabinet)} >เพิ่มเข้าทะเบียน</Button>
    </div>
    {!activeCatalog.length ? <div className="ops-info-banner"><Icon name="info" /><span>ยังไม่มีแม่แบบอุปกรณ์ที่เปิดใช้ในระบบ</span></div> : <small className="ops-field-helper">ตำแหน่งติดตั้งแนะนำให้กรอกหลังเพิ่มรายการ ส่วน Serial Number ไม่บังคับ</small>}
  </section>;
}

export function EquipmentQuickAddPanel({ catalog, canonicalItems = [], stationFormat = "SC", initialGroupId = null, initialBoqGroupCode = "", initialCategoryId = "", initialScope = "", initialParentSystemId = "", initialParentAssetId = "", initialEquipmentType = "", initialRecordKind = "", activeLanes = [], stationSystems = [], stationEquipment = [], disabled = false, open = false, onClose, onAdd, onAddSystem }) {
  const contextGroup = initialGroupId ? SC_OPERATION_SYSTEM_GROUPS.find((group) => group.id === initialGroupId) || null : null;
  const contextScope = String(initialScope || "").trim() || getBoqScopeForGroup(stationFormat, initialBoqGroupCode);
  const contextMainCategory = CENTRAL_EQUIPMENT_MAIN_CATEGORIES.find((category) => category.id === initialCategoryId) || null;
  const contextMainCategoryLabel = contextMainCategory?.canonicalCategories?.[0] || contextMainCategory?.label || "";
  const contextBoqGroup = BOQ_CHECKLIST_GROUPS[String(stationFormat).toUpperCase() === "IMPS" ? "IMPS" : "SC"].find((group) => group.code === String(initialBoqGroupCode).replace(/^(SC|IMPS)-/i, "")) || null;
  const scopedCanonicalItems = useMemo(() => filterCatalogItemsByBoqGroup(canonicalItems, canonicalItems, { stationFormat, groupCode: initialBoqGroupCode }), [canonicalItems, stationFormat, initialBoqGroupCode]);
  const contextCategoryAssetTypes = useMemo(() => new Set(scopedCanonicalItems
    .filter((item) => item.kind === "asset" && (!initialCategoryId || getRelationshipCategoryForAsset({ type: item.equipmentType, categoryCode: item.checklistMapping?.[0], scope: contextScope }) === initialCategoryId))
    .map((item) => item.equipmentType).filter(Boolean)), [scopedCanonicalItems, initialCategoryId, contextScope]);
  const contextCategorySystemIds = useMemo(() => new Set(scopedCanonicalItems
    .filter((item) => item.kind === "system" && (!initialCategoryId || getRelationshipCategoryForSystem({ canonicalItemId: item.id, systemId: item.id, sourceRefs: item.checklistMapping, scope: contextScope }) === initialCategoryId))
    .map((item) => item.id)), [scopedCanonicalItems, initialCategoryId, contextScope]);
  const groupedCatalog = useMemo(() => filterCatalogItemsByBoqGroup(catalog, canonicalItems, { stationFormat, groupCode: initialBoqGroupCode }), [catalog, canonicalItems, stationFormat, initialBoqGroupCode]);
  const contextAssetTypes = useMemo(() => new Set((Array.isArray(canonicalItems) ? canonicalItems : []).filter((item) => item.kind === "asset" && (!contextGroup || getScSystemGroupForCanonical(item) === contextGroup.id)).map((item) => item.equipmentType).filter(Boolean)), [canonicalItems, contextGroup?.id]);
  const activeCatalog = useMemo(() => groupedCatalog.filter((item) => item.active !== false && !getEquipmentType(item.type)?.legacyOnly
    && (!initialBoqGroupCode && contextGroup ? contextAssetTypes.has(item.type) : true)
    && (!initialCategoryId || contextCategoryAssetTypes.has(item.type))), [groupedCatalog, initialBoqGroupCode, contextGroup?.id, contextAssetTypes, initialCategoryId, contextCategoryAssetTypes]);
  const availableSystems = useMemo(() => scopedCanonicalItems.filter((item) => item.kind === "system"
    && (!initialBoqGroupCode && contextGroup ? getScSystemGroupForCanonical(item) === contextGroup.id : true)
    && (!initialCategoryId || contextCategorySystemIds.has(item.id))), [scopedCanonicalItems, initialBoqGroupCode, contextGroup?.id, initialCategoryId, contextCategorySystemIds]);
  const categories = useMemo(() => ITEM_LIBRARY_CATEGORIES.map((category) => ({
    ...category,
    items: activeCatalog.filter((item) => item.categoryCode === category.code),
  })).filter((category) => category.items.length && (!contextGroup || initialBoqGroupCode || contextGroup.categoryCodes.includes(category.code))), [activeCatalog, contextGroup?.id, initialBoqGroupCode]);
  const catalogItems = useMemo(() => categories.flatMap((category) => category.items.map((item) => ({ ...item, categoryTitle: category.title }))), [categories]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategoryCode, setCatalogCategoryCode] = useState("all");
  const [catalogItemId, setCatalogItemId] = useState(() => catalogItems.find((item) => item.type === initialEquipmentType)?.id || "");
  const [recordKind, setRecordKind] = useState(() => initialRecordKind === "system" && availableSystems.length ? "system" : initialRecordKind === "asset" && categories.length ? "asset" : categories.length ? "asset" : availableSystems.length ? "system" : "asset");
  const [systemCategory, setSystemCategory] = useState("all");
  const [systemItemId, setSystemItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [laneAssignments, setLaneAssignments] = useState([]);
  const [systemLaneAssignments, setSystemLaneAssignments] = useState([]);
  const [wimParentAssignments, setWimParentAssignments] = useState(() => initialParentSystemId ? [initialParentSystemId] : []);
  const [selectedScope, setSelectedScope] = useState("");
  const [ownerSystemId, setOwnerSystemId] = useState(initialParentSystemId);
  const [parentCabinetId, setParentCabinetId] = useState(initialParentAssetId);
  const selectedItem = catalogItems.find((item) => item.id === catalogItemId) || null;
  const systemCategories = useMemo(() => Array.from(new Set(availableSystems.map((item) => item.category).filter(Boolean))), [availableSystems]);
  const visibleSystems = useMemo(() => availableSystems.filter((item) => systemCategory === "all" || item.category === systemCategory), [availableSystems, systemCategory]);
  const selectedSystem = visibleSystems.find((item) => item.id === systemItemId) || visibleSystems[0] || null;
  const isWimCatalogItem = isWimEquipment(selectedItem);
  const isWimSortingSystem = selectedSystem?.id === WIM_SORTING_SYSTEM_CANONICAL_ID;
  const activeWimSystems = getWimSortingSystemInstances(stationSystems).filter((system) => (!initialParentSystemId || system.id === initialParentSystemId) && (!contextScope || String(system.scope).trim().toLowerCase() === contextScope.toLowerCase()));
  const definition = canonicalItems.find((item) => item.kind === "asset" && item.equipmentType === selectedItem?.type);
  const parentSystemKey = (system) => String(system?.canonicalItemId || (system?.systemId === "wim" && system?.componentId === "electronics" ? "wim-electronics-system" : system?.systemId || system?.id || ""));
  const allowedOwnerIds = definition?.systemIds || [];
  const ownerSystemOptions = (stationSystems || []).filter((system) => system.active !== false && Number(system.quantity ?? 1) > 0
    && allowedOwnerIds.includes(parentSystemKey(system))
    && (!initialParentSystemId || system.id === initialParentSystemId)
    && (!contextScope || !system.scope || String(system.scope).trim().toLowerCase() === contextScope.toLowerCase())
    && (selectedItem?.type !== "LPR_CAMERA" || system.id === initialParentSystemId || (parentSystemKey(system) === "lpr-control"
      && (lanes || []).some((lane) => lane.active !== false && lane.id === system.laneId)
      && !(stationEquipment || []).some((asset) => asset.active !== false && asset.type === "LPR_CAMERA" && asset.parentSystemId === system.id))))
    .map((system) => selectedItem?.type === "LPR_CAMERA" ? { ...system, laneLabel: `Lane ${(lanes || []).find((lane) => lane.id === system.laneId)?.laneNo || "—"}` } : system);
  const selectedOwnerSystem = ownerSystemOptions.find((system) => system.id === ownerSystemId)
    || ownerSystemOptions.find((system) => system.id === initialParentSystemId)
    || null;
  const isWimElectronicsChild = isWimElectronicsSubEquipmentType(selectedItem?.type);
  const isLprCamera = selectedItem?.type === "LPR_CAMERA";
  const parentCabinetOptions = (stationEquipment || []).filter((asset) => asset.type === "CONTROL_CABINET" && asset.active !== false
    && ownerSystemOptions.some((system) => system.id === asset.parentSystemId)
    && (!initialParentAssetId || asset.id === initialParentAssetId));
  const selectedParentCabinet = parentCabinetOptions.find((asset) => asset.id === parentCabinetId) || (initialParentSystemId && parentCabinetOptions.length === 1 ? parentCabinetOptions[0] : null);
  const cabinetOwnerOptions = ownerSystemOptions.filter((system) => system.id === selectedParentCabinet?.parentSystemId);
  const selectedCabinetOwner = cabinetOwnerOptions.find((system) => system.id === selectedParentCabinet?.parentSystemId)
    || cabinetOwnerOptions.find((system) => system.id === ownerSystemId)
    || cabinetOwnerOptions.find((system) => system.id === initialParentSystemId)
    || (cabinetOwnerOptions.length === 1 ? cabinetOwnerOptions[0] : null);
  const rawScopeOptions = recordKind === "system" ? selectedSystem?.id?.startsWith("dimension-") ? ["3D"] : selectedSystem?.allowedScopes || [] : ["LASER_SCANNER", "DIMENSION_CONTROLLER"].includes(selectedItem?.type) ? ["3D"] : selectedItem?.type === "LPR_CAMERA" ? (stationFormat === "IMPS" ? ["ImPS", "3D"] : ["High Speed", "Low Speed", "3D"]) : selectedItem?.type === "FIXED_CAMERA" && stationFormat === "IMPS" ? ["Image Processing", "ImPS"] : definition?.scopeVariants?.length ? definition.scopeVariants : definition?.allowedScopes || [];
  const scopeOptions = rawScopeOptions.filter((scope) => stationFormat === "IMPS" ? !["High Speed", "Low Speed"].includes(scope) : scope !== "ImPS");
  const assignedWimParent = activeWimSystems.find((system) => system.id === wimParentAssignments[0]);
  const resolvedScope = isWimCatalogItem
    ? (contextScope || assignedWimParent?.scope || (activeWimSystems.length === 1 ? activeWimSystems[0].scope : "") || selectedScope)
    : isWimElectronicsChild
      ? (selectedCabinetOwner?.scope || contextScope || "")
      : (selectedOwnerSystem?.scope || contextScope || (scopeOptions.length === 1 ? scopeOptions[0] : selectedScope));
  const resolvedParentSystem = isWimCatalogItem
    ? assignedWimParent
    : isWimElectronicsChild
      ? selectedCabinetOwner
      : selectedOwnerSystem;
  const selectedCategory = getBoqAddCategory({ stationFormat, type: selectedItem?.type, categoryCode: selectedItem?.categoryCode, scope: resolvedScope, canonicalItemId: definition?.id });
  const selectedSystemCategory = getBoqAddCategory({ stationFormat, kind: "system", categoryCode: selectedSystem?.checklistMapping?.[0], scope: resolvedScope, canonicalItemId: selectedSystem?.id });
  const canSubmit = recordKind === "system"
    ? Boolean(selectedSystem && selectedSystemCategory.code && (contextScope || scopeOptions.length <= 1 || selectedScope)) && (!isWimSortingSystem || (systemLaneAssignments.length === quantity && systemLaneAssignments.every(Boolean)))
    : Boolean(selectedItem && (isWimCatalogItem || selectedCategory.code) && (contextScope || selectedOwnerSystem || isWimElectronicsChild || scopeOptions.length <= 1 || selectedScope)
      && (isWimCatalogItem || isWimElectronicsChild || !allowedOwnerIds.length || Boolean(selectedOwnerSystem))
      && (!isWimElectronicsChild || Boolean(selectedParentCabinet && resolvedParentSystem))
      && (!(selectedItem.type === "CONTROL_CABINET" || isWimElectronicsChild || isLprCamera) || Boolean(resolvedParentSystem))
      && (!isLprCamera || quantity === 1)
      && (!isWimCatalogItem || activeWimSystems.length > 0 && (initialParentSystemId && activeWimSystems.length === 1 || (wimParentAssignments.length === quantity && wimParentAssignments.every((id) => activeWimSystems.some((system) => system.id === id))))));
  const resolvedWimParentIds = Array.from({ length: quantity }, (_, index) => wimParentAssignments[index] || (initialParentSystemId && activeWimSystems.length === 1 ? activeWimSystems[0].id : ""));
  const visibleCatalogItems = catalogItems.filter((item) => {
    const searchable = `${item.label} ${item.prefix} ${item.categoryCode} ${item.categoryTitle}`.toLowerCase();
    const matchesCategory = catalogCategoryCode === "all" || item.categoryCode === catalogCategoryCode;
    return matchesCategory && (!catalogQuery.trim() || searchable.includes(catalogQuery.trim().toLowerCase()));
  });

  useEffect(() => {
    if (!catalogItems.some((item) => item.id === catalogItemId)) setCatalogItemId("");
  }, [catalogItems, catalogItemId]);

  useEffect(() => {
    if (catalogCategoryCode !== "all" && !categories.some((category) => category.code === catalogCategoryCode)) setCatalogCategoryCode("all");
  }, [catalogCategoryCode, categories]);

  useEffect(() => {
    if (systemCategory !== "all" && !systemCategories.includes(systemCategory)) setSystemCategory("all");
  }, [systemCategories, systemCategory]);

  useEffect(() => {
    if (!catalogItemId || visibleCatalogItems.some((item) => item.id === catalogItemId)) return;
    setCatalogItemId("");
    setQuantity(1);
    setLaneAssignments([]);
    setWimParentAssignments(initialParentSystemId ? [initialParentSystemId] : []);
  }, [catalogItemId, visibleCatalogItems]);

  useEffect(() => {
    if (!visibleSystems.some((item) => item.id === systemItemId)) setSystemItemId(visibleSystems[0]?.id || "");
  }, [systemItemId, visibleSystems]);

  useEffect(() => {
    if (selectedScope && !scopeOptions.includes(selectedScope)) setSelectedScope("");
  }, [selectedScope, scopeOptions.join("|")]);

  useEffect(() => { setSelectedScope(""); setOwnerSystemId(initialParentSystemId); setParentCabinetId(initialParentAssetId); }, [systemItemId, catalogItemId, recordKind, initialParentSystemId, initialParentAssetId]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  const chooseItem = (nextItem) => {
    setCatalogItemId(nextItem.id);
    setSelectedScope("");
    setOwnerSystemId(initialParentSystemId);
    setParentCabinetId("");
    setQuantity(1);
    setLaneAssignments([]);
    setWimParentAssignments(initialParentSystemId ? [initialParentSystemId] : []);
  };

  const changeQuantity = (nextValue) => {
    const nextQuantity = Math.max(1, Math.min(isLprCamera ? 1 : 99, Number(nextValue) || 1));
    setQuantity(nextQuantity);
    setLaneAssignments((current) => current.slice(0, nextQuantity));
    setSystemLaneAssignments((current) => current.slice(0, nextQuantity));
    setWimParentAssignments((current) => current.slice(0, nextQuantity));
  };

  if (!open) return null;

  return <div className="sc-add-panel-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
    <aside className="sc-add-panel" role="dialog" aria-modal="true" aria-labelledby="sc-add-panel-title">
      <div className="sc-add-panel-heading">
        <div><h2 id="sc-add-panel-title">เพิ่มอุปกรณ์ / ระบบ</h2><p>เพิ่มข้อมูลจริงเข้าทะเบียนของสถานี</p></div>
        <button type="button" className="sc-close" onClick={onClose} aria-label="ปิดแผงเพิ่มอุปกรณ์">×</button>
      </div>
      <div className="sc-add-panel-body">
        {(contextMainCategory || contextBoqGroup || contextGroup) && <div className="sc-add-context"><span className="sc-system-card-icon"><ScContextIcon name={contextGroup?.icon || contextMainCategory?.icon || "system"} size={18} /></span><div><small>กำลังเพิ่มในหมวดหลัก</small><strong>{contextMainCategory ? [contextMainCategoryLabel, contextScope].filter(Boolean).join(" · ") : contextBoqGroup?.title || contextGroup?.label}</strong>{contextScope && <small>{initialScope ? "Scope จากตำแหน่งในผัง" : "Scope กำหนดตามกลุ่มนี้"}: {contextScope}</small>}</div></div>}
        <div className="sc-add-kind-switch" role="tablist" aria-label="ชนิดข้อมูลที่จะเพิ่ม">
          <button type="button" role="tab" aria-selected={recordKind === "asset"} className={recordKind === "asset" ? "is-active" : ""} disabled={!categories.length} onClick={() => setRecordKind("asset")}><Icon name="equipment" pixelSize={18} /><span><strong>อุปกรณ์จริง</strong><small>Asset รายตัว</small></span></button>
          <button type="button" role="tab" aria-selected={recordKind === "system"} className={recordKind === "system" ? "is-active" : ""} disabled={!availableSystems.length} onClick={() => setRecordKind("system")}><Icon name="system" pixelSize={18} /><span><strong>ระบบ</strong><small>System จากคลังกลาง</small></span></button>
        </div>
        {recordKind === "system" && selectedSystem && scopeOptions.length > 1 && !contextScope && <label className="ops-field"><span>กลุ่มที่ติดตั้ง</span><CustomSelect label="กลุ่มที่ติดตั้ง" value={selectedScope} onChange={(event) => setSelectedScope(event.target.value)}><option value="">เลือกกลุ่มระบบ</option>{scopeOptions.map((scope) => <option key={scope} value={scope}>{getBoqAddCategory({ stationFormat, kind: "system", categoryCode: selectedSystem.checklistMapping?.[0], scope, canonicalItemId: selectedSystem.id }).title}</option>)}</CustomSelect></label>}
        {recordKind === "system" && selectedSystem && <small>{contextMainCategory ? [contextMainCategoryLabel, resolvedScope].filter(Boolean).join(" · ") : `${selectedSystemCategory.code || "เลือกชุดระบบ"} · ${selectedSystemCategory.title}`} · BOQ/TOR {getScSystemCategoryCodes(selectedSystem)}</small>}
        {recordKind === "asset" ? <>
        <section className="sc-add-step" aria-labelledby="sc-add-step-equipment">
          <div className="sc-add-step-heading"><span>1</span><div><strong id="sc-add-step-equipment">เลือกอุปกรณ์ที่ติดตั้งจริง</strong><small>ค้นหาจากชื่ออุปกรณ์ได้เลย ไม่ต้องรู้หมวด BOQ ก่อน</small></div></div>
          {catalogItems.length ? <>
            <label className="sc-add-search"><Icon name="search" /><span className="sr-only">ค้นหาอุปกรณ์ที่จะเพิ่ม</span><input type="search" value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="ค้นหา เช่น Sensor, กล้อง, NVR" /></label>
            <label className="ops-field sc-add-category-filter" htmlFor="sc-add-category"><span>หมวด BOQ <em>(ถ้าต้องการกรอง)</em></span><CustomSelect id="sc-add-category" label="หมวด BOQ" value={catalogCategoryCode} onChange={(event) => setCatalogCategoryCode(event.target.value)} disabled={disabled}><option value="all">ทุกหมวด BOQ</option>{categories.map((category) => <option key={category.code} value={category.code}>{category.code} · {category.title}</option>)}</CustomSelect></label>
            <div className="sc-add-item-list" role="listbox" aria-label="เลือกอุปกรณ์ที่ติดตั้งจริง">
              {visibleCatalogItems.length ? visibleCatalogItems.map((item) => <button type="button" role="option" aria-selected={selectedItem?.id === item.id} className={`sc-add-item-option ${selectedItem?.id === item.id ? "is-selected" : ""}`} key={item.id} onClick={() => chooseItem(item)}>
                <span className="sc-add-item-icon"><ScContextIcon name={item.type} size={20} /></span>
                <span className="sc-add-item-copy"><strong>{[item.nameEn, item.label].filter(Boolean).join(" · ")}</strong><small>{contextMainCategory ? [contextMainCategoryLabel, contextScope].filter(Boolean).join(" · ") : getBoqAddCategory({ stationFormat, type: item.type, categoryCode: item.categoryCode, scope: contextScope, canonicalItemId: canonicalItems.find((entry) => entry.kind === "asset" && entry.equipmentType === item.type)?.id }).title} · BOQ/TOR {item.categoryCode}</small></span>
                <span className="sc-add-item-prefix">{item.prefix}</span>
                {selectedItem?.id === item.id && <Icon name="check" size="small" />}
              </button>) : <div className="sc-add-empty"><Icon name="search" /><strong>ไม่พบอุปกรณ์ที่ค้นหา</strong><small>ลองใช้ชื่อสั้นลง หรือค้นหาด้วย Prefix</small></div>}
            </div>
          </> : <div className="sc-add-empty"><Icon name="info" /><strong>{contextGroup ? `ยังไม่มีอุปกรณ์ที่รองรับในหมวด ${contextGroup.label}` : "ยังไม่มีไอเทมที่เปิดใช้ในคลัง"}</strong><small>{contextGroup ? "เลือกข้อมูลระบบ หากหมวดนี้รองรับ หรือเพิ่มรายการในคลังไอเทมก่อน" : "ไปที่คลังไอเทมเพื่อสร้างหรือเปิดใช้งานรายการก่อน"}</small></div>}
        </section>
        <section className="sc-add-step" aria-labelledby="sc-add-step-quantity">
          <div className="sc-add-step-heading"><span>2</span><div><strong id="sc-add-step-quantity">ระบุจำนวน</strong><small>เพิ่มตามจำนวนที่ติดตั้งจริง</small></div></div>
          {selectedItem ? <>
            <div className="sc-add-item-preview"><strong>{[selectedItem.nameEn, selectedItem.label].filter(Boolean).join(" · ")}</strong><span>{contextMainCategory ? [contextMainCategoryLabel, resolvedScope].filter(Boolean).join(" · ") : `${selectedCategory.code || (isWimCatalogItem ? "เลือก WIM Sorting System แม่" : "เลือกชุดระบบ")} · ${selectedCategory.title}`}</span><small>BOQ/TOR {selectedItem.categoryCode} · Prefix {selectedItem.prefix}</small></div>
            {!isWimCatalogItem && !isWimElectronicsChild && ownerSystemOptions.length > 0 && (!initialParentSystemId || ownerSystemOptions.length > 1) && <label className="ops-field"><span>System แม่</span><CustomSelect label="System แม่" value={ownerSystemId} onChange={(event) => setOwnerSystemId(event.target.value)}><option value="">เลือกระบบแม่</option>{ownerSystemOptions.map((system) => <option key={system.id} value={system.id}>{getStationSystemDisplayLabel(system)} · {system.scope || contextScope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
            {!isWimCatalogItem && !isWimElectronicsChild && initialParentSystemId && ownerSystemOptions.length === 1 && <div className="sc-readonly-field"><span>System แม่</span><strong>{getStationSystemDisplayLabel(ownerSystemOptions[0])}</strong></div>}
            {isWimElectronicsChild && parentCabinetOptions.length > 0 && (!initialParentSystemId || parentCabinetOptions.length > 1) && <label className="ops-field"><span>Cabinet แม่</span><CustomSelect label="Cabinet แม่" value={parentCabinetId} onChange={(event) => { setParentCabinetId(event.target.value); setOwnerSystemId(""); }}><option value="">เลือก Cabinet แม่</option>{parentCabinetOptions.map((cabinet) => <option key={cabinet.id} value={cabinet.id}>{cabinet.assetNo || "ไม่มี Asset No."} · {cabinet.scope || contextScope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
            {isWimElectronicsChild && selectedParentCabinet && !selectedParentCabinet.parentSystemId && cabinetOwnerOptions.length > 1 && <label className="ops-field"><span>WIM Electronics System แม่</span><CustomSelect label="WIM Electronics System แม่" value={selectedCabinetOwner?.id || ""} onChange={(event) => setOwnerSystemId(event.target.value)}><option value="">เลือกระบบแม่</option>{cabinetOwnerOptions.map((system) => <option key={system.id} value={system.id}>{getStationSystemDisplayLabel(system)} · {system.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
            {isWimElectronicsChild && !parentCabinetOptions.length && <small className="sc-add-field-warning"><Icon name="alert" size="small" />ยังไม่มี WIM Electronics Cabinet ในกลุ่มนี้ กรุณาเพิ่ม Cabinet จาก System แม่ก่อน</small>}
            {allowedOwnerIds.length > 0 && !ownerSystemOptions.length && !isWimCatalogItem && <small className="sc-add-field-warning"><Icon name="alert" size="small" />{isLprCamera ? "ยังไม่มี LPR System ที่ผูกกับ Lane และยังมีช่องกล้องว่าง" : "ยังไม่มี System แม่ที่ตรงกับกลุ่มนี้ กรุณาเพิ่ม System ก่อนเพิ่มอุปกรณ์"}</small>}
            <div className="sc-readonly-field"><span>Scope</span><strong>{resolvedScope || "ยังระบุไม่ได้"}</strong><small>{contextScope ? (initialScope ? "กำหนดจากตำแหน่งในผัง" : `กำหนดจากกลุ่ม ${contextBoqGroup?.title || initialBoqGroupCode}`) : isWimElectronicsChild ? "กำหนดจาก Cabinet แม่" : isWimCatalogItem ? "กำหนดจาก WIM Sorting System แม่" : selectedOwnerSystem ? "กำหนดจาก System แม่" : "เลือกกลุ่มหรือ System แม่เพื่อกำหนดอัตโนมัติ"}</small></div>
            <div className="sc-add-quantity-control"><button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="ลดจำนวนอุปกรณ์">−</button><input className="sc-add-quantity-value" type="number" min="1" max={isLprCamera ? "1" : "99"} value={quantity} onChange={(event) => changeQuantity(event.target.value)} aria-label="จำนวนอุปกรณ์" /><button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={quantity >= (isLprCamera ? 1 : 99)} aria-label="เพิ่มจำนวนอุปกรณ์">+</button></div>{isLprCamera && <small className="sc-add-field-warning">เพิ่มได้กล้องจริง 1 ตัวต่อ LPR System และระบบจะไม่สร้างกล้องให้อัตโนมัติ</small>}
          </> : <div className="sc-add-empty"><Icon name="info" /><strong>เลือกอุปกรณ์ก่อนระบุจำนวน</strong><small>ระบบจะแสดงหมวด BOQ และข้อมูลที่ต้องกรอกตามประเภทให้อัตโนมัติ</small></div>}
        </section>
        {selectedItem && isWimCatalogItem && <section className="sc-add-step" aria-labelledby="sc-add-step-lane">
          <div className="sc-add-step-heading"><span>3</span><div><strong id="sc-add-step-lane">เลือก WIM Sorting System แม่</strong><small>Sensor/Loop ต้องผูกกับระบบ WIM ที่ติดตั้งในเลนนั้น ระบบจะเติม Lane ให้อัตโนมัติ</small></div></div>
          {initialParentSystemId && activeWimSystems.length === 1 ? <div className="sc-readonly-field"><span>WIM Sorting System แม่</span><strong>WIM Sorting System #{activeWimSystems[0].instanceNo || "?"} · {activeWimSystems[0].scope || contextScope}</strong><small>ใช้ระบบแม่ที่ตรงกับกลุ่มนี้อัตโนมัติ</small></div> : <div className="sc-add-lane-list">{Array.from({ length: quantity }, (_, index) => <label className="sc-add-lane-row" key={`${selectedItem.id}-${index}`}><span><strong>{[selectedItem.nameEn, selectedItem.label].filter(Boolean).join(" · ")} {index + 1}</strong><small>เลือกระบบแม่เพื่อกำหนด Scope และ Lane</small></span><CustomSelect label={`WIM Sorting System ของ ${selectedItem.label} ${index + 1}`} value={wimParentAssignments[index] || ""} disabled={disabled} onChange={(event) => setWimParentAssignments((current) => { const next = [...current]; next[index] = event.target.value; return next; })}><option value="">เลือก WIM Sorting System</option>{activeWimSystems.map((system) => <option key={system.id} value={system.id}>WIM Sorting System #{system.instanceNo || "?"} · Lane {String(system.laneId || "").replace(/^.*?lane-/, "")} · {system.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>)}</div>}
          {!activeWimSystems.length && <small className="sc-add-field-warning"><Icon name="alert" size="small" />ยังไม่มี WIM Sorting System ที่ผูกกับ Lane กรุณาเพิ่มระบบแม่ก่อนเพิ่ม Sensor/Loop</small>}
        </section>}
        </> : <section className="sc-add-step" aria-labelledby="sc-add-step-system">
          <div className="sc-add-step-heading"><span>1</span><div><strong id="sc-add-step-system">เลือกระบบที่จะลงทะเบียน</strong><small>เลือกจากคลังกลาง ระบบจะถูกจัดเข้ากลุ่มที่เกี่ยวข้องให้อัตโนมัติ</small></div></div>
          {availableSystems.length ? <><label className="ops-field sc-add-category-filter"><span>หมวดระบบ <em>(ถ้าต้องการกรอง)</em></span><CustomSelect id="sc-add-system-category" label="หมวดระบบ" value={systemCategory} onChange={(event) => setSystemCategory(event.target.value)} disabled={disabled}><option value="all">ทุกหมวดระบบ</option>{systemCategories.map((category) => <option key={category} value={category}>{category}</option>)}</CustomSelect></label><label className="ops-field"><span>ข้อมูลระบบ (System)</span><CustomSelect label="ข้อมูลระบบ (System)" value={selectedSystem?.id || ""} onChange={(event) => { setSystemItemId(event.target.value); setQuantity(1); setSystemLaneAssignments([]); }} disabled={disabled}><option value="">เลือก System</option>{visibleSystems.map((item) => <option key={item.id} value={item.id}>{getScSystemCategoryCodes(item)} · {item.nameEn || item.nameTh} · {item.nameTh} · {item.category}</option>)}</CustomSelect></label>{selectedSystem && <div className="sc-add-system-preview"><span className="sc-record-kind is-system">SYSTEM</span><div><strong>{getScSystemCategoryCodes(selectedSystem)} · {selectedSystem.nameEn || selectedSystem.nameTh} · {selectedSystem.nameTh}</strong><small>หมวดระบบ {selectedSystem.category}</small></div></div>}{selectedSystem && <><div className="sc-add-step-heading"><span>2</span><div><strong>จำนวนระบบที่ติดตั้งจริง</strong><small>ระบบละ 1 Lane · ไม่สร้าง Lane เพิ่มให้อัตโนมัติ</small></div></div><div className="sc-add-quantity-control"><button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="ลดจำนวนระบบ">−</button><input className="sc-add-quantity-value" type="number" min="1" max="99" value={quantity} onChange={(event) => changeQuantity(event.target.value)} aria-label="จำนวนระบบ" /><button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={quantity >= 99} aria-label="เพิ่มจำนวนระบบ">+</button></div>{isWimSortingSystem && <div className="sc-add-lane-list">{Array.from({ length: quantity }, (_, index) => <label className="sc-add-lane-row" key={`${selectedSystem.id}-${index}`}><span><strong>WIM Sorting System #{index + 1}</strong><small>เลือก Lane ที่ติดตั้งระบบนี้จริง</small></span><CustomSelect label={`Lane ของ WIM Sorting System ${index + 1}`} value={systemLaneAssignments[index] || ""} disabled={disabled} onChange={(event) => setSystemLaneAssignments((current) => { const next = [...current]; next[index] = event.target.value; return next; })}><option value="">เลือก Lane</option>{activeLanes.map((lane) => <option key={lane.id} value={lane.id}>Lane {lane.laneNo} · {getLaneScope(lane, stationSystems) || "ไม่ระบุ Scope"} · {lane.label}</option>)}</CustomSelect></label>)}</div>}</>}</> : <div className="sc-add-empty"><Icon name="info" /><strong>{contextGroup ? `ยังไม่มี System ที่รองรับในหมวด ${contextGroup.label}` : "ไม่มี System สำหรับรูปแบบสถานีนี้"}</strong></div>}
        </section>}
        <div className="sc-add-panel-note"><Icon name="info" /><span>เลือกอุปกรณ์ตามที่ติดตั้งจริงได้เลย · หมวด BOQ และ Asset No. จะถูกบันทึกให้อัตโนมัติ · การแก้ทะเบียนมีผลกับรอบตรวจใหม่เท่านั้น</span></div>
      </div>
        <div className="sc-add-panel-footer"><Button onClick={onClose}>ยกเลิก</Button><Button onClick={() => { if (recordKind === "system") onAddSystem?.(selectedSystem, quantity, { laneIds: systemLaneAssignments, scope: resolvedScope }); else onAdd?.(selectedItem, quantity, { laneIds: laneAssignments, wimSystemIds: resolvedWimParentIds, parentSystemId: resolvedParentSystem?.id || null, parentAssetId: selectedParentCabinet?.id || null, scope: resolvedScope }); onClose?.(); }} variant="primary" icon="plus" disabled={disabled || !canSubmit}>{recordKind === "system" ? "เพิ่มระบบเข้าทะเบียน" : "เพิ่มเข้าทะเบียน"}</Button></div>
    </aside>
  </div>;
}

export const READINESS_BLOCKER_COPY = Object.freeze({
  EMPTY_REGISTER: { label: "ทะเบียนอุปกรณ์และระบบ", tab: "equipment" },
  ASSET_NO_REQUIRED: { label: "รหัส Asset No.", tab: "equipment" },
  DUPLICATE_ASSET_NO: { label: "รหัสอุปกรณ์ (Asset No.) ซ้ำ", tab: "equipment" },
  WIM_SYSTEM_LANE_REQUIRED: { label: "Lane ของ WIM Sorting System", tab: "equipment" },
  WIM_SYSTEM_LANE_DUPLICATE: { label: "WIM Sorting System ซ้ำใน Lane เดียวกัน", tab: "equipment" },
  WIM_PARENT_SYSTEM_REQUIRED: { label: "ระบบแม่ของ WIM Sensor/Loop", tab: "equipment" },
  WIM_PARENT_SYSTEM_INVALID: { label: "Lane ของระบบแม่ WIM", tab: "equipment" },
  WIM_PARENT_LANE_MISMATCH: { label: "Lane ของอุปกรณ์ WIM ไม่ตรงระบบแม่", tab: "equipment" },
  WIM_ELECTRONICS_PARENT_CABINET_REQUIRED: { label: "Cabinet แม่ของอุปกรณ์ WIM Electronics", tab: "equipment" },
  WIM_ELECTRONICS_SYSTEM_REQUIRED: { label: "WIM Electronics System ของ Cabinet/อุปกรณ์", tab: "equipment" },
  WIM_SWITCHING_DC_OUTPUT_REQUIRED: { label: "แรงดัน Output ของ Switching DC", tab: "equipment" },
  CHECKLIST_MAPPING_REQUIRED: { label: "Checklist mapping ของ System", tab: "checklist" },
});

export function readinessBlockerCopy(blocker) {
  return READINESS_BLOCKER_COPY[blocker?.code] || { label: "ข้อมูลประจำสถานี", tab: "general" };
}

export function StationProfileRedesigned({ state, profile, setSelected, addStation, updateProfile, notify, onArchiveStation, onPurgeStation, activeEquipment = [], itemCatalog = [], addCatalogEquipment, changeQuantity, canonicalItems = [], addCanonicalSystem, updateCanonicalSystem, removeCanonicalSystem, equipmentRegisterGroups = [], equipmentGroups = [], referenced, updateEquipment, removeEquipment, stationRounds = [], masterConfigSections = [], isMasterConfigDisabled, enabledMasterConfigCount = 0, disabledMasterConfigCount = 0, masterConfigItems = [], toggleChecklist, previewApplicable = 0, previewNotApplicable = 0, updateStationLanes, assignStationLane, assignWimParentSystem, addStationLane, removeStationLane }) {
  const activeLanes = profile?.lanes?.filter((lane) => lane.active !== false) || [];
  const wimAssets = activeEquipment.filter(isWimEquipment);
  const wimSensorCount = wimAssets.filter((equipment) => equipment.type === "WIM_SENSOR").length;
  const wimLoopCount = wimAssets.filter((equipment) => equipment.type === "WIM_LOOP").length;
  const unassignedWimCount = wimAssets.filter((equipment) => !equipment.laneId).length;
  const incompleteEquipmentCount = countIncompleteEquipment(activeEquipment);
  const stationInfoReady = Boolean(profile?.stationCode?.trim() && profile?.stationName?.trim());
  const wimReady = !unassignedWimCount && (!wimAssets.length || activeLanes.length > 0);
  const checklistReady = disabledMasterConfigCount === 0;
  const stationReady = Boolean(profile && profile.active !== false && stationInfoReady && wimReady && !incompleteEquipmentCount);
  const attentionItems = [
    profile?.active === false ? "สถานีปิดใช้งานอยู่" : "",
    incompleteEquipmentCount ? `ข้อมูลอุปกรณ์ยังไม่ครบ ${incompleteEquipmentCount} รายการ` : "",
    unassignedWimCount ? `ยังไม่ผูก Lane ${unassignedWimCount} รายการ` : "",
    disabledMasterConfigCount ? `ปิดรายการตรวจไว้ ${disabledMasterConfigCount} รายการ` : "",
  ].filter(Boolean);
  const scrollToStationSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const laneSummary = activeLanes.map((lane) => ({
    ...lane,
    sensorCount: wimAssets.filter((item) => item.laneId === lane.id && item.type === "WIM_SENSOR").length,
    loopCount: wimAssets.filter((item) => item.laneId === lane.id && item.type === "WIM_LOOP").length,
  }));

  if (!profile) return <section className="ops-page station-profile-redesign"><Breadcrumb items={[{ label: "ทะเบียนสถานี", href: "#/stations" }, { label: "รายละเอียดสถานี" }]} /><section className="ops-panel station-profile-empty"><div className="ops-panel-toolbar"><StationSelect profiles={state.stationProfiles} value={profile?.id} onChange={setSelected} label="สถานีที่กำลังแก้ไข" includeInactive /></div><EmptyState title="ยังไม่มีสถานี" action={<Button onClick={addStation} variant="primary" icon="plus">สร้างสถานี</Button>}>สร้างสถานีแรกเพื่อเริ่มเพิ่มอุปกรณ์</EmptyState></section></section>;

  return <StationProfileScWorkspace
    state={state}
    profile={profile}
    setSelected={setSelected}
    updateProfile={updateProfile}
    notify={notify}
    onArchiveStation={onArchiveStation}
    onPurgeStation={onPurgeStation}
    activeEquipment={activeEquipment}
    itemCatalog={itemCatalog}
    addCatalogEquipment={addCatalogEquipment}
    changeQuantity={changeQuantity}
    canonicalItems={canonicalItems}
    addCanonicalSystem={addCanonicalSystem}
    updateCanonicalSystem={updateCanonicalSystem}
    removeCanonicalSystem={removeCanonicalSystem}
    equipmentRegisterGroups={equipmentRegisterGroups}
    equipmentGroups={equipmentGroups}
    referenced={referenced}
    updateEquipment={updateEquipment}
    removeEquipment={removeEquipment}
    stationRounds={stationRounds}
    masterConfigSections={masterConfigSections}
    isMasterConfigDisabled={isMasterConfigDisabled}
    enabledMasterConfigCount={enabledMasterConfigCount}
    disabledMasterConfigCount={disabledMasterConfigCount}
    masterConfigItems={masterConfigItems}
    toggleChecklist={toggleChecklist}
    previewApplicable={previewApplicable}
    previewNotApplicable={previewNotApplicable}
    updateStationLanes={updateStationLanes}
    assignStationLane={assignStationLane}
    assignWimParentSystem={assignWimParentSystem}
    addStationLane={addStationLane}
    removeStationLane={removeStationLane}
  />;

  return <section className="ops-page station-profile-redesign">
    <Breadcrumb items={[{ label: "ทะเบียนสถานี", href: "#/stations" }, { label: profile.stationCode, mono: true }]} />
    <header className="station-profile-hero">
      <div className="station-profile-hero-main"><p className="ops-eyebrow">STATION PROFILE</p><div className="station-profile-title-row"><span className="station-profile-mark"><Icon name="building" /></span><div className="station-profile-title-copy"><h1>{profile.stationName}</h1><p><span className="ops-code">{profile.stationCode}</span> · แก้ไขข้อมูลสำหรับรอบการตรวจถัดไป</p></div><StatusBadge status={profile.active === false ? "inactive" : stationReady ? "normal" : "waiting"}>{profile.active === false ? "ปิดใช้งาน" : stationReady ? "พร้อมใช้งาน" : "ต้องตรวจสอบ"}</StatusBadge></div></div>
      <div className="station-profile-hero-actions"><Button href="#/stations" icon="arrow">กลับทะเบียนสถานี</Button></div>
    </header>
    <section id="station-profile-overview" className="station-profile-context" aria-label="ข้อมูลสถานีที่กำลังแก้ไข"><div className="station-profile-context-grid"><StationSelect profiles={state.stationProfiles} value={profile.id} onChange={setSelected} label="สถานีที่กำลังแก้ไข" includeInactive /><label className="ops-field ops-code-field"><span>รหัสสถานี</span><input value={profile.stationCode} disabled={profile.active === false} onChange={(event) => updateProfile("stationCode", event.target.value)} placeholder="เช่น NKS-OUT" /></label><label className="ops-field ops-field-wide"><span>ชื่อสถานี</span><input value={profile.stationName} disabled={profile.active === false} onChange={(event) => updateProfile("stationName", event.target.value)} placeholder="ชื่อสถานีหรือจุดติดตั้ง" /></label></div><div className="station-profile-context-footer"><span className="station-profile-save"><Icon name="save" />บันทึกอัตโนมัติ</span><span>รอบที่กำลังกรอก {stationRounds.filter((round) => round.status !== "closed").length} รอบ · ประวัติที่ปิดแล้ว {stationRounds.filter((round) => round.status === "closed").length} รายการ</span><div className="station-profile-advanced-actions"><Button onClick={() => onArchiveStation(profile)} variant={profile.active === false ? "secondary" : "danger-ghost"} icon={profile.active === false ? "refresh" : "archive"}>{profile.active === false ? "เปิดใช้งานสถานี" : "ปิดใช้งานสถานี"}</Button><Button onClick={() => onPurgeStation(profile)} variant="danger-ghost" icon="delete">ลบสถานีถาวร</Button></div></div></section>
    <div className={`station-profile-attention ${attentionItems.length ? "has-attention" : "is-ready"}`} role="status"><Icon name={attentionItems.length ? "alert" : "check"} /><div><strong>{attentionItems.length ? `ต้องตรวจสอบ ${attentionItems.length} เรื่องก่อนสร้างรอบตรวจ` : "สถานีพร้อมสร้างรอบตรวจ"}</strong><span>{attentionItems.length ? attentionItems.join(" · ") : "ข้อมูลหลักและการผูกอุปกรณ์พร้อมใช้งาน"}</span></div>{attentionItems.length > 0 && <button type="button" className="station-profile-attention-action" onClick={() => scrollToStationSection(unassignedWimCount ? "station-profile-lanes" : incompleteEquipmentCount ? "station-profile-equipment" : "station-profile-checklist")}>ดูรายละเอียด</button>}</div>
    <section className="station-profile-summary" aria-label="สรุปสถานี"><article><span className="station-profile-summary-icon"><Icon name="building" /></span><div><strong>{activeLanes.length}</strong><span>Lane</span><small>ช่องจราจรที่ใช้งาน</small></div></article><article><span className="station-profile-summary-icon"><Icon name="equipment" /></span><div><strong>{wimAssets.length}</strong><span>WIM Assets</span><small>{wimSensorCount} Sensor · {wimLoopCount} Loop</small></div></article><article><span className="station-profile-summary-icon"><Icon name="checklist" /></span><div><strong>{enabledMasterConfigCount}<small> / {masterConfigItems.length}</small></strong><span>รายการตรวจ</span><small>เปิดใช้สำหรับสถานีนี้</small></div></article><article className={stationReady ? "is-ready" : "is-warning"}><span className="station-profile-summary-icon"><Icon name={stationReady ? "check" : "alert"} /></span><div><strong>{stationReady ? "พร้อม" : "ตรวจสอบ"}</strong><span>สถานะรวม</span><small>{attentionItems.length ? `${attentionItems.length} เรื่องที่ควรดู` : "ไม่มีรายการค้าง"}</small></div></article></section>
     <section className="station-profile-steps" aria-labelledby="station-profile-steps-title"><div className="station-profile-section-heading"><div><p className="ops-eyebrow">START HERE</p><h2 id="station-profile-steps-title">ขั้นตอนของหน้านี้</h2></div><span>ทำตามลำดับเพื่อให้พร้อมสร้างรอบตรวจ</span></div><div className="station-profile-step-list"><button type="button" className={stationInfoReady ? "is-complete" : "is-current"} onClick={() => scrollToStationSection("station-profile-overview")}><span>1</span><div><strong>ตรวจข้อมูลสถานี</strong><small>{stationInfoReady ? "ข้อมูลครบแล้ว" : "กรอกรหัสและชื่อสถานี"}</small></div><Icon name={stationInfoReady ? "check" : "arrow"} /></button><button type="button" className={wimReady ? "is-complete" : "is-current"} onClick={() => scrollToStationSection("station-profile-wim")}><span>2</span><div><strong>ตรวจอุปกรณ์ WIM</strong><small>{wimReady ? String(wimAssets.length) + " รายการพร้อมใช้งาน" : "ตรวจ Lane และการผูก Sensor / Loop"}</small></div><Icon name={wimReady ? "check" : "arrow"} /></button><button type="button" className={checklistReady ? "is-complete" : "is-current"} onClick={() => scrollToStationSection("station-profile-checklist")}><span>3</span><div><strong>ตั้งค่า Checklist</strong><small>{checklistReady ? String(enabledMasterConfigCount) + " รายการเปิดใช้" : "มี " + String(disabledMasterConfigCount) + " รายการปิดใช้งาน"}</small></div><Icon name={checklistReady ? "check" : "arrow"} /></button></div></section>
    <section id="station-profile-wim" className="station-profile-section station-profile-wim" aria-labelledby="station-profile-wim-title"><div className="station-profile-section-heading"><div><p className="ops-eyebrow">BOQ 2.1 · WIM GROUP</p><h2 id="station-profile-wim-title"><span className="ops-config-section-code">2.1</span> {formatCentralNameEnglishFirst(getCentralChecklistSectionName("2.1"))}</h2><span>รวม Sensor และ Loop ไว้ในกลุ่มเดียว เพื่อดูจำนวนและสถานะได้ทันที</span></div><span className={`station-profile-section-status ${wimReady ? "is-ready" : "is-warning"}`}><Icon name={wimReady ? "check" : "alert"} />{wimReady ? "พร้อมใช้งาน" : "ต้องตรวจสอบ"} · {wimAssets.length} รายการ</span></div><div className="station-profile-wim-types"><article><span className="station-profile-wim-icon"><Icon name={getEquipmentIconName("WIM_SENSOR")} /></span><div><strong>{getEquipmentDisplayLabel({ type: "WIM_SENSOR" })}</strong><span>{wimSensorCount} รายการใช้งาน</span><small>อุปกรณ์จริงในทะเบียนสถานี</small></div><div className="ops-quantity-controls"><button type="button" className="ops-quantity-button" onClick={() => changeQuantity("WIM_SENSOR", -1)} disabled={!wimSensorCount || profile.active === false} aria-label="ลดจำนวนเซนเซอร์ WIM"><span aria-hidden="true">−</span></button><output className="ops-quantity-count" aria-label="จำนวนเซนเซอร์ WIM">{wimSensorCount}</output><button type="button" className="ops-quantity-button" onClick={() => changeQuantity("WIM_SENSOR", 1)} disabled={profile.active === false} aria-label="เพิ่มจำนวนเซนเซอร์ WIM"><span aria-hidden="true">+</span></button></div></article><article><span className="station-profile-wim-icon"><Icon name={getEquipmentIconName("WIM_LOOP")} /></span><div><strong>{getEquipmentDisplayLabel({ type: "WIM_LOOP" })}</strong><span>{wimLoopCount} รายการใช้งาน</span><small>อุปกรณ์จริงในทะเบียนสถานี</small></div><div className="ops-quantity-controls"><button type="button" className="ops-quantity-button" onClick={() => changeQuantity("WIM_LOOP", -1)} disabled={!wimLoopCount || profile.active === false} aria-label="ลดจำนวน Loop ตรวจจับ WIM"><span aria-hidden="true">−</span></button><output className="ops-quantity-count" aria-label="จำนวน Loop ตรวจจับ WIM">{wimLoopCount}</output><button type="button" className="ops-quantity-button" onClick={() => changeQuantity("WIM_LOOP", 1)} disabled={profile.active === false} aria-label="เพิ่มจำนวน Loop ตรวจจับ WIM"><span aria-hidden="true">+</span></button></div></article></div><div className="station-profile-wim-lane-summary"><div><strong>สรุปการผูกกับ Lane</strong><span>{activeLanes.length} Lane · {unassignedWimCount ? `ยังไม่ผูก ${unassignedWimCount} รายการ` : "ผูกครบแล้ว"}</span></div><div className="station-profile-lane-pills">{laneSummary.map((lane) => <span key={lane.id}><strong>Lane {lane.laneNo} · {getLaneScope(lane, profile.stationSystems) || "ไม่ระบุ Scope"}</strong><small>{lane.sensorCount} Sensor · {lane.loopCount} Loop</small></span>)}</div><Button onClick={() => scrollToStationSection("station-profile-lanes")} variant="secondary" icon="arrow">ดูการผูก Lane</Button></div><details className="station-profile-system-details"><summary>ดูความสัมพันธ์ระบบกับทะเบียนอุปกรณ์ <span>{profile.stationSystems?.length || 0} กลุ่ม</span></summary><StationSystemsSummary systems={profile.stationSystems} equipment={activeEquipment} compact /></details></section>
    <details id="station-profile-lanes" className="station-profile-disclosure station-profile-lane-disclosure"><summary className="station-profile-disclosure-summary"><span className="station-profile-disclosure-icon"><Icon name="building" /></span><span><strong>Lane Topology</strong><small>กำหนดโครงสร้างช่องจราจรและผูก Sensor / Loop กับ Lane</small></span><span className="station-profile-disclosure-count">{activeLanes.length} เลน{unassignedWimCount ? ` · ค้าง ${unassignedWimCount}` : ""}</span><span className="station-profile-disclosure-chevron" aria-hidden="true" /></summary><div className="station-profile-disclosure-body"><LaneAssignmentStep stationFormat={profile.stationFormat} lanes={profile.lanes} equipment={activeEquipment} stationSystems={profile.stationSystems} disabled={profile.active === false} showHeading={false} headingEyebrow="LANE TOPOLOGY" headingTitle="กำหนดเลนและผูก Sensor / Loop" headingDescription="โครงสร้าง Lane แยกจากอุปกรณ์ และมีผลกับรอบการตรวจใหม่เท่านั้น" onChangeLanes={updateStationLanes} onAssignLane={assignStationLane} onAddLane={addStationLane} onRemoveLane={removeStationLane} /></div></details>
    <details id="station-profile-equipment" className="station-profile-disclosure"><summary className="station-profile-disclosure-summary"><span className="station-profile-disclosure-icon"><Icon name="equipment" /></span><span><strong>ทะเบียนอุปกรณ์</strong><small>ปรับจำนวนและแก้รายละเอียด อุปกรณ์จริงตามหมวด BOQ</small></span><span className="station-profile-disclosure-count">{activeEquipment.length} ใช้งาน · {equipmentGroups.length} กลุ่ม</span><span className="station-profile-disclosure-chevron" aria-hidden="true" /></summary><div className="station-profile-disclosure-body equipment-panel"><EquipmentCatalogAddPanel catalog={itemCatalog} stationFormat={profile.stationFormat} stationSystems={profile.stationSystems} stationEquipment={profile.equipment} lanes={profile.lanes} disabled={profile.active === false} onAdd={addCatalogEquipment} /><div className="ops-equipment-quantity-group-list" aria-label="ปรับจำนวนอุปกรณ์ตามหมวด BOQ">{equipmentRegisterGroups.map((group) => { const groupItems = group.types.flatMap((type) => type.items); const groupActiveCount = groupItems.filter((equipment) => equipment.active !== false).length; const groupInactiveCount = groupItems.length - groupActiveCount; return <section className="ops-equipment-quantity-group" key={group.code} aria-labelledby={`station-equipment-quantity-group-${group.code}`}><div className="ops-equipment-quantity-group-heading"><span className="ops-config-section-code">{group.code}</span><div><h4 id={`station-equipment-quantity-group-${group.code}`}>{group.title}</h4><span>{groupActiveCount} ใช้งาน{groupInactiveCount ? ` · ปิดใช้งาน ${groupInactiveCount}` : ""} · {groupItems.length} รายการ</span></div></div><div className="ops-equipment-quantity-subtypes">{group.types.map((type) => { const all = type.items; const activeCount = all.filter((equipment) => equipment.active !== false).length; const inactiveCount = all.length - activeCount; const typeLabel = getEquipmentTypeDisplayLabel(type); return <div className="ops-quantity-row" key={type.value}><div className="ops-quantity-name"><span className="ops-equipment-icon"><Icon name={getEquipmentIconName(type.value)} /></span><div><strong>{typeLabel}</strong><span>{activeCount ? `กำลังใช้งาน ${activeCount} รายการ` : "ยังไม่มีอุปกรณ์ใช้งาน"}{inactiveCount ? ` · ปิดใช้งาน ${inactiveCount}` : ""}</span></div></div><div className="ops-quantity-controls"><button type="button" className="ops-quantity-button" onClick={() => changeQuantity(type.value, -1)} disabled={!activeCount || profile.active === false} aria-label={`ลดจำนวน ${typeLabel}`}><span aria-hidden="true">−</span></button><output className="ops-quantity-count" aria-label={`จำนวนใช้งาน ${typeLabel}`}>{activeCount}</output><button type="button" className="ops-quantity-button" onClick={() => changeQuantity(type.value, 1)} disabled={profile.active === false} aria-label={`เพิ่มจำนวน ${typeLabel}`}><span aria-hidden="true">+</span></button></div></div>; })}</div></section>; })}</div>{profile.equipment.length ? <div className="ops-equipment-list"><div className="ops-subsection-heading"><strong>รายละเอียดอุปกรณ์รายตัว</strong><span>จัดตามหมวด BOQ และแก้ Asset No., ตำแหน่ง และ Serial Number ได้จากรายการด้านล่าง</span></div><div className="ops-equipment-group-list">{equipmentGroups.map((group) => { const groupItems = group.types.flatMap((type) => type.items); const activeCount = groupItems.filter((equipment) => equipment.active !== false).length; const inactiveCount = groupItems.length - activeCount; return <section className="ops-equipment-group" key={group.code} aria-labelledby={`station-equipment-group-${group.code}`}><div className="ops-equipment-group-heading"><span className="ops-config-section-code">{group.code}</span><div><h4 id={`station-equipment-group-${group.code}`}>{group.title}</h4><span>{activeCount} ใช้งาน{inactiveCount ? ` · ปิดใช้งาน ${inactiveCount}` : ""} · {groupItems.length} รายการ</span></div></div><div className="ops-equipment-subgroups">{group.types.map((type) => <section className="ops-equipment-subgroup" key={type.value} aria-labelledby={`station-equipment-subgroup-${group.code}-${type.value}`}><div className="ops-equipment-subgroup-heading"><h5 id={`station-equipment-subgroup-${group.code}-${type.value}`}>{getEquipmentTypeDisplayLabel(type)}</h5><span>{type.items.length} รายการ</span></div><div className="ops-equipment-subgroup-items">{type.items.map((equipment) => <EquipmentRow key={equipment.id} equipment={equipment} isReferenced={referenced(equipment.id)} disabled={profile.active === false} onChange={updateEquipment} onRemove={removeEquipment} />)}</div></section>)}</div></section>; })}</div></div> : <EmptyState icon="equipment" title="ยังไม่มีอุปกรณ์ในสถานีนี้">กดปุ่ม + ของประเภทอุปกรณ์ที่ต้องการเพิ่ม</EmptyState>}</div></details>
    <EquipmentChecklistCoverage equipment={activeEquipment} items={masterConfigItems} displaySections={masterConfigSections} stationFormat={profile.stationFormat} /><details id="station-profile-checklist" className="station-profile-disclosure"><summary className="station-profile-disclosure-summary"><span className="station-profile-disclosure-icon"><Icon name="checklist" /></span><span><strong>การตั้งค่า Checklist</strong><small>เปิดหรือปิดรายการตรวจสำหรับสถานีนี้</small></span><span className="station-profile-disclosure-count">{enabledMasterConfigCount}/{masterConfigItems.length} เปิดใช้{disabledMasterConfigCount ? ` · ปิด ${disabledMasterConfigCount}` : ""}</span><span className="station-profile-disclosure-chevron" aria-hidden="true" /></summary><div className="station-profile-disclosure-body ops-checklist-config"><p className="ops-section-description">ค่าเหล่านี้มีผลกับรอบการตรวจใหม่เท่านั้น รายการใน Snapshot และประวัติเดิมจะไม่เปลี่ยน รายการที่ผูกกับระบบหรืออุปกรณ์จะแสดงตามของจริงและขอบเขตที่ติดตั้ง ส่วนงานระดับสถานีจะแสดงพร้อมป้ายบอกระดับ</p><div className="ops-config-list">{masterConfigSections.map((section, sectionIndex) => <details className="ops-config-section" key={section.code} open={sectionIndex === 0}><summary><span className="ops-config-section-code">{section.code}</span><span className="ops-config-section-title">{section.title}</span><small>{section.items.filter((item) => !isMasterConfigDisabled(item)).length}/{section.items.length} รายการ</small></summary><div className="ops-config-items">{section.items.map((item) => { const disabled = isMasterConfigDisabled(item); const scopeMeta = getChecklistScopeMeta(item); return <div className={`ops-config-item ${disabled ? "is-disabled" : ""}`} key={item.id}><div><strong>{item.label}</strong><span>{scopeMeta.label} · {item.unit || "ข้อมูล"} · {disabled ? "ปิดใช้งานสำหรับสถานีนี้" : "ใช้เป็นกติกาของรอบการตรวจใหม่"}</span></div><button type="button" className={`ops-config-toggle ${disabled ? "is-disabled" : "is-enabled"}`} aria-pressed={!disabled} aria-label={`${disabled ? "เปิด" : "ปิด"} ${item.label}`} onClick={() => toggleChecklist(item.id, disabled)}><Icon name={disabled ? "close" : "check"} /><span>{disabled ? "ปิด" : "เปิด"}</span></button></div>; })}</div></details>)}</div></div></details>
    <details className="station-profile-disclosure station-profile-preview-disclosure"><summary className="station-profile-disclosure-summary"><span className="station-profile-disclosure-icon"><Icon name="archive" /></span><span><strong>ตัวอย่างรายการของรอบตรวจใหม่</strong><small>ดูสิ่งที่จะถูกสร้างเมื่อเริ่มรอบการตรวจ</small></span><span className="station-profile-disclosure-count">{previewApplicable} รายการเกี่ยวข้อง</span><span className="station-profile-disclosure-chevron" aria-hidden="true" /></summary><div className="station-profile-disclosure-body"><div className="ops-preview-metrics"><div><strong>{activeEquipment.length}</strong><span>อุปกรณ์จริงที่ใช้งาน</span></div><div><strong>{previewApplicable}</strong><span>รายการตรวจที่เกี่ยวข้อง</span></div><div><strong>{previewNotApplicable}</strong><span>ไม่เกี่ยวข้อง / ปิดใช้งาน</span></div></div><p className="ops-section-description">อุปกรณ์จริงที่เพิ่มเกินแม่แบบจะสร้างรายการต่อจากลำดับสุดท้ายโดยอัตโนมัติ เช่น LPR #4 และ #5</p></div></details>
  </section>;
}

export function EquipmentChecklistCoverage({ equipment, items, onSelectAsset, displaySections = [], stationFormat = "SC" }) {
  return <ChecklistCoverageSummary coverage={getChecklistCoverageSummary({ equipment }, items)} onSelectAsset={onSelectAsset} displaySections={displaySections} stationFormat={stationFormat} />;
}

export function ScContextIcon({ name, size = 20, className = "" }) {
  return <Icon name={getScIconName(name)} pixelSize={size} className={className} />;
}

export function getScAssetTypeDisplayName(equipment) {
  return getEquipmentDisplayLabel(equipment);
}

export function getScAssetTypeEnglishName(equipment) {
  return getEquipmentEnglishLabel(equipment);
}

export function getScSystemCategoryCodes(item) {
  const codes = Array.isArray(item?.checklistMapping) ? item.checklistMapping.filter(Boolean) : [];
  return codes.length ? codes.join(", ") : "—";
}

export const SC_OPERATION_SYSTEM_GROUPS = Object.freeze([
  ...CENTRAL_EQUIPMENT_MAIN_CATEGORIES,
  Object.freeze({ id: "other", label: "Other Systems", description: "ระบบส่วนควบอื่น ๆ", categoryCodes: [], canonicalCategories: [], icon: "other" }),
]);

export function currentStationSystemRows(systems = []) {
  return Array.isArray(systems) ? systems : [];
}

export function getScSystemGroupForCanonical(item) {
  return SC_OPERATION_SYSTEM_GROUPS.find((group) => group.canonicalCategories.includes(item?.category))?.id || "other";
}

export function getScTemplateCategoryCounts(stationFormat) {
  const counts = getDefaultStationEquipmentCounts(stationFormat);
  return ITEM_LIBRARY_CATEGORIES.map((category) => ({
    ...category,
    expected: Object.entries(counts).filter(([type]) => getEquipmentCategoryCode({ type }) === category.code).reduce((total, [, count]) => total + Number(count || 0), 0),
  }));
}

export function isScAssetDataComplete(equipment, activeLanes, stationSystems = [], stationEquipment = []) {
  const location = String(equipment?.location || "").trim();
  const locationReady = Boolean(location && location !== "ระบุตำแหน่ง");
  const wimParent = isWimEquipment(equipment) ? getWimSortingSystemById(stationSystems, equipment?.parentSystemId) : null;
  const laneReady = !isWimEquipment(equipment) || Boolean(wimParent && activeLanes.some((lane) => lane.id === wimParent.laneId) && (!equipment.laneId || equipment.laneId === wimParent.laneId));
  const outputReady = equipment?.type !== "WIM_SWITCHING_DC" || (Array.isArray(equipment?.outputVoltages) && equipment.outputVoltages.length > 0);
  const electronicsHierarchyReady = !getWimElectronicsHierarchyIssue(equipment, stationEquipment, stationSystems);
  return locationReady && isEquipmentDetailComplete(equipment) && laneReady && outputReady && electronicsHierarchyReady;
}

export function ScWizardSystemRail({ groups = [], selectedGroupId, onSelectGroup, groupAttentionCount }) {
  return <aside className="sc-wizard-rail" aria-label="จุดติดตั้งระบบและอุปกรณ์">
    <div className="sc-wizard-rail-heading"><p className="ops-eyebrow">ทะเบียนอุปกรณ์ประจำสถานี</p><h2>จุดติดตั้ง</h2><p>เลือกจุดติดตั้งเพื่อดูระบบและอุปกรณ์ที่ตรงกับขอบเขตงานนั้น</p></div>
    <nav className="sc-wizard-group-list" aria-label="เลือกจุดติดตั้ง">
      {groups.map((group) => {
        const systemCount = group.allSystems.filter((system) => system.active !== false && Number(system.quantity || 0) > 0).length;
        const assetCount = group.allAssets.filter((asset) => asset.active !== false).length;
        const attention = groupAttentionCount(group);
        return <button type="button" key={group.id} className={`sc-wizard-group ${selectedGroupId === group.id ? "is-selected" : ""}`} aria-current={selectedGroupId === group.id ? "true" : undefined} onClick={() => onSelectGroup(group.id)}>
          <span className="sc-wizard-group-icon"><ScContextIcon name={group.icon} size={18} /></span>
          <span className="sc-wizard-group-copy"><strong>{group.label}</strong><small>{group.description}</small><small>{systemCount} ระบบ · {assetCount} อุปกรณ์</small></span>
          {attention > 0 && <span className="sc-wizard-group-attention" aria-label={`${attention} รายการต้องตรวจสอบ`}>{attention}</span>}
        </button>;
      })}
      {!groups.length && <div className="sc-wizard-group-empty">ยังไม่มีหมวดที่มีรายการติดตั้งจริง</div>}
    </nav>
  </aside>;
}

export function StationProfileScWorkspace({ state, profile, setSelected, addStation, updateProfile, notify, onArchiveStation, onPurgeStation, activeEquipment = [], itemCatalog = [], addCatalogEquipment, canonicalItems = [], addCanonicalSystem, updateCanonicalSystem, removeCanonicalSystem, referenced, updateEquipment, removeEquipment, stationRounds = [], masterConfigSections = [], isMasterConfigDisabled, enabledMasterConfigCount = 0, disabledMasterConfigCount = 0, masterConfigItems = [], toggleChecklist, updateStationLanes, assignStationLane, assignWimParentSystem, addStationLane, removeStationLane }) {
  const [tab, setTab] = useState("equipment");
  const [activeCategoryKey, setActiveCategoryKey] = useState("wim-sorting");
  const [filter, setFilter] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedKind, setSelectedKind] = useState("asset");
  const [expandedSystemId, setExpandedSystemId] = useState("sc-wim-hs");
  const [selectedGroupId, setSelectedGroupId] = useState("sc-wim-hs");
  const [showGeneral, setShowGeneral] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addContextGroupId, setAddContextGroupId] = useState(null);
  const [addContextBoqGroupCode, setAddContextBoqGroupCode] = useState("");
  const [addContextCategoryId, setAddContextCategoryId] = useState("");
  const [addContextScope, setAddContextScope] = useState("");
  const [addContextParentSystemId, setAddContextParentSystemId] = useState("");
  const [addContextParentAssetId, setAddContextParentAssetId] = useState("");
  const [addContextEquipmentType, setAddContextEquipmentType] = useState("");
  const [addInitialRecordKind, setAddInitialRecordKind] = useState("");
  const generalRef = useRef(null);
  const activeLanes = (profile?.lanes || []).filter((lane) => lane.active !== false);
  const allAssetEquipment = useMemo(() => sortEquipmentForDisplay((profile?.equipment || []).filter((item) => item.type !== "LANE" && !getEquipmentType(item.type)?.legacyOnly), activeLanes), [profile?.equipment, activeLanes]);
  const activeAssetEquipment = allAssetEquipment.filter((item) => item.active !== false);
  const templateCategories = useMemo(() => getScTemplateCategoryCounts(profile?.stationFormat), [profile?.stationFormat]);
  const templateTotal = templateCategories.reduce((total, category) => total + category.expected, 0);
  const readiness = getStationReadiness(profile);
  const confirmedReady = readiness.ready && Boolean(profile?.readinessConfirmedAt);
  const legacyLaneCount = (profile?.equipment || []).filter((item) => item.type === "LANE").length;
  const pending = activeAssetEquipment.filter((item) => !isScAssetDataComplete(item, activeLanes, profile.stationSystems, allAssetEquipment));
  const typeOptions = Array.from(new Set(allAssetEquipment.map((item) => item.type))).map((value) => ({ value, label: getScAssetTypeDisplayName({ type: value }) }));
  const needsAttention = (item) => item.active !== false && !isScAssetDataComplete(item, activeLanes, profile.stationSystems, allAssetEquipment);
  const filtered = allAssetEquipment.filter((item) => {
    const matchesFilter = filter === "inactive" ? item.active === false : item.active !== false && (filter !== "pending" || needsAttention(item));
    const matchesType = type === "all" || item.type === type;
    const searchable = `${item.assetNo || ""} ${getScAssetTypeDisplayName(item)} ${getScAssetTypeEnglishName(item)} ${item.location || ""}`.toLowerCase();
    return matchesFilter && matchesType && (!query || searchable.includes(query.toLowerCase()));
  });
  const currentCanonicalItems = canonicalItems;
  const systemDefinitionsById = useMemo(() => new Map(currentCanonicalItems.map((item) => [item.id, item])), [currentCanonicalItems]);
  const registeredSystems = profile?.stationSystems || [];
  const visibleStationSystems = currentStationSystemRows(registeredSystems);
  const registerableSystems = visibleStationSystems.filter((system) => system.id !== "present-wim-sorting");
  const relationshipSystemCount = useMemo(() => getStationRelationshipSystemCount({ stationFormat: profile?.stationFormat, systems: registerableSystems }), [profile?.stationFormat, registerableSystems]);
  const wimSystemCount = getWimSortingInstalledQuantity(registeredSystems);
  const blockerAssetIds = new Set((readiness.blockers || []).map((blocker) => blocker.assetId).filter(Boolean));
  const blockerSystemIds = new Set((readiness.blockers || []).map((blocker) => blocker.systemId).filter(Boolean));
  const warningAssetIds = new Set((readiness.warnings || []).map((warning) => warning.assetId).filter(Boolean));
  const warningSystemIds = new Set((readiness.warnings || []).map((warning) => warning.systemId).filter(Boolean));
  const assetRegisterStatus = (asset) => {
    if (asset.active === false) return "inactive";
    if (blockerAssetIds.has(asset.id)) return "blocker";
    if (warningAssetIds.has(asset.id) || !isScAssetDataComplete(asset, activeLanes, profile.stationSystems, allAssetEquipment)) return "warning";
    return "ready";
  };
  const systemRegisterStatus = (system) => {
    if (system.active === false) return "inactive";
    const isWimInstance = isWimSortingSystemRecord(system);
    const complete = Number(system.quantity || 0) > 0 && (!isWimInstance || activeLanes.some((lane) => lane.id === system.laneId));
    if (blockerSystemIds.has(system.id)) return "blocker";
    if (warningSystemIds.has(system.id)) return "warning";
    return complete ? "ready" : "blocker";
  };
  const groupAttentionCount = (group) => [...group.allSystems.map(systemRegisterStatus), ...group.allAssets.map(assetRegisterStatus)].filter((status) => status === "blocker" || status === "warning").length;
  const relationshipTree = useMemo(() => buildStationRelationshipTree({
    stationFormat: profile?.stationFormat,
    systems: registerableSystems.filter((system) => !query || `${getStationSystemLabel(system)} ${getStationSystemEnglishLabel(system)} ${system.displayLabel || ""} ${system.sourceLabel || ""}`.toLowerCase().includes(query.toLowerCase())),
    equipment: filtered,
    includeEmptyGroups: false,
    includeInactive: filter === "inactive",
    includeCatalogOptions: true,
  }), [profile?.stationFormat, registerableSystems, filtered, query, filter]);
  const profileRelationshipTree = useMemo(() => buildStationRelationshipTree({
    stationFormat: profile?.stationFormat,
    systems: registerableSystems,
    equipment: allAssetEquipment,
    includeEmptyGroups: false,
    includeInactive: filter === "inactive",
    includeCatalogOptions: true,
  }), [profile?.stationFormat, registerableSystems, allAssetEquipment, filter]);
  useEffect(() => {
    if (profileRelationshipTree.some((group) => group.groupId === selectedGroupId)) return;
    const firstGroup = profileRelationshipTree[0] || null;
    setSelectedGroupId(firstGroup?.groupId || "");
    setExpandedSystemId(firstGroup?.groupId || "");
    setActiveCategoryKey(firstGroup?.categories[0]?.id || "");
  }, [profileRelationshipTree, selectedGroupId]);
  const visibleOperationalGroups = profileRelationshipTree
    .filter((group) => group.hasData)
    .map((group) => ({
      ...group,
      id: group.groupId,
      label: group.title,
      description: group.description || (group.isUnmapped ? "รายการจริงที่ยังไม่มีตำแหน่งในผังสถานี" : `กลุ่ม ${profile.stationFormat || "SC"} ตามแบบสถานี`),
      icon: group.isUnmapped ? "other" : "system",
      allSystems: group.categories.flatMap((category) => category.systems),
      allAssets: group.categories.flatMap((category) => category.assets),
    }));
  const selectedGroup = visibleOperationalGroups.find((group) => group.id === selectedGroupId) || visibleOperationalGroups[0] || null;
  const relationshipGroupForCategory = (categoryId, scope = "") => {
    const point = findStationWorkpoint(profile?.stationFormat, categoryId, scope);
    if (point) {
      const matchingPoint = profileRelationshipTree.find((group) => group.workpointId === point.id);
      if (matchingPoint) return matchingPoint;
    }
    if (scope) {
      const matchingScope = profileRelationshipTree.find((group) => group.categories.some((category) => category.id === categoryId
        && category.scopes.some((entry) => String(entry.scope || "").trim().toLocaleLowerCase() === String(scope).trim().toLocaleLowerCase())));
      if (matchingScope) return matchingScope;
    }
    return profileRelationshipTree.find((group) => group.categories.some((category) => category.id === categoryId && category.hasData))
    || profileRelationshipTree.find((group) => group.categories.some((category) => category.id === categoryId))
    || profileRelationshipTree[0] || null;
  };
  const relationshipLocationForRecord = (recordId, kind) => {
    for (const group of profileRelationshipTree) {
      const category = group.categories.find((entry) => {
        const records = kind === "system" ? entry.systems : entry.assets;
        return records.some((record) => String(record.id) === String(recordId));
      });
      if (category) return { group, category };
    }
    return null;
  };
  const closedRounds = stationRounds.filter((round) => round.status === "closed");
  const directionLabel = { inbound: "ขาเข้า", outbound: "ขาออก", both: "ทั้งสองทิศทาง", unspecified: "ไม่ระบุ" }[profile?.direction] || profile?.direction || "ไม่ระบุ";
  const switchTab = (nextTab) => { setTab(nextTab); if (nextTab !== "equipment") setSelectedId(null); };
  const selectItem = (id, kind = "asset", systemGroupId = null, scope = "") => {
    setSelectedId(id);
    setSelectedKind(kind);
    if (systemGroupId) {
      const nextGroup = relationshipGroupForCategory(systemGroupId, scope);
      if (nextGroup) {
        setSelectedGroupId(nextGroup.groupId);
        setExpandedSystemId(nextGroup.groupId);
        setActiveCategoryKey(nextGroup.categories.find((category) => category.id === systemGroupId)?.id || nextGroup.categories[0]?.id || "");
      }
    }
    setTab("equipment");
  };
  const closeEditor = () => {
    const id = selectedId;
    const kind = selectedKind;
    setSelectedId(null);
    requestAnimationFrame(() => document.getElementById(`sc-${kind}-row-${id}`)?.querySelector("button")?.focus());
  };
  const renderProfileWorkSpecEditor = (record, kind) => {
    const location = relationshipLocationForRecord(record.id, kind);
    const category = location?.category;
    const definition = kind === "asset"
      ? currentCanonicalItems.find((item) => item.kind === "asset" && item.equipmentType === record.type)
      : systemDefinitionsById.get(record.canonicalItemId);
    const options = kind === "asset" ? (category?.equipmentOptions || []) : (category?.systemOptions || []);
    const workSpecOption = options.find((item) => kind === "asset"
      ? String(item.equipmentType || "").toUpperCase() === String(record.type || "").toUpperCase()
        && (!record.scope || !item.scope || String(item.scope) === String(record.scope))
      : item.canonicalItemId === record.canonicalItemId
        && (!record.scope || !item.scope || String(item.scope) === String(record.scope)));
    const contextScope = String(workSpecOption?.scope || "").trim();
    const scopeChoices = (definition?.allowedScopes || (kind === "asset" ? equipmentScopeChoices(record.type) : []))
      .filter((scope) => profile.stationFormat === "IMPS" ? !["High Speed", "Low Speed"].includes(scope) : !["ImPS", "Image Processing"].includes(scope));
    const ownerSystemIds = Array.isArray(definition?.systemIds) ? definition.systemIds : [];
    const isLprCamera = kind === "asset" && String(record.type || "").toUpperCase() === "LPR_CAMERA";
    const isLprSystem = kind === "system" && String(record.canonicalItemId || record.systemId || "") === "lpr-control";
    const ownerSystemOptions = kind === "asset" && ownerSystemIds.length && !isWimEquipment(record) && !isWimElectronicsSubEquipmentType(record.type)
      ? registeredSystems.filter((system) => system.active !== false
        && ownerSystemIds.includes(system.canonicalItemId || system.systemId)
        && (!contextScope || String(system.scope || "") === contextScope)
        && (!isLprCamera || system.id === record.parentSystemId || (String(system.canonicalItemId || system.systemId || "") === "lpr-control"
          && activeLanes.some((lane) => lane.id === system.laneId)
          && !allAssetEquipment.some((asset) => asset.type === "LPR_CAMERA" && asset.id !== record.id && asset.parentSystemId === system.id))))
        .map((system) => isLprCamera ? { ...system, laneLabel: `Lane ${activeLanes.find((lane) => lane.id === system.laneId)?.laneNo || "—"}` } : system)
      : [];
    const parentScope = String(contextScope || record.scope || "").trim();
    const wimParentOptions = kind === "asset" && isWimEquipment(record)
      ? getWimSortingSystemInstances(registeredSystems).filter((system) => system.active !== false
        && (!parentScope || String(system.scope || "") === parentScope)
        && activeLanes.some((lane) => lane.id === system.laneId))
        .map((system) => ({
          id: system.id,
          laneId: system.laneId,
          scope: system.scope,
          laneLabel: `Lane ${activeLanes.find((lane) => lane.id === system.laneId)?.laneNo || "—"}`,
          label: `WIM Sorting System #${system.instanceNo || "?"} · Lane ${activeLanes.find((lane) => lane.id === system.laneId)?.laneNo || "—"} · ${system.scope || "ไม่ระบุ Scope"}`,
        }))
      : [];
    const cabinetOptions = kind === "asset" && isWimElectronicsSubEquipmentType(record.type)
      ? allAssetEquipment.filter((asset) => asset.type === "CONTROL_CABINET" && asset.active !== false
        && (!parentScope || !asset.scope || String(asset.scope) === parentScope))
      : [];
    const electronicsSystemOptions = kind === "asset" && (record.type === "CONTROL_CABINET" || isWimElectronicsSubEquipmentType(record.type))
      ? registeredSystems.filter((system) => system.active !== false
        && ((system.canonicalItemId || system.systemId) === "wim-electronics-system" || (system.systemId === "wim" && system.componentId === "electronics"))
        && (!parentScope || !system.scope || String(system.scope) === parentScope))
      : [];
    const laneOptions = kind === "system" && isWimSortingSystemRecord(record)
      ? activeLanes.filter((lane) => !getWimSortingSystemInstances(registeredSystems).some((system) => system.id !== record.id && system.laneId === lane.id))
      : isLprSystem ? activeLanes.filter((lane) => !registeredSystems.some((system) => system.id !== record.id && String(system.canonicalItemId || system.systemId || "") === "lpr-control" && system.active !== false && system.laneId === lane.id)
        && String(getLaneScope(lane, registeredSystems) || "").trim() === String(contextScope || record.scope || "").trim()) : [];
    if (kind === "system" && isWimSortingSystemRecord(record) && record.laneId && !laneOptions.some((lane) => lane.id === record.laneId)) {
      const currentLane = (profile.lanes || []).find((lane) => lane.id === record.laneId);
      if (currentLane) laneOptions.unshift(currentLane);
    }
    if (isLprSystem && record.laneId && !laneOptions.some((lane) => lane.id === record.laneId)) {
      const currentLane = (profile.lanes || []).find((lane) => lane.id === record.laneId);
      if (currentLane) laneOptions.unshift(currentLane);
    }
    const parent = kind === "asset" && isWimEquipment(record) ? getWimSortingSystemById(registeredSystems, record.parentSystemId) : null;
    const lprParent = kind === "asset" && isLprCamera ? registeredSystems.find((system) => system.id === record.parentSystemId && String(system.canonicalItemId || system.systemId || "") === "lpr-control") : null;
    const assetParent = parent || lprParent;
    const parentLane = assetParent ? activeLanes.find((lane) => lane.id === assetParent.laneId) : null;
    const relationshipText = assetParent ? `${getStationSystemDisplayLabel(assetParent)} · Lane ${parentLane?.laneNo || "—"}` : (kind === "asset" && (isWimEquipment(record) || isLprCamera) ? "ยังไม่ผูกระบบแม่" : "");
    const path = location
      ? getRelationshipPath({ format: profile.stationFormat, groupCode: location.group.code, categoryId: category.id, kind })
      : "รายการนอก Work Spec";
    const validateAssetNo = kind === "asset"
      ? (assetNo) => validateEquipmentDraft({ assetNo }, profile.equipment, { excludeId: record.id }).errors.assetNo || ""
      : undefined;
    const save = (edited) => {
      if (kind === "asset") {
        const fields = ["assetNo", "location", "serialNo", "serialStatus", "serialReason", "parentSystemId", "parentAssetId", "scope", "laneId", "outputVoltages", "active"];
        const patch = Object.fromEntries(fields.filter((field) => Object.prototype.hasOwnProperty.call(edited, field)).map((field) => [field, edited[field]]));
        updateEquipment?.(record.id, patch);
      } else {
        for (const field of ["displayLabel", "scope", "quantity", "unit", "note", "laneId"]) {
          if (Object.prototype.hasOwnProperty.call(edited, field)) updateCanonicalSystem?.(record.id, field, edited[field]);
        }
      }
      setSelectedId(null);
    };
    return <div className="sc-work-spec-inline" aria-label={`แก้ไขรายการติดตั้งจริง ${path}`}>
      <div className="sc-work-spec-inline-heading">
        <p className="ops-eyebrow">ทะเบียนอุปกรณ์ประจำสถานี · แก้ไขรายการติดตั้งจริง</p>
        <strong>{path}</strong>
        {category?.description && <small>{category.description}</small>}
      </div>
      <StationRelationshipInlineEditor
        key={`${kind}-${record.id}`}
        record={record}
        kind={kind}
        label={kind === "asset" ? getScAssetTypeDisplayName(record) : getStationSystemDisplayLabel(record)}
        scopeChoices={scopeChoices}
        laneOptions={laneOptions}
        lprSystemRequiresLane={isLprSystem}
        onAddLane={isLprSystem ? (scope) => addStationLane?.(scope) : undefined}
        wimParentOptions={wimParentOptions}
        ownerSystemOptions={ownerSystemOptions}
        ownerSystemRequired={Boolean(ownerSystemIds.length && !isWimEquipment(record) && !isWimElectronicsSubEquipmentType(record.type))}
        cabinetOptions={cabinetOptions}
        electronicsSystemOptions={electronicsSystemOptions}
        contextScope={contextScope}
        relationshipText={relationshipText}
        validateAssetNo={validateAssetNo}
        disabled={profile.active === false}
        showActivation={kind === "asset"}
        showSerialReason={kind === "asset"}
        showSystemDetails={kind === "system"}
        saveHint="บันทึกการแก้ไขลงทะเบียนสถานีนี้"
        onSave={save}
        onCancel={closeEditor}
      />
    </div>;
  };
  useEffect(() => {
    if (!selectedId) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeEditor();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedId, selectedKind]);
  const openGeneral = () => {
    setShowMoreMenu(false);
    setShowGeneral(true);
  };
  const openAddPanel = (groupId = null, initialRecordKind = "", requestedBoqGroupCode = "", initialParentSystemId = "", requestedScope = "") => {
    const categoryToOperationGroup = {
      "wim-sorting": "wim", "wim-control": "wim", "wim-electronics": "wim", "wim-data-control": "data-control",
      "display-processing": "data-control", data: "data-control",
    };
    const relationshipGroup = profileRelationshipTree.find((group) => group.groupId === groupId)
      || (groupId ? relationshipGroupForCategory(groupId, requestedScope) : null);
    const categoryId = relationshipGroup?.categories.some((category) => category.id === groupId)
      ? groupId
      : relationshipGroup?.categories[0]?.id || null;
    const isRelationshipCategory = Boolean(categoryId && relationshipGroup?.categories.some((category) => category.id === categoryId));
    const normalizedGroupId = categoryToOperationGroup[categoryId] || categoryId;
    const nextGroupId = typeof normalizedGroupId === "string" && SC_OPERATION_SYSTEM_GROUPS.some((group) => group.id === normalizedGroupId) ? normalizedGroupId : null;
    setAddContextGroupId(nextGroupId);
    setAddContextBoqGroupCode(String(requestedBoqGroupCode || ""));
    setAddContextCategoryId(isRelationshipCategory ? categoryId : "");
    setAddContextScope(String(requestedScope || relationshipGroup?.scope || "").trim());
    setAddContextParentSystemId(String(initialParentSystemId || ""));
    setAddContextParentAssetId("");
    setAddContextEquipmentType("");
    setAddInitialRecordKind(initialRecordKind === "asset" || initialRecordKind === "system" ? initialRecordKind : "");
    if (relationshipGroup) {
      setSelectedGroupId(relationshipGroup.groupId);
      setExpandedSystemId(relationshipGroup.groupId);
      setActiveCategoryKey(relationshipGroup.categories.find((category) => category.id === categoryId)?.id || relationshipGroup.categories[0]?.id || "");
    }
    setShowAddPanel(true);
  };
  const openRelationshipAddPanel = (categoryId, recordKind, option) => {
    openAddPanel(categoryId, recordKind, "", option?.parentId || "", option?.scope || "");
    setAddContextParentAssetId(option?.parentAssetId || "");
    setAddContextEquipmentType(option?.equipmentType || option?.type || "");
  };
  const openReadiness = (blocker) => {
    const copy = readinessBlockerCopy(blocker);
    switchTab(copy.tab === "general" ? "equipment" : copy.tab);
    if (copy.tab === "equipment") {
      if (blocker?.systemId) {
        const location = relationshipLocationForRecord(blocker.systemId, "system");
        if (location) {
          setFilter("all");
          setType("all");
          setQuery("");
          setSelectedId(blocker.systemId);
          setSelectedKind("system");
          setSelectedGroupId(location.group.groupId);
          setExpandedSystemId(location.group.groupId);
          setActiveCategoryKey(location.category.id);
        }
      } else {
        const asset = allAssetEquipment.find((item) => item.id === blocker?.assetId) || pending[0];
        if (asset) openAssetRecord(asset.id);
      }
    }
  };
  const openAssetRecord = (assetId) => {
    const asset = allAssetEquipment.find((item) => item.id === assetId);
    const location = asset ? relationshipLocationForRecord(asset.id, "asset") : null;
    if (!asset || !location) return;
    setFilter("all");
    setType("all");
    setQuery("");
    setTab("equipment");
    setSelectedId(asset.id);
    setSelectedKind("asset");
    setSelectedGroupId(location.group.groupId);
    setExpandedSystemId(location.group.groupId);
    setActiveCategoryKey(location.category.id);
  };
  const blockerGroups = Object.values((readiness.blockers || []).reduce((groups, blocker) => {
    const key = blocker.code || "UNKNOWN";
    if (!groups[key]) groups[key] = { ...blocker, count: 0 };
    groups[key].count += 1;
    return groups;
  }, {}));

  useEffect(() => {
    setTab("equipment");
    setFilter("all");
    setType("all");
    setQuery("");
    setShowGeneral(false);
    setShowMoreMenu(false);
    setShowAddPanel(false);
    setAddContextGroupId(null);
    setAddContextBoqGroupCode("");
    setAddContextCategoryId("");
    setAddContextScope("");
    setAddContextParentSystemId("");
    setAddInitialRecordKind("");
    setSelectedId(null);
    setSelectedKind("asset");
    setActiveCategoryKey(profile?.stationFormat === "IMPS" ? "image-processing" : "wim");
    setExpandedSystemId(profile?.stationFormat === "IMPS" ? "imps-image-processing" : "sc-wim-hs");
    const initialGroup = profile?.stationFormat === "IMPS" ? "imps-image-processing" : "sc-wim-hs";
    setSelectedGroupId(initialGroup);
  }, [profile?.id]);

  useEffect(() => {
    if (!selectedId) return;
    const exists = selectedKind === "asset" ? allAssetEquipment.some((item) => item.id === selectedId) : registerableSystems.some((item) => item.id === selectedId);
    if (!exists) setSelectedId(null);
  }, [allAssetEquipment, registeredSystems, selectedId, selectedKind]);

  if (!profile) return <section className="ops-page station-profile-redesign"><Breadcrumb items={[{ label: "ทะเบียนสถานี", href: "#/stations" }, { label: "รายละเอียดสถานี" }]} /><section className="ops-panel station-profile-empty"><div className="ops-panel-toolbar"><StationSelect profiles={state.stationProfiles} value={profile?.id} onChange={setSelected} label="สถานีที่กำลังแก้ไข" includeInactive /></div><EmptyState title="ยังไม่มีสถานี" action={<Button onClick={addStation} variant="primary" icon="plus">สร้างสถานี</Button>}>สร้างสถานีแรกเพื่อเริ่มเพิ่มอุปกรณ์</EmptyState></section></section>;

  return <StationProfileEquipmentContext.Provider value={{ canonicalItems, stationEquipment: allAssetEquipment, stationSystems: profile.stationSystems || [] }}><section className="ops-page sc-station-workspace">
    <Breadcrumb items={[{ label: "ทะเบียนสถานี", href: "#/stations" }, { label: "รายการสถานี", href: "#/stations" }, { label: profile.stationName || profile.stationCode, mono: true }]} />
    <header className="sc-station-header">
      <div className="sc-station-heading"><p className="ops-eyebrow">STATION PROFILE</p><div className="sc-title-line"><span className="sc-title-icon"><Icon name="pin" pixelSize={22} /></span><div><h1>{profile.stationName || "รายละเอียดสถานี"}</h1><p><span className="ops-code">{profile.stationCode || "ยังไม่มีรหัส"}</span><span className="sc-meta-divider">|</span><span>{profile.stationFormat === "SC" ? "SC — Spot Check · รองรับ VMS" : getStationFormatDefinition(profile.stationFormat).label}</span><span className="sc-meta-divider">|</span><span>{directionLabel}</span>{profile.province && <><span className="sc-meta-divider">|</span><span>{profile.province}</span></>}</p></div></div></div>
      <div className="sc-header-actions"><button type="button" className="ops-button ops-button-secondary sc-more-menu-toggle" aria-haspopup="menu" aria-expanded={showMoreMenu} onClick={() => setShowMoreMenu((current) => !current)}><Icon name="dots" />เพิ่มเติม</button>{showMoreMenu && <div className="sc-more-menu" role="menu" aria-label="เมนูเพิ่มเติมของสถานี"><button type="button" role="menuitem" onClick={openGeneral}><Icon name="settings" /><span><strong>ข้อมูลสถานีและ Vehicle API</strong><small>รหัส ชื่อ จังหวัด ทิศทาง และการเชื่อมต่อ</small></span></button><button type="button" role="menuitem" onClick={() => { setShowMoreMenu(false); onArchiveStation(profile); }}><Icon name={profile.active === false ? "check" : "archive"} /><span><strong>{profile.active === false ? "เปิดใช้งานสถานี" : "ปิดใช้งานสถานี"}</strong><small>{profile.active === false ? "นำสถานีกลับเข้าสู่ทะเบียนใช้งาน" : "ซ่อนจากการใช้งานใหม่โดยไม่ลบข้อมูล"}</small></span></button><button type="button" role="menuitem" className="is-danger" onClick={() => { setShowMoreMenu(false); onPurgeStation(profile); }}><Icon name="delete" /><span><strong>ลบสถานีถาวร</strong><small>ใช้เมื่อแน่ใจว่าไม่ต้องเก็บข้อมูลสถานีนี้แล้ว</small></span></button></div>}<div className="sc-updated"><Icon name="calendar" pixelSize={16} /><span>บันทึกอัตโนมัติ · ข้อมูลปัจจุบัน</span></div></div>
    </header>
    <section className="sc-metrics" aria-label="สรุปข้อมูลสถานี">
      <article><span className="sc-metric-icon is-blue"><Icon name="equipment" pixelSize={22} /></span><div><strong>{activeAssetEquipment.length}</strong><span>Asset ติดตั้งจริง</span><small>อุปกรณ์จริงที่ลงทะเบียน</small></div></article>
      <article><span className="sc-metric-icon is-blue"><Icon name="system" pixelSize={22} /></span><div><strong>{relationshipSystemCount}</strong><span>System</span><small>ระบบที่แสดงในผัง · WIM {wimSystemCount} ระบบติดตั้งจริง</small></div></article>
      <article><span className="sc-metric-icon is-blue"><Icon name="lane" pixelSize={22} /></span><div><strong>{activeLanes.length}</strong><span>Lane</span><small>ช่องทางที่ใช้งาน</small></div></article>
      <article><span className="sc-metric-icon is-blue"><Icon name="checklist" pixelSize={22} /></span><div><strong>{templateTotal}</strong><span>อุปกรณ์ตามแบบ {profile.stationFormat || "SC"}</span><small>จำนวนอุปกรณ์อ้างอิง ไม่ใช่จำนวนรายการตรวจ</small></div></article>
      <article className={readiness.blockers.length || readiness.warnings?.length ? "is-warning" : "is-ready"}><span className="sc-metric-icon is-warning"><Icon name="alert" pixelSize={22} /></span><div><strong>{readiness.blockers.length}</strong><span>รายการบล็อก</span><small>คำเตือนข้อมูล {readiness.warnings?.length || 0} รายการ</small></div></article>
    </section>
    <section className={`sc-readiness ${readiness.blockers.length ? "has-blockers" : readiness.warnings?.length ? "has-warnings" : confirmedReady ? "is-ready" : "is-unconfirmed"}`} aria-labelledby="sc-readiness-title">
      <div className="sc-readiness-icon"><Icon name={confirmedReady && !readiness.blockers.length && !readiness.warnings?.length ? "check" : "alert"} pixelSize={24} /></div><div className="sc-readiness-copy"><p className="ops-eyebrow">READINESS CHECK</p><h2 id="sc-readiness-title">{confirmedReady && !readiness.blockers.length && !readiness.warnings?.length ? "สถานีพร้อมสร้างรอบตรวจ" : readiness.warnings?.length && !readiness.blockers.length ? "พร้อมสร้างรอบตรวจ แต่มีคำเตือน" : "ความพร้อมก่อนสร้างรอบตรวจ"}</h2><p>{readiness.blockers.length ? `พบรายการที่บล็อกการสร้างรอบ ${readiness.blockers.length} รายการ กรุณาตรวจสอบและดำเนินการ` : readiness.warnings?.length ? `มีคำเตือนข้อมูล ${readiness.warnings.length} รายการ ซึ่งไม่บล็อกการสร้างรอบใหม่ แต่ควรตรวจสอบก่อนเริ่มงาน` : confirmedReady ? "ข้อมูลทะเบียนพร้อมใช้สำหรับรอบใหม่ และประวัติเดิมจะไม่ถูกเปลี่ยน" : "ตรวจข้อมูลให้ครบ แล้วกดยืนยันความพร้อมก่อนสร้างรอบตรวจ"}</p></div><div className="sc-readiness-actions">{readiness.blockers.length ? <button type="button" className="ops-button ops-button-secondary" onClick={() => openReadiness(readiness.blockers[0])}>ดูรายการที่ต้องแก้ <Icon name="arrow" /></button> : !confirmedReady && <button type="button" className="ops-button ops-button-primary" onClick={() => updateProfile("readinessConfirmedAt", new Date().toISOString())}>ยืนยันความพร้อม</button>}</div>
      {blockerGroups.length > 0 && <div className="sc-readiness-reasons">{blockerGroups.map((blocker) => { const copy = readinessBlockerCopy(blocker); return <button type="button" key={blocker.code} onClick={() => openReadiness(blocker)}><span><Icon name="alert" size="small" /><strong>{copy.label}</strong><small>{blocker.count > 1 ? `${blocker.count} รายการ · ` : ""}{blocker.message}</small></span><Icon name="arrow" size="small" /></button>; })}</div>}
      {readiness.warnings?.length > 0 && <details className="sc-readiness-warnings"><summary>คำเตือนข้อมูล {readiness.warnings.length} รายการ</summary><ul>{readiness.warnings.map((warning, index) => {
        const asset = allAssetEquipment.find((entry) => entry.id === warning.assetId);
        const description = warning.missingFields?.length ? `ขาดข้อมูล: ${warning.missingFields.join(" · ")}` : warning.message || warning.label || String(warning);
        return <li key={`${warning.code || "warning"}-${warning.assetId || index}`}><span><strong>{asset ? `${asset.assetNo || "ไม่มี Asset No."} · ${getScAssetTypeDisplayName(asset)}` : warning.label || "คำเตือนข้อมูล"}</strong><small>{description}</small></span>{asset && <button type="button" className="sc-warning-edit" onClick={() => openAssetRecord(asset.id)}>เปิดอุปกรณ์</button>}</li>;
      })}</ul></details>}
    </section>
    <section className="station-profile-workspace-context" aria-live="polite" aria-label="Workspace ปัจจุบัน">
      <div className="station-profile-workspace-context-copy"><p className="ops-eyebrow">CURRENT WORKSPACE</p><span className="station-profile-workspace-breadcrumb" aria-label="ตำแหน่งปัจจุบัน">{profile.stationCode || profile.stationName || "สถานี"} › {selectedGroup?.label || "Installation Point"} › Equipment</span><strong>{selectedGroup?.label || "เลือกจุดติดตั้ง"}</strong><span>{selectedGroup?.description || "เลือกจุดติดตั้งเพื่อดูระบบและอุปกรณ์ที่เกี่ยวข้อง"}</span></div>
      <div className="station-profile-workspace-context-meta"><span>สถานี {profile.stationCode || "—"}</span><span>{(selectedGroup?.systemCount || 0) + (selectedGroup?.assetCount || 0)} รายการจริง</span><span className={`station-category-status is-${selectedGroup?.hasData ? "ready" : "empty"}`}>{selectedGroup?.hasData ? "มีรายการจริง" : "ยังไม่มีรายการ"}</span></div>
    </section>
    <nav className="sc-tabs" aria-label="ข้อมูลสถานี">
      {[{ id: "equipment", label: "ระบบและอุปกรณ์", icon: "system" }, { id: "lane", label: "ข้อมูล Lane", icon: "lane" }, { id: "checklist", label: "รายการตรวจสอบ (Checklist)", icon: "checklist" }, { id: "snapshot", label: "ประวัติ/ภาพถ่าย (Snapshot)", icon: "archive" }].map(({ id, label, icon }) => <button type="button" key={id} className={tab === id ? "is-active" : ""} aria-pressed={tab === id} onClick={() => switchTab(id)}><Icon name={icon} pixelSize={18} /><span>{label}</span></button>)}
    </nav>
    {tab === "equipment" && <div className="sc-workspace">
      <ScWizardSystemRail groups={visibleOperationalGroups} selectedGroupId={selectedGroup?.id} onSelectGroup={(id) => { const nextGroup = profileRelationshipTree.find((group) => group.groupId === id); setSelectedGroupId(id); setActiveCategoryKey(nextGroup?.categories[0]?.id || (id === "unmapped" ? "unmapped" : "")); setExpandedSystemId(id); setSelectedId(null); }} groupAttentionCount={groupAttentionCount} />
      <section className="sc-register" aria-labelledby="sc-equipment-title">
         <div className="sc-register-heading"><div><p className="ops-eyebrow">ทะเบียนติดตั้งจริง · STATION PROFILE</p><h2 id="sc-equipment-title">อุปกรณ์ประจำสถานี</h2><p>จัดการระบบและอุปกรณ์ตามจุดติดตั้งและ Scope ที่กำหนด การแก้ไขมีผลกับรอบตรวจใหม่ ส่วน Snapshot เดิมคงข้อมูลตามวันที่ตรวจ</p></div><div className="sc-register-heading-actions"><span className="sc-register-total"><strong>{activeAssetEquipment.length + registerableSystems.length}</strong><small>ติดตั้งจริง</small></span><Button onClick={() => openAddPanel(selectedGroup?.id || null, "")} variant="primary" icon="plus" disabled={profile.active === false}>เพิ่มรายการ</Button></div></div>
        <div className="sc-register-view-note"><span className="sc-view-dot" />แสดงเฉพาะหมวดที่มีระบบหรืออุปกรณ์ในทะเบียนสถานี</div>
        <div className="sc-register-toolbar"><label className="sc-search"><Icon name="search" /><span className="sr-only">ค้นหาระบบหรืออุปกรณ์</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อระบบ อุปกรณ์ หรือรหัส Asset No." /></label><div className="sc-filter-chips" role="group" aria-label="กรองสถานะอุปกรณ์">{[{ id: "all", label: "ทั้งหมด" }, { id: "pending", label: "ต้องแก้ไข", count: pending.length }, { id: "inactive", label: "ปิดใช้งาน" }].map((option) => <button type="button" key={option.id} className={filter === option.id ? "is-active" : ""} aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}{option.count !== undefined ? ` ${option.count}` : ""}</button>)}</div><label className="sc-type-filter"><span className="sr-only">กรองประเภทอุปกรณ์</span><CustomSelect label="กรองประเภทอุปกรณ์" value={type} onChange={(event) => setType(event.target.value)}><option value="all">ทุกประเภท</option>{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CustomSelect></label></div>
        <p className="sc-result-note">แสดง {relationshipTree.reduce((total, group) => total + group.systemCount, 0)} System · {relationshipTree.reduce((total, group) => total + group.assetCount, 0)} Asset ตามผังความสัมพันธ์ · WIM Sorting System ติดตั้งจริง {wimSystemCount} ระบบ{legacyLaneCount ? ` · มีข้อมูล Lane เดิม ${legacyLaneCount} รายการ (ดูแท็บข้อมูล Lane)` : ""}</p>
        <StationRelationshipRegister tree={relationshipTree} expandedGroupId={expandedSystemId} onToggleGroup={(id) => { const nextGroup = profileRelationshipTree.find((group) => group.groupId === id); setSelectedGroupId(id); setActiveCategoryKey(nextGroup?.categories[0]?.id || ""); setExpandedSystemId((current) => current === id ? "" : id); }} onAdd={openRelationshipAddPanel} selectedId={selectedId} selectedKind={selectedKind} editingId={selectedId} editingKind={selectedKind} renderInlineEditor={renderProfileWorkSpecEditor} onSelect={selectItem} onDelete={(record, kind) => kind === "asset" ? removeEquipment?.(record) : removeCanonicalSystem?.(record.id)} activeLanes={activeLanes} stationSystems={profile.stationSystems} systemDefinitionsById={systemDefinitionsById} showMissingRows={false} activeCategoryKey={activeCategoryKey} getSystemDisplayLabel={getStationSystemDisplayLabel} getAssetDisplayLabel={getScAssetTypeDisplayName} isWimEquipment={isWimEquipment} getWimSortingSystemById={getWimSortingSystemById} isWimSortingSystemRecord={isWimSortingSystemRecord} isScAssetDataComplete={isScAssetDataComplete} assetStatusFor={assetRegisterStatus} systemStatusFor={systemRegisterStatus} getRelationshipPath={getRelationshipPath} onEditLane={profile.active === false ? undefined : () => switchTab("lane")} onDeleteLane={profile.active === false ? undefined : removeStationLane} />
      </section>
    </div>}
    {tab === "lane" && <section className="sc-resource-panel"><div className="sc-panel-heading"><span className="sc-panel-icon"><Icon name="lane" pixelSize={22} /></span><div><p className="ops-eyebrow">LANE TOPOLOGY</p><h2>ข้อมูล Lane</h2><p>Lane เป็นโครงสร้างช่องทาง แยกจาก Asset และ WIM Sorting System ใช้ผูกกับ Sensor / Loop เฉพาะ WIM</p></div></div><div className="sc-lane-note"><Icon name="info" pixelSize={18} /><span>ข้อมูล Lane เดิม {legacyLaneCount} รายการถ้ามี จะไม่ถูกรวมในตาราง Asset</span></div><LaneAssignmentStep stationFormat={profile.stationFormat} lanes={profile.lanes} equipment={activeAssetEquipment} stationSystems={profile.stationSystems} disabled={profile.active === false} showHeading={false} onChangeLanes={updateStationLanes} onAssignLane={assignStationLane} onAssignParentSystem={assignWimParentSystem} onAddLane={addStationLane} onRemoveLane={removeStationLane} /></section>}
    {tab === "checklist" && <section className="sc-resource-panel"><div className="sc-panel-heading"><span className="sc-panel-icon"><Icon name="checklist" pixelSize={22} /></span><div><p className="ops-eyebrow">CHECKLIST COVERAGE</p><h2>รายการตรวจสอบ (Checklist)</h2><p>ชื่อหมวดอ้างอิงจาก Checklist Copy และค่าเปิด/ปิดมีผลกับรอบใหม่เท่านั้น</p></div></div><EquipmentChecklistCoverage equipment={activeAssetEquipment} items={masterConfigItems} displaySections={masterConfigSections} stationFormat={profile.stationFormat} onSelectAsset={(asset) => openAssetRecord(asset.id)} /><div className="ops-config-list sc-checklist-list">{masterConfigSections.map((section, sectionIndex) => <details className="ops-config-section" key={section.code} open={sectionIndex === 0}><summary><span className="ops-config-section-code">{section.code}</span><span className="ops-config-section-title">{section.title}</span><small>{section.items.filter((item) => !isMasterConfigDisabled(item)).length}/{section.items.length} รายการ</small></summary><div className="ops-config-items">{section.items.map((item) => { const disabled = isMasterConfigDisabled(item); return <div className={`ops-config-item ${disabled ? "is-disabled" : ""}`} key={item.id}><div><strong>{item.label}</strong><span>{item.unit || "ข้อมูล"} · {disabled ? "ปิดใช้งานสำหรับสถานีนี้" : "ใช้เป็นกติกาของรอบการตรวจใหม่"}</span></div><button type="button" className={`ops-config-toggle ${disabled ? "is-disabled" : "is-enabled"}`} aria-pressed={!disabled} onClick={() => toggleChecklist(item.id, disabled)}><Icon name={disabled ? "close" : "check"} /><span>{disabled ? "ปิด" : "เปิด"}</span></button></div>; })}</div></details>)}</div></section>}
    {tab === "snapshot" && <section className="sc-resource-panel"><div className="sc-panel-heading"><span className="sc-panel-icon"><Icon name="archive" pixelSize={22} /></span><div><p className="ops-eyebrow">READ-ONLY HISTORY</p><h2>ประวัติ/ภาพถ่าย (Snapshot)</h2><p>Snapshot เป็นข้อมูลประจำรอบแบบอ่านอย่างเดียว ไม่ถูกเขียนทับจากการแก้ทะเบียนปัจจุบัน</p></div></div>{closedRounds.length ? <div className="sc-snapshot-list">{closedRounds.map((round) => <a className="sc-snapshot-card" key={round.id} href={`#/history/${encodeURIComponent(round.id)}`}><span className="sc-snapshot-card-icon"><Icon name="archive" pixelSize={20} /></span><span><strong>{round.name || round.title || `รอบตรวจ ${formatDateTime(round.startedAt || round.createdAt)}`}</strong><small>{formatDateTime(round.closedAt || round.updatedAt || round.createdAt)} · Snapshot {round.snapshot?.equipment?.length || 0} Asset · {round.snapshot?.attachments ? "มีไฟล์แนบ" : "ไม่มีไฟล์แนบ"}</small></span><Icon name="arrow" /></a>)}</div> : <EmptyState icon="archive" title="ยังไม่มีประวัติที่ปิดรอบ">เมื่อปิดรอบตรวจแล้ว Snapshot และภาพถ่ายจะแสดงที่นี่</EmptyState>}</section>}
    <details ref={generalRef} className="sc-general-panel" open={showGeneral} onToggle={(event) => setShowGeneral(event.currentTarget.open)}><summary><span><Icon name="settings" /><strong>ข้อมูลสถานีและการตั้งค่าขั้นสูง</strong><small>รหัส ชื่อ จังหวัด ทิศทาง รูปแบบสถานี และ Vehicle API</small></span><span className="sc-general-count">{showGeneral ? "ปิดแผง" : "เปิดจากเมนูเพิ่มเติม"}</span></summary><div className="sc-general-body"><div className="ops-form-grid"><StationSelect profiles={state.stationProfiles} value={profile.id} onChange={setSelected} label="สถานีที่กำลังแก้ไข" includeInactive /><label className="ops-field"><span>รหัสสถานี</span><input value={profile.stationCode || ""} disabled={profile.active === false} onChange={(event) => updateProfile("stationCode", event.target.value)} /></label><label className="ops-field ops-field-wide"><span>ชื่อสถานี</span><input value={profile.stationName || ""} disabled={profile.active === false} onChange={(event) => updateProfile("stationName", event.target.value)} /></label><label className="ops-field"><span>รูปแบบสถานี</span><input value={getStationFormatDefinition(profile.stationFormat).label} readOnly /></label><div className="ops-field"><MasterSelect kind="province" referenceData={state.referenceData} value={profile.provinceId || ""} disabled={profile.active === false} label="จังหวัด" onChange={(event) => { const province = (state.referenceData?.provinces || []).find((entry) => entry.id === event.target.value); updateProfile("provinceId", event.target.value); updateProfile("province", province?.name || ""); }} /></div><label className="ops-field"><span>ทิศทาง</span><CustomSelect label="ทิศทาง" value={profile.direction || "unspecified"} disabled={profile.active === false} onChange={(event) => updateProfile("direction", event.target.value)}><option value="unspecified">ไม่ระบุ</option><option value="inbound">ขาเข้า</option><option value="outbound">ขาออก</option><option value="both">ทั้งสองทิศทาง</option></CustomSelect></label></div><details className="sc-general-advanced"><summary>Vehicle API</summary><VehicleSearchConfigPanel profile={profile} value={profile.vehicleSearchConfig} stationId={profile.id} disabled={profile.active === false} onChange={(value) => updateProfile("vehicleSearchConfig", value)} notify={notify} /></details><p className="ops-info-banner"><Icon name="info" />การแก้ทะเบียนมีผลกับรอบการตรวจใหม่เท่านั้น ข้อมูลประจำรอบ Snapshot และประวัติเดิมจะไม่เปลี่ยน</p></div></details>
    {showAddPanel && <EquipmentQuickAddPanel catalog={itemCatalog} canonicalItems={currentCanonicalItems} stationFormat={profile.stationFormat} stationSystems={profile.stationSystems} stationEquipment={allAssetEquipment} initialGroupId={addContextGroupId} initialBoqGroupCode={addContextBoqGroupCode} initialCategoryId={addContextCategoryId} initialScope={addContextScope} initialParentSystemId={addContextParentSystemId} initialParentAssetId={addContextParentAssetId} initialEquipmentType={addContextEquipmentType} initialRecordKind={addInitialRecordKind} activeLanes={activeLanes} disabled={profile.active === false} open={showAddPanel} onClose={() => { setShowAddPanel(false); setAddContextGroupId(null); setAddContextBoqGroupCode(""); setAddContextCategoryId(""); setAddContextScope(""); setAddContextParentSystemId(""); setAddInitialRecordKind(""); }} onAdd={addCatalogEquipment} onAddSystem={addCanonicalSystem} />}
  </section></StationProfileEquipmentContext.Provider>;
}

export function equipmentScopeChoices(type) {
  if (type === "CONTROL_CABINET" || isWimElectronicsSubEquipmentType(type)) return [];
  if (["VMS_SIGN", "VMS_LIGHT_SENSOR", "VMS_DISPLAY"].includes(type)) return ["High Speed", "Low Speed"];
  if (type === "LPR_CAMERA") return ["High Speed", "Low Speed", "3D", "ImPS"];
  if (["FIXED_CAMERA", "PTZ_CAMERA", "NVR", "JOYSTICK"].includes(type)) return ["High Speed", "Low Speed", "Image Processing", "ImPS"];
  if (["WIM_SENSOR", "WIM_LOOP", "CONTROL_COMPUTER", "CONTROL_CABINET", "LASER_SCANNER", "DIMENSION_CONTROLLER", "IMAGE_PROCESSOR"].includes(type)) return ["High Speed", "Low Speed", "3D", "ImPS", "Image Processing"];
  return [];
}

export function EquipmentRow({ equipment, isReferenced, stationSystems = [], canonicalItems = [], disabled = false, onChange, onRemove }) {
  const stationProfileContext = useContext(StationProfileEquipmentContext);
  stationSystems = stationSystems.length ? stationSystems : stationProfileContext.stationSystems;
  canonicalItems = canonicalItems.length ? canonicalItems : stationProfileContext.canonicalItems;
  const isWim = isWimEquipment(equipment);
  const definition = canonicalItems.find((item) => item.kind === "asset" && item.equipmentType === equipment.type);
  const ownerIds = definition?.systemIds || [];
  const ownerSystemKey = (system) => String(system?.canonicalItemId || (system?.systemId === "wim" && system?.componentId === "electronics" ? "wim-electronics-system" : system?.systemId || ""));
  const ownerSystemOptions = stationSystems.filter((system) => system.active !== false && Number(system.quantity ?? 1) > 0 && ownerIds.includes(ownerSystemKey(system)));
  const ownerSystem = ownerSystemOptions.find((system) => system.id === equipment.parentSystemId);
  const inheritsScope = ownerIds.length > 0;
  const assignOwnerSystem = (systemId) => {
    const parent = ownerSystemOptions.find((system) => system.id === systemId);
    onChange(equipment.id, "parentSystemId", parent?.id || null);
    onChange(equipment.id, "scope", parent?.scope || "");
  };
  const serialStatus = equipment.serialStatus || "unknown";
  const serialInputValue = serialStatus === "present" ? equipment.serialNo : serialStatus === "not-available" ? equipment.serialReason || "" : "";
  const serialInputLabel = serialStatus === "not-available" ? `เหตุผลที่ไม่มี Serial ของ ${equipment.assetNo}` : `Serial Number ของ ${equipment.assetNo}`;
  const serialInputPlaceholder = serialStatus === "not-available" ? "เหตุผลที่ไม่มี Serial" : serialStatus === "unknown" ? "เลือกสถานะก่อนกรอก" : "Serial Number";
  return <article className={`ops-equipment-row ops-equipment-split ${equipment.active === false ? "is-inactive" : ""}`}>
    <div className="ops-equipment-identity">
      <span className="ops-equipment-icon"><Icon name={getEquipmentIconName(equipment.type)} /></span>
      <div className="ops-equipment-identity-copy">
        <strong>{getEquipmentDisplayLabel(equipment)}</strong>
        <span>{equipment.type === "CUSTOM" ? "อุปกรณ์กำหนดเอง (Custom) · มีรายการตรวจทั่วไป แต่ยังไม่มีรายการตรวจเฉพาะ" : `${equipment.categoryCode || getEquipmentCategoryCode(equipment)} · ${isReferenced ? "มี Snapshot อ้างอิงแล้ว" : "ยังไม่ถูกอ้างอิงในรอบตรวจ"}${isWim && equipment.laneId ? ` · ผูก Lane แล้ว` : isWim ? " · ยังไม่ผูก Lane" : ""}`}</span>
        <StatusBadge status={equipment.active === false ? "inactive" : "normal"}>{equipment.active === false ? "ปิดใช้งาน" : "ใช้งาน"}</StatusBadge>
      </div>
    </div>
    <div className="ops-equipment-control">
      <div className="ops-equipment-fields">
        <label className="ops-field ops-code-field"><span>รหัสอุปกรณ์ (Asset No.)</span><input value={equipment.assetNo} disabled={disabled} onChange={(event) => onChange(equipment.id, "assetNo", event.target.value)} /></label>
        <label className="ops-field"><span>ตำแหน่งติดตั้ง</span><input value={equipment.location} disabled={disabled} onChange={(event) => onChange(equipment.id, "location", event.target.value)} /></label>
        {inheritsScope && ownerSystemOptions.length > 0 && (!equipment.parentSystemId || ownerSystemOptions.length > 1) && <label className="ops-field"><span>System แม่</span><CustomSelect label={`System แม่ของ ${equipment.assetNo || equipment.type}`} value={ownerSystem?.id || ""} disabled={disabled} onChange={(event) => assignOwnerSystem(event.target.value)}><option value="">เลือกระบบแม่</option>{ownerSystemOptions.map((system) => <option key={system.id} value={system.id}>{system.displayLabel || system.nameEn || system.canonicalItemId} · {system.scope || "ไม่ระบุ Scope"}</option>)}</CustomSelect></label>}
        {inheritsScope && ownerSystemOptions.length === 0 && <div className="sc-readonly-field"><span>System แม่</span><strong>ยังไม่มีระบบแม่ที่ตรงกับอุปกรณ์</strong></div>}
        {inheritsScope && <div className="sc-readonly-field"><span>Scope</span><strong>{ownerSystem?.scope || (equipment.parentSystemId ? equipment.scope || "ยังไม่ระบุ" : "เลือก System แม่เพื่อกำหนด Scope")}</strong><small>กำหนดตาม System แม่</small></div>}
        {!inheritsScope && equipmentScopeChoices(equipment.type).length > 0 && <label className="ops-field"><span>ชุดระบบที่สังกัด</span><CustomSelect label={`ชุดระบบของ ${equipment.assetNo || equipment.type}`} value={equipment.scope || ""} disabled={disabled} onChange={(event) => onChange(equipment.id, "scope", event.target.value)}><option value="">ยังไม่ระบุ</option>{equipmentScopeChoices(equipment.type).map((scope) => <option key={scope} value={scope}>{scope}</option>)}</CustomSelect></label>}
        <fieldset className="ops-serial-fieldset ops-serial-inline">
          <legend>Serial Number</legend>
          <div className="ops-serial-control">
            <div className="ops-serial-options ops-serial-segmented" role="radiogroup" aria-label={`สถานะ Serial Number ของ ${equipment.assetNo}`}>
              <label className={serialStatus === "present" ? "is-selected" : ""}><input type="radio" name={`profile-serial-status-${equipment.id}`} checked={serialStatus === "present"} disabled={disabled} onChange={() => onChange(equipment.id, "serialStatus", "present")} /><span>มี</span></label>
              <label className={serialStatus === "not-available" ? "is-selected" : ""}><input type="radio" name={`profile-serial-status-${equipment.id}`} checked={serialStatus === "not-available"} disabled={disabled} onChange={() => onChange(equipment.id, "serialStatus", "not-available")} /><span>ไม่มี / อ่านไม่ได้</span></label>
              <label className={serialStatus === "unknown" ? "is-selected" : ""}><input type="radio" name={`profile-serial-status-${equipment.id}`} checked={serialStatus === "unknown"} disabled={disabled} onChange={() => onChange(equipment.id, "serialStatus", "unknown")} /><span>ยังไม่ระบุ</span></label>
            </div>
            <input className="ops-serial-value" value={serialInputValue} disabled={disabled || serialStatus === "unknown"} onChange={(event) => onChange(equipment.id, serialStatus === "not-available" ? "serialReason" : "serialNo", event.target.value)} placeholder={serialInputPlaceholder} aria-label={serialInputLabel} />
          </div>
          {serialStatus === "unknown" && <small className="ops-field-warning">ยังไม่ระบุสถานะ</small>}
        </fieldset>
      </div>
    </div>
    <div className="ops-equipment-actions"><Button onClick={() => onChange(equipment.id, "active", equipment.active === false)} variant="ghost" icon={equipment.active === false ? "check" : "close"} disabled={disabled}>{equipment.active === false ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Button><Button onClick={() => onRemove(equipment)} variant="danger-ghost" icon="delete" disabled={disabled || isReferenced}>ลบอุปกรณ์</Button></div>
  </article>;
}
