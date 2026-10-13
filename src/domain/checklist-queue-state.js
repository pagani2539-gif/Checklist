import { getVehicleSystemLabel } from './vehicle-review-systems.js';
import { sortEquipmentForDisplay } from "./ordering.js";
import { getEffectiveEquipmentScope } from "./station-equipment-parent.js";
import { getChecklistBoqGroupId } from "./boq-checklist-groups.js";
import { CENTRAL_EQUIPMENT_MAIN_CATEGORIES, getCentralChecklistSectionName, getCentralChecklistItemLabel, useCentralEnglishNames } from "./equipment-names.js";
import { getStationWorkpointLayout, getVehicleReviewWorkpoint, resolveChecklistWorkpoint } from "./station-workpoint-layout.js";

export function getChecklistQueueToggle(expandedSections, sectionCode, selectedCode) {
  const current = expandedSections instanceof Set ? expandedSections : new Set(expandedSections);
  const isExpanded = current.has(sectionCode);

  if (isExpanded && selectedCode === sectionCode) {
    const next = new Set(current);
    next.delete(sectionCode);
    return { expandedSections: next, shouldSelect: false };
  }

  return { expandedSections: new Set([sectionCode]), shouldSelect: true };
}

const CHECKLIST_SECTION_KIND_SUFFIX = /\s+-\s+(?:Equipment|Systems & Software)$/;
const MAIN_CATEGORY_BY_CODE = new Map(
  CENTRAL_EQUIPMENT_MAIN_CATEGORIES.flatMap((category) => category.categoryCodes.map((code) => [code, category])),
);
const PAGE_QUEUE_CATEGORY_ALIAS_BY_CODE = new Map([
  ["1.1.4", "data-control"],
  ["1.1.8", "data-control"],
]);
const CHECKLIST_CLEANING_SECTION_CODES = new Set(["6.2", "6.3"]);

function checklistPageMainCategory(sourceCode) {
  const directCategory = MAIN_CATEGORY_BY_CODE.get(sourceCode);
  if (directCategory) return directCategory;
  const aliasCategoryId = PAGE_QUEUE_CATEGORY_ALIAS_BY_CODE.get(sourceCode);
  return aliasCategoryId
    ? CENTRAL_EQUIPMENT_MAIN_CATEGORIES.find((category) => category.id === aliasCategoryId) || null
    : null;
}

function sourceSectionCodeForItem(item, section) {
  return String(item?.sourceSectionCode || item?.sectionCode || section?.code || "");
}

function workpointFromBoqGroup(stationFormat, categoryId, boqGroupCode) {
  const format = normalizedStationFormat(stationFormat);
  const match = String(boqGroupCode || "").trim().toUpperCase().match(/^(SC|IMPS)-(\d{2})$/);
  if (!match || match[1] !== format) return null;
  const candidates = getStationWorkpointLayout(format).filter((point) =>
    point.categoryId === categoryId && point.noteId === `${format}-${match[2]}`);
  return candidates.length === 1 ? candidates[0] : null;
}

export function getCleaningQueueItemCount(items = []) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.isEquipmentCleaning === true
    || item?.isAreaCleaning === true
    || CHECKLIST_CLEANING_SECTION_CODES.has(sourceSectionCodeForItem(item))).length;
}

export function getChecklistQueueItemBlocks(items = []) {
  const inspectionItems = [];
  const cleaningItems = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.isEquipmentCleaning === true || item?.isAreaCleaning === true) cleaningItems.push(item);
    else inspectionItems.push(item);
  }
  return [
    ...(inspectionItems.length ? [{ kind: "inspection", items: inspectionItems }] : []),
    ...(cleaningItems.length ? [{ kind: "cleaning", items: cleaningItems }] : []),
  ];
}

// Display-only cleanup: never rewrite Snapshot labels or source requirements.
export function getChecklistDisplayText(text = "") {
  const label = useCentralEnglishNames(text)
    .replace(/\s*·\s*ความเร็ว(?:สูง|ต่ำ)(?=\s*(?:·|$))/g, "")
    .replace(/ของ\s+(?=[ก-๙])/g, "ของ")
    .replace(/SD Card/g, "การ์ดหน่วยความจำ")
    .replace(/การ์ดหน่วยความจำ\s+ของ/g, "การ์ดหน่วยความจำของ")
    .replace(/Variable Message Sign\s*·\s*ป้าย VMS/g, "ป้าย VMS")
    .replace(/บน\s+ป้าย VMS/g, "บนป้าย VMS")
    .replace(/ตรวจตำแหน่ง\s+ป้ายข้อความเปลี่ยนแปลงได้/g, "ตรวจตำแหน่งติดตั้งป้าย VMS")
    .replace(/ตรวจการเรียงลำดับ\s+จอแสดงผล VMS/g, "ตรวจการจัดเรียงจอแสดงผล VMS");
  const parts = label.split(/\s*·\s*/);
  return parts.filter((part, index) => {
    const lane = part.match(/^ช่องจราจร\s+(\d+)$/);
    if (!lane) return true;
    const lanePattern = new RegExp(`ช่องจราจร\\s+${lane[1]}(?!\\d)`);
    return !parts.slice(0, index).some((previous) => lanePattern.test(previous));
  }).join(" · ");
}

export function getChecklistQueueItemLabel(item = {}) {
  const label = getChecklistDisplayText(getCentralChecklistItemLabel(item));
  if (item?.isEquipmentCleaning) return label.replace(/^Equipment Cleaning · /, "ทำความสะอาดอุปกรณ์ · ");
  if (item?.isAreaCleaning && item.cleaningAssetType === "CONTROL_CABINET") {
    return label.replace(/^Control Cabinet Surrounding Area Cleaning · /, "ทำความสะอาดพื้นที่โดยรอบตู้ควบคุม · ");
  }
  return label;
}

function ensureQueueGroup(groupsById, groups, { id, title }) {
  const existing = groupsById.get(id);
  if (existing) return existing;
  const group = { id, title, sections: [], sectionsByCode: new Map() };
  groupsById.set(id, group);
  groups.push(group);
  return group;
}

function addQueueSection(group, sourceSection, items, { code, title, mainCategoryId = "", queueDisplayCode = "", queueKey = "" } = {}) {
  const sectionCode = String(code || sourceSection.code || "");
  let section = group.sectionsByCode.get(sectionCode);
  if (!section) {
    section = {
      ...sourceSection,
      code: sectionCode,
      title: useCentralEnglishNames(title || sourceSection.title),
      queueDisplayCode: queueDisplayCode || sectionCode,
      queueKey: queueKey || sectionCode,
      items: [],
      sourceItems: [],
      queueSourceSectionCode: sourceSection.code,
      mainCategoryId: mainCategoryId || null,
    };
    group.sectionsByCode.set(sectionCode, section);
    group.sections.push(section);
  }
  section.items.push(...items);
  section.sourceItems.push(...items);
}

function normalizedStationFormat(value) {
  return String(value || "SC").toUpperCase() === "IMPS" ? "IMPS" : "SC";
}

function sectionKind(section) {
  const match = String(section?.title || "").match(CHECKLIST_SECTION_KIND_SUFFIX);
  return match?.[0]?.endsWith("Equipment")
    ? { title: "อุปกรณ์", englishTitle: "Equipment" }
    : match
      ? { title: "ระบบและซอฟต์แวร์", englishTitle: "Systems & Software" }
      : null;
}

function formatGroupForSection(section, stationFormat) {
  const format = normalizedStationFormat(stationFormat);
  const kind = sectionKind(section);
  if (!kind || section?.code === "1.1") return null;

  const sourceGroupCode = String(section?.boqGroupCode || "").trim();
  const fullGroup = sourceGroupCode.match(/^(SC|IMPS)-(\d{2})$/);
  if (fullGroup && fullGroup[1] === format) {
    const title = String(section.title || "").replace(CHECKLIST_SECTION_KIND_SUFFIX, "").trim();
    const groupId = `${format}-${fullGroup[2]}`;
    return {
      id: `boq-${groupId}`,
      title: `${groupId} · ${title}`,
      kind: "format-system",
      format,
      order: Number(fullGroup[2]),
      childTitle: kind.title,
      childCode: section.code,
    };
  }

  const legacyGroup = sourceGroupCode.match(/^(\d{2})$/);
  if (legacyGroup && new RegExp(`^${legacyGroup[1]}\\.0[12]$`).test(String(section.code || ""))) {
    const title = String(section.title || "").replace(CHECKLIST_SECTION_KIND_SUFFIX, "").trim();
    const groupId = `${format}-${legacyGroup[1]}`;
    return {
      id: `legacy-${groupId}`,
      title: `${groupId} · ${title}`,
      kind: "format-system",
      format,
      order: Number(legacyGroup[1]),
      childTitle: kind.title,
      childCode: `${format}-${section.code}`,
    };
  }

  // Keep explicit but unresolved format groups visible without assigning them
  // to one of the six systems by guesswork (for example, VMS without a scope).
  if (sourceGroupCode.startsWith(`${format}-`)) {
    return {
      id: `unassigned-${format}`,
      title: `${format} · ยังไม่ระบุชุดตรวจ`,
      kind: "unassigned",
      format,
      order: Number.MAX_SAFE_INTEGER - 1,
      childTitle: kind.title,
      childCode: section.code,
    };
  }

  return null;
}

export function getChecklistQueueSectionLabel(section, stationFormat = "SC") {
  const format = normalizedStationFormat(stationFormat);
  const presentationGroup = formatGroupForSection(section, format);
  const code = presentationGroup?.childCode || section?.code || "";
  return [code, section?.title].filter(Boolean).join(" · ");
}

export function getChecklistQueueEquipmentGroups(section = {}, { separateSystems = false } = {}) {
  const groups = [];
  const groupsById = new Map();

  for (const item of section.items || []) {
    const types = Array.isArray(item.assetBinding?.types) ? item.assetBinding.types.filter(Boolean) : [];
    const itemKind = item.assetId || types.length
      ? "equipment"
      : item.systemRecordId
        ? "system"
        : "station";
    const groupId = item.assetId
      ? `asset-${item.assetId}`
      : types.length
        ? `type-${types.join("-")}`
        : separateSystems && item.systemRecordId
          ? `system-${item.systemRecordId}`
          : separateSystems
            ? "station"
            : "shared";
    const existing = groupsById.get(groupId);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    const group = {
      id: groupId,
      assetId: item.assetId || null,
      assetNo: item.assetNo || "",
      types,
      scope: item.assetId ? "asset" : types.length ? "equipment-type" : separateSystems ? itemKind : "shared",
      kind: separateSystems ? itemKind : undefined,
      systemRecordId: separateSystems ? item.systemRecordId || null : null,
      items: [item],
    };
    groupsById.set(groupId, group);
    groups.push(group);
  }

  return groups;
}

export function getChecklistQueueGroups(sections = [], stationFormat = "SC") {
  const groups = [];
  const groupsById = new Map();
  const format = normalizedStationFormat(stationFormat);

  for (const sourceSection of sections) {
    if (sourceSection.code === "1.1") {
      const group = ensureQueueGroup(groupsById, groups, { id: "section-1.1", title: "ความพร้อมหน้างาน" });
      addQueueSection(group, sourceSection, sourceSection.items || [], { code: "1.1" });
      continue;
    }

    const presentationGroup = formatGroupForSection(sourceSection, format);
    if (presentationGroup) {
      const group = ensureQueueGroup(groupsById, groups, {
        id: presentationGroup.id,
        title: presentationGroup.title,
      });
      group.kind = presentationGroup.kind;
      group.format = presentationGroup.format;
      group.order = presentationGroup.order;
      addQueueSection(group, sourceSection, sourceSection.items || [], {
        code: sourceSection.code,
        title: presentationGroup.childTitle,
        queueDisplayCode: presentationGroup.childCode,
      });
      continue;
    }

    const knownCategoryItems = new Map();
    const fallbackItems = [];
    for (const item of sourceSection.items || []) {
      const sourceCode = sourceSectionCodeForItem(item, sourceSection);
      const category = MAIN_CATEGORY_BY_CODE.get(sourceCode);
      if (!category) {
        fallbackItems.push(item);
        continue;
      }
      const key = category.id;
      if (!knownCategoryItems.has(key)) knownCategoryItems.set(key, new Map());
      const itemsBySourceCode = knownCategoryItems.get(key);
      if (!itemsBySourceCode.has(sourceCode)) itemsBySourceCode.set(sourceCode, []);
      itemsBySourceCode.get(sourceCode).push(item);
    }

    for (const [categoryId, itemsBySourceCode] of knownCategoryItems) {
      const category = CENTRAL_EQUIPMENT_MAIN_CATEGORIES.find((entry) => entry.id === categoryId);
      const categoryIndex = CENTRAL_EQUIPMENT_MAIN_CATEGORIES.findIndex((entry) => entry.id === categoryId);
      const group = ensureQueueGroup(groupsById, groups, { id: `main-${category.id}`, title: category.label });
      group.kind = "equipment-category";
      group.order = categoryIndex;
      for (const [sourceCode, items] of itemsBySourceCode) {
        addQueueSection(group, sourceSection, items, {
          code: sourceCode,
          title: items.find((item) => item.sourceSectionTitle)?.sourceSectionTitle || sourceCode,
          mainCategoryId: category.id,
        });
      }
    }

    if (fallbackItems.length || !(sourceSection.items || []).length) {
      const hasParentGroup = Boolean(sourceSection.boqGroupCode && sourceSection.boqGroupCode !== sourceSection.code);
      const groupId = hasParentGroup ? `boq-${sourceSection.boqGroupCode}` : `section-${sourceSection.code}`;
      const group = ensureQueueGroup(groupsById, groups, {
        id: groupId,
        title: hasParentGroup ? sourceSection.title.replace(CHECKLIST_SECTION_KIND_SUFFIX, "") : sourceSection.title,
      });
      addQueueSection(group, sourceSection, fallbackItems.length ? fallbackItems : sourceSection.items || [], { code: sourceSection.code });
    }
  }

  return groups
    .map((group) => ({
      ...group,
      sections: group.sections
        .map((section) => ({ ...section, equipmentGroups: getChecklistQueueEquipmentGroups(section) }))
        .sort((left, right) => String(left.code).localeCompare(String(right.code), undefined, { numeric: true })),
    }))
    .sort((left, right) => {
      const leftOrder = left.id === "section-1.1" ? -1 : (left.order ?? Number.MAX_SAFE_INTEGER);
      const rightOrder = right.id === "section-1.1" ? -1 : (right.order ?? Number.MAX_SAFE_INTEGER);
      return leftOrder - rightOrder;
    })
    .map(({ sectionsByCode, ...group }) => group);
}

export function getChecklistPageNavigationItems(sections = [], stationFormat = "SC", snapshot = {}) {
  return getChecklistPageQueueGroups(sections, stationFormat, snapshot).flatMap((group) =>
    group.sections.flatMap((section) => section.equipmentGroups.flatMap((equipmentGroup) =>
      getChecklistQueueItemBlocks(equipmentGroup.items).flatMap((block) => block.items.map((item) => ({
        ...item,
        displaySectionCode: item.sectionCode || section.queueSourceSectionCode || section.code,
      }))),
    )),
  );
}

const CHECKLIST_ITEM_KIND_ORDER = Object.freeze({ equipment: 0, station: 1, system: 2 });
const CHECKLIST_SCOPE_ORDER = Object.freeze({
  high: 0,
  low: 1,
  "3d": 2,
  imps: 3,
  image: 4,
});

function checklistItemKind(item) {
  if (item?.assetId || item?.assetBinding?.types?.length) return "equipment";
  if (item?.systemRecordId) return "system";
  return "station";
}

function checklistScopeOrder(item) {
  const scope = String(item?.scope || item?.laneScopeLabel || "").trim().toLowerCase();
  if (/high|ความเร็วสูง/.test(scope)) return CHECKLIST_SCOPE_ORDER.high;
  if (/low|ความเร็วต่ำ/.test(scope)) return CHECKLIST_SCOPE_ORDER.low;
  if (/3d|สามมิติ/.test(scope)) return CHECKLIST_SCOPE_ORDER["3d"];
  if (/imps/.test(scope)) return CHECKLIST_SCOPE_ORDER.imps;
  if (/image/.test(scope)) return CHECKLIST_SCOPE_ORDER.image;
  return Number.MAX_SAFE_INTEGER;
}

function sortChecklistSubcategoryItems(items) {
  return [...items].sort((left, right) => (
    (CHECKLIST_ITEM_KIND_ORDER[checklistItemKind(left)] ?? Number.MAX_SAFE_INTEGER)
      - (CHECKLIST_ITEM_KIND_ORDER[checklistItemKind(right)] ?? Number.MAX_SAFE_INTEGER)
    || checklistScopeOrder(left) - checklistScopeOrder(right)
  ));
}

/**
 * Checklist-only hierarchy: installed station category -> actual source
 * subcategory -> equipment, station work, then systems. Other views continue
 * to use the format-qualified BOQ grouping above.
 */
export function getChecklistPageQueueGroups(sections = [], stationFormat = "SC", snapshot = {}) {
  const format = normalizedStationFormat(stationFormat);
  const reviewPoints = [...new Set(sections.flatMap(section => (section.items || []).map(item => item.vehicleReviewSystemKey)))].map(getVehicleReviewWorkpoint).filter(Boolean);
  const layout = [...getStationWorkpointLayout(format), ...reviewPoints];
  const groups = [];
  const groupsById = new Map();
  const workpointItems = new Map();
  const unresolvedScopeItemsByCategory = new Map();
  const cleaningItemsByCode = new Map();
  const areaCleaningRecords = [];
  const unmappedItemsByCode = new Map();

  for (const sourceSection of sections) {
    if (sourceSection.code === "1.1") {
      const readiness = ensureQueueGroup(groupsById, groups, { id: "section-1.1", title: "STATION READINESS" });
      readiness.kind = "station-readiness";
      readiness.order = -1;
      readiness.categoryDescription = "ความพร้อมหน้างาน · งานระดับสถานี";
      addQueueSection(readiness, sourceSection, sortChecklistSubcategoryItems(sourceSection.items || []), { code: "1.1" });
      continue;
    }

    for (const sourceItem of sourceSection.items || []) {
      const asset = (snapshot.equipment || []).find((entry) => entry.id === sourceItem.assetId);
      const system = (snapshot.stationSystems || []).find((entry) => entry.id === sourceItem.systemRecordId);
      const scope = (asset && getEffectiveEquipmentScope(asset, snapshot.equipment, snapshot.stationSystems || []))
        || system?.scope || sourceItem.scope || sourceItem.laneScopeLabel || sourceItem.scopeLabel || sourceItem.systemScope;
      let item = scope ? { ...sourceItem, scope } : sourceItem;
      const sourceCode = sourceSectionCodeForItem(item, sourceSection);
      const category = checklistPageMainCategory(sourceCode);
      const isCleaningSection = CHECKLIST_CLEANING_SECTION_CODES.has(sourceCode);
      if (isCleaningSection) {
        if (!cleaningItemsByCode.has(sourceCode)) cleaningItemsByCode.set(sourceCode, []);
        cleaningItemsByCode.get(sourceCode).push({ item, sourceSection });
        continue;
      }
      if (sourceItem.isAreaCleaning === true && !category) {
        areaCleaningRecords.push({ item, sourceSection });
        continue;
      }
      const point = category && (resolveChecklistWorkpoint(format, { categoryId: category.id, sourceCode, item })
        || workpointFromBoqGroup(format, category.id,
          sourceSection.boqGroupCode || getChecklistBoqGroupId(item, snapshot)));
      if (point && !item.scope) item = { ...item, scope: point.scope };
      if (point) {
        if (!workpointItems.has(point.id)) workpointItems.set(point.id, new Map());
        const itemsByCode = workpointItems.get(point.id);
        if (!itemsByCode.has(sourceCode)) itemsByCode.set(sourceCode, []);
        itemsByCode.get(sourceCode).push({ item, sourceSection });
      } else if (category) {
        if (!unresolvedScopeItemsByCategory.has(category.id)) unresolvedScopeItemsByCategory.set(category.id, new Map());
        const byCode = unresolvedScopeItemsByCategory.get(category.id);
        if (!byCode.has(sourceCode)) byCode.set(sourceCode, []);
        byCode.get(sourceCode).push({ item, sourceSection });
      } else {
        if (!unmappedItemsByCode.has(sourceCode)) unmappedItemsByCode.set(sourceCode, []);
        unmappedItemsByCode.get(sourceCode).push({ item, sourceSection });
      }
    }
  }

  const sourceForRecords = (records) => records[0]?.sourceSection || { code: records[0]?.item?.sectionCode || "" };
  layout.forEach((point, pointIndex) => {
    const itemsByCode = workpointItems.get(point.id);
    if (!itemsByCode) return;
    const group = ensureQueueGroup(groupsById, groups, { id: `checklist-workpoint-${point.id}`, title: point.titleEn });
    group.kind = "station-workpoint";
    group.workpointId = point.id;
    group.categoryLabel = point.titleEn;
    group.categoryDescription = point.titleTh;
    group.scope = point.scope;
    group.order = pointIndex;
    for (const [sourceCode, records] of [...itemsByCode.entries()].sort(([left], [right]) => String(left).localeCompare(String(right), undefined, { numeric: true }))) {
      const sectionName = getCentralChecklistSectionName(sourceCode);
      const sourceName = records.find(({ item }) => item.sourceSectionTitle)?.item.sourceSectionTitle;
      const items = sortChecklistSubcategoryItems(records.map(({ item }) => item));
      addQueueSection(group, sourceForRecords(records), items, {
        code: sourceCode,
        title: items.some(item => item.automaticSoftwareTest) ? `ทดสอบโปรแกรมและงานตรวจรถ · ${getVehicleSystemLabel(items[0].vehicleReviewSystemKey)}` : items.length && items.every(item => item.vehicleReviewSystemKey && item.vehicleReviewContext) ? `ตรวจข้อมูลรถ · ${getVehicleSystemLabel(items[0].vehicleReviewSystemKey)}` : sourceName || sectionName?.nameEn || sectionName?.nameTh || sourceCode,
        mainCategoryId: layout.find((entry) => entry.id === point.id)?.categoryId || "",
        queueDisplayCode: sourceCode,
        queueKey: `${point.id}::${sourceCode}`,
      });
    }
  });

  let unresolvedIndex = 0;
  for (const category of CENTRAL_EQUIPMENT_MAIN_CATEGORIES) {
    const itemsByCode = unresolvedScopeItemsByCategory.get(category.id);
    if (!itemsByCode) continue;
    const group = ensureQueueGroup(groupsById, groups, {
      id: `checklist-unresolved-scope-${category.id}`,
      title: `${category.label.toUpperCase()} · ยังไม่ระบุช่องทาง`,
    });
    group.kind = "unresolved-scope";
    group.categoryDescription = "ทราบหมวดอุปกรณ์แล้ว แต่ข้อมูลรอบตรวจยังไม่ระบุช่องทางหรือขอบเขต";
    group.order = layout.length + unresolvedIndex++;
    for (const [sourceCode, records] of [...itemsByCode.entries()].sort(([left], [right]) => String(left).localeCompare(String(right), undefined, { numeric: true }))) {
      const sectionName = getCentralChecklistSectionName(sourceCode);
      const sourceName = records.find(({ item }) => item.sourceSectionTitle)?.item.sourceSectionTitle;
      addQueueSection(group, sourceForRecords(records), sortChecklistSubcategoryItems(records.map(({ item }) => item)), {
        code: sourceCode,
        title: sourceName || sectionName?.nameEn || sectionName?.nameTh || sourceCode,
        mainCategoryId: category.id,
        queueDisplayCode: sourceCode,
        queueKey: `unresolved-scope::${category.id}::${sourceCode}`,
      });
    }
  }

  if (cleaningItemsByCode.size || areaCleaningRecords.length) {
    const group = ensureQueueGroup(groupsById, groups, { id: "checklist-cleaning", title: "CLEANING" });
    group.kind = "station-cleaning";
    group.categoryDescription = "งานทำความสะอาดและงานพื้นที่ประกอบการตรวจ";
    group.order = layout.length + unresolvedIndex;
    for (const [sourceCode, records] of [...cleaningItemsByCode.entries()].sort(([left], [right]) => String(left).localeCompare(String(right), undefined, { numeric: true }))) {
      const sourceName = records.find(({ item }) => item.sourceSectionTitle)?.item.sourceSectionTitle;
      addQueueSection(group, sourceForRecords(records), sortChecklistSubcategoryItems(records.map(({ item }) => item)), {
        code: sourceCode,
        title: sourceName || getCentralChecklistSectionName(sourceCode)?.nameEn || getCentralChecklistSectionName(sourceCode)?.nameTh || sourceCode,
        queueDisplayCode: sourceCode,
        queueKey: `cleaning::${sourceCode}`,
      });
    }
    if (areaCleaningRecords.length) {
      const sourceSection = sourceForRecords(areaCleaningRecords);
      addQueueSection(group, sourceSection, sortChecklistSubcategoryItems(areaCleaningRecords.map(({ item }) => item)), {
        code: "area-cleaning",
        title: "งานทำความสะอาดพื้นที่",
        queueDisplayCode: sourceSection.code || "2.2",
        queueKey: "cleaning::area-cleaning",
      });
    }
  }

  if (unmappedItemsByCode.size) {
    const group = ensureQueueGroup(groupsById, groups, { id: "checklist-unmapped", title: "LEGACY / UNMAPPED" });
    group.kind = "unmapped-workpoint";
    group.categoryDescription = "รายการเดิมที่ยังระบุจุดติดตั้งไม่ได้ · แสดงไว้ท้ายรายการ";
    group.order = layout.length + unresolvedIndex + 1;
    for (const [sourceCode, records] of [...unmappedItemsByCode.entries()].sort(([left], [right]) => String(left).localeCompare(String(right), undefined, { numeric: true }))) {
      const sourceName = records.find(({ item }) => item.sourceSectionTitle)?.item.sourceSectionTitle;
      addQueueSection(group, sourceForRecords(records), sortChecklistSubcategoryItems(records.map(({ item }) => item)), {
        code: sourceCode,
        title: sourceName || getCentralChecklistSectionName(sourceCode)?.nameEn || getCentralChecklistSectionName(sourceCode)?.nameTh || sourceCode,
        queueDisplayCode: sourceCode,
        queueKey: `unmapped::${sourceCode}`,
      });
    }
  }

  return groups
    .map((group) => ({
      ...group,
      sections: group.sections
        .map((section) => {
          const equipmentGroups = getChecklistQueueEquipmentGroups(section, { separateSystems: true });
          const rank = new Map(sortEquipmentForDisplay(snapshot.equipment || [], snapshot.lanes || []).map((asset, index) => [asset.id, index]));
          equipmentGroups.sort((a, b) => (rank.get(a.assetId) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.assetId) ?? Number.MAX_SAFE_INTEGER));
          return { ...section, equipmentGroups };
        })
        .sort((left, right) => String(left.code).localeCompare(String(right.code), undefined, { numeric: true })),
    }))
    .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER))
    .map(({ sectionsByCode, ...group }) => group);
}
