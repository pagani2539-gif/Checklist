import { getNextLaneNumberForScope, setLaneScope } from "../../domain/station-lane-scope.js";
import { BOQ_CHECKLIST_PRESENTATION_VERSION } from "../../domain/boq-checklist-groups.js";

export function createStationDetailPage(runtime) {
  const { Breadcrumb, Button, CHECKLIST_POLICY_VERSION, CLEANING_POLICY_VERSION, EQUIPMENT_ORDER_VERSION, EVIDENCE_CHECKLIST_SECTIONS, EmptyState, EquipmentCatalogAddPanel, EquipmentRow, Icon, LaneAssignmentStep, PageHeader, STATION_DRAFT_TEMPLATE_VERSION, StationProfileRedesigned, StationSelect, StationSystemsSummary, StationTorSummary, StatusBadge, WIM_SORTING_SYSTEM_CANONICAL_ID, belongsToStation, createId, getActivePhysicalEquipment, getCanonicalItemsForFormat, getCatalogItemDisplayLabel, getEquipmentDisplayLabel, getEquipmentGroupsForRegister, getEquipmentIconName, getEquipmentType, getEquipmentTypeDisplayLabel, getItemsForSnapshot, getNewRoundChecklistItems, getNextEquipmentIndex, synchronizeGeneratedAssetNos, getStationChecklistItems, getStationChecklistSections, getWimSortingSystemById, getWimSortingSystemInstances, getWimElectronicsHierarchyIssue, isWimElectronicsSubEquipmentType, isWimEquipment, isWimSortingSystemRecord, makeEquipment, makeEquipmentFromCatalogItem, makeLane, navigate, normalizeItemCatalog, profileFor, setStationChecklistItemEnabled, useMemo, validateEquipmentDraft } = runtime;
  return function StationDetailPage({ state, update, notify, requestConfirm, onArchiveStation, onPurgeStation, route }) {
    const selectedId = route?.id || route?.query?.stationId || state.ui?.selectedStationId || state.activeStationId || state.stationProfiles[0]?.id;
    const profile = route?.id ? state.stationProfiles.find((entry) => entry.id === selectedId) || null : profileFor(state, selectedId);
    const referenced = (equipmentId) => state.inspectionRounds.some((round) => round.snapshot?.equipment?.some((equipment) => equipment.id === equipmentId));
    const setSelected = (stationId) => {
      if (route?.id) {
        navigate(`#/stations/${encodeURIComponent(stationId)}`);
        return;
      }
      update((current) => ({ ...current, activeStationId: stationId, ui: { ...(current.ui || {}), selectedStationId: stationId } }));
    };
    const updateProfile = (field, value) => update((current) => ({ ...current, stationProfiles: current.stationProfiles.map((entry) => entry.id === profile?.id ? { ...entry, [field]: value, ...(field === "readinessConfirmedAt" ? {} : { readinessConfirmedAt: null }) } : entry) }));
    const updateStationLanes = (lanes, message = "") => {
      if (!profile || profile.active === false) return;
      update((current) => ({ ...current, stationProfiles: current.stationProfiles.map((entry) => entry.id === profile.id ? { ...entry, lanes: Array.isArray(lanes) ? lanes : [], templateVersion: STATION_DRAFT_TEMPLATE_VERSION } : entry) }), message);
    };
    const assignStationLane = (equipmentId, laneId) => {
      if (!profile || profile.active === false) return;
      update((current) => ({
        ...current,
        stationProfiles: current.stationProfiles.map((entry) => entry.id === profile.id ? {
          ...entry,
          readinessConfirmedAt: null,
          templateVersion: STATION_DRAFT_TEMPLATE_VERSION,
          equipment: entry.equipment.map((equipment) => equipment.id === equipmentId ? { ...equipment, laneId: laneId || null } : equipment),
        } : entry),
      }), "บันทึกการผูกอุปกรณ์กับเลนแล้ว");
    };
    const assignWimParentSystem = (equipmentId, parentSystemId) => {
      if (!profile || profile.active === false) return;
      const parent = getWimSortingSystemById(profile.stationSystems, parentSystemId);
      update((current) => ({
        ...current,
        stationProfiles: current.stationProfiles.map((entry) => entry.id === profile.id ? {
          ...entry,
          readinessConfirmedAt: null,
          templateVersion: STATION_DRAFT_TEMPLATE_VERSION,
          equipment: synchronizeGeneratedAssetNos(entry.equipment.map((equipment) => equipment.id === equipmentId
            ? { ...equipment, parentSystemId: parent?.id || null, laneId: parent?.laneId || null, scope: parent?.scope || null }
            : equipment), entry.stationSystems),
        } : entry),
      }), parent ? "บันทึก WIM Sorting System แม่แล้ว" : "ยกเลิกการผูก WIM Sorting System แม่แล้ว");
    };
    const addStationLane = (scopeOverride = "") => {
      if (!profile || profile.active === false) return;
      const scope = String(scopeOverride || (profile.stationFormat === "IMPS" ? "ImPS" : "High Speed")).trim();
      const nextLaneNo = getNextLaneNumberForScope(profile.lanes, scope, profile.stationSystems);
      updateStationLanes([...profile.lanes, makeLane(nextLaneNo, { id: createId("lane"), scope })], "เพิ่มเลนแล้ว");
    };
    const removeStationLane = async (lane) => {
      if (!profile || profile.active === false) return;
      const linkedSystems = (profile.stationSystems || []).filter((system) => isWimSortingSystemRecord(system) && system.active !== false && system.laneId === lane?.id);
      const linked = activeEquipment.filter((equipment) => isWimEquipment(equipment) && (equipment.laneId === lane?.id || linkedSystems.some((system) => system.id === equipment.parentSystemId)));
      const confirmed = await requestConfirm({
        title: `ลบ Lane ${lane?.laneNo || ""}`,
        description: linked.length ? `มี Sensor/Loop ผูกอยู่ ${linked.length} รายการ ระบบจะยกเลิกการผูกของอุปกรณ์ในสถานีปัจจุบัน แต่ Snapshot เดิมจะไม่เปลี่ยน` : "เลนนี้ยังไม่มีอุปกรณ์ผูกอยู่ และจะถูกนำออกจากโครงสร้างสถานี",
        confirmLabel: "ยืนยันลบเลน",
      });
      if (!confirmed) return;
      update((current) => ({
        ...current,
        stationProfiles: current.stationProfiles.map((entry) => entry.id === profile.id ? {
          ...entry,
          readinessConfirmedAt: null,
          templateVersion: STATION_DRAFT_TEMPLATE_VERSION,
          lanes: entry.lanes.filter((entryLane) => entryLane.id !== lane?.id),
          stationSystems: entry.stationSystems.map((system) => system.laneId === lane?.id ? { ...system, laneId: null } : system),
          equipment: entry.equipment.map((equipment) => equipment.laneId === lane?.id || linkedSystems.some((system) => system.id === equipment.parentSystemId) ? { ...equipment, laneId: null } : equipment),
        } : entry),
      }), "ลบ Lane แล้ว");
    };
    const updateEquipment = (equipmentId, fieldOrPatch, value) => {
      if (profile?.active === false) return;
      const patch = fieldOrPatch && typeof fieldOrPatch === "object" ? { ...fieldOrPatch } : { [fieldOrPatch]: value };
      if (Object.prototype.hasOwnProperty.call(patch, "assetNo")) {
        const result = validateEquipmentDraft({ assetNo: patch.assetNo }, profile.equipment, { excludeId: equipmentId });
        if (!result.valid) { notify(result.errors.assetNo); return; }
        patch.assetNoMode = "manual";
      }
      update((current) => ({
        ...current,
        stationProfiles: current.stationProfiles.map((entry) => {
          if (entry.id !== profile?.id) return entry;
          const equipment = entry.equipment.map((equipment) => {
            if (equipment.id !== equipmentId) return equipment;
            const nextPatch = { ...patch };
            if (Object.prototype.hasOwnProperty.call(patch, "serialStatus") && patch.serialStatus === "present") nextPatch.serialReason = "";
            if (Object.prototype.hasOwnProperty.call(patch, "serialStatus") && patch.serialStatus === "not-available") nextPatch.serialNo = "";
            if (Object.prototype.hasOwnProperty.call(patch, "parentSystemId") && isWimEquipment(equipment)) {
              const parent = getWimSortingSystemById(entry.stationSystems, patch.parentSystemId);
              nextPatch.parentSystemId = parent?.id || null;
              nextPatch.laneId = parent?.laneId || null;
              nextPatch.scope = parent?.scope || null;
            }
            return { ...equipment, ...nextPatch };
          });
          return {
            ...entry,
            equipment: synchronizeGeneratedAssetNos(equipment, entry.stationSystems),
            readinessConfirmedAt: null,
          };
        }),
      }));
    };
    const addStation = () => { navigate("#/stations/new"); };
    const nextEquipmentIndex = (equipment, type, scope = "") => {
      const definition = getEquipmentType(type);
      return getNextEquipmentIndex(equipment, { type, prefix: definition.prefix, scope });
    };
    const canonicalItems = useMemo(() => getCanonicalItemsForFormat(profile?.stationFormat), [profile?.stationFormat]);
    const itemCatalog = useMemo(() => {
      const allowedTypes = new Set(canonicalItems.filter((item) => item.kind === "asset").map((item) => item.equipmentType).filter(Boolean));
      return normalizeItemCatalog(state.itemCatalog, { includeWimElectronics: true }).filter((item) => item.kind === "custom" || allowedTypes.has(item.type));
    }, [canonicalItems, state.itemCatalog]);
    const addCanonicalSystem = (item, quantity = 1, options = {}) => {
      if (!profile || profile.active === false || item?.kind !== "system") return;
      if (item.id === WIM_SORTING_SYSTEM_CANONICAL_ID) {
        const requestedQuantity = Math.max(1, Math.min(99, Number(quantity) || 1));
        const laneIds = Array.isArray(options?.laneIds) ? options.laneIds.slice(0, requestedQuantity) : [];
        const activeLaneIds = new Set((profile.lanes || []).filter((lane) => lane.active !== false).map((lane) => lane.id));
        const currentWimLanes = new Set(getWimSortingSystemInstances(profile.stationSystems).map((system) => system.laneId));
        if (laneIds.length !== requestedQuantity || laneIds.some((laneId) => !activeLaneIds.has(laneId)) || new Set(laneIds).size !== laneIds.length || laneIds.some((laneId) => currentWimLanes.has(laneId))) {
          notify("WIM Sorting System ต้องเลือก Lane ที่ติดตั้งจริง และ 1 Lane มีได้ 1 ระบบ");
          return;
        }
        const nextInstanceNo = Math.max(0, ...getWimSortingSystemInstances(profile.stationSystems).map((system) => Number(system.instanceNo) || 0));
        const nextSystems = laneIds.map((laneId, index) => ({
          id: createId("wim-sorting"),
          canonicalItemId: WIM_SORTING_SYSTEM_CANONICAL_ID,
          systemId: WIM_SORTING_SYSTEM_CANONICAL_ID,
          componentId: "sorting",
          displayLabel: item.nameTh,
          nameEn: item.nameEn,
          sourceLabel: item.nameEn,
          sourceRefs: [...(item.checklistMapping || [])],
          quantity: 1,
          referenceUnit: item.defaultUnit,
          unit: item.defaultUnit,
          scope: options.scope || item.allowedScopes[0],
          note: "",
          laneId,
          instanceNo: nextInstanceNo + index + 1,
          checklistMapping: [...item.checklistMapping],
          active: true,
          recordKind: "system",
        }));
        updateProfile("stationSystems", [...profile.stationSystems, ...nextSystems]);
        return;
      }
      const next = { id: createId("system"), canonicalItemId: item.id, systemId: item.id, componentId: "canonical", displayLabel: item.nameTh, sourceLabel: item.nameEn, quantity: 1, referenceUnit: item.defaultUnit, unit: item.defaultUnit, scope: options.scope || item.allowedScopes[0], note: "", checklistMapping: [...item.checklistMapping], active: true, recordKind: "system" };
      updateProfile("stationSystems", [...profile.stationSystems, next]);
    };
    const updateCanonicalSystem = (id, field, value) => {
      const currentSystem = profile.stationSystems.find((entry) => entry.id === id);
      if (isWimSortingSystemRecord(currentSystem) && field === "laneId") {
        const laneId = String(value || "").trim() || null;
        const laneExists = profile.lanes.some((lane) => lane.active !== false && lane.id === laneId);
        const duplicate = getWimSortingSystemInstances(profile.stationSystems).some((system) => system.id !== id && system.laneId === laneId);
        if (!laneExists || duplicate) { notify("WIM Sorting System ต้องผูกกับ Lane ที่ยังไม่มีระบบ WIM อื่น"); return; }
        update((current) => ({ ...current, stationProfiles: current.stationProfiles.map((entry) => entry.id === profile.id ? { ...entry, stationSystems: entry.stationSystems.map((system) => system.id === id ? { ...system, laneId } : system), equipment: entry.equipment.map((equipment) => equipment.parentSystemId === id ? { ...equipment, laneId } : equipment), readinessConfirmedAt: null } : entry) }));
        return;
      }
      if (isWimSortingSystemRecord(currentSystem) && field === "quantity") return;
      const nextValue = field === "quantity" ? Math.max(0, Number(value || 0)) : value;
      update((current) => ({
        ...current,
        stationProfiles: current.stationProfiles.map((entry) => {
          if (entry.id !== profile.id) return entry;
          const nextLanes = field === "scope" && isWimSortingSystemRecord(currentSystem)
            ? setLaneScope(entry.lanes || [], currentSystem.laneId, nextValue, entry.stationSystems)
            : entry.lanes;
          const scopedLane = nextLanes.find((lane) => lane.id === currentSystem?.laneId);
          const nextSystems = entry.stationSystems.map((system) => system.id === id
            ? { ...system, [field]: nextValue, ...(field === "scope" && isWimSortingSystemRecord(currentSystem) && scopedLane ? { instanceNo: scopedLane.laneNo } : {}) }
            : system);
          const parentCabinetIds = new Set((entry.equipment || [])
            .filter((equipment) => equipment.type === "CONTROL_CABINET" && equipment.parentSystemId === id)
            .map((equipment) => equipment.id));
          const nextEquipment = field === "scope" ? (entry.equipment || []).map((equipment) => equipment.parentSystemId === id || parentCabinetIds.has(equipment.parentAssetId)
            ? { ...equipment, scope: nextValue }
            : equipment) : entry.equipment;
          return { ...entry, stationSystems: nextSystems, equipment: synchronizeGeneratedAssetNos(nextEquipment, nextSystems), lanes: nextLanes, readinessConfirmedAt: null };
        }),
      }));
    };
    const removeCanonicalSystem = (id) => {
      const ownedCabinetIds = new Set(profile.equipment.filter((equipment) => equipment.type === "CONTROL_CABINET" && equipment.active !== false && equipment.parentSystemId === id).map((equipment) => equipment.id));
      const children = profile.equipment.filter((equipment) => equipment.active !== false && (equipment.parentSystemId === id || ownedCabinetIds.has(equipment.parentAssetId)));
      if (children.length) { notify(`ยังนำ System ออกไม่ได้ เพราะมีอุปกรณ์ผูกอยู่ ${children.length} รายการ`); return; }
      updateProfile("stationSystems", profile.stationSystems.filter((entry) => entry.id !== id));
    };
    const addCatalogEquipment = (catalogItem, quantity = 1, options = {}) => {
      if (!profile || profile.active === false || !catalogItem) return;
      const requestedQuantity = Math.max(1, Math.min(99, Number(quantity) || 1));
      const laneIds = Array.isArray(options?.laneIds) ? options.laneIds : [];
      const wimSystemIds = Array.isArray(options?.wimSystemIds) ? options.wimSystemIds : [];
      const isWimAsset = isWimEquipment(catalogItem.kind === "custom" ? null : { type: catalogItem.type });
      const isWimElectronicsChild = isWimElectronicsSubEquipmentType(catalogItem.type);
      if (isWimAsset && (wimSystemIds.length !== requestedQuantity || wimSystemIds.some((id) => !getWimSortingSystemById(profile.stationSystems, id)))) {
        notify("WIM Sensor/Loop ต้องเลือก WIM Sorting System แม่ก่อนเพิ่ม");
        return;
      }
      const parentCabinet = isWimElectronicsChild ? (profile.equipment || []).find((asset) => asset.id === options.parentAssetId && asset.type === "CONTROL_CABINET" && asset.active !== false) : null;
      const selectedParentSystem = (profile.stationSystems || []).find((system) => system.id === options.parentSystemId && system.active !== false) || null;
      if (isWimElectronicsChild && !parentCabinet) { notify("อุปกรณ์ WIM Electronics ต้องเลือก Cabinet แม่ก่อนเพิ่ม"); return; }
      if ((catalogItem.type === "CONTROL_CABINET" || isWimElectronicsChild) && !selectedParentSystem) { notify("อุปกรณ์ WIM Electronics ต้องผูกกับ WIM Electronics System แม่ก่อนเพิ่ม"); return; }
      update((current) => {
        const currentProfile = current.stationProfiles.find((entry) => entry.id === profile.id);
        if (!currentProfile) return current;
        const nextEquipment = [...(currentProfile.equipment || [])];
        for (let index = 0; index < requestedQuantity; index += 1) {
          const parentSystemId = isWimAsset ? wimSystemIds[index] : options.parentSystemId || parentCabinet?.parentSystemId || null;
          const parentSystem = parentSystemId ? getWimSortingSystemById(currentProfile.stationSystems, parentSystemId)
            || currentProfile.stationSystems?.find((system) => system.id === parentSystemId)
            || null : null;
          const parentAsset = isWimElectronicsChild ? (currentProfile.equipment || []).find((asset) => asset.id === options.parentAssetId && asset.type === "CONTROL_CABINET" && asset.active !== false) : null;
          const scope = parentAsset?.scope || parentSystem?.scope || options.scope || null;
          const nextIndex = getNextEquipmentIndex(nextEquipment, {
            type: catalogItem.kind === "custom" ? "CUSTOM" : catalogItem.type,
            prefix: catalogItem.prefix,
            scope,
          });
          const next = makeEquipmentFromCatalogItem(catalogItem, nextIndex, { location: "", laneId: parentSystem?.laneId || (isWimAsset ? null : laneIds[index] || null), parentSystemId, parentAssetId: parentAsset?.id || options.parentAssetId || null, scope, assetNoMode: "generated" });
          if ((next?.type === "CONTROL_CABINET" || isWimElectronicsChild) && getWimElectronicsHierarchyIssue(next, [...nextEquipment, next], currentProfile.stationSystems)) {
            notify("WIM Electronics ต้องผูกกับ System และ Cabinet ที่มี Scope ตรงกัน");
            return current;
          }
          if (!next || nextEquipment.some((item) => item.assetNo === next.assetNo)) return current;
          nextEquipment.push(next);
        }
        return {
          ...current,
          stationProfiles: current.stationProfiles.map((entry) => entry.id === profile.id ? { ...entry, equipment: nextEquipment, readinessConfirmedAt: null } : entry),
        };
      }, requestedQuantity === 1 ? `เพิ่ม ${getCatalogItemDisplayLabel(catalogItem)} เข้าทะเบียนแล้ว` : `เพิ่ม ${getCatalogItemDisplayLabel(catalogItem)} ${requestedQuantity} รายการเข้าทะเบียนแล้ว`);
    };
    const changeQuantity = async (type, delta) => {
      if (!profile || profile.active === false) return;
      if (delta > 0 && isWimEquipment({ type })) {
        notify("เพิ่ม WIM Sensor/Loop ผ่านปุ่มเพิ่มอุปกรณ์ เพื่อเลือก WIM Sorting System แม่");
        return;
      }
      if (delta > 0 && canonicalItems.some((item) => item.kind === "asset" && item.equipmentType === type && item.systemIds?.length)) {
        notify("เพิ่มอุปกรณ์ผ่านปุ่มเพิ่มอุปกรณ์ เพื่อผูกกับ System แม่และรับ Scope ให้อัตโนมัติ");
        return;
      }
      const currentItems = profile.equipment.filter((equipment) => equipment.type === type);
      const activeItems = currentItems.filter((equipment) => equipment.active !== false);
      if (delta > 0) {
        const existingScopes = [...new Set(activeItems.map((item) => item.scope).filter(Boolean))];
        if (existingScopes.length !== 1) {
          notify("กรุณาเพิ่มผ่านคลังอุปกรณ์และเลือกชุดระบบก่อน เพื่อให้เลข Checklist ตรงกัน");
          return;
        }
        const next = makeEquipment(type, nextEquipmentIndex(profile.equipment, type, existingScopes[0]), { location: "ระบุตำแหน่ง", scope: existingScopes[0] });
        update((current) => ({ ...current, stationProfiles: current.stationProfiles.map((entry) => entry.id === profile.id ? { ...entry, equipment: [...entry.equipment, next] } : entry) }), `เพิ่ม ${getEquipmentDisplayLabel({ type })} แล้ว`);
        return;
      }
      const candidate = activeItems[activeItems.length - 1];
      if (!candidate) return;
      const hasSnapshotReference = referenced(candidate.id);
      const label = `${getEquipmentDisplayLabel(candidate)} ${candidate.assetNo || "รายการสุดท้าย"}`;
      const message = hasSnapshotReference
        ? `ยืนยันลดจำนวน ${label} หรือไม่? อุปกรณ์นี้อยู่ใน Snapshot เก่า ระบบจะปิดใช้งานในสถานีปัจจุบันแทนการลบ และประวัติเดิมจะไม่เปลี่ยน`
        : `ยืนยันลดจำนวน ${label} หรือไม่? รายการนี้ยังไม่ถูกใช้ใน Snapshot และจะถูกลบจากทะเบียนสถานี`;
      const confirmed = await requestConfirm({ title: `ลดจำนวน ${label}`, description: message, confirmLabel: "ยืนยันลดจำนวน" });
      if (!confirmed) return;
      update((current) => ({ ...current, stationProfiles: current.stationProfiles.map((entry) => entry.id === profile.id ? { ...entry, equipment: hasSnapshotReference ? entry.equipment.map((item) => item.id === candidate.id ? { ...item, active: false } : item) : entry.equipment.filter((item) => item.id !== candidate.id) } : entry) }), hasSnapshotReference ? "ปิดใช้งานอุปกรณ์แล้ว" : "ลดจำนวนอุปกรณ์แล้ว");
    };
    const removeEquipment = (equipment) => {
      if (profile?.active === false) { notify("สถานีปิดใช้งานอยู่ ให้เปิดใช้งานก่อนแก้ทะเบียน"); return; }
      if (referenced(equipment.id)) { notify("อุปกรณ์นี้ถูกใช้ใน Snapshot แล้ว ให้ปิดใช้งานแทนการลบ"); return; }
      void requestConfirm({ title: `ลบ ${equipment.assetNo || getEquipmentDisplayLabel(equipment)}`, description: "อุปกรณ์นี้ยังไม่ถูกใช้ใน Snapshot และจะถูกลบออกจากทะเบียนสถานีปัจจุบัน", confirmLabel: "ยืนยันลบอุปกรณ์" }).then((confirmed) => {
        if (!confirmed) return;
        update((current) => ({ ...current, stationProfiles: current.stationProfiles.map((entry) => entry.id === profile.id ? { ...entry, equipment: entry.equipment.filter((item) => item.id !== equipment.id) } : entry) }), "ลบอุปกรณ์แล้ว");
      });
    };
    const toggleChecklist = (templateId, enabled) => {
      if (profile?.active === false) { notify("สถานีปิดใช้งานอยู่ ให้เปิดใช้งานก่อนแก้ Checklist"); return; }
      update((current) => {
        const currentProfile = profileFor(current, profile?.id);
        const checklistConfig = setStationChecklistItemEnabled(currentProfile, templateId, enabled);
        return { ...current, stationProfiles: current.stationProfiles.map((entry) => entry.id === profile?.id ? { ...entry, checklistConfig } : entry) };
      }, enabled ? "เปิดใช้รายการตรวจแล้ว" : "ปิดรายการตรวจสำหรับสถานีนี้แล้ว");
    };
    const displayEquipment = (profile?.equipment || []).filter((equipment) => !getEquipmentType(equipment.type)?.legacyOnly && equipment.type !== "LANE");
    const activeEquipment = getActivePhysicalEquipment(profile?.equipment);
    const inactiveEquipment = displayEquipment.filter((equipment) => equipment.active === false);
    const equipmentRegisterGroups = getEquipmentGroupsForRegister(profile?.equipment, { includeEmptyGroups: true, lanes: profile?.lanes }).filter((group) => group.code !== "1.1.11");
    const equipmentGroups = getEquipmentGroupsForRegister(profile?.equipment, { lanes: profile?.lanes }).filter((group) => group.code !== "1.1.11");
    const checklistDisplayProfile = profile ? { ...profile, checklistCopy: state.checklistCopy, checklistPresentationVersion: BOQ_CHECKLIST_PRESENTATION_VERSION } : null;
    const masterConfigItems = checklistDisplayProfile ? getStationChecklistItems(checklistDisplayProfile, { includeDisabled: true }) : [];
    const masterConfigSections = checklistDisplayProfile ? getStationChecklistSections(checklistDisplayProfile, { includeDisabled: true }) : [];
    const isMasterConfigDisabled = (item) => item.checklistDisabled;
    const enabledMasterConfigCount = masterConfigItems.filter((item) => !isMasterConfigDisabled(item)).length;
    const disabledMasterConfigCount = masterConfigItems.length - enabledMasterConfigCount;
    const previewSnapshot = profile ? { checklistPolicyVersion: CHECKLIST_POLICY_VERSION, orderingVersion: EQUIPMENT_ORDER_VERSION, stationId: profile.id, stationFormat: profile.stationFormat, checklistPresentationVersion: BOQ_CHECKLIST_PRESENTATION_VERSION, stationCode: profile.stationCode, stationName: profile.stationName, stationSystems: profile.stationSystems, torItems: profile.torItems, lanes: profile.lanes, equipment: activeEquipment, checklistConfig: profile.checklistConfig, templateVersion: STATION_DRAFT_TEMPLATE_VERSION, cleaningPolicyVersion: CLEANING_POLICY_VERSION, checklistCopy: state.checklistCopy, masterChecklistCopy: state.masterChecklistCopy } : null;
    const previewItems = previewSnapshot ? getNewRoundChecklistItems(previewSnapshot) : [];
    const previewApplicable = previewItems.filter((item) => item.applicable !== false).length;
    const previewNotApplicable = masterConfigItems.filter((item) => item.checklistDisabled).length;
    const stationRounds = profile ? state.inspectionRounds.filter((round) => belongsToStation(round, profile.id)) : [];
  
    return <StationProfileRedesigned
      state={state}
      profile={profile}
      setSelected={setSelected}
      addStation={addStation}
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
      requestConfirm={requestConfirm}
    />;
  
    return <section className="ops-page">
    <Breadcrumb items={[{ label: "ทะเบียนสถานี", href: "#/stations" }, { label: profile?.stationCode || "รายละเอียดสถานี", mono: Boolean(profile) }]} />
      <PageHeader eyebrow="STATION PROFILE" title={profile?.stationName || "รายละเอียดสถานี"} description="แก้ไขข้อมูลแม่ของสถานีสำหรับรอบการตรวจถัดไป การแก้ไขจะไม่เปลี่ยนข้อมูล ณ วันที่เริ่มรอบการตรวจเดิม" actions={<div className="ops-page-actions"><Button href="#/stations" icon="arrow">กลับทะเบียนสถานี</Button><Button onClick={addStation} variant="primary" icon="plus">สร้างสถานี</Button></div>} />
      <section className="ops-panel station-panel"><div className="ops-panel-toolbar"><StationSelect profiles={state.stationProfiles} value={profile?.id} onChange={setSelected} label="สถานีที่กำลังแก้ไข" includeInactive /><span className="ops-inline-note"><Icon name="save" />บันทึกอัตโนมัติ</span></div>{profile ? <><div className="ops-station-form"><label className="ops-field ops-code-field"><span>รหัสสถานี</span><input value={profile.stationCode} disabled={profile.active === false} onChange={(event) => updateProfile("stationCode", event.target.value)} placeholder="เช่น NKS-OUT" /></label><label className="ops-field ops-field-wide"><span>ชื่อสถานี</span><input value={profile.stationName} disabled={profile.active === false} onChange={(event) => updateProfile("stationName", event.target.value)} placeholder="ชื่อสถานีหรือจุดติดตั้ง" /></label></div><div className="ops-station-profile-actions"><div className={`ops-info-banner ${profile.active === false ? "is-archived" : ""}`}><Icon name={profile.active === false ? "archive" : "info"} /><span>{profile.active === false ? "สถานีนี้ถูกปิดใช้งาน จึงไม่แสดงในตัวเลือกสร้างรอบการตรวจใหม่ แต่ประวัติและข้อมูลประจำรอบเดิมยังอยู่" : "การปรับจำนวนอุปกรณ์และเปิด/ปิดรายการตรวจมีผลกับรอบการตรวจใหม่เท่านั้น รอบที่สร้างข้อมูลประจำรอบแล้วและประวัติเดิมจะไม่เปลี่ยน"}</span></div><Button onClick={() => onArchiveStation(profile)} variant={profile.active === false ? "secondary" : "danger-ghost"} icon={profile.active === false ? "refresh" : "archive"}>{profile.active === false ? "เปิดใช้งานสถานี" : "ปิดใช้งานสถานี"}</Button><Button onClick={() => onPurgeStation(profile)} variant="danger" icon="delete">ลบสถานีถาวร</Button></div></> : <EmptyState title="ยังไม่มีสถานี" action={<Button onClick={addStation} variant="primary" icon="plus">สร้างสถานี</Button>}>สร้างสถานีแรกเพื่อเริ่มเพิ่มอุปกรณ์</EmptyState>}</section>
      {profile && <>
          <section className="ops-panel"><StationTorSummary items={profile.torItems} equipment={activeEquipment} /><StationSystemsSummary systems={profile.stationSystems} equipment={activeEquipment} /></section>
          <section className="ops-panel ops-lane-topology-panel"><LaneAssignmentStep stationFormat={profile.stationFormat} lanes={profile.lanes} equipment={activeEquipment} stationSystems={profile.stationSystems} disabled={profile.active === false} headingEyebrow="LANE TOPOLOGY" headingTitle="กำหนดเลนและผูก Sensor / Loop" headingDescription="โครงสร้าง Lane แยกจากอุปกรณ์ และมีผลกับรอบการตรวจใหม่เท่านั้น" onChangeLanes={updateStationLanes} onAssignLane={assignStationLane} onAddLane={addStationLane} onRemoveLane={removeStationLane} /></section>
          <section className="ops-panel equipment-panel">
           <div className="ops-panel-heading"><div><p className="ops-eyebrow">EQUIPMENT REGISTER</p><h3>ทะเบียนอุปกรณ์</h3><span className="ops-heading-note">ใช้งาน {activeEquipment.length} รายการ · ปิดใช้งาน {inactiveEquipment.length} รายการ · ทั้งหมด {displayEquipment.length} รายการ</span></div></div>
            <EquipmentCatalogAddPanel catalog={itemCatalog} stationFormat={profile.stationFormat} stationSystems={profile.stationSystems} disabled={profile.active === false} onAdd={addCatalogEquipment} />
            <div className="ops-equipment-quantity-group-list" aria-label="ปรับจำนวนอุปกรณ์ตามหมวด BOQ">{equipmentRegisterGroups.map((group) => { const groupItems = group.types.flatMap((type) => type.items); const groupActiveCount = groupItems.filter((equipment) => equipment.active !== false).length; const groupInactiveCount = groupItems.length - groupActiveCount; return <section className="ops-equipment-quantity-group" key={group.code} aria-labelledby={`equipment-quantity-group-${group.code}`}><div className="ops-equipment-quantity-group-heading"><span className="ops-config-section-code">{group.code}</span><div><h4 id={`equipment-quantity-group-${group.code}`}>{group.title}</h4><span>{groupActiveCount} ใช้งาน{groupInactiveCount ? ` · ${groupInactiveCount} ปิดใช้งาน` : ""} · {groupItems.length} รายการ</span></div></div><div className="ops-equipment-quantity-subtypes">{group.types.map((type) => { const all = type.items; const activeCount = all.filter((equipment) => equipment.active !== false).length; const inactiveCount = all.length - activeCount; const typeLabel = getEquipmentTypeDisplayLabel(type); return <div className="ops-quantity-row" key={type.value}><div className="ops-quantity-name"><span className="ops-equipment-icon"><Icon name={getEquipmentIconName(type.value)} /></span><div><strong>{typeLabel}</strong><span>{activeCount ? `กำลังใช้งาน ${activeCount} รายการ` : "ยังไม่มีอุปกรณ์ใช้งาน"}{inactiveCount ? ` · ปิดใช้งาน ${inactiveCount}` : ""}</span></div></div><div className="ops-quantity-controls"><button type="button" className="ops-quantity-button" onClick={() => changeQuantity(type.value, -1)} disabled={!activeCount || profile.active === false} aria-label={`ลดจำนวน ${typeLabel}`}><span aria-hidden="true">−</span></button><output className="ops-quantity-count" aria-label={`จำนวนใช้งาน ${typeLabel}`}>{activeCount}</output><button type="button" className="ops-quantity-button" onClick={() => changeQuantity(type.value, 1)} disabled={profile.active === false} aria-label={`เพิ่มจำนวน ${typeLabel}`}><span aria-hidden="true">+</span></button></div></div>; })}</div></section>; })}</div>
           {displayEquipment.length ? <div className="ops-equipment-list"><div className="ops-subsection-heading"><strong>รายละเอียดอุปกรณ์รายตัว</strong><span>จัดตามหมวด BOQ และประเภทย่อย · แก้รหัสอุปกรณ์ (Asset No.), ตำแหน่ง และ Serial Number ได้จากรายการด้านล่าง</span></div><div className="ops-equipment-group-list">{equipmentGroups.map((group) => { const groupItems = group.types.flatMap((type) => type.items); const activeCount = groupItems.filter((equipment) => equipment.active !== false).length; const inactiveCount = groupItems.length - activeCount; return <section className="ops-equipment-group" key={group.code} aria-labelledby={`equipment-group-${group.code}`}><div className="ops-equipment-group-heading"><span className="ops-config-section-code">{group.code}</span><div><h4 id={`equipment-group-${group.code}`}>{group.title}</h4><span>{activeCount} ใช้งาน{inactiveCount ? ` · ${inactiveCount} ปิดใช้งาน` : ""} · {groupItems.length} รายการ</span></div></div><div className="ops-equipment-subgroups">{group.types.map((type) => <section className="ops-equipment-subgroup" key={type.value} aria-labelledby={`equipment-subgroup-${group.code}-${type.value}`}><div className="ops-equipment-subgroup-heading"><h5 id={`equipment-subgroup-${group.code}-${type.value}`}>{type.label}</h5><span>{type.items.length} รายการ</span></div><div className="ops-equipment-subgroup-items">{type.items.map((equipment) => <EquipmentRow key={equipment.id} equipment={equipment} stationSystems={profile.stationSystems} canonicalItems={getCanonicalItemsForFormat(profile.stationFormat)} isReferenced={referenced(equipment.id)} disabled={profile.active === false} onChange={updateEquipment} onRemove={removeEquipment} />)}</div></section>)}</div></section>; })}</div></div> : <EmptyState icon="equipment" title="ยังไม่มีอุปกรณ์ในสถานีนี้">กดปุ่ม + ของประเภทอุปกรณ์ที่ต้องการเพิ่ม</EmptyState>}
         </section>
        <section className="ops-panel ops-checklist-config"><div className="ops-panel-heading"><div><p className="ops-eyebrow">STATION CHECKLIST CONFIGURATION</p><h3>การตั้งค่ารายการตรวจประจำสถานี</h3><span className="ops-heading-note">เปิดใช้ {enabledMasterConfigCount} จาก {masterConfigItems.length} รายการ · ปิด {disabledMasterConfigCount} รายการ</span></div><StatusBadge status={disabledMasterConfigCount ? "waiting" : "normal"}>{disabledMasterConfigCount ? "มีรายการปิดใช้งาน" : "เปิดใช้ครบ"}</StatusBadge></div><p className="ops-section-description">หน้านี้แสดง {masterConfigSections.length} หมวด / {masterConfigItems.length} รายการที่คำนวณจากอุปกรณ์จริงเพื่อเปิดหรือปิดกติกาต่อสถานี ส่วนรายการหลักฐานกลางจากเอกสาร BOQ มี {EVIDENCE_CHECKLIST_SECTIONS.length} หมวด / 170 รายการ; รอบใหม่จะคำนวณช่องจากอุปกรณ์จริงและนโยบายของข้อมูลประจำรอบ ส่วนข้อมูลประจำรอบที่ผ่าน migration จะไม่แสดงหัวข้อวิดีโอเดิมอีก ช่องที่ต้องผูกอุปกรณ์จริงแต่ไม่มีอุปกรณ์ในข้อมูลประจำรอบจะเป็น “ไม่เกี่ยวข้อง” และไม่รวมในความคืบหน้า</p><div className="ops-config-list">{masterConfigSections.map((section, sectionIndex) => <details className="ops-config-section" key={section.code} open={sectionIndex === 0}><summary><span className="ops-config-section-code">{section.code}</span><span className="ops-config-section-title">{section.title}</span><small>{section.items.filter((item) => !isMasterConfigDisabled(item)).length}/{section.items.length} รายการ</small></summary><div className="ops-config-items">{section.items.map((item) => { const disabled = isMasterConfigDisabled(item); return <div className={`ops-config-item ${disabled ? "is-disabled" : ""}`} key={item.id}><div><strong>{item.label}</strong><span>{item.unit || "ข้อมูล"} · {disabled ? "ปิดใช้งานสำหรับสถานีนี้" : "ใช้เป็นกติกาของรอบการตรวจใหม่"}</span></div><button type="button" className={`ops-config-toggle ${disabled ? "is-disabled" : "is-enabled"}`} aria-pressed={!disabled} aria-label={`${disabled ? "เปิด" : "ปิด"} ${item.label}`} onClick={() => toggleChecklist(item.id, disabled)}><Icon name={disabled ? "close" : "check"} /><span>{disabled ? "ปิด" : "เปิด"}</span></button></div>; })}</div></details>)}</div></section>
        <section className="ops-panel ops-station-preview"><div className="ops-panel-heading"><div><p className="ops-eyebrow">NEXT ROUND PREVIEW</p><h3>ตัวอย่างรายการของรอบการตรวจใหม่</h3><span className="ops-heading-note">ระบบจะใช้ค่าปัจจุบันเมื่อเริ่มรอบตรวจจากงวดงานเท่านั้น</span></div><Icon name="archive" /></div><div className="ops-preview-metrics"><div><strong>{activeEquipment.length}</strong><span>อุปกรณ์จริงที่ใช้งาน</span></div><div><strong>{previewApplicable}</strong><span>รายการตรวจที่เกี่ยวข้อง</span></div><div><strong>{previewNotApplicable}</strong><span>ไม่เกี่ยวข้อง / ปิดใช้งาน</span></div></div><p className="ops-section-description">อุปกรณ์จริงที่เพิ่มเกินแม่แบบจะสร้างรายการต่อจากลำดับสุดท้ายโดยอัตโนมัติ เช่น LPR #4 และ #5</p></section>
      </>}
    </section>;
  }
}
