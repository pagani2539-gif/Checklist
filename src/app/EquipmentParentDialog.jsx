import CustomSelect from "./CustomSelect.jsx";
import { useEffect, useRef, useState } from "react";

export default function EquipmentParentDialog({ equipmentName, choices, lanes = [], onChoose, onClose }) {
  const dialogRef = useRef(null);
  const [choiceId, setChoiceId] = useState("");
  const selected = choices.find((choice) => choice.id === choiceId);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => { dialog.close(); previousFocus?.focus?.(); };
  }, []);
  return <dialog ref={dialogRef} className="ops-equipment-parent-dialog" aria-labelledby="equipment-parent-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id="equipment-parent-title">เลือกความสัมพันธ์ของอุปกรณ์</h2>
    <p>{equipmentName}</p>
    <label className="ops-field"><span>System / Cabinet แม่</span><CustomSelect autoFocus value={choiceId} onChange={(event) => setChoiceId(event.target.value)}>
      <option value="">เลือกแม่ที่ติดตั้งจริง</option>
      {choices.map(({ id, system, cabinet }) => {
        const lane = lanes.find((entry) => entry.id === system.laneId);
        return <option key={id} value={id}>{cabinet ? `${cabinet.assetNo || "Cabinet"} · ` : ""}{system.nameEn || system.displayLabel || system.canonicalItemId}{lane ? ` · Lane ${lane.laneNo}` : ""} · {system.scope}</option>;
      })}
    </CustomSelect></label>
    <div className="sc-readonly-field"><span>Scope</span><strong>{selected?.system.scope || "เลือกความสัมพันธ์แม่ก่อน"}</strong><small>อุปกรณ์รับ Scope จาก System แม่</small></div>
    <footer><button type="button" onClick={onClose}>ยกเลิก</button><button type="button" disabled={!selected} onClick={() => onChoose(selected)}>เพิ่มอุปกรณ์</button></footer>
  </dialog>;
}
