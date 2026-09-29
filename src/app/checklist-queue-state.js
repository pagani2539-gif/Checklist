import { CENTRAL_EQUIPMENT_MAIN_CATEGORIES, getCentralChecklistSectionName } from "../domain/equipment-names.js";

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

export function getCleaningQueueItemCount(items = []) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.isEquipmentCleaning === true
    || item?.isAreaCleaning === true
    || CHECKLIST_CLEANING_SECTION_CODES.has(sourceSectionCodeForItem(item))).length;
}

export function getChecklistQueueItemLabel(item = {}) {
  const label = String(item?.label || "");
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

function addQueueSection(group, sourceSection, items, { code, title, mainCategoryId = "", queueDisplayCode = "" } = {}) {
  const sectionCode = String(code || sourceSection.code || "");
  let section = group.sectionsByCode.get(sectionCode);
  if (!section) {
    section = {
      ...sourceSection,
      code: sectionCode,
      title: title || sourceSection.title,
      queueDisplayCode: queueDisplayCode || sectionCode,
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

export function getChecklistPageNavigationItems(sections = []) {
  return getChecklistPageQueueGroups(sections).flatMap((group) => group.sections.flatMap((section) => (
    section.items.map((item) => ({
      ...item,
      displaySectionCode: item.sectionCode || section.queueSourceSectionCode || section.code,
    }))
  )));
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
export function getChecklistPageQueueGroups(sections = []) {
  const groups = [];
  const groupsById = new Map();

  for (const sourceSection of sections) {
    if (sourceSection.code === "1.1") {
      const readiness = ensureQueueGroup(groupsById, groups, { id: "section-1.1", title: "ความพร้อมหน้างาน" });
      readiness.kind = "station-readiness";
      readiness.order = -1;
      addQueueSection(readiness, sourceSection, sortChecklistSubcategoryItems(sourceSection.items || []), { code: "1.1" });
      continue;
    }

    const itemsByCategory = new Map();
    const cleaningItemsByCode = new Map();
    const unmappedItems = new Map();
    for (const item of sourceSection.items || []) {
      const sourceCode = sourceSectionCodeForItem(item, sourceSection);
      const category = checklistPageMainCategory(sourceCode);
      const isCleaningSection = CHECKLIST_CLEANING_SECTION_CODES.has(sourceCode);
      const target = category ? itemsByCategory : isCleaningSection ? cleaningItemsByCode : unmappedItems;
      const targetId = category?.id || (isCleaningSection ? "cleaning" : "unmapped");
      if (!target.has(targetId)) target.set(targetId, new Map());
      const itemsByCode = target.get(targetId);
      if (!itemsByCode.has(sourceCode)) itemsByCode.set(sourceCode, []);
      itemsByCode.get(sourceCode).push(item);
    }

    for (const [categoryId, itemsByCode] of itemsByCategory) {
      const category = CENTRAL_EQUIPMENT_MAIN_CATEGORIES.find((entry) => entry.id === categoryId);
      const order = CENTRAL_EQUIPMENT_MAIN_CATEGORIES.findIndex((entry) => entry.id === categoryId);
      const categoryLabel = category.canonicalCategories?.[0] || category.label;
      const group = ensureQueueGroup(groupsById, groups, { id: `checklist-main-${category.id}`, title: categoryLabel });
      group.kind = "station-equipment-category";
      group.categoryLabel = categoryLabel;
      group.categoryDescription = category.description;
      group.order = order;
      for (const [sourceCode, items] of itemsByCode) {
        const sourceName = items.find((item) => item.sourceSectionTitle)?.sourceSectionTitle;
        const sectionName = getCentralChecklistSectionName(sourceCode);
        addQueueSection(group, sourceSection, sortChecklistSubcategoryItems(items), {
          code: sourceCode,
          title: sourceName || sourceSection.title || sectionName?.nameTh || sectionName?.nameEn || sourceCode,
          mainCategoryId: category.id,
          queueDisplayCode: sourceCode,
        });
      }
    }

    if (cleaningItemsByCode.has("cleaning")) {
      const group = ensureQueueGroup(groupsById, groups, { id: "checklist-cleaning", title: "งานทำความสะอาด" });
      group.kind = "station-cleaning";
      group.order = CENTRAL_EQUIPMENT_MAIN_CATEGORIES.length;
      for (const [sourceCode, items] of cleaningItemsByCode.get("cleaning")) {
        const sourceName = items.find((item) => item.sourceSectionTitle)?.sourceSectionTitle;
        addQueueSection(group, sourceSection, sortChecklistSubcategoryItems(items), {
          code: sourceCode,
          title: sourceName || sourceSection.title || sourceCode,
          queueDisplayCode: sourceCode,
        });
      }
    }

    for (const [unmappedId, itemsByCode] of unmappedItems) {
      const group = ensureQueueGroup(groupsById, groups, { id: `checklist-${unmappedId}`, title: "รายการที่ยังไม่มีหมวดในผัง" });
      group.kind = "unmapped";
      group.order = CENTRAL_EQUIPMENT_MAIN_CATEGORIES.length + 1;
      for (const [sourceCode, items] of itemsByCode) {
        const sourceName = items.find((item) => item.sourceSectionTitle)?.sourceSectionTitle;
        addQueueSection(group, sourceSection, sortChecklistSubcategoryItems(items), {
          code: sourceCode,
          title: sourceName || sourceSection.title || sourceCode,
          queueDisplayCode: sourceCode,
        });
      }
    }
  }

  return groups
    .map((group) => ({
      ...group,
      sections: group.sections
        .map((section) => ({ ...section, equipmentGroups: getChecklistQueueEquipmentGroups(section, { separateSystems: true }) }))
        .sort((left, right) => {
          const leftCategoryOrder = group.kind === "station-equipment-category" ? CENTRAL_EQUIPMENT_MAIN_CATEGORIES.find((category) => category.id === left.mainCategoryId)?.categoryCodes.indexOf(left.code) ?? Number.MAX_SAFE_INTEGER : 0;
          const rightCategoryOrder = group.kind === "station-equipment-category" ? CENTRAL_EQUIPMENT_MAIN_CATEGORIES.find((category) => category.id === right.mainCategoryId)?.categoryCodes.indexOf(right.code) ?? Number.MAX_SAFE_INTEGER : 0;
          return leftCategoryOrder - rightCategoryOrder || String(left.code).localeCompare(String(right.code), undefined, { numeric: true });
        }),
    }))
    .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER))
    .map(({ sectionsByCode, ...group }) => group);
}
