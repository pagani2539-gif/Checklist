function text(value) {
  return String(value ?? "").trim();
}

function contractFormFromContract(contract, draft = null) {
  const normalizedTitle = text(contract?.title || contract?.projectName);
  const base = {
    contractNo: text(contract?.contractNo),
    title: contract?.status === "draft" && normalizedTitle === "สัญญาใหม่" && !text(contract?.projectName) ? "" : normalizedTitle,
    projectName: text(contract?.projectName && contract.projectName !== contract.title ? contract.projectName : ""),
    contractDate: text(contract?.contractDate),
    contractorId: text(contract?.contractorId),
    agencyId: text(contract?.agencyId),
    startDate: text(contract?.startDate),
    endDate: text(contract?.endDate),
    regionIds: Array.isArray(contract?.regionIds) ? [...contract.regionIds] : [],
  };
  return draft && typeof draft === "object" ? { ...base, ...draft, regionIds: Array.isArray(draft.regionIds) ? [...draft.regionIds] : base.regionIds } : base;
}

function withoutContractFormDraft(current, draftKey) {
  const drafts = { ...(current.ui?.contractFormDrafts || {}) };
  delete drafts[draftKey];
  return { ...current, ui: { ...(current.ui || {}), contractFormDrafts: drafts } };
}

export function createNewContractPage(runtime) {
  const { Button, PageHeader, ThaiDatePicker, MasterSelect, SearchableMultiSelect, contractFor, createContractDraft, getContractCoreCompleteness, hasDuplicateContractNumber, navigate, useEffect, useState } = runtime;
  return function NewContractPage({ state, update, notify, route }) {
    const existingContract = route?.id ? contractFor(state, route.id) : null;
    const draftKey = existingContract?.id || "new";
    const storedDraft = state.ui?.contractFormDrafts?.[draftKey] || null;
    const [form, setForm] = useState(() => contractFormFromContract(existingContract, storedDraft));
    useEffect(() => {
      setForm(contractFormFromContract(existingContract, storedDraft));
    }, [draftKey, existingContract?.updatedAt]);
    useEffect(() => {
      const timer = window.setTimeout(() => {
        update((current) => ({ ...current, ui: { ...(current.ui || {}), contractFormDrafts: { ...(current.ui?.contractFormDrafts || {}), [draftKey]: form } } }));
      }, 350);
      return () => window.clearTimeout(timer);
    }, [draftKey, form]);
    const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
    const contractor = (state.referenceData?.contractors || []).find((entry) => entry.id === form.contractorId);
    const agency = (state.referenceData?.agencies || []).find((entry) => entry.id === form.agencyId);
    const contractForCompleteness = {
      ...form,
      title: text(form.title),
      agency: agency?.name || (!form.agencyId ? existingContract?.agency : "") || "",
      contractor: contractor?.name || (!form.contractorId ? existingContract?.contractor : "") || "",
    };
    const coreCompleteness = getContractCoreCompleteness(contractForCompleteness);
    const save = () => {
      if (hasDuplicateContractNumber(state.contracts, form.contractNo, existingContract?.id || "")) { notify("เลขที่สัญญานี้มีอยู่แล้ว แม้สัญญาเดิมจะปิดแล้ว"); return; }
      if (form.startDate && form.endDate && form.startDate > form.endDate) { notify("วันเริ่มสัญญาต้องไม่เกินวันสิ้นสุดสัญญา"); return; }
      const contract = createContractDraft({
        ...(existingContract || {}),
        ...form,
        id: existingContract?.id,
        title: text(form.title),
        projectName: text(form.projectName || form.title),
        contractorId: form.contractorId,
        contractor: contractor?.name || (!form.contractorId ? existingContract?.contractor : "") || "",
        agencyId: form.agencyId,
        agency: agency?.name || (!form.agencyId ? existingContract?.agency : "") || "",
        reportCompanyId: existingContract?.reportCompanyId || "ntr",
        status: coreCompleteness.valid ? "active" : "draft",
      });
      const message = coreCompleteness.valid ? "บันทึกสัญญาแล้ว" : "บันทึกร่างสัญญาแล้ว";
      update((current) => ({
        ...withoutContractFormDraft(current, draftKey),
        contracts: existingContract
          ? (current.contracts || []).map((entry) => entry.id === contract.id ? contract : entry)
          : [contract, ...(current.contracts || [])],
      }), message);
      navigate(`#/contracts/${encodeURIComponent(contract.id)}`);
    };
    const regionOptions = state.regions || [];
    const FieldHint = ({ children }) => <small className="contract-field-hint">{children}</small>;
    const cancelHref = existingContract ? `#/contracts/${encodeURIComponent(existingContract.id)}` : "#/dashboard";
    return <section className="ops-page contracts-page">
      <PageHeader eyebrow={existingContract ? "EDIT CONTRACT" : "NEW CONTRACT"} title={existingContract ? "แก้ไขข้อมูลสัญญา" : "สร้างสัญญา"} description="กรอกข้อมูลหลักจากเอกสารสัญญาจริงให้ตรงกัน แล้วค่อยเติมรายละเอียดหน้าปกเมื่อพร้อม" actions={<Button href={cancelHref} icon="close">ยกเลิก</Button>} />
      <section className="ops-panel contract-form-panel">
        <div className="ops-info-banner contract-form-instructions"><strong>ข้อมูลหลัก 7 รายการ:</strong><span>ใช้ระบุสัญญาและคู่สัญญา ได้แก่ เลขที่ วันที่ลงนาม ชื่อสัญญา หน่วยงาน ผู้รับจ้าง และวันเริ่ม–สิ้นสุด หากยังกรอกไม่ครบ ระบบจะบันทึกเป็น “ร่าง” เพื่อกลับมาแก้ไขได้</span></div>
        <div className="ops-form-grid">
          <label className="ops-field"><span>เลขที่สัญญาตามเอกสาร <em>(จำเป็น)</em></span><input value={form.contractNo} onChange={(event) => updateField("contractNo", event.target.value)} placeholder="เช่น สคน.e-68/2569" /><FieldHint>คัดลอกจากเลขที่บนหัวสัญญา ไม่ใช่เลขงวดงานหรือเลขรายงาน</FieldHint></label>
          <label className="ops-field"><span>วันที่ลงนามในสัญญา <em>(จำเป็น)</em></span><ThaiDatePicker value={form.contractDate} label="วันที่ลงนามในสัญญา" onChange={(nextValue) => updateField("contractDate", nextValue)} /><FieldHint>ใช้วันที่ที่ระบุในเอกสารสัญญา ไม่ใช่วันเริ่มปฏิบัติงาน</FieldHint></label>
          <label className="ops-field ops-field-wide"><span>ชื่อสัญญา / รายละเอียดงานตามเอกสาร <em>(จำเป็น)</em></span><textarea rows="3" value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="เช่น สัญญาจ้างก่อสร้างบำรุงรักษาและปรับปรุงสถานีตรวจสอบน้ำหนัก..." /><FieldHint>คัดลอกข้อความเต็มจากสัญญา ไม่ต้องแยกชื่อโครงการซ้ำ</FieldHint></label>
          <div className="ops-field"><MasterSelect kind="contractor" referenceData={state.referenceData} value={form.contractorId} onChange={(event) => updateField("contractorId", event.target.value)} label="ผู้รับจ้างตามสัญญา (จำเป็น)" placeholder="ค้นหาและเลือกนิติบุคคลผู้รับจ้าง" emptyText="ยังไม่มีรายการผู้รับจ้างใน Master Data" /><FieldHint>เลือกจากรายชื่อบริษัทตามกฎหมายที่มีอยู่ใน Master Data เท่านั้น</FieldHint></div>
          <div className="ops-field"><MasterSelect kind="agency" referenceData={state.referenceData} value={form.agencyId} onChange={(event) => updateField("agencyId", event.target.value)} label="หน่วยงานเจ้าของงาน (จำเป็น)" placeholder="ค้นหาและเลือกหน่วยงานเจ้าของงาน" emptyText="ยังไม่มีรายการหน่วยงานใน Master Data" /><FieldHint>เลือกจากรายชื่อหน่วยงานเจ้าของงานที่มีอยู่ใน Master Data เท่านั้น</FieldHint></div>
          <label className="ops-field"><span>วันเริ่มสัญญา <em>(จำเป็น)</em></span><ThaiDatePicker value={form.startDate} label="วันเริ่มสัญญา" onChange={(nextValue) => updateField("startDate", nextValue)} /><FieldHint>วันที่เริ่มนับระยะเวลาหรือเริ่มปฏิบัติงานตามสัญญา</FieldHint></label>
          <label className="ops-field"><span>วันสิ้นสุดสัญญา <em>(จำเป็น)</em></span><ThaiDatePicker value={form.endDate} label="วันสิ้นสุดสัญญา" onChange={(nextValue) => updateField("endDate", nextValue)} /><FieldHint>วันที่สิ้นสุดตามเงื่อนไขสัญญา ต้องไม่ก่อนวันเริ่มสัญญา</FieldHint></label>
        </div>
        <details className="contract-form-advanced">
          <summary>ข้อมูลเพิ่มเติมสำหรับการจัดกลุ่ม (กรอกภายหลังได้)</summary>
          <div className="ops-form-grid">
            <label className="ops-field ops-field-wide"><span>ชื่อโครงการสำหรับรายงาน (ถ้าต่างจากชื่อสัญญา)</span><input value={form.projectName} onChange={(event) => updateField("projectName", event.target.value)} placeholder="ถ้าไม่กรอก ระบบจะใช้ชื่อสัญญา" /><FieldHint>กรอกเฉพาะเมื่อชื่อโครงการที่ใช้รายงานสั้นหรือแตกต่างจากชื่อสัญญา</FieldHint></label>
          </div>
          <div className="contract-region-picker">
            <div><p className="ops-eyebrow">OPTIONAL GROUPING</p><h3>ภาค/พื้นที่ที่สัญญาครอบคลุม</h3><span className="ops-heading-note">ข้อมูลช่วยจัดกลุ่มและกรองรายการ ไม่ใช่ข้อมูลคู่สัญญา</span></div>
            <div><SearchableMultiSelect options={regionOptions} value={form.regionIds} onChange={(value) => updateField("regionIds", value)} label="เลือกภาค/พื้นที่ในสัญญา" placeholder="เลือกภาคที่ครอบคลุม" renderOption={(region) => region.name} emptyText="ยังไม่มีภาคใน Master Data" /><FieldHint>เลือกทุกภาคที่ระบุไว้ในเอกสารสัญญา หากยังไม่ทราบให้เว้นไว้ก่อนได้</FieldHint></div>
          </div>
        </details>
        {!coreCompleteness.valid && <div className="ops-info-banner contract-completeness-note"><strong>ยังไม่ครบสำหรับใช้งาน:</strong><span>ขาด {coreCompleteness.missingFields.join(" · ")} ระบบจะบันทึกเป็นร่าง</span></div>}
        <div className="ops-page-actions ops-page-actions-end"><Button href={cancelHref} variant="secondary">ยกเลิก</Button><Button onClick={save} variant="primary" icon="check">{coreCompleteness.valid ? "บันทึกสัญญา" : "บันทึกร่าง"}</Button></div>
      </section>
    </section>;
  };
}

export function createContractDetailPage(runtime) {
  const { Button, EmptyState, Icon, PageHeader, StatusBadge, ThaiDatePicker, contractFor, contractLabel, createWorkPackageDraft, getContractCoreCompleteness, navigate, regionsForContract, useMemo, useState, validateWorkPackageDraft, workPackagesForContract } = runtime;
  return function ContractDetailPage({ state, update, notify, onDeleteContract, route }) {
    const contract = contractFor(state, route.id);
    const [tab, setTab] = useState(() => route.query.tab || "overview");
    const [packageForm, setPackageForm] = useState({ packageNo: "", title: "", periodStart: "", periodEnd: "", status: "active" });
    const packages = useMemo(() => workPackagesForContract(state, contract?.id), [state, contract?.id]);
    if (!contract) return <section className="ops-page"><EmptyState icon="alert" title="ไม่พบสัญญา" action={<Button href="#/dashboard" variant="primary">กลับภาพรวม</Button>}>ลิงก์นี้อาจเป็นสัญญาที่ถูกลบหรือยังไม่ได้ซิงก์ข้อมูล</EmptyState></section>;
    const coreCompleteness = getContractCoreCompleteness(contract);
    const addPackage = () => {
      const validation = validateWorkPackageDraft(packageForm, contract, packages);
      if (!validation.valid) { notify(Object.values(validation.errors)[0]); return; }
      const workPackage = createWorkPackageDraft({ ...packageForm, contractId: contract.id, reportSequence: packageForm.packageNo });
      update((current) => ({ ...current, workPackages: [workPackage, ...(current.workPackages || [])] }), "สร้างงวดงานแล้ว");
      navigate(`#/contracts/${encodeURIComponent(contract.id)}/work-packages/${encodeURIComponent(workPackage.id)}`);
    };
    const tabs = [["overview", "ภาพรวม"], ["work-packages", "งาน/งวด"], ["stations", "สถานี"], ["reports", "รายงาน"], ["documents", "เอกสาร"]];
    const assignedStations = (state.contractStationAssignments || []).filter((entry) => entry.contractId === contract.id && entry.status !== "inactive");
    return <section className="ops-page contracts-page"><PageHeader eyebrow="CONTRACT DETAIL" title={contractLabel(contract)} description={contract.projectName || contract.title} actions={<div className="ops-page-actions"><Button href={`#/contracts/${encodeURIComponent(contract.id)}/edit`} variant="secondary" icon="edit">แก้ไขข้อมูลสัญญา</Button><Button onClick={() => onDeleteContract?.(contract)} variant="danger-ghost" icon="delete">ลบถาวร</Button><Button href="#/dashboard" icon="arrow">กลับภาพรวม</Button></div>} /><div className="contract-detail-hero"><div><span className="contract-detail-number">{contract.contractNo || "ยังไม่มีเลขสัญญา"}</span><h2>{contract.title}</h2><p>{regionsForContract(state, contract).map((region) => region.name).join(" · ") || "ยังไม่ระบุภาค"}</p></div><StatusBadge status={contract.status === "active" ? "normal" : contract.status === "closed" ? "inactive" : "waiting"}>{contract.status === "active" ? "ใช้งาน" : contract.status === "closed" ? "ปิดสัญญา" : "ร่าง"}</StatusBadge></div>{contract.status === "draft" && <div className="ops-info-banner contract-completeness-note"><strong>สัญญาฉบับร่าง:</strong><span>ยังขาด {coreCompleteness.missingFields.join(" · ")} เลือก “แก้ไขข้อมูลสัญญา” เพื่อกรอกต่อ</span></div>}<nav className="contract-tabs" aria-label="ส่วนของสัญญา">{tabs.map(([key, label]) => <button type="button" className={tab === key ? "is-active" : ""} key={key} onClick={() => setTab(key)}>{label}{key === "work-packages" && <small>{packages.length}</small>}</button>)}</nav>{tab === "overview" && <section className="contract-detail-grid"><article className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-eyebrow">CONTRACT SUMMARY</p><h3>ข้อมูลสัญญา</h3></div></div><dl className="contract-summary-list"><div><dt>ชื่อสัญญา</dt><dd>{contract.title || "—"}</dd></div>{contract.projectName && contract.projectName !== contract.title && <div><dt>ชื่อโครงการสำหรับรายงาน</dt><dd>{contract.projectName}</dd></div>}<div><dt>วันที่ลงนาม</dt><dd>{contract.contractDate || "—"}</dd></div><div><dt>ผู้รับจ้าง</dt><dd>{contract.contractor || "—"}</dd></div><div><dt>หน่วยงาน</dt><dd>{contract.agency || "—"}</dd></div><div><dt>ช่วงสัญญา</dt><dd>{[contract.startDate, contract.endDate].filter(Boolean).join(" – ") || "—"}</dd></div></dl></article><article className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-eyebrow">REGION COVERAGE</p><h3>ภาค/พื้นที่</h3></div></div><div className="contract-region-chip-list">{regionsForContract(state, contract).map((region) => <span key={region.id}>{region.name}</span>)}{!regionsForContract(state, contract).length && <span>ยังไม่ระบุ</span>}</div><p className="ops-heading-note">สัญญานี้สามารถผูกสถานีจากหลายภาคได้ โดยภาคทำหน้าที่เป็นตัวกรองและพื้นที่ครอบคลุม</p></article></section>}{tab === "work-packages" && <section className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-eyebrow">WORK PACKAGES</p><h3>งาน/งวดของสัญญา</h3><span className="ops-heading-note">หนึ่งงวดเลือกได้หลายสถานี และเริ่มรอบตรวจจากหน้านี้</span></div></div><div className="contract-inline-form"><input value={packageForm.packageNo} onChange={(event) => setPackageForm((current) => ({ ...current, packageNo: event.target.value }))} placeholder="งวดที่ 9" /><input value={packageForm.title} onChange={(event) => setPackageForm((current) => ({ ...current, title: event.target.value }))} placeholder="ชื่องาน/ช่วงรายงาน" /><label className="ops-field"><span>เริ่มงวด</span><ThaiDatePicker value={packageForm.periodStart} label="เริ่มงวด" onChange={(nextValue) => setPackageForm((current) => ({ ...current, periodStart: nextValue }))} /></label><label className="ops-field"><span>สิ้นสุดงวด</span><ThaiDatePicker value={packageForm.periodEnd} label="สิ้นสุดงวด" onChange={(nextValue) => setPackageForm((current) => ({ ...current, periodEnd: nextValue }))} /></label><Button onClick={addPackage} variant="primary" icon="plus">เพิ่มงวด</Button></div>{packages.length ? <div className="contract-package-list">{packages.map((workPackage) => { const assignmentCount = (state.contractStationAssignments || []).filter((entry) => entry.workPackageId === workPackage.id && entry.status !== "inactive").length; return <article className="contract-package-row" key={workPackage.id}><div><span className="ops-round-code">{workPackage.reportSequence || workPackage.packageNo}</span><h3>{workPackage.title}</h3><p>{[workPackage.periodStart, workPackage.periodEnd].filter(Boolean).join(" – ") || "ยังไม่ระบุช่วงเวลา"} · {assignmentCount} สถานี</p></div><div><Button href={`#/contracts/${encodeURIComponent(contract.id)}/work-packages/${encodeURIComponent(workPackage.id)}`} variant="secondary" icon="arrow">จัดการงวด</Button></div></article>; })}</div> : <EmptyState icon="list" title="ยังไม่มีงวดงาน">เพิ่มงวดแรกเพื่อเลือกหลายสถานีในชุดเดียว</EmptyState>}</section>}{tab === "stations" && <section className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-eyebrow">ASSIGNED STATIONS</p><h3>สถานีในสัญญา</h3></div></div>{assignedStations.length ? <div className="contract-assigned-list">{assignedStations.map((assignment) => { const station = state.stationProfiles.find((profile) => profile.id === assignment.stationId); const workPackage = packages.find((entry) => entry.id === assignment.workPackageId); return <div className="contract-assigned-row" key={assignment.id}><Icon name="building" /><div><strong>{station?.stationCode || "—"} · {station?.stationName || "สถานีที่ไม่พบ"}</strong><span>{workPackage?.reportSequence || "งวด"} · {workPackage?.title || "—"} · {station?.province || "ไม่ระบุจังหวัด"}</span></div><Button href={`#/contracts/${encodeURIComponent(contract.id)}/work-packages/${encodeURIComponent(workPackage?.id || "")}`} variant="secondary" icon="arrow">เปิดงวด</Button></div>; })}</div> : <EmptyState title="ยังไม่มีสถานีในสัญญา">เพิ่มสถานีจากหน้าแต่ละงวดงาน</EmptyState>}</section>}{tab === "reports" && <section className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-eyebrow">REPORT CENTER</p><h3>รายงานจากสัญญา</h3><span className="ops-heading-note">เลือกชนิดรายงานให้ชัดเจน: หน้าปกงานสัญญา หรือรายงานตรวจสถานีเดิม</span></div></div><div className="report-type-grid"><article><span className="report-type-icon"><Icon name="archive" /></span><h3>Contract Work Report</h3><p>หน้าปกงานตามสัญญา แสดงเลขสัญญา งวด ภาค สถานี และจังหวัด</p><Button href={`#/contracts/${encodeURIComponent(contract.id)}?tab=work-packages`} variant="primary" icon="arrow">เลือกงวดเพื่อสร้าง</Button></article><article><span className="report-type-icon"><Icon name="list" /></span><h3>Station Inspection Report</h3><p>รายงานตรวจหน้างานเดิมของ NTR / LTP / IS8 พร้อมบริบทสัญญาใน metadata</p><Button href="#/history" variant="secondary" icon="arrow">เปิดรายงานตรวจสถานี</Button></article></div><div className="contract-report-list">{(state.contractWorkReports || []).filter((report) => report.contractId === contract.id).map((report) => <div key={report.id}><strong>{report.reportSequence || "หน้าปกงาน"}</strong><span>{report.snapshot?.stationName || "ทุกสถานี"} · {report.status === "final" ? "ฉบับจริง" : "ฉบับร่าง"}</span></div>)}</div></section>}{tab === "documents" && <section className="ops-panel"><EmptyState icon="archive" title="เอกสารสัญญา">พื้นที่นี้เตรียมไว้สำหรับแนบ TOR, หนังสือสัญญา และเอกสารประกอบ โดยยังไม่ปะปนกับหลักฐานตรวจสถานี</EmptyState></section>}</section>;
  };
}

export function createWorkPackagePage(runtime) {
  const { Button, CustomSelect, EmptyState, Icon, PageHeader, StatusBadge, assignmentsForWorkPackage, contractFor, createContractStationAssignment, getStationReadiness, navigate, regionsForContract, useMemo, useState, workPackageFor } = runtime;
  return function WorkPackagePage({ state, update, notify, route }) {
    const contract = contractFor(state, route.id);
    const workPackage = workPackageFor(state, route.workPackageId);
    const profiles = (state.stationProfiles || []).filter((profile) => profile.active !== false && (!getStationReadiness || getStationReadiness(profile).ready));
    const existing = assignmentsForWorkPackage(state, route.workPackageId);
    const [selected, setSelected] = useState(() => existing.map((entry) => entry.stationId));
    const [query, setQuery] = useState("");
    const [provinceFilter, setProvinceFilter] = useState("all");
    const [regionFilter, setRegionFilter] = useState("all");
    if (!contract || !workPackage || workPackage.contractId !== contract.id) return <section className="ops-page"><EmptyState title="ไม่พบงวดงาน" action={<Button href={`#/contracts/${encodeURIComponent(route.id)}`} variant="primary">กลับสัญญา</Button>}>งวดงานนี้ไม่อยู่ภายใต้สัญญาที่ระบุ</EmptyState></section>;
    const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
    const filteredProfiles = profiles.filter((profile) => {
      const province = (state.referenceData?.provinces || []).find((entry) => entry.id === profile.provinceId || entry.name === profile.province);
      const region = (state.regions || []).find((entry) => entry.code === province?.regionCode || entry.id === province?.regionId);
      const haystack = `${profile.stationCode} ${profile.stationName} ${profile.province}`.toLocaleLowerCase("th-TH");
      return (!query.trim() || haystack.includes(query.trim().toLocaleLowerCase("th-TH"))) && (provinceFilter === "all" || province?.id === provinceFilter) && (regionFilter === "all" || region?.id === regionFilter || region?.code === regionFilter);
    });
    const save = () => {
      const selectedSet = new Set(selected);
      update((current) => {
        const assignmentIds = new Set(existing.map((entry) => entry.id));
        const nextAssignments = (current.contractStationAssignments || []).map((entry) => assignmentIds.has(entry.id) && !selectedSet.has(entry.stationId) ? { ...entry, status: "inactive", updatedAt: new Date().toISOString() } : entry);
        selected.forEach((stationId) => {
          const currentForStation = nextAssignments.filter((entry) => entry.stationId === stationId && entry.status !== "inactive" && entry.workPackageId !== workPackage.id);
          currentForStation.forEach((entry) => {
            const otherPackage = current.workPackages?.find((candidate) => candidate.id === entry.workPackageId);
            const overlap = (!workPackage.periodEnd || !otherPackage?.periodStart || workPackage.periodEnd >= otherPackage.periodStart) && (!otherPackage?.periodEnd || !workPackage.periodStart || otherPackage.periodEnd >= workPackage.periodStart);
            if (overlap) {
              const index = nextAssignments.findIndex((candidate) => candidate.id === entry.id);
              if (index >= 0) nextAssignments[index] = { ...nextAssignments[index], status: "inactive", effectiveTo: workPackage.periodStart || nextAssignments[index].effectiveTo, updatedAt: new Date().toISOString() };
            }
          });
          const currentAssignment = nextAssignments.find((entry) => entry.workPackageId === workPackage.id && entry.stationId === stationId);
          if (currentAssignment) {
            const index = nextAssignments.findIndex((entry) => entry.id === currentAssignment.id);
            nextAssignments[index] = { ...currentAssignment, status: "active", updatedAt: new Date().toISOString() };
          } else nextAssignments.push(createContractStationAssignment({ contractId: contract.id, workPackageId: workPackage.id, stationId, effectiveFrom: workPackage.periodStart, effectiveTo: workPackage.periodEnd }));
        });
        return { ...current, contractStationAssignments: nextAssignments };
      }, "บันทึกสถานีในงวดแล้ว");
    };
    return <section className="ops-page contracts-page"><PageHeader eyebrow="WORK PACKAGE" title={`${workPackage.reportSequence || workPackage.packageNo} · ${workPackage.title}`} description={`${contract.contractNo || "สัญญา"} · ${contract.title}`} actions={<Button href={`#/contracts/${encodeURIComponent(contract.id)}?tab=work-packages`} icon="arrow">กลับรายการงวด</Button>} /><div className="contract-context-strip"><span><Icon name="archive" />{contract.contractNo || "ยังไม่มีเลขสัญญา"}</span><span><Icon name="list" />{workPackage.reportSequence || workPackage.packageNo || "งวด"}</span><span><Icon name="pin" />{regionsForContract(state, contract).map((region) => region.name).join(" · ") || "ไม่ระบุภาค"}</span></div><section className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-eyebrow">STATION ASSIGNMENT</p><h3>เลือกสถานีในงวดนี้</h3><span className="ops-heading-note">เลือกได้หลายสถานี ระบบจะแสดงเฉพาะสถานี active ที่ผ่านความพร้อมแล้ว</span></div><span className="ops-count-badge">{selected.length}</span></div><div className="ops-filter-bar"><label className="ops-search"><Icon name="search" /><span className="sr-only">ค้นหาสถานี</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหารหัส ชื่อ หรือจังหวัด" /></label><label className="ops-field ops-filter-select"><span>จังหวัด</span><CustomSelect value={provinceFilter} onChange={(event) => setProvinceFilter(event.target.value)}><option value="all">ทุกจังหวัด</option>{(state.referenceData?.provinces || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</CustomSelect></label><label className="ops-field ops-filter-select"><span>ภาค</span><CustomSelect value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}><option value="all">ทุกภาค</option>{(state.regions || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</CustomSelect></label></div>{filteredProfiles.length ? <div className="contract-station-picker">{filteredProfiles.map((profile) => <label className={`contract-station-option ${selected.includes(profile.id) ? "is-selected" : ""}`} key={profile.id}><input type="checkbox" checked={selected.includes(profile.id)} onChange={() => toggle(profile.id)} /><span className="contract-station-option-icon"><Icon name="building" /></span><span><strong>{profile.stationCode} · {profile.stationName}</strong><small>{profile.province || "ไม่ระบุจังหวัด"} · พร้อมสร้างรอบตรวจ</small></span></label>)}</div> : <EmptyState icon="building" title="ไม่พบสถานีที่พร้อมผูกงวด">ตรวจตัวกรอง หรือกลับไปจัดการ Station Profile ให้ผ่านความพร้อมก่อน</EmptyState>}<div className="ops-page-actions ops-page-actions-end"><Button onClick={save} variant="primary" icon="check">บันทึกสถานีในงวด</Button></div></section>{selected.length > 0 && <section className="ops-panel"><div className="ops-panel-heading"><div><p className="ops-eyebrow">NEXT ACTIONS</p><h3>เริ่มรอบตรวจ</h3><span className="ops-heading-note">เริ่มด้วยสถานีและวันที่ตรวจ แล้วเลือกผูกงวดนี้ภายหลังได้</span></div></div><div className="contract-work-actions">{selected.map((stationId) => { const station = profiles.find((profile) => profile.id === stationId); return <article key={stationId}><div><strong>{station?.stationCode} · {station?.stationName}</strong><span>{station?.province || "ไม่ระบุจังหวัด"}</span></div><div><Button href={`#/inspections/new?stationId=${encodeURIComponent(stationId)}`} variant="secondary" icon="plus">สร้างรอบตรวจ</Button><Button href={`#/contracts/${encodeURIComponent(contract.id)}/work-packages/${encodeURIComponent(workPackage.id)}/reports/new?stationId=${encodeURIComponent(stationId)}`} variant="primary" icon="archive">หน้าปกงาน</Button></div></article>; })}</div></section>}</section>;
  };
}
