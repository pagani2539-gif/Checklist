import { BOQ_CHECKLIST_PRESENTATION_VERSION } from "../../domain/boq-checklist-groups.js";

export function createNewInspectionPage(runtime) {
  const { Breadcrumb, Button, CHECKLIST_POLICY_VERSION, CLEANING_POLICY_VERSION, ChecklistCoverageSummary, CustomSelect, EQUIPMENT_ORDER_VERSION, EVIDENCE_CHECKLIST_SECTIONS, EmptyState, Icon, PageHeader, STATION_DRAFT_TEMPLATE_VERSION, StatusBadge, Stepper, ThaiDatePicker, createInspectionRound, getActivePhysicalEquipment, getChecklistCoverageSummary, getChecklistScopeMeta, getEquipmentDisplayLabel, getNewRoundChecklistItems, getStationChecklistItems, getStationChecklistSections, getStationReadiness, navigate, sortEquipmentForDisplay, useEffect, useState } = runtime;
  return function NewInspectionPage({ state, update, notify, route }) {
    const activeProfiles = state.stationProfiles.filter((entry) => entry.active !== false && getStationReadiness(entry).ready && entry.readinessConfirmedAt);
    const activeButNotReady = state.stationProfiles.filter((entry) => entry.active !== false && !activeProfiles.some((profile) => profile.id === entry.id));
    const requestedStationId = route.query.stationId || "";
    const initialStation = activeProfiles.some((entry) => entry.id === requestedStationId)
      ? requestedStationId
      : activeProfiles.some((entry) => entry.id === state.ui?.selectedStationId) ? state.ui.selectedStationId : activeProfiles[0]?.id || "";
    const [stationId, setStationId] = useState(initialStation);
    const [inspectionDate, setInspectionDate] = useState("");
    const [step, setStep] = useState(1);
    const [validationMessage, setValidationMessage] = useState("");
    const profile = activeProfiles.find((entry) => entry.id === stationId) || null;
    useEffect(() => {
      if (requestedStationId && activeProfiles.some((entry) => entry.id === requestedStationId)) setStationId(requestedStationId);
    }, [requestedStationId, activeProfiles.length]);
    const equipment = sortEquipmentForDisplay(getActivePhysicalEquipment(profile?.equipment), profile?.lanes);
    const snapshot = profile ? {
      checklistPolicyVersion: CHECKLIST_POLICY_VERSION,
      orderingVersion: EQUIPMENT_ORDER_VERSION,
      stationId: profile.id,
      stationFormat: profile.stationFormat,
      stationCode: profile.stationCode,
      stationName: profile.stationName,
      stationSystems: profile.stationSystems,
      lanes: profile.lanes,
      equipment,
      checklistConfig: profile.checklistConfig,
      templateVersion: STATION_DRAFT_TEMPLATE_VERSION,
      cleaningPolicyVersion: CLEANING_POLICY_VERSION,
      checklistCopy: state.checklistCopy,
      masterChecklistCopy: state.masterChecklistCopy,
    } : null;
    const items = snapshot ? getNewRoundChecklistItems(snapshot) : [];
    const applicableCount = items.filter((item) => item.applicable !== false).length;
    const coverage = getChecklistCoverageSummary(snapshot, items);
    const displaySections = snapshot ? getStationChecklistSections(snapshot) : [];
    const disabledCount = snapshot ? getStationChecklistItems(snapshot, { includeDisabled: true }).filter((item) => item.checklistDisabled).length : 0;
    const relationshipSummary = items.reduce((summary, item) => {
      const path = item.relationshipPath || getChecklistScopeMeta(item).label;
      summary[path] = (summary[path] || 0) + 1;
      return summary;
    }, {});
    const equipmentGroups = equipment.reduce((groups, item) => {
      const label = getEquipmentDisplayLabel(item);
      groups[label] = (groups[label] || 0) + 1;
      return groups;
    }, {});
    const showError = (message) => {
      setValidationMessage(message);
      notify(message);
    };
    const nextStep = () => {
      const message = !profile ? "กรุณาเลือกสถานีที่พร้อมใช้งานก่อน"
        : step === 1 && !String(inspectionDate || "").trim() ? "กรุณาระบุวันที่ตรวจก่อนดำเนินการต่อ"
          : step === 1 && !applicableCount ? "สถานีนี้ยังไม่มีรายการตรวจที่เปิดใช้งาน" : "";
      if (message) return showError(message);
      setValidationMessage("");
      setStep((current) => Math.min(3, current + 1));
    };
    const createRound = () => {
      if (!profile || !getStationReadiness(profile).ready || !profile.readinessConfirmedAt) return notify("สถานียังไม่ผ่านการยืนยันความพร้อม กรุณากลับไปตรวจ Station Profile");
      if (!String(inspectionDate || "").trim()) return showError("กรุณาระบุวันที่ตรวจก่อนเริ่มรอบการตรวจ");
      if (!applicableCount) return notify("ไม่มีรายการตรวจที่เปิดใช้งาน");
      const round = createInspectionRound(profile, { inspectionDate }, { checklistCopy: state.checklistCopy, masterChecklistCopy: state.masterChecklistCopy });
      update((current) => ({ ...current, inspectionRounds: [round, ...current.inspectionRounds], activeRoundId: round.id, activeStationId: profile.id, ui: { ...(current.ui || {}), selectedStationId: profile.id } }), "สร้างรอบการตรวจแล้ว");
      navigate("#/inspections/" + encodeURIComponent(round.id));
    };
    return <section className="ops-page">
      <Breadcrumb items={[{ label: "รอบการตรวจ", href: "#/inspections" }, { label: "สร้างรอบการตรวจใหม่" }]} />
      <PageHeader eyebrow="NEW INSPECTION ROUND" title="สร้างรอบการตรวจใหม่" description="เลือกสถานีและวันที่ตรวจ ตรวจ Snapshot ก่อนเริ่ม Checklist ได้เลย โดยไม่ต้องเลือกสัญญาก่อน" actions={<Button href="#/inspections" icon="close">ยกเลิก</Button>} />
      <Stepper current={step} />
      <section className="ops-panel ops-new-round">
        {profile && !applicableCount && <EmptyState title="ไม่มีรายการตรวจที่เปิดใช้งาน">เปิดรายการตรวจในหน้าตั้งค่าสถานีก่อนสร้างรอบใหม่</EmptyState>}
        {step === 1 && <div className="ops-new-round-step"><div className="ops-panel-heading"><div><p className="ops-eyebrow">STEP 1 / 3</p><h3>เลือกสถานีและวันที่ตรวจ</h3><span className="ops-heading-note">การผูกสัญญาหรืองวดงานทำภายหลังได้</span></div><span className="ops-wizard-step-mark">1</span></div>
          {validationMessage && <div id="new-round-form-error" className="ops-form-error-banner" role="alert" tabIndex="-1"><Icon name="alert" /><span>{validationMessage}</span></div>}
          {!activeProfiles.length ? <EmptyState icon="building" title="ยังไม่มีสถานีพร้อมสร้างรอบ" action={<Button href="#/stations" variant="primary" icon="building">ไปจัดการสถานี</Button>}>{activeButNotReady.length ? "มี " + activeButNotReady.length + " สถานีที่ต้องแก้ความพร้อมก่อน" : "สร้าง Station Profile ก่อนเริ่มรอบการตรวจ"}</EmptyState> : <div className="ops-form-grid">
            <label className="ops-field ops-field-wide"><span>สถานีที่จะตรวจ <em>(จำเป็น)</em></span><CustomSelect value={stationId} onChange={(event) => { setValidationMessage(""); setStationId(event.target.value); }} aria-label="เลือกสถานีที่จะสร้างรอบการตรวจ" label="เลือกสถานีที่จะสร้างรอบการตรวจ"><option value="">เลือกสถานีที่พร้อมตรวจ</option>{activeProfiles.map((entry) => <option key={entry.id} value={entry.id}>{entry.stationCode} · {entry.stationName}</option>)}</CustomSelect></label>
            <label className="ops-field"><span>วันที่ตรวจ <em>(จำเป็น)</em></span><ThaiDatePicker value={inspectionDate} label="วันที่ตรวจ" onChange={(value) => { setValidationMessage(""); setInspectionDate(value); }} /></label>
            {profile && <div className="ops-info-banner ops-field-wide"><Icon name="info" /><span>{profile.stationCode} · {profile.stationName} · อุปกรณ์จริงที่ใช้งาน {equipment.length} รายการ</span></div>}
          </div>}
        </div>}
        {step === 2 && <div className="ops-new-round-step"><div className="ops-panel-heading"><div><p className="ops-eyebrow">STEP 2 / 3</p><h3>ตรวจข้อมูล ณ วันที่เริ่มรอบการตรวจ</h3><span className="ops-heading-note">ข้อมูลนี้จะถูกล็อกไว้ในรอบการตรวจ แม้แก้ทะเบียนสถานีภายหลัง</span></div><span className="ops-wizard-step-mark">2</span></div>
          {profile ? <><div className="ops-snapshot-preview"><div className="ops-panel-heading"><div><p className="ops-eyebrow">SNAPSHOT PREVIEW</p><h3>{profile.stationCode} · {profile.stationName}</h3></div><StatusBadge status="draft">พร้อมสร้าง</StatusBadge></div><p>ระบบจะนำเฉพาะอุปกรณ์จริงที่เปิดใช้งานและรายการตรวจที่เกี่ยวข้องเข้าสู่รอบนี้</p><div className="ops-equipment-count-grid">{Object.entries(equipmentGroups).map(([label, count]) => <div key={label}><strong>{count}</strong><span>{label}</span></div>)}{!equipment.length && <div><strong>0</strong><span>อุปกรณ์ที่ใช้งาน</span></div>}</div><div className="ops-snapshot-total"><Icon name="archive" /><span>รวม {equipment.length} อุปกรณ์จริง · {applicableCount} รายการตรวจที่เกี่ยวข้อง · {disabledCount} รายการปิดใช้งาน · {EVIDENCE_CHECKLIST_SECTIONS.length} หมวด · {items.reduce((total, item) => total + (item.evidenceSlots?.length || 0), 0)} ช่องหลักฐาน</span></div><ChecklistCoverageSummary coverage={coverage} displaySections={displaySections} stationFormat={profile.stationFormat} /><div className="ops-preview-relationship-summary" aria-label="สรุปผังความสัมพันธ์ของรายการตรวจ"><div><strong>ที่มาของรายการตรวจตามผังระบบ</strong><span>ระบบใช้ความสัมพันธ์จาก Station Profile และไม่รวมรายการแม่แบบที่ยังไม่ได้ติดตั้ง</span></div><ul>{Object.entries(relationshipSummary).slice(0, 12).map(([path, count]) => <li key={path}><span>{path}</span><strong>{count} รายการ</strong></li>)}</ul></div></div><div className="ops-info-banner"><Icon name="archive" /><span>ชุดข้อความมาตรฐานกลางและข้อมูลสถานีที่แก้ภายหลังจะไม่เปลี่ยนข้อมูล ณ วันที่เริ่มรอบ</span></div></> : <EmptyState title="ยังไม่มีสถานีที่ใช้งานได้">กลับไปสร้างหรือเปิดใช้งานสถานีจากหน้าทะเบียน</EmptyState>}
        </div>}
        {step === 3 && <div className="ops-new-round-step"><div className="ops-panel-heading"><div><p className="ops-eyebrow">STEP 3 / 3</p><h3>ยืนยันและเริ่มรอบการตรวจ</h3><span className="ops-heading-note">ระบบจะสร้างฉบับร่างและเปิด Checklist ทันที</span></div><span className="ops-wizard-step-mark">3</span></div><div className="ops-review-grid"><div><span>สถานี</span><strong>{profile?.stationCode || "—"}</strong><small>{profile?.stationName || "—"}</small></div><div><span>วันที่ตรวจ</span><strong>{inspectionDate || "ยังไม่ระบุวันที่"}</strong><small>วันที่บันทึกไว้กับรอบนี้</small></div><div><span>รายการตรวจ</span><strong>{applicableCount}</strong><small>รายการที่เกี่ยวข้องจาก Snapshot</small></div><div><span>หลักฐาน</span><strong>{items.reduce((total, item) => total + (item.evidenceSlots?.length || 0), 0)}</strong><small>ช่องหลักฐาน ณ วันที่เริ่มรอบ</small></div></div><div className="ops-info-banner"><Icon name="check" /><span>หลังปิดรอบ คุณกรอกหน้าปกรายงานและเลือกผูกสัญญาหรืองวดงานภายหลังได้</span></div></div>}
        <div className="ops-page-actions ops-page-actions-end"><Button onClick={() => setStep((current) => Math.max(1, current - 1))} variant="secondary" icon="arrow" disabled={step <= 1}>ย้อนกลับ</Button>{step < 3 ? <Button onClick={nextStep} variant="primary" icon="arrow" disabled={step === 1 && !profile}>ถัดไป</Button> : <Button onClick={createRound} variant="primary" icon="refresh" disabled={!profile || !applicableCount}>สร้างรอบตรวจและเริ่ม Checklist</Button>}</div>
      </section>
    </section>;
  };
}
