import { normalizeReferenceRecord } from "../../domain/reference-data.js";

export function createReferenceDataPage(runtime) {
  const { Button, EmptyState, PageHeader, createId, useState } = runtime;
  return function ReferenceDataPage({ state, update, notify, route }) {
    const [kind, setKind] = useState(() => route?.query?.kind === "agency" ? "agency" : "contractor");
    const [name, setName] = useState("");
    const [alias, setAlias] = useState("");
    const add = () => {
      const value = name.trim();
      if (!value) { notify("กรุณาระบุชื่อ Master Data"); return; }
      const key = kind === "agency" ? "agencies" : "contractors";
      const entries = state.referenceData?.[key] || [];
      const normalized = value.toLocaleLowerCase("th-TH").replace(/\s+/g, "");
      if (entries.some((entry) => [entry.name, ...(entry.aliases || [])].some((candidate) => String(candidate || "").toLocaleLowerCase("th-TH").replace(/\s+/g, "") === normalized))) { notify("รายการนี้มีอยู่แล้วใน Master Data"); return; }
      const record = normalizeReferenceRecord({ id: createId(`master-${kind}`), name: value, aliases: alias.split(",").map((entry) => entry.trim()).filter(Boolean) }, kind);
      update((current) => ({ ...current, referenceData: { ...(current.referenceData || {}), [key]: [...(current.referenceData?.[key] || []), record] } }), "เพิ่ม Master Data แล้ว");
      setName(""); setAlias("");
    };
    const entries = kind === "agency" ? (state.referenceData?.agencies || []) : (state.referenceData?.contractors || []);
    return <section className="ops-page contracts-page"><PageHeader eyebrow="REFERENCE DATA" title="จัดการ Master Data" description="เพิ่มผู้รับจ้างและหน่วยงานมาตรฐาน เพื่อให้ทุกสัญญาใช้รายการเดียวกัน" actions={<Button href="#/dashboard" icon="arrow">กลับภาพรวม</Button>} /><section className="ops-context-note"><span>หน้านี้สำหรับ admin / station-manager เท่านั้น เมื่อใช้ Server Mode ระบบจะตรวจสิทธิ์ซ้ำที่ API</span></section><section className="ops-panel"><div className="ops-info-banner contract-reference-instructions"><strong>{kind === "agency" ? "กำลังเพิ่มหน่วยงาน:" : "กำลังเพิ่มผู้รับจ้าง:"}</strong><span>{kind === "agency" ? "กรอกชื่อหน่วยงานผู้ว่าจ้างหรือเจ้าของงานตามเอกสารสัญญา" : "กรอกชื่อนิติบุคคลผู้รับจ้างตามเอกสารสัญญา"}</span></div><div className="ops-form-grid"><label className="ops-field"><span>ชนิดข้อมูล</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="contractor">ผู้รับจ้าง</option><option value="agency">หน่วยงาน</option></select></label><label className="ops-field"><span>ชื่อมาตรฐาน <em>(จำเป็น)</em></span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "agency" ? "เช่น สำนักทางหลวง" : "เช่น บริษัท ... จำกัด"} /></label><label className="ops-field"><span>ชื่อเรียกอื่น</span><input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="คั่นหลายชื่อด้วย ," /></label><div className="ops-field"><span>&nbsp;</span><Button onClick={add} variant="primary" icon="plus">เพิ่มรายการ</Button></div></div><div className="contract-reference-list">{entries.length ? entries.map((entry) => <div className="contract-reference-row" key={entry.id}><strong>{entry.name}</strong><span>{entry.aliases?.length ? entry.aliases.join(" · ") : "ไม่มีชื่อเรียกอื่น"}</span></div>) : <EmptyState icon="archive" title="ยังไม่มีรายการ">เพิ่มรายการแรกเพื่อให้ฟอร์มสัญญาเลือกใช้ได้</EmptyState>}</div></section></section>;
  };
}
