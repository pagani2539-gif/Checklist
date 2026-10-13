import { sortElectronicsByCabinet, electronicsTypeOrder } from "../domain/wim-electronics-order.js";
import { AppIcon as Icon } from "./icon-system.jsx";
import { Button } from "./controls/ActionControls.jsx";
import { groupEquipmentBySubcategory } from "../domain/equipment-subcategories.js";

function statusMeta(status) {
  if (status === "inactive") return { label: "ปิดใช้งาน", className: "is-inactive" };
  if (status === "blocker") return { label: "ต้องแก้", className: "is-blocker" };
  if (status === "warning") return { label: "ควรเติม", className: "is-warning" };
  return { label: "พร้อม", className: "is-complete" };
}

function sameScope(left, right) {
  return String(left || "").trim().toLocaleLowerCase() === String(right || "").trim().toLocaleLowerCase();
}

export default function StationRelationshipRegister({
  tree = [],
  expandedGroupId = "",
  onToggleGroup,
  onAdd,
  selectedId,
  selectedKind,
  editingId,
  editingKind,
  onEdit,
  onDelete,
  onSelect,
  renderInlineEditor,
  activeLanes = [],
  stationSystems = [],
  systemDefinitionsById,
  activeCategoryKey = "",
  getSystemDisplayLabel,
  getAssetDisplayLabel,
  isWimEquipment,
  getWimSortingSystemById,
  isWimSortingSystemRecord,
  assetStatusFor,
  systemStatusFor,
  getRelationshipPath,
  getSystemSecondaryLabel,
  getAssetSecondaryLabel,
  alwaysExpanded = false,
  onAddLane,
  editingLaneId,
  onEditLane,
  onDeleteLane,
  renderLaneEditor,
  showMissingRows = false,
}) {
  const renderEquipmentSubcategories = (systemCanonicalId, items, renderItem) => groupEquipmentBySubcategory(
    systemCanonicalId,
    items,
    (item) => item?.equipmentType || item?.type,
  ).map(({ subcategory, items: groupedItems }) => <div className="ops-equipment-subcategory" key={subcategory.id} role="group" aria-label={`${subcategory.titleEn} · ${subcategory.titleTh}`}>
    <header className="ops-equipment-subcategory-heading"><strong>{subcategory.titleEn}</strong><small>{subcategory.titleTh}</small></header>
    <div className="ops-equipment-subcategory-items">{groupedItems.map(renderItem)}</div>
  </div>);

  const renderSystemRecord = (system, category) => {
    const definition = systemDefinitionsById?.get(system.canonicalItemId);
    const isWimInstance = isWimSortingSystemRecord(system);
    const isLprInstance = String(system.canonicalItemId || system.systemId || "") === "lpr-control";
    const meta = statusMeta(systemStatusFor ? systemStatusFor(system) : "ready");
    const label = getSystemDisplayLabel(system);
    const secondaryLabel = getSystemSecondaryLabel?.(system);
    const lane = activeLanes.find((entry) => entry.id === system.laneId);
    const path = getRelationshipPath({ format: category.format, categoryId: category.id, scope: system.scope, kind: "system" });
    const isEditing = editingId === system.id && editingKind === "system";
    return <div className={`sc-relation-entry ${selectedKind === "system" && selectedId === system.id ? "is-selected" : ""}`} key={system.id} id={`sc-system-row-${system.id}`}>
      <div className="sc-relation-record is-system">
        <span className="sc-relation-record-kind">SYSTEM</span>
        <span className="sc-relation-record-copy"><strong>{isWimInstance ? `${label} #${system.instanceNo || "?"}` : label}</strong>{secondaryLabel && secondaryLabel !== label && <small className="sc-relation-name-th">{secondaryLabel}</small>}<small>{path} · {definition?.category || system.sourceRefs?.join(", ") || "Canonical System"}</small></span>
        <span className="sc-relation-record-meta">{system.quantity ?? 0} {system.unit || system.referenceUnit || definition?.defaultUnit || "ระบบ"}</span>
        <span className="sc-relation-record-meta">{isWimInstance || isLprInstance ? (lane ? `Lane ${lane.laneNo} · ${system.scope || "ไม่ระบุ Scope"}` : "ยังไม่ผูก Lane") : system.scope || "ทุกช่อง"}</span>
        <span className={`sc-status ${meta.className}`}><i />{meta.label}</span>
        <span className="sc-relation-record-actions">{(onEdit || onSelect) && <Button variant="secondary" onClick={() => onEdit ? onEdit(system, "system", category.id) : onSelect(system.id, "system", category.id, system.scope)} aria-label={`แก้ไข ${label}`}>แก้ไข</Button>}{onDelete && <Button variant="danger-ghost" onClick={() => onDelete(system, "system")} aria-label={`ลบ ${label}`}>ลบ</Button>}</span>
      </div>
      {isEditing && renderInlineEditor?.(system, "system")}
    </div>;
  };

  const renderAssetRecord = (entry, category, scope) => {
    const asset = entry.record || entry;
    const parent = entry.parentSystem || getWimSortingSystemById(stationSystems, asset.parentSystemId);
    const lane = parent ? activeLanes.find((candidate) => candidate.id === parent.laneId) : activeLanes.find((candidate) => candidate.id === asset.laneId);
    const meta = statusMeta(assetStatusFor ? assetStatusFor(asset) : (asset.active === false ? "inactive" : "ready"));
    const path = getRelationshipPath({ format: category.format, categoryId: category.id, scope: scope.scope, kind: "asset" });
    const isEditing = editingId === asset.id && editingKind === "asset";
    const label = getAssetDisplayLabel(asset);
    const secondaryLabel = getAssetSecondaryLabel?.(asset);
    const relationHint = entry.association === "catalog-scope-inferred" ? " · จัดใต้ System จากชนิดและ Scope (ไม่บันทึกความสัมพันธ์เพิ่ม)" : "";
    const scopeLabel = parent?.scope || asset.scope || scope.scope || "ไม่ระบุ Scope";
    return <div className={`sc-relation-entry ${selectedKind === "asset" && selectedId === asset.id ? "is-selected" : ""} ${asset.active === false ? "is-inactive" : ""}`} key={asset.id} id={`sc-asset-row-${asset.id}`}>
      <div className="sc-relation-record is-asset">
        <span className="sc-relation-record-kind">EQUIPMENT</span>
        <span className="sc-relation-record-copy"><strong>{label}{isWimEquipment(asset) && parent ? ` · WIM Sorting System #${parent.instanceNo || "?"}` : asset.type === "LPR_CAMERA" && parent ? " · LPR System" : ""}</strong>{secondaryLabel && secondaryLabel !== label && <small className="sc-relation-name-th">{secondaryLabel}</small>}<small>{path} · {asset.location || "ยังไม่ระบุตำแหน่ง"}{relationHint}</small></span>
        <span className="sc-relation-record-meta"><strong className="ops-code">{asset.assetNo || "ยังไม่มี Asset No."}</strong></span>
        <span className="sc-relation-record-meta">{scopeLabel}{isWimEquipment(asset) || asset.type === "LPR_CAMERA" ? ` · ${lane ? `Lane ${lane.laneNo}` : "ยังไม่ผูก Lane"}` : ""}</span>
        <span className={`sc-status ${meta.className}`}><i />{meta.label}</span>
        <span className="sc-relation-record-actions">{(onEdit || onSelect) && <Button variant="secondary" onClick={() => onEdit ? onEdit(asset, "asset", category.id) : onSelect(asset.id, "asset", category.id, scope.scope)} aria-label={`แก้ไข ${label}`}>แก้ไข</Button>}{onDelete && <Button variant="danger-ghost" onClick={() => onDelete(asset, "asset")} aria-label={`ลบ ${label}`}>ลบ</Button>}</span>
      </div>
      {isEditing && renderInlineEditor?.(asset, "asset")}
    </div>;
  };

  const renderEquipmentOption = (option, category, scope, parentSystem = null, disabledByMissingParent = false, hideRecords = false) => {
    const existingEntries = parentSystem?.equipment || [];
    const records = existingEntries.filter((entry) => {
      const asset = entry.record || entry;
      return String(asset.type || "").toUpperCase() === String(option.equipmentType || "").toUpperCase();
    });
    const canAddWimEquipment = !["WIM_SENSOR", "WIM_LOOP"].includes(String(option.equipmentType || "").toUpperCase())
      || (parentSystem && activeLanes.some((lane) => lane.id === parentSystem.record?.laneId || lane.id === parentSystem.laneId));
    const isLprCamera = String(option.equipmentType || "").toUpperCase() === "LPR_CAMERA";
    const lprParent = parentSystem?.record || null;
    const lprLane = isLprCamera && String(lprParent?.canonicalItemId || lprParent?.systemId || "") === "lpr-control"
      ? activeLanes.find((lane) => lane.id === lprParent.laneId)
      : null;
    const canAddLprCamera = !isLprCamera || Boolean(lprLane && records.length === 0);
    return <div className="sc-relationship-choice" key={`${option.id}-${parentSystem?.id || parentSystem?.record?.id || "unowned"}`}>
      <div className="sc-relationship-choice-header"><span className="sc-relation-record-copy"><strong>{option.nameEn || option.nameTh}</strong>{option.nameTh && option.nameTh !== option.nameEn && <small className="sc-relation-name-th">{option.nameTh}</small>}<small>{scope.scope} · BOQ/TOR {option.sourceRefs?.join(", ") || "รายการมาตรฐาน"}</small></span><span className="sc-relationship-choice-count">{isLprCamera ? `${records.length}/1 กล้อง` : `ติดตั้ง ${records.length}`}</span><Button onClick={() => onAdd?.(category.id, "asset", { ...option, ...(parentSystem?.record?.id || parentSystem?.id ? { parentId: parentSystem.record?.id || parentSystem.id } : {}) }, option.groupCode)} variant="secondary" icon="plus" disabled={disabledByMissingParent || !canAddWimEquipment || !canAddLprCamera}>{isLprCamera ? "เพิ่มกล้อง" : "เพิ่ม"}</Button></div>
      {disabledByMissingParent && <small className="sc-relationship-add-requirement">เพิ่ม System แม่ใน Scope นี้ก่อน จึงจะเพิ่ม Equipment ได้</small>}
      {!canAddWimEquipment && <small className="sc-relationship-add-requirement">เพิ่ม Lane และ WIM Sorting System ใน Scope นี้ก่อน เพื่อผูก Sensor/Loop ให้ถูกช่อง</small>}
      {isLprCamera && !lprLane && <small className="sc-relationship-add-requirement">เพิ่มหรือผูก LPR System กับ Lane ใน Scope นี้ก่อน</small>}
      {isLprCamera && records.length > 0 && <small className="sc-relationship-add-requirement">System นี้มีกล้องแล้ว 1 ตัว</small>}
      {!hideRecords && records.map((entry) => renderAssetRecord(entry, category, scope))}
    </div>;
  };

  if (!tree.length) return <div className="sc-relationship-empty"><Icon name="info" pixelSize={18} /><strong>ไม่พบรายการที่แสดงได้</strong><span>หากกำลังค้นหาหรือกรอง ให้ล้างคำค้นหาและตัวกรอง หากยังไม่มีรายการ ให้เพิ่มระบบหรืออุปกรณ์ติดตั้งจริง</span></div>;

  return <div id="sc-relationship-tree" className={`sc-relationship-tree ${alwaysExpanded ? "is-single-group-view" : ""}`} aria-label="ผังความสัมพันธ์ระบบและอุปกรณ์">
    {tree.map((group) => {
      const category = group.categories?.[0] || group;
      const expanded = alwaysExpanded || expandedGroupId === group.groupId;
      const groupHeading = <><span className="sc-system-chevron" aria-hidden="true">›</span><span className="sc-relationship-work-copy"><strong>{group.title || category.label}</strong><small className="sc-relationship-name-th">{group.description || category.description}</small><small>{category.sourceRefs?.length ? `อ้างอิง BOQ/TOR ${category.sourceRefs.join(", ")}` : "จุดติดตั้งของสถานี"}</small></span><span className="sc-relationship-work-count">{category.systemCount} System · {category.assetCount} Equipment</span></>;
      return <article className={`sc-relationship-work-group ${expanded ? "is-expanded" : ""}`} id={`sc-work-group-${group.groupId}`} key={group.groupId}>
        <div className="sc-relationship-work-heading">
          {alwaysExpanded
            ? <div className="sc-relationship-work-toggle is-static" role="heading" aria-level="3">{groupHeading}</div>
            : <button type="button" className="sc-relationship-work-toggle" aria-expanded={expanded} onClick={() => onToggleGroup?.(group.groupId)}>{groupHeading}</button>}
          <span className="sc-relationship-work-status">{category.hasData ? "ติดตั้งแล้ว" : "ตามผัง · ยังไม่ติดตั้ง"}</span>
        </div>
        {(expanded || alwaysExpanded) && <div className="sc-relationship-work-body">
          {category.scopes.filter((scope) => showMissingRows || scope.hasData).map((scope) => {
            const systemIds = new Set(scope.systems.map((node) => node.canonicalItemId));
            const systemRows = scope.systems.map((node) => {
              const system = node.record;
              const option = scope.systemOptions.find((candidate) => candidate.canonicalItemId === node.canonicalItemId);
              const equipmentOptions = node.equipmentOptions?.length ? node.equipmentOptions : (option?.equipmentOptions || []);
              const renderedAssets = new Set();
              return <section className="sc-relationship-parent" key={system.id} data-parent-system-id={system.id}>
                {renderSystemRecord(system, category)}
                <div className="sc-relationship-children" aria-label={`Equipment ใต้ ${getSystemDisplayLabel(system)}`}>
                  {node.canonicalItemId === "wim-electronics-system" ? <>
                    {sortElectronicsByCabinet(node.equipment, entry => entry.record || entry).map(entry => {
                      const asset = entry.record || entry;
                      const cabinet = node.equipment.map(value => value.record || value).find(value => value.id === asset.parentAssetId && value.type === "CONTROL_CABINET");
                      return <div key={asset.id} className="sc-electronics-asset" data-cabinet-id={cabinet?.id || (asset.type === "CONTROL_CABINET" ? asset.id : "unassigned")}>
                        {asset.type === "CONTROL_CABINET" ? <h4>{asset.assetNo || "Cabinet"}</h4> : <small>{cabinet ? `ตู้ ${cabinet.assetNo || cabinet.id}` : "ยังไม่ระบุตู้"}</small>}
                        {renderAssetRecord(entry, category, scope)}
                      </div>;
                    })}
                    <div className="sc-electronics-add-options" aria-label="เพิ่มอุปกรณ์ WIM Electronics">
                      {[...equipmentOptions].sort((a, b) => electronicsTypeOrder(a.equipmentType) - electronicsTypeOrder(b.equipmentType)).map(option => renderEquipmentOption(option, category, scope, node, false, true))}
                    </div>
                  </> : <>
                  {renderEquipmentSubcategories(system.canonicalItemId || system.systemId, equipmentOptions, (equipmentOption) => {
                    const entries = node.equipment.filter((entry) => String((entry.record || entry).type || "").toUpperCase() === String(equipmentOption.equipmentType || "").toUpperCase());
                    entries.forEach((entry) => renderedAssets.add((entry.record || entry).id));
                    return renderEquipmentOption({ ...equipmentOption, id: `${equipmentOption.id}::${system.id}` }, category, scope, node);
                  })}
                  {renderEquipmentSubcategories(system.canonicalItemId || system.systemId, node.equipment.filter((entry) => !renderedAssets.has((entry.record || entry).id)), (entry) => renderAssetRecord(entry, category, scope))}
                  </>}
                  {!equipmentOptions.length && !node.equipment.length && <div className="sc-relationship-kind-empty">System นี้ยังไม่มี Equipment</div>}
                </div>
              </section>;
            });

            const uninstalledOptions = showMissingRows ? scope.systemOptions.filter((option) => !systemIds.has(option.canonicalItemId)) : [];
            return <section className={`sc-relationship-scope ${scope.hasData ? "has-data" : "is-empty"}`} data-station-scope={scope.scope} key={scope.id}>
              <header className="sc-relationship-scope-heading"><span className="sc-system-card-icon"><Icon name="pin" pixelSize={16} /></span><div><strong>Scope · {scope.scope}</strong><small>{scope.systemCount} System · {scope.assetCount} Equipment</small></div></header>
              {category.id === "wim" && <section className="sc-lane-register" aria-label={`Lane ใน Scope ${scope.scope}`}><div className="sc-lane-register-heading"><strong>Lane ของ WIM</strong><span>{activeLanes.filter((lane) => sameScope(lane.scope || stationSystems.find((system) => system.laneId === lane.id)?.scope, scope.scope)).length} Lane</span></div>{activeLanes.filter((lane) => sameScope(lane.scope || stationSystems.find((system) => system.laneId === lane.id)?.scope, scope.scope)).length ? activeLanes.filter((lane) => sameScope(lane.scope || stationSystems.find((system) => system.laneId === lane.id)?.scope, scope.scope)).map((lane) => <div className="sc-lane-register-entry" key={lane.id}><span className="sc-lane-register-icon"><Icon name="lane" size="small" /></span><span className="sc-lane-register-copy"><strong>Lane {lane.laneNo} · {lane.label || "ช่องจราจร"}</strong><small>{lane.direction || "ยังไม่ระบุทิศทาง"} · {stationSystems.some((system) => isWimSortingSystemRecord(system) && system.laneId === lane.id) ? "มี WIM Sorting System" : "ยังไม่มี WIM Sorting System"}</small></span><span className="sc-relation-record-actions">{onEditLane && <Button variant="secondary" onClick={() => onEditLane(lane.id)}>แก้ไข Lane</Button>}{onDeleteLane && <Button variant="danger-ghost" onClick={() => onDeleteLane(lane.id)}>ลบ Lane</Button>}</span>{editingLaneId === lane.id && renderLaneEditor?.(lane)}</div>) : <div className="sc-relationship-kind-empty">ยังไม่มี Lane ใน Scope นี้</div>}</section>}
              <div className="sc-relationship-scope-content">
                {systemRows}
                {uninstalledOptions.map((option) => <section className="sc-relationship-parent is-template" key={option.id}>
                  <div className="sc-relationship-choice"><div className="sc-relationship-choice-header"><span className="sc-relation-record-copy"><strong>{option.nameEn || option.nameTh}</strong>{option.nameTh && option.nameTh !== option.nameEn && <small className="sc-relation-name-th">{option.nameTh}</small>}<small>{scope.scope} · System · BOQ/TOR {option.sourceRefs?.join(", ") || "รายการมาตรฐาน"}</small></span><span className="sc-relationship-choice-count">ยังไม่ติดตั้ง</span><Button onClick={() => onAdd?.(category.id, "system", option, option.groupCode)} variant="secondary" icon="plus">เพิ่ม System</Button></div></div>
                  <div className="sc-relationship-children">{renderEquipmentSubcategories(option.canonicalItemId || option.id, option.equipmentOptions || [], (childOption) => renderEquipmentOption(childOption, category, scope, null, true))}</div>
                </section>)}
                {scope.unlinkedAssets.length > 0 && <section className="sc-relationship-unlinked" aria-label={`Equipment ยังไม่ผูก System ใน Scope ${scope.scope}`}><header><strong>ยังไม่ผูก System</strong><small>แสดงไว้ครบ ไม่ได้เติมหรือแก้ความสัมพันธ์ในข้อมูลสถานี</small></header>{scope.unlinkedAssets.map((entry) => renderAssetRecord(entry, category, scope))}</section>}
                {!systemRows.length && !uninstalledOptions.length && !scope.unlinkedAssets.length && <div className="sc-relationship-kind-empty">Scope นี้ยังไม่มี System หรือ Equipment</div>}
              </div>
            </section>;
          })}
        </div>}
      </article>;
    })}
  </div>;
}
