import { useEffect, useMemo, useRef, useState } from "react";
import { filterReferenceOptions, referenceOptionsFor } from "../domain/reference-data.js";

function optionLabel(option) {
  return [option?.code, option?.name].filter(Boolean).join(" · ") || "ไม่ระบุ";
}

function emitChange(onChange, value) {
  onChange?.({ target: { value } });
}

export function MasterSelect({
  kind = "province",
  value = "",
  referenceData,
  options,
  onChange,
  label,
  placeholder = "เลือกข้อมูล",
  disabled = false,
  allowClear = true,
  emptyText = "ยังไม่มีข้อมูลใน Master Data",
  className = "",
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const available = useMemo(() => options || referenceOptionsFor(referenceData || {}, kind), [kind, options, referenceData]);
  const filtered = useMemo(() => filterReferenceOptions(available, query).slice(0, 80), [available, query]);
  const selected = available.find((entry) => entry.id === value) || null;

  useEffect(() => {
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const select = (next) => {
    emitChange(onChange, next);
    setQuery("");
    setOpen(false);
  };

  return <div ref={rootRef} className={`master-select ${className}`}>
    {label && <span className="master-select-label">{label}</span>}
    <button type="button" className="master-select-trigger" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)}>
      <span className={selected ? "" : "is-placeholder"}>{selected ? optionLabel(selected) : placeholder}</span>
      <span aria-hidden="true">⌄</span>
    </button>
    {open && <div className="master-select-menu" role="listbox" aria-label={label || placeholder}>
      <input autoFocus className="master-select-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาด้วยรหัสหรือชื่อ" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }} />
      {allowClear && value && <button type="button" className="master-select-option is-clear" onClick={() => select("")}>ล้างค่า</button>}
      {filtered.length ? filtered.map((option) => <button type="button" role="option" aria-selected={option.id === value} className={`master-select-option ${option.id === value ? "is-selected" : ""}`} key={option.id} onClick={() => select(option.id)}><span>{optionLabel(option)}</span>{option.regionCode && <small>{option.regionCode}</small>}</button>) : <div className="master-select-empty">{emptyText}</div>}
    </div>}
  </div>;
}

export function SearchableMultiSelect({
  options = [],
  value = [],
  onChange,
  label,
  placeholder = "เลือกได้หลายรายการ",
  disabled = false,
  renderOption = optionLabel,
  emptyText = "ไม่พบรายการ",
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedIds = Array.isArray(value) ? value : [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("th-TH");
    return options.filter((option) => !needle || [option?.id, option?.name, option?.label, option?.stationCode, option?.stationName, option?.province].filter(Boolean).join(" ").toLocaleLowerCase("th-TH").includes(needle));
  }, [options, query]);
  useEffect(() => {
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const toggle = (id) => onChange?.(selectedIds.includes(id) ? selectedIds.filter((entry) => entry !== id) : [...selectedIds, id]);
  return <div ref={rootRef} className="master-multi-select">
    {label && <span className="master-select-label">{label}</span>}
    <button type="button" className="master-select-trigger" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen((current) => !current)}><span className={selectedIds.length ? "" : "is-placeholder"}>{selectedIds.length ? `เลือกแล้ว ${selectedIds.length} รายการ` : placeholder}</span><span aria-hidden="true">⌄</span></button>
    {selectedIds.length > 0 && <div className="master-multi-tags">{selectedIds.map((id) => { const option = options.find((entry) => entry.id === id); return option ? <button type="button" key={id} className="master-multi-tag" onClick={() => toggle(id)}>{renderOption(option)} ×</button> : null; })}</div>}
    {open && <div className="master-select-menu" role="listbox" aria-multiselectable="true"><input autoFocus className="master-select-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหา" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }} />{filtered.length ? filtered.map((option) => <label className={`master-select-option master-multi-option ${selectedIds.includes(option.id) ? "is-selected" : ""}`} key={option.id}><input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => toggle(option.id)} /><span>{renderOption(option)}</span></label>) : <div className="master-select-empty">{emptyText}</div>}</div>}
  </div>;
}

export function ContractContextSelect({ contracts = [], workPackages = [], stations = [], contractId = "", workPackageId = "", stationId = "", onChange }) {
  const packages = workPackages.filter((entry) => !contractId || entry.contractId === contractId);
  const packageStationIds = new Set(stations.filter((station) => !workPackageId || station.workPackageId === workPackageId).map((station) => station.id));
  const visibleStations = stations.filter((station) => !workPackageId || packageStationIds.has(station.id));
  return <div className="ops-form-grid ops-context-picker">
    <label className="ops-field"><span>สัญญา <em>(จำเป็น)</em></span><select value={contractId} onChange={(event) => onChange?.({ contractId: event.target.value, workPackageId: "", stationId: "" })}><option value="">เลือกสัญญา</option>{contracts.map((entry) => <option key={entry.id} value={entry.id}>{entry.contractNo} · {entry.title}</option>)}</select></label>
    <label className="ops-field"><span>งวดงาน <em>(จำเป็น)</em></span><select value={workPackageId} disabled={!contractId} onChange={(event) => onChange?.({ contractId, workPackageId: event.target.value, stationId: "" })}><option value="">เลือกงวด</option>{packages.map((entry) => <option key={entry.id} value={entry.id}>{entry.reportSequence || entry.packageNo} · {entry.title}</option>)}</select></label>
    <label className="ops-field"><span>สถานี <em>(จำเป็น)</em></span><select value={stationId} disabled={!workPackageId} onChange={(event) => onChange?.({ contractId, workPackageId, stationId: event.target.value })}><option value="">เลือกสถานีในงวด</option>{visibleStations.map((entry) => <option key={entry.id} value={entry.id}>{entry.stationCode} · {entry.stationName} · {entry.province || "ไม่ระบุจังหวัด"}</option>)}</select></label>
  </div>;
}
