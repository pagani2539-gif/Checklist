import { AppIcon as Icon } from "./icon-system.jsx";
import { Button } from "./controls/ActionControls.jsx";

const HIDDEN_SYSTEM_CATEGORY_IDS = new Set(["wim-control", "wim-electronics"]);

function statusMeta(status) {
  if (status === "inactive") return { label: "ปิดใช้งาน", className: "is-inactive" };
  if (status === "blocker") return { label: "ต้องแก้", className: "is-blocker" };
  if (status === "warning") return { label: "ควรเติม", className: "is-warning" };
  return { label: "พร้อม", className: "is-complete" };
}

function sameScope(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

function scopeForGroup(format, code) {
  if (format === "IMPS") return "ImPS";
  if (code === "01") return "High Speed";
  if (code === "04") return "Low Speed";
  return "";
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
  getGroupSecondaryLabel,
  getSystemSecondaryLabel,
  getAssetSecondaryLabel,
  alwaysExpanded = false,
  onAddLane,
  editingLaneId,
  onEditLane,
  onDeleteLane,
  renderLaneEditor,
}) {
  const categoryIsActive = (categoryId) => activeCategoryKey === categoryId
    || (activeCategoryKey === "wim" && ["wim-sorting", "wim-control", "wim-electronics", "wim-data-control"].includes(categoryId))
    || (activeCategoryKey === "data-control" && ["wim-data-control", "data", "display-processing"].includes(categoryId));

  const renderSystemRecord = (system, category, group) => {
    const definition = systemDefinitionsById?.get(system.canonicalItemId);
    const isWimInstance = isWimSortingSystemRecord(system);
    const meta = statusMeta(systemStatusFor ? systemStatusFor(system) : "ready");
    const label = getSystemDisplayLabel(system);
    const secondaryLabel = getSystemSecondaryLabel?.(system);
    const lane = activeLanes.find((entry) => entry.id === system.laneId);
    const path = getRelationshipPath({ format: group.format, groupCode: group.code, categoryId: category.id, kind: "system" });
    const isEditing = editingId === system.id && editingKind === "system";
    return <div className={`sc-relation-entry ${selectedKind === "system" && selectedId === system.id ? "is-selected" : ""}`} key={system.id} id={`sc-system-row-${system.id}`}>
      <div className="sc-relation-record is-system">
        <span className="sc-relation-record-kind">SYSTEM</span>
        <span className="sc-relation-record-copy"><strong>{isWimInstance ? `${label} #${system.instanceNo || "?"}` : label}</strong>{secondaryLabel && secondaryLabel !== label && <small className="sc-relation-name-th">{secondaryLabel}</small>}<small>{path} · {definition?.category || system.sourceRefs?.join(", ") || "Canonical System"}</small></span>
        <span className="sc-relation-record-meta">{system.quantity ?? 0} {system.unit || system.referenceUnit || definition?.defaultUnit || "ระบบ"}</span>
        <span className="sc-relation-record-meta">{isWimInstance ? (lane ? `Lane ${lane.laneNo}` : "ยังไม่ผูก Lane") : system.scope || "ทุกช่อง"}</span>
        <span className={`sc-status ${meta.className}`}><i />{meta.label}</span>
        <span className="sc-relation-record-actions">{(onEdit || onSelect) && <Button variant="secondary" onClick={() => onEdit ? onEdit(system, "system", category.id) : onSelect(system.id, "system", category.id)} aria-label={`แก้ไข ${label}`}>แก้ไข</Button>}{onDelete && <Button variant="danger-ghost" onClick={() => onDelete(system, "system")} aria-label={`ลบ ${label}`}>ลบ</Button>}</span>
      </div>
      {isEditing && renderInlineEditor?.(system, "system")}
    </div>;
  };

  const renderAssetRecord = (asset, category, group) => {
    const parent = getWimSortingSystemById(stationSystems, asset.parentSystemId);
    const lane = parent ? activeLanes.find((entry) => entry.id === parent.laneId) : activeLanes.find((entry) => entry.id === asset.laneId);
    const meta = statusMeta(assetStatusFor ? assetStatusFor(asset) : (asset.active === false ? "inactive" : "ready"));
    const path = getRelationshipPath({ format: group.format, groupCode: group.code, categoryId: category.id, kind: "asset" });
    const isEditing = editingId === asset.id && editingKind === "asset";
    const scope = parent?.scope || asset.scope || "—";
    const label = getAssetDisplayLabel(asset);
    const secondaryLabel = getAssetSecondaryLabel?.(asset);
    return <div className={`sc-relation-entry ${selectedKind === "asset" && selectedId === asset.id ? "is-selected" : ""} ${asset.active === false ? "is-inactive" : ""}`} key={asset.id} id={`sc-asset-row-${asset.id}`}>
      <div className="sc-relation-record is-asset">
        <span className="sc-relation-record-kind">ASSET</span>
        <span className="sc-relation-record-copy"><strong>{label}{isWimEquipment(asset) && parent ? ` · WIM Sorting System #${parent.instanceNo || "?"}` : ""}</strong>{secondaryLabel && secondaryLabel !== label && <small className="sc-relation-name-th">{secondaryLabel}</small>}<small>{path} · {asset.location || "ยังไม่ระบุตำแหน่ง"}</small></span>
        <span className="sc-relation-record-meta"><strong className="ops-code">{asset.assetNo || "ยังไม่มี Asset No."}</strong></span>
        <span className="sc-relation-record-meta">{scope}{isWimEquipment(asset) ? ` · ${lane ? `Lane ${lane.laneNo}` : "ยังไม่ผูก Lane"}` : ""}</span>
        <span className={`sc-status ${meta.className}`}><i />{meta.label}</span>
        <span className="sc-relation-record-actions">{(onEdit || onSelect) && <Button variant="secondary" onClick={() => onEdit ? onEdit(asset, "asset", category.id) : onSelect(asset.id, "asset", category.id)} aria-label={`แก้ไข ${getAssetDisplayLabel(asset)}`}>แก้ไข</Button>}{onDelete && <Button variant="danger-ghost" onClick={() => onDelete(asset, "asset")} aria-label={`ลบ ${getAssetDisplayLabel(asset)}`}>ลบ</Button>}</span>
      </div>
      {isEditing && renderInlineEditor?.(asset, "asset")}
    </div>;
  };

  const visibleTree = tree;
  if (!visibleTree.length) return <div className="sc-relationship-empty"><Icon name="info" pixelSize={18} /><strong>ยังไม่มีหมวดในรูปแบบสถานีนี้</strong><span>ตรวจสอบรูปแบบสถานีและผังรายการมาตรฐาน</span></div>;

  return <div id="sc-relationship-tree" className={`sc-relationship-tree ${alwaysExpanded ? "is-single-group-view" : ""}`} aria-label="ผังความสัมพันธ์ระบบและอุปกรณ์">
    {visibleTree.map((group) => {
      const expanded = alwaysExpanded || expandedGroupId === group.groupId;
      const groupSecondaryLabel = getGroupSecondaryLabel?.(group);
      const groupHeadingContents = <><span className="sc-system-chevron" aria-hidden="true">›</span><span className="ops-config-section-code">{group.groupId}</span><span className="sc-relationship-work-copy"><strong>{group.title}</strong>{groupSecondaryLabel && <small className="sc-relationship-name-th">{groupSecondaryLabel}</small>}<small>{group.sourceRefs?.length ? `อ้างอิง ${group.sourceRefs.join(", ")}` : "กลุ่มความสัมพันธ์ของสถานี"}</small></span><span className="sc-relationship-work-count">{group.systemCount} System · {group.assetCount} Asset</span></>;
      return <article className={`sc-relationship-work-group ${expanded ? "is-expanded" : ""}`} id={`sc-work-group-${group.groupId}`} key={group.groupId}>
        <div className="sc-relationship-work-heading">
          {alwaysExpanded
            ? <div className="sc-relationship-work-toggle is-static" role="heading" aria-level="3">{groupHeadingContents}</div>
            : <button type="button" className="sc-relationship-work-toggle" aria-expanded={expanded} onClick={() => onToggleGroup(group.groupId)}>{groupHeadingContents}</button>}
          <span className="sc-relationship-work-status">{group.hasData ? "ติดตั้งแล้ว" : "ตามผัง · ยังไม่ติดตั้ง"}</span>
        </div>
        {(expanded || alwaysExpanded) && <div className="sc-relationship-work-body">
          {group.categories.map((category) => {
            const active = categoryIsActive(category.id);
            const matchedAssets = new Set();
            const matchedSystems = new Set();
            const equipmentChoices = (category.equipmentOptions || []).map((option) => {
              const records = category.assets.filter((asset) => {
                const parent = getWimSortingSystemById(stationSystems, asset.parentSystemId);
                const scope = parent?.scope || asset.scope || "";
                const typeMatches = String(asset.type || "").toUpperCase() === String(option.equipmentType || "").toUpperCase();
                const scopeMatches = sameScope(scope, option.scope);
                if (typeMatches && scopeMatches) matchedAssets.add(asset.id);
                return typeMatches && scopeMatches;
              });
              return { option, records };
            });
            const canAddWimEquipment = (option) => {
              const requiresParent = category.id === "wim-sorting"
                && ["WIM_SENSOR", "WIM_LOOP"].includes(String(option.equipmentType || "").toUpperCase());
              if (!requiresParent) return true;
              return stationSystems.some((system) => isWimSortingSystemRecord(system)
                && system.active !== false
                && sameScope(system.scope, option.scope)
                && activeLanes.some((lane) => lane.id === system.laneId));
            };
            const systemChoices = (category.systemOptions || []).map((option) => {
              const records = category.systems.filter((system) => system.canonicalItemId === option.canonicalItemId && sameScope(system.scope, option.scope));
              records.forEach((system) => matchedSystems.add(system.id));
              return { option, records };
            });
            const otherAssets = category.assets.filter((asset) => !matchedAssets.has(asset.id));
            const otherSystems = category.systems.filter((system) => !matchedSystems.has(system.id));
            const hasEquipment = equipmentChoices.length > 0 || category.assets.length > 0;
            const hasSystems = systemChoices.length > 0 || category.systems.length > 0;
            const scopedLanes = category.id !== "wim-sorting" ? [] : activeLanes.filter((lane) => {
              const parent = stationSystems.find((system) => isWimSortingSystemRecord(system) && system.laneId === lane.id);
              const laneScope = lane.scope || parent?.scope || (group.format === "IMPS" ? "ImPS" : group.code === "04" ? "Low Speed" : "High Speed");
              const expectedScope = scopeForGroup(group.format, group.code);
              return !expectedScope || sameScope(laneScope, expectedScope);
            });
            return <section className={`sc-relationship-category ops-station-category-card ${active ? "is-active" : ""} ${!category.hasData ? "is-empty" : ""}`} data-station-category={category.id} key={`${group.groupId}-${category.id}`}>
              <header className="sc-relationship-category-heading"><span className="sc-system-card-icon"><Icon name="system" pixelSize={18} /></span><div><strong className="ops-station-category-title">{category.label}</strong><small className="ops-station-category-meta">{category.description}</small></div><span className="sc-relationship-category-count">{category.systemCount} System · {category.assetCount} Asset</span><div className="sc-relationship-category-actions">{category.id === "wim-sorting" && <Button onClick={() => onAddLane?.(group.code)} variant="secondary" icon="plus">เพิ่ม Lane</Button>}</div></header>
              {category.id === "wim-sorting" && <section className="sc-lane-register" aria-label={`โครงสร้าง Lane ${category.label}`}><div className="sc-lane-register-heading"><strong>Lane และ WIM Parent</strong><span>{scopedLanes.length} Lane</span></div>{scopedLanes.length ? scopedLanes.map((lane) => <div className="sc-lane-register-entry" key={lane.id}><span className="sc-lane-register-icon"><Icon name="lane" size="small" /></span><span className="sc-lane-register-copy"><strong>Lane {lane.laneNo} · {lane.label || "ช่องจราจร"}</strong><small>{lane.direction || "ยังไม่ระบุทิศทาง"} · {stationSystems.some((system) => isWimSortingSystemRecord(system) && system.laneId === lane.id) ? "มี WIM Sorting System" : "ยังไม่มี WIM Sorting System"}</small></span><span className="sc-relation-record-actions"><Button variant="secondary" onClick={() => onEditLane?.(lane.id)}>แก้ไข Lane</Button><Button variant="danger-ghost" onClick={() => onDeleteLane?.(lane.id)}>ลบ Lane</Button></span>{editingLaneId === lane.id && renderLaneEditor?.(lane)}</div>) : <div className="sc-relationship-kind-empty">ยังไม่มี Lane ในขอบเขตนี้</div>}</section>}
              <div className="sc-relationship-kinds">
                {hasEquipment && <section className="sc-relationship-kind" aria-label={`${category.label} Equipment`}><div className="sc-relationship-kind-heading"><span>.01</span><span className="sc-relationship-kind-title"><strong>Equipment</strong><small>อุปกรณ์</small></span><small>{category.assetCount} รายการจริง</small></div>
                  {equipmentChoices.map(({ option, records }) => { const canAdd = canAddWimEquipment(option); return <div className="sc-relationship-choice" key={option.id}><div className="sc-relationship-choice-header"><span className="sc-relation-record-copy"><strong>{option.nameEn || option.nameTh}</strong>{option.nameTh && option.nameTh !== option.nameEn && <small className="sc-relation-name-th">{option.nameTh}</small>}<small>{option.scope || "ทุกช่อง"} · {option.sourceRefs?.join(", ") || "รายการมาตรฐาน"}</small></span><span className="sc-relationship-choice-count">ติดตั้ง {records.length}</span><Button onClick={() => onAdd(category.id, "asset", option, group.code)} variant="secondary" icon="plus" disabled={!canAdd}>เพิ่ม</Button></div>{!canAdd && <small className="sc-relationship-add-requirement">เพิ่ม Lane และ WIM Sorting System ใน Scope นี้ก่อน เพื่อผูก Sensor/Loop ให้ถูกช่อง</small>}{records.map((asset) => renderAssetRecord(asset, category, group))}</div>; })}
                  {otherAssets.length > 0 && <div className="sc-relationship-unmapped"><strong>{category.id === "unmapped" ? "รายการนอกผังหรือยังไม่จัดหมวด" : "รายการเดิมที่ไม่ตรงตัวเลือกมาตรฐาน"}</strong><small>{category.id === "unmapped" ? "แสดงข้อมูลจริงไว้ให้ตรวจและแก้หมวดหรือขอบเขตได้" : "ยังแสดงข้อมูลจริงไว้เพื่อไม่ให้รายการสูญหาย"}</small>{otherAssets.map((asset) => renderAssetRecord(asset, category, group))}</div>}
                  {!equipmentChoices.length && !category.assets.length && <div className="sc-relationship-kind-empty">หมวดนี้ไม่มี Equipment ตามรายการมาตรฐาน</div>}
                </section>}
                {hasSystems && <section className="sc-relationship-kind" aria-label={`${category.label} Systems and Software`}><div className="sc-relationship-kind-heading"><span>.02</span><span className="sc-relationship-kind-title"><strong>Systems &amp; Software</strong><small>ระบบและซอฟต์แวร์</small></span><small>{category.systemCount} ระบบจริง</small></div>
                  {systemChoices.map(({ option, records }) => <div className="sc-relationship-choice" key={option.id}><div className="sc-relationship-choice-header"><span className="sc-relation-record-copy"><strong>{option.nameEn || option.nameTh}</strong>{option.nameTh && option.nameTh !== option.nameEn && <small className="sc-relation-name-th">{option.nameTh}</small>}<small>{option.scope || "ทุกช่อง"} · {option.sourceRefs?.join(", ") || "รายการมาตรฐาน"}</small></span><span className="sc-relationship-choice-count">{records.length ? `${records.length} ระบบติดตั้ง` : "ยังไม่ติดตั้ง"}</span><Button onClick={() => onAdd(category.id, "system", option, group.code)} variant="secondary" icon="plus" disabled={category.id !== "wim-sorting" && records.length > 0}>{category.id === "wim-sorting" ? "เพิ่มระบบ / Lane" : records.length ? "ติดตั้งแล้ว" : "เพิ่ม"}</Button></div>{records.map((system) => renderSystemRecord(system, category, group))}</div>)}
                  {category.id === "unmapped" && otherSystems.length > 0 && <div className="sc-relationship-unmapped"><strong>ระบบนอกผังหรือยังไม่จัดหมวด</strong><small>แสดงข้อมูลจริงไว้ให้ตรวจและแก้หมวดหรือขอบเขตได้</small>{otherSystems.map((system) => renderSystemRecord(system, category, group))}</div>}
                  {category.id !== "unmapped" && otherSystems.map((system) => renderSystemRecord(system, category, group))}
                  {!systemChoices.length && !category.systems.length && !HIDDEN_SYSTEM_CATEGORY_IDS.has(category.id) && <div className="sc-relationship-kind-empty">หมวดนี้ไม่มี Systems &amp; Software ตามรายการมาตรฐาน</div>}
                </section>}
                {!hasEquipment && !hasSystems && <div className="sc-relationship-kind-empty">หมวดนี้ไม่มีรายการตามรูปแบบสถานี</div>}
              </div>
            </section>;
          })}
        </div>}
      </article>;
    })}
  </div>;
}
