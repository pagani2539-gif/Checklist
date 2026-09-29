import { useState } from "react";
import { AppIcon as Icon } from "./icon-system.jsx";
import { Button } from "./controls/ActionControls.jsx";
import { WIM_ELECTRONICS_OUTPUT_VOLTAGES, isWimElectronicsSubEquipmentType } from "../domain/wim-electronics.js";

export default function StationRelationshipInlineEditor({
  record,
  kind,
  label,
  scopeChoices = [],
  laneOptions = [],
  wimParentOptions = [],
  ownerSystemOptions = [],
  ownerSystemRequired = false,
  cabinetOptions = [],
  electronicsSystemOptions = [],
  contextScope = "",
  scopeLabel = "Scope",
  relationshipText = "",
  error = "",
  validateAssetNo,
  disabled = false,
  showActivation = false,
  showSerialReason = false,
  showSystemDetails = false,
  saveHint = "ยังไม่บันทึกจนกด “บันทึก”",
  onSave,
  onCancel,
}) {
  const [draft, setDraft] = useState(() => ({ ...record, outputVoltages: [...(record?.outputVoltages || [])] }));
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const validationError = kind === "asset" ? (validateAssetNo ? validateAssetNo(draft.assetNo) : error) : error;
  const isWimChild = kind === "asset" && ["WIM_SENSOR", "WIM_LOOP"].includes(record?.type);
  const isWimElectronicsChild = kind === "asset" && isWimElectronicsSubEquipmentType(record?.type);
  const isWimElectronicsCabinet = kind === "asset" && record?.type === "CONTROL_CABINET";
  const selectedOwnerSystem = ownerSystemOptions.find((entry) => entry.id === draft.parentSystemId)
    || (ownerSystemOptions.length === 1 ? ownerSystemOptions[0] : null);
  const chooseWimParent = (parentId) => {
    const parent = wimParentOptions.find((entry) => entry.id === parentId);
    setDraft((current) => ({
      ...current,
      parentSystemId: parent?.id || "",
      laneId: parent?.laneId || "",
      scope: parent?.scope || contextScope || current.scope || "",
    }));
  };
  const selectedWimParent = wimParentOptions.find((entry) => entry.id === draft.parentSystemId);
  const selectedCabinet = cabinetOptions.find((entry) => entry.id === draft.parentAssetId);
  const selectedElectronicsSystem = electronicsSystemOptions.find((entry) => entry.id === (selectedCabinet?.parentSystemId || draft.parentSystemId))
    || (!selectedCabinet?.parentSystemId && electronicsSystemOptions.length === 1 ? electronicsSystemOptions[0] : null);
  const chooseCabinet = (cabinetId) => {
    const cabinet = cabinetOptions.find((entry) => entry.id === cabinetId);
    const matchingSystems = electronicsSystemOptions.filter((entry) => !cabinet?.scope || !entry.scope || String(entry.scope).trim().toLowerCase() === String(cabinet.scope).trim().toLowerCase());
    const parent = matchingSystems.find((entry) => entry.id === cabinet?.parentSystemId)
      || (!cabinet?.parentSystemId && matchingSystems.length === 1 ? matchingSystems[0] : null);
    setDraft((current) => ({
      ...current,
      parentAssetId: cabinet?.id || "",
      parentSystemId: parent?.id || cabinet?.parentSystemId || "",
      scope: cabinet?.scope || parent?.scope || contextScope || current.scope || "",
    }));
  };
  const canSave = !disabled && !(validateAssetNo && validationError) && (!isWimChild || Boolean(selectedWimParent))
    && (!isWimElectronicsChild || Boolean(selectedCabinet && selectedElectronicsSystem && (selectedCabinet.parentSystemId || draft.parentSystemId)))
    && (!isWimElectronicsCabinet || !electronicsSystemOptions.length || Boolean(draft.parentSystemId && selectedElectronicsSystem))
    && (!ownerSystemRequired || Boolean(draft.parentSystemId && selectedOwnerSystem));
  const toggleVoltage = (voltage) => setDraft((current) => ({
    ...current,
    outputVoltages: (current.outputVoltages || []).includes(voltage)
      ? current.outputVoltages.filter((entry) => entry !== voltage)
      : [...(current.outputVoltages || []), voltage],
  }));

  return <section className="ops-draft-relationship-editor sc-inline-relationship-editor" aria-label={`แก้ไข ${label}`}>
    <div className="ops-draft-relationship-editor-grid">
      {kind === "asset" ? <>
        <label className="ops-field"><span>Asset No. <em>(จำเป็น)</em></span><input value={draft.assetNo || ""} disabled={disabled} aria-invalid={Boolean(validationError)} onChange={(event) => update("assetNo", event.target.value)} />{validationError && <small className="ops-field-error" role="alert">{validationError}</small>}</label>
        <label className="ops-field"><span>ตำแหน่งติดตั้ง</span><input value={draft.location || ""} disabled={disabled} onChange={(event) => update("location", event.target.value)} /></label>
        <label className="ops-field"><span>Serial Number</span><input value={draft.serialNo || ""} disabled={disabled} onChange={(event) => update("serialNo", event.target.value)} /></label>
        <label className="ops-field"><span>สถานะ Serial</span><select value={draft.serialStatus || "unknown"} disabled={disabled} onChange={(event) => update("serialStatus", event.target.value)}><option value="unknown">ยังไม่ระบุ</option><option value="present">มี Serial</option><option value="not-available">ไม่มี / อ่านไม่ได้</option></select></label>
        {showSerialReason && draft.serialStatus === "not-available" && <label className="ops-field"><span>เหตุผลที่ไม่มี Serial Number</span><input value={draft.serialReason || ""} disabled={disabled} onChange={(event) => update("serialReason", event.target.value)} /></label>}
        {showActivation && <label className="ops-field"><span>สถานะเปิดใช้งาน</span><select value={draft.active === false ? "inactive" : "active"} disabled={disabled} onChange={(event) => update("active", event.target.value !== "inactive")}><option value="active">ใช้งานปกติ</option><option value="inactive">ปิดใช้งาน</option></select></label>}
        {isWimElectronicsCabinet && electronicsSystemOptions.length > 0 && (!draft.parentSystemId || electronicsSystemOptions.length > 1) && <label className="ops-field"><span>WIM Electronics System แม่ <em>(จำเป็น)</em></span><select value={draft.parentSystemId || ""} disabled={disabled} onChange={(event) => { const parent = electronicsSystemOptions.find((entry) => entry.id === event.target.value); update("parentSystemId", parent?.id || ""); update("scope", parent?.scope || ""); }}><option value="">เลือกระบบแม่</option>{electronicsSystemOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.displayLabel || entry.nameEn || entry.canonicalItemId} · {entry.scope || "ไม่ระบุ Scope"}</option>)}</select></label>}
        {isWimElectronicsCabinet && draft.parentSystemId && electronicsSystemOptions.length === 1 && <div className="ops-field"><span>WIM Electronics System แม่</span><strong>{selectedElectronicsSystem?.displayLabel || selectedElectronicsSystem?.nameEn || selectedElectronicsSystem?.canonicalItemId || "ระบบแม่"}</strong></div>}
        {isWimElectronicsChild && <>
          <label className="ops-field"><span>อยู่ภายใต้ Cabinet <em>(จำเป็นต่อ Checklist)</em></span><select value={draft.parentAssetId || ""} disabled={disabled} onChange={(event) => chooseCabinet(event.target.value)} aria-invalid={!selectedCabinet}><option value="">เลือก Cabinet แม่</option>{cabinetOptions.map((cabinet) => <option key={cabinet.id} value={cabinet.id}>{cabinet.assetNo || "ไม่มี Asset No."} · {cabinet.location || "ยังไม่ระบุตำแหน่ง"} · {cabinet.scope || "ทุกขอบเขต"}</option>)}</select>{!cabinetOptions.length && <small className="ops-field-error" role="alert">ยังไม่มี Cabinet ที่ใช้งาน กรุณาเพิ่ม Cabinet ก่อน</small>}</label>
          {selectedCabinet && !selectedCabinet.parentSystemId && electronicsSystemOptions.length > 0 && (!draft.parentSystemId || electronicsSystemOptions.length > 1) && <label className="ops-field"><span>WIM Electronics System แม่ <em>(จำเป็น)</em></span><select value={draft.parentSystemId || ""} disabled={disabled} onChange={(event) => { const parent = electronicsSystemOptions.find((entry) => entry.id === event.target.value); update("parentSystemId", parent?.id || ""); update("scope", selectedCabinet.scope || parent?.scope || ""); }}><option value="">เลือกระบบแม่</option>{electronicsSystemOptions.filter((entry) => !selectedCabinet.scope || !entry.scope || String(entry.scope).trim().toLowerCase() === String(selectedCabinet.scope).trim().toLowerCase()).map((entry) => <option key={entry.id} value={entry.id}>{entry.displayLabel || entry.nameEn || entry.canonicalItemId} · {entry.scope || "ไม่ระบุ Scope"}</option>)}</select></label>}
          {selectedCabinet && <div className="ops-field"><span>{scopeLabel}</span><strong>{selectedCabinet.scope || selectedElectronicsSystem?.scope || "ยังไม่ระบุ"}</strong><small>กำหนดจาก Cabinet และ System แม่</small></div>}
        </>}
        {isWimChild ? <>
          <label className="ops-field"><span>WIM Sorting System (ระบบแม่) <em>(จำเป็น)</em></span><select value={draft.parentSystemId || ""} disabled={disabled} onChange={(event) => chooseWimParent(event.target.value)} aria-invalid={!selectedWimParent}>
            <option value="">เลือก WIM Sorting System และ Lane</option>
            {wimParentOptions.map((parent) => <option key={parent.id} value={parent.id}>{parent.label}</option>)}
          </select><small>Scope และ Lane จะอ้างอิงจากระบบแม่ที่เลือก</small>
            {!wimParentOptions.length && <small className="ops-field-error" role="alert">ยังไม่มี WIM Sorting System ใน Scope นี้ กรุณาเพิ่มระบบแม่ก่อน</small>}
          </label>
          <div className="ops-field"><span>{scopeLabel}</span><strong>{selectedWimParent?.scope || contextScope || "ยังไม่ระบุ"}</strong><small>กำหนดตามระบบแม่</small></div>
          <div className="ops-field"><span>Lane</span><strong>{selectedWimParent?.laneLabel || "เลือกตามระบบแม่"}</strong></div>
        </> : <>
          {ownerSystemRequired && ownerSystemOptions.length > 0 && (!draft.parentSystemId || ownerSystemOptions.length > 1) && <label className="ops-field"><span>System แม่ <em>(จำเป็น)</em></span><select value={draft.parentSystemId || ""} disabled={disabled} onChange={(event) => { const parent = ownerSystemOptions.find((entry) => entry.id === event.target.value); update("parentSystemId", parent?.id || ""); update("scope", parent?.scope || ""); }}><option value="">เลือกระบบแม่</option>{ownerSystemOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.displayLabel || entry.nameEn || entry.canonicalItemId} · {entry.scope || "ไม่ระบุ Scope"}</option>)}</select></label>}
          {ownerSystemRequired && !ownerSystemOptions.length && <small className="ops-field-error" role="alert">ไม่พบ System แม่ในหมวดนี้ กรุณาเพิ่มระบบก่อนบันทึก</small>}
          {!ownerSystemRequired && !isWimElectronicsChild && scopeChoices.length > 1 && !contextScope && <label className="ops-field"><span>{scopeLabel}</span><select value={draft.scope || scopeChoices[0]} disabled={disabled} onChange={(event) => update("scope", event.target.value)}>{scopeChoices.map((scope) => <option key={scope} value={scope}>{scope}</option>)}</select></label>}
          {!ownerSystemRequired && !isWimElectronicsChild && contextScope && <div className="ops-field"><span>{scopeLabel}</span><strong>{contextScope}</strong><small>กำหนดตามหมวดที่กำลังแก้ไข</small></div>}
          {ownerSystemRequired && selectedOwnerSystem && <div className="ops-field"><span>{scopeLabel}</span><strong>{selectedOwnerSystem.scope || "ยังไม่ระบุ"}</strong><small>กำหนดตาม System แม่</small></div>}
          {relationshipText && <div className="ops-field"><span>ความสัมพันธ์</span><strong>{relationshipText}</strong></div>}
        </>}
        {record.type === "WIM_SWITCHING_DC" && <fieldset className="ops-serial-fieldset" disabled={disabled}><legend>Output ของ Switching DC</legend>{WIM_ELECTRONICS_OUTPUT_VOLTAGES.map((voltage) => <label key={voltage}><input type="checkbox" checked={(draft.outputVoltages || []).includes(voltage)} onChange={() => toggleVoltage(voltage)} />{voltage}VDC</label>)}</fieldset>}
      </> : <>
        {showSystemDetails && <>
          <label className="ops-field"><span>ชื่อระบบ</span><input value={draft.displayLabel ?? draft.sourceLabel ?? draft.nameEn ?? ""} disabled={disabled} onChange={(event) => update("displayLabel", event.target.value)} /></label>
          {record.canonicalItemId !== "wim-sorting" && <label className="ops-field"><span>จำนวน</span><input type="number" min="0" value={draft.quantity ?? 0} disabled={disabled} onChange={(event) => update("quantity", Number(event.target.value || 0))} /></label>}
          <label className="ops-field"><span>หน่วย</span><input value={draft.unit || draft.referenceUnit || "ระบบ"} disabled={disabled} onChange={(event) => update("unit", event.target.value)} /></label>
          <label className="ops-field"><span>หมายเหตุ</span><textarea rows="3" value={draft.note || ""} disabled={disabled} onChange={(event) => update("note", event.target.value)} /></label>
        </>}
        {scopeChoices.length > 1 && !contextScope && <label className="ops-field"><span>{scopeLabel}</span><select value={draft.scope || scopeChoices[0]} disabled={disabled} onChange={(event) => update("scope", event.target.value)}>{scopeChoices.map((scope) => <option key={scope} value={scope}>{scope}</option>)}</select></label>}
        {contextScope && <div className="ops-field"><span>{scopeLabel}</span><strong>{contextScope}</strong><small>กำหนดตามหมวดที่กำลังแก้ไข</small></div>}
        {record.canonicalItemId === "wim-sorting" && laneOptions.length > 0 && <label className="ops-field"><span>Lane</span><select value={draft.laneId || ""} disabled={disabled} onChange={(event) => update("laneId", event.target.value)}>{laneOptions.map((lane) => <option key={lane.id} value={lane.id}>Lane {lane.laneNo} · {lane.label || "ช่องจราจร"}</option>)}</select></label>}
        <div className="ops-info-banner"><Icon name="info" /><span>รายการตรวจ System แยกจาก Equipment จริงในหมวด .01</span></div>
      </>}
      {showActivation && kind === "system" && <label className="ops-field"><span>สถานะเปิดใช้งาน</span><select value={draft.active === false ? "inactive" : "active"} disabled={disabled} onChange={(event) => update("active", event.target.value !== "inactive")}><option value="active">ใช้งานปกติ</option><option value="inactive">ปิดใช้งาน</option></select></label>}
    </div>
    <footer className="sc-inline-editor-actions"><span className={`ops-status-chip ${canSave ? "is-ready" : "is-warning"}`}>{canSave ? saveHint : disabled ? "สถานีปิดใช้งานอยู่" : validationError || (isWimElectronicsChild || isWimElectronicsCabinet ? "ต้องเลือกระบบแม่และความสัมพันธ์ให้ครบก่อนบันทึก" : isWimChild ? "ต้องเลือกระบบ WIM แม่ก่อนบันทึก" : "ต้องเลือกระบบแม่ก่อนบันทึก")}</span><Button variant="primary" onClick={() => onSave(draft)} disabled={!canSave}>บันทึก</Button><Button variant="ghost" onClick={onCancel}>ยกเลิก</Button></footer>
  </section>;
}
