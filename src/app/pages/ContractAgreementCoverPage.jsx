import ContractAgreementCover from "../ContractAgreementCover.jsx";

function displayDate(value) {
  if (!value) return "ยังไม่ระบุ";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function firstValidationError(errors) {
  return Object.values(errors || {}).find(Boolean) || "กรุณาตรวจสอบข้อมูลหน้าปกสัญญา";
}

function withoutContractCoverDraft(current, contractId) {
  const ui = { ...(current.ui || {}) };
  const drafts = { ...(ui.contractAgreementCoverDrafts || {}) };
  delete drafts[contractId];
  return { ...current, ui: { ...ui, contractAgreementCoverDrafts: drafts } };
}

export function createContractAgreementCoverPage(runtime) {
  const {
    Button,
    EmptyState,
    Icon,
    PageHeader,
    buildContractAgreementCoverSnapshot,
    contractAgreementCoversForContract,
    contractFor,
    createContractAgreementCover,
    createContractCommitteeMember,
    createContractScopeItem,
    nextContractAgreementCoverVersion,
    normalizeContractAgreementData,
    regionsForContract,
    validateContractAgreementCover,
    useEffect,
    useMemo,
    useRef,
    useState,
  } = runtime;

  return function ContractAgreementCoverPage({ state, update, notify, route }) {
    const contract = contractFor(state, route.id);
    const contractId = contract?.id || "";
    const storedDraft = state.ui?.contractAgreementCoverDrafts?.[contractId];
    const initialForm = useMemo(() => normalizeContractAgreementData(storedDraft || contract?.agreementCover || {}), [contract?.agreementCover, contractId, normalizeContractAgreementData, storedDraft]);
    const [form, setForm] = useState(initialForm);
    const [formDirty, setFormDirty] = useState(false);
    const [selectedCoverId, setSelectedCoverId] = useState("");
    const updateRef = useRef(update);
    updateRef.current = update;

    useEffect(() => {
      setForm(initialForm);
      setFormDirty(false);
      setSelectedCoverId("");
    }, [contractId]); // A contract switch must load its own draft; edits within the same contract stay in the form.

    useEffect(() => {
      if (!contractId || !formDirty) return undefined;
      const timer = window.setTimeout(() => {
        updateRef.current((current) => ({
          ...current,
          ui: {
            ...(current.ui || {}),
            contractAgreementCoverDrafts: {
              ...(current.ui?.contractAgreementCoverDrafts || {}),
              [contractId]: normalizeContractAgreementData(form),
            },
          },
        }));
      }, 500);
      return () => window.clearTimeout(timer);
    }, [contractId, form, formDirty]);

    const issuedCovers = useMemo(() => contractAgreementCoversForContract(state, contractId), [contractId, contractAgreementCoversForContract, state]);
    const selectedIssuedCover = issuedCovers.find((cover) => cover.id === selectedCoverId) || null;
    const regions = useMemo(() => regionsForContract(state, contract), [contract, regionsForContract, state]);
    const currentSnapshot = useMemo(() => buildContractAgreementCoverSnapshot({ ...contract, agreementCover: form }, regions), [buildContractAgreementCoverSnapshot, contract, form, regions]);
    const previewSnapshot = selectedIssuedCover?.snapshot || currentSnapshot;

    if (!contract) return <section className="ops-page"><EmptyState icon="alert" title="ไม่พบสัญญา" action={<Button href="#/dashboard" variant="primary">กลับภาพรวม</Button>}>ลิงก์นี้อาจเป็นสัญญาที่ถูกลบหรือยังไม่ได้ซิงก์ข้อมูล</EmptyState></section>;

    const updateForm = (recipe) => {
      setForm((current) => typeof recipe === "function" ? recipe(current) : recipe);
      setFormDirty(true);
      setSelectedCoverId("");
    };
    const saveContractData = (issue = false) => {
      const normalized = normalizeContractAgreementData(form);
      const validation = validateContractAgreementCover(contract, normalized);
      if (!validation.valid) {
        notify(firstValidationError(validation.errors));
        return;
      }
      if (issue) {
        const snapshot = buildContractAgreementCoverSnapshot({ ...contract, agreementCover: normalized }, regions);
        const version = nextContractAgreementCoverVersion(state.contractAgreementCovers, contract.id);
        const issued = createContractAgreementCover({ contractId: contract.id, version, status: "issued", snapshot });
        update((current) => ({
          ...withoutContractCoverDraft({
            ...current,
            contracts: (current.contracts || []).map((entry) => entry.id === contract.id ? { ...entry, agreementCover: normalized, updatedAt: new Date().toISOString() } : entry),
            contractAgreementCovers: [issued, ...(current.contractAgreementCovers || [])],
          }, contract.id),
        }), "ออกหน้าปกสัญญาฉบับใหม่แล้ว");
        setSelectedCoverId(issued.id);
      } else {
        update((current) => withoutContractCoverDraft({
          ...current,
          contracts: (current.contracts || []).map((entry) => entry.id === contract.id ? { ...entry, agreementCover: normalized, updatedAt: new Date().toISOString() } : entry),
        }, contract.id), "บันทึกข้อมูลหน้าปกสัญญาแล้ว");
      }
      setForm(normalized);
      setFormDirty(false);
    };
    const addScopeItem = () => updateForm((current) => ({ ...current, scopeItems: [...current.scopeItems, createContractScopeItem({ order: current.scopeItems.length })] }));
    const removeScopeItem = (id) => updateForm((current) => ({ ...current, scopeItems: current.scopeItems.filter((item) => item.id !== id).map((item, order) => ({ ...item, order })) }));
    const updateScopeItem = (id, description) => updateForm((current) => ({ ...current, scopeItems: current.scopeItems.map((item) => item.id === id ? { ...item, description, updatedAt: new Date().toISOString() } : item) }));
    const addCommitteeMember = () => updateForm((current) => ({ ...current, committeeMembers: [...current.committeeMembers, createContractCommitteeMember({ order: current.committeeMembers.length })] }));
    const removeCommitteeMember = (id) => updateForm((current) => ({ ...current, committeeMembers: current.committeeMembers.filter((member) => member.id !== id).map((member, order) => ({ ...member, order })) }));
    const updateCommitteeMember = (id, field, value) => updateForm((current) => ({ ...current, committeeMembers: current.committeeMembers.map((member) => member.id === id ? { ...member, [field]: value, updatedAt: new Date().toISOString() } : member) }));

    return <section className="ops-page contracts-page contract-agreement-page">
      <PageHeader eyebrow="CONTRACT AGREEMENT COVER" title="หน้าปกสัญญา" description="กรอกข้อมูลตามสัญญาจริง แล้วออกเอกสารฉบับประวัติแยกจากหน้าปกงานตามงวด" actions={<div className="ops-page-actions"><Button href={`#/contracts/${encodeURIComponent(contract.id)}`} icon="arrow">กลับรายละเอียดสัญญา</Button><Button onClick={() => window.print()} variant="primary" icon="archive">พิมพ์หน้าปก</Button></div>} />
      <div className="contract-agreement-workspace">
        <section className="contract-agreement-editor" aria-label="กรอกข้อมูลหน้าปกสัญญา">
          <div className="ops-panel-heading"><div><p className="ops-eyebrow">EDITOR</p><h2>ข้อมูลหน้าปก</h2><span className="ops-heading-note">ข้อมูลสัญญาหลักดึงจาก Contract และส่วนด้านล่างเป็นรายละเอียดเฉพาะหน้าปก</span></div></div>
          {formDirty ? <p className="ops-info-banner"><Icon name="info" />ระบบกำลังเก็บร่างอัตโนมัติ เพื่อป้องกันข้อมูลหายเมื่อ reload หรือเปลี่ยน route</p> : storedDraft && <p className="ops-info-banner"><Icon name="check" />มีร่างหน้าปกที่บันทึกไว้แล้ว</p>}
          <section className="contract-agreement-linked-data"><h3>ข้อมูลจากสัญญาหลัก</h3><dl className="contract-agreement-linked-grid"><div><dt>เลขที่สัญญา</dt><dd>{contract.contractNo || "ยังไม่ระบุ"}</dd></div><div><dt>วันที่สัญญา</dt><dd>{displayDate(contract.contractDate)}</dd></div><div><dt>ชื่อสัญญา</dt><dd>{contract.title || contract.projectName || "ยังไม่ระบุ"}</dd></div><div><dt>หน่วยงานเจ้าของงาน</dt><dd>{contract.agency || "ยังไม่ระบุ"}</dd></div><div><dt>ผู้รับจ้าง</dt><dd>{contract.contractor || "ยังไม่ระบุ"}</dd></div><div><dt>ช่วงสัญญา</dt><dd>{displayDate(contract.startDate)} – {displayDate(contract.endDate)}</dd></div></dl><p className="ops-heading-note">หากข้อมูลกลุ่มนี้ไม่ถูกต้อง ให้กลับไปแก้ที่รายละเอียดสัญญาหลักก่อนออกเอกสาร</p></section>
          <section className="contract-agreement-form-section"><div className="contract-agreement-section-heading"><div><p className="ops-eyebrow">SCOPE OF WORK</p><h3>ขอบเขตงาน</h3></div><Button onClick={addScopeItem} variant="secondary" icon="plus">เพิ่มรายการ</Button></div>{form.scopeItems.map((item, index) => <div className="contract-agreement-repeat-row" key={item.id}><span className="contract-agreement-row-number">{index + 1}</span><input value={item.description} onChange={(event) => updateScopeItem(item.id, event.target.value)} placeholder="รายละเอียดขอบเขตงานตามเอกสาร" aria-label={`ขอบเขตงานรายการที่ ${index + 1}`} /><Button onClick={() => removeScopeItem(item.id)} variant="danger-ghost" icon="delete" aria-label={`ลบขอบเขตงานรายการที่ ${index + 1}`}>ลบ</Button></div>)}{!form.scopeItems.length && <p className="contract-agreement-empty-row">ยังไม่มีขอบเขตงาน กด “เพิ่มรายการ” เพื่อเริ่มกรอก</p>}</section>
          <section className="contract-agreement-form-section"><div className="contract-agreement-section-heading"><div><p className="ops-eyebrow">TERMS & FINANCE</p><h3>ระยะเวลาและการเงิน</h3></div></div><div className="ops-form-grid"><label className="ops-field"><span>ระยะเวลาตามเอกสาร (วัน)</span><input type="number" min="0" value={form.durationDays} onChange={(event) => updateForm((current) => ({ ...current, durationDays: event.target.value }))} placeholder="เช่น 300" /></label><label className="ops-field"><span>มูลค่าสัญญา (บาท)</span><input inputMode="decimal" value={form.contractValue} onChange={(event) => updateForm((current) => ({ ...current, contractValue: event.target.value }))} placeholder="เช่น 4000000.00" /></label><label className="ops-field"><span>ค่าปรับต่อวัน (บาท)</span><input inputMode="decimal" value={form.penaltyPerDay} onChange={(event) => updateForm((current) => ({ ...current, penaltyPerDay: event.target.value }))} placeholder="เช่น 10000.00" /></label><label className="ops-field ops-field-wide"><span>หมายเหตุบนหน้าปก (ถ้ามี)</span><textarea rows="3" value={form.notes} onChange={(event) => updateForm((current) => ({ ...current, notes: event.target.value }))} placeholder="ข้อมูลเพิ่มเติมที่ต้องการเก็บกับหน้าปก" /></label></div></section>
          <section className="contract-agreement-form-section"><div className="contract-agreement-section-heading"><div><p className="ops-eyebrow">COMMITTEE</p><h3>คณะกรรมการ / ผู้เกี่ยวข้อง</h3></div><Button onClick={addCommitteeMember} variant="secondary" icon="plus">เพิ่มรายชื่อ</Button></div>{form.committeeMembers.map((member, index) => <div className="contract-agreement-repeat-row contract-agreement-committee-editor" key={member.id}><span className="contract-agreement-row-number">{index + 1}</span><input value={member.name} onChange={(event) => updateCommitteeMember(member.id, "name", event.target.value)} placeholder="ชื่อ-นามสกุล" aria-label={`ชื่อคณะกรรมการรายการที่ ${index + 1}`} /><input value={member.role} onChange={(event) => updateCommitteeMember(member.id, "role", event.target.value)} placeholder="บทบาท เช่น ประธานกรรมการ" aria-label={`บทบาทคณะกรรมการรายการที่ ${index + 1}`} /><Button onClick={() => removeCommitteeMember(member.id)} variant="danger-ghost" icon="delete" aria-label={`ลบคณะกรรมการรายการที่ ${index + 1}`}>ลบ</Button></div>)}{!form.committeeMembers.length && <p className="contract-agreement-empty-row">ยังไม่มีรายชื่อ กด “เพิ่มรายชื่อ” เพื่อเริ่มกรอก</p>}</section>
          <label className="ops-field contract-agreement-emblem-field"><span>ที่อยู่ไฟล์ตราหน่วยงาน (ถ้ามี)</span><input value={form.emblemPath} onChange={(event) => updateForm((current) => ({ ...current, emblemPath: event.target.value }))} placeholder="เช่น /report/department-seal.png" /></label>
          <div className="ops-page-actions ops-page-actions-end contract-agreement-editor-actions"><Button onClick={() => saveContractData(false)} variant="secondary" icon="check">บันทึกข้อมูลหน้าปก</Button><Button onClick={() => saveContractData(true)} variant="primary" icon="archive">ออกหน้าปกฉบับนี้</Button></div>
        </section>

        <section className="contract-agreement-preview-panel" aria-label="ตัวอย่างหน้าปกสัญญา">
          <div className="contract-agreement-preview-heading"><div><p className="ops-eyebrow">A4 PREVIEW</p><h2>ตัวอย่างหน้าปก</h2><span className="ops-heading-note">ตัวอย่างนี้ใช้ข้อมูลร่างปัจจุบัน ส่วนฉบับที่ออกแล้วจะไม่เปลี่ยนตามการแก้ Contract</span></div>{issuedCovers.length > 0 && <label className="contract-agreement-version-select"><span>ฉบับประวัติ</span><select value={selectedCoverId} onChange={(event) => setSelectedCoverId(event.target.value)}><option value="">ร่างปัจจุบัน</option>{issuedCovers.map((cover) => <option key={cover.id} value={cover.id}>ฉบับที่ {cover.version} · {displayDate(cover.createdAt?.slice(0, 10))}</option>)}</select></label>}</div>
          {selectedIssuedCover && <p className="ops-info-banner"><Icon name="archive" />กำลังดู snapshot ฉบับที่ {selectedIssuedCover.version} ซึ่งเป็นข้อมูลคงที่ ณ วันที่ออกเอกสาร <Button onClick={() => setSelectedCoverId("")} variant="ghost">กลับร่างปัจจุบัน</Button></p>}
          <div className="contract-agreement-preview"><ContractAgreementCover snapshot={previewSnapshot} version={selectedIssuedCover?.version} mode={selectedIssuedCover ? "issued" : "draft"} /></div>
          {issuedCovers.length > 0 && <div className="contract-agreement-issued-list"><h3>ประวัติหน้าปกที่ออกแล้ว</h3>{issuedCovers.map((cover) => <button type="button" key={cover.id} className={selectedCoverId === cover.id ? "is-selected" : ""} onClick={() => setSelectedCoverId(cover.id)}><strong>ฉบับที่ {cover.version}</strong><span>{displayDate(cover.createdAt?.slice(0, 10))}</span></button>)}</div>}
        </section>
      </div>
    </section>;
  };
}
