export function createRevisionPage(runtime) {
  const { Breadcrumb, Button, EmptyState, Icon, PageHeader, StatusBadge, createRevisionRound, formatDateTime, getRoundSummary, navigate, roundFor, shortId, useRef, useState, validateCorrectionReason } = runtime;
  return function RevisionPage({ state, update, notify, requestConfirm, route }) {
    const sourceRound = roundFor(state, route.id);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const reasonRef = useRef(null);
    const summary = sourceRound ? getRoundSummary(sourceRound) : null;
    const revisionNumber = (Number(sourceRound?.revisionNumber) || 0) + 1;
    const submit = async () => {
      const validation = validateCorrectionReason(reason);
      if (!validation.valid) {
        setError(validation.error);
        window.requestAnimationFrame(() => reasonRef.current?.focus());
        return;
      }
      if (!sourceRound || sourceRound.status !== "closed") return;
      const confirmed = await requestConfirm({
        title: `สร้างฉบับแก้ไขครั้งที่ ${revisionNumber}`,
        description: "ระบบจะสร้างรอบ draft ใหม่จาก Snapshot และผลตรวจเดิม รอบประวัติเดิมจะยังอ่านได้และไม่ถูกเขียนทับ",
        confirmLabel: "ยืนยันสร้างฉบับแก้ไข",
        confirmVariant: "primary",
        confirmIcon: "edit",
      });
      if (!confirmed) return;
      setSaving(true);
      try {
        const revision = createRevisionRound(sourceRound, { reason: validation.reason });
        update((current) => ({
          ...current,
          inspectionRounds: [revision, ...current.inspectionRounds],
          activeRoundId: revision.id,
          activeStationId: revision.stationId,
          ui: { ...(current.ui || {}), selectedStationId: revision.stationId },
        }), "สร้างฉบับแก้ไขเป็นรอบใหม่แล้ว");
        navigate(`#/inspections/${encodeURIComponent(revision.id)}`);
      } catch (revisionError) {
        setError(revisionError?.message || "สร้างฉบับแก้ไขไม่สำเร็จ");
      } finally {
        setSaving(false);
      }
    };
    if (!sourceRound) return <section className="ops-page"><Breadcrumb items={[{ label: "ประวัติ / พิมพ์", href: "#/history" }, { label: "สร้างฉบับแก้ไข" }]} /><PageHeader eyebrow="REVISION NOT FOUND" title="ไม่พบรอบต้นฉบับ" description="ลิงก์นี้อาจไม่อยู่ใน browser เครื่องนี้แล้ว" actions={<Button href="#/history" variant="primary" icon="arrow">กลับประวัติ</Button>} /><section className="ops-panel"><EmptyState icon="alert" title="สร้างฉบับแก้ไขไม่ได้">เลือกประวัติที่ปิดแล้วจากหน้าประวัติ / พิมพ์</EmptyState></section></section>;
    if (sourceRound.status !== "closed") return <section className="ops-page"><Breadcrumb items={[{ label: "ประวัติ / พิมพ์รายงาน", href: "#/history" }, { label: "จัดทำฉบับแก้ไข" }]} /><PageHeader eyebrow="REVISION NOT AVAILABLE" title="รอบนี้ยังไม่ปิด" description="จัดทำฉบับแก้ไขได้จากรอบการตรวจที่ปิดแล้วเท่านั้น" actions={<Button href={`#/inspections/${encodeURIComponent(sourceRound.id)}`} variant="primary" icon="arrow">เปิดรอบการตรวจ</Button>} /><section className="ops-panel"><EmptyState icon="info" title="ยังไม่ใช่ประวัติ">ตรวจและปิดรอบนี้ก่อน หากต้องการจัดทำฉบับแก้ไข</EmptyState></section></section>;
    return <section className="ops-page">
      <Breadcrumb items={[{ label: "ประวัติ / พิมพ์รายงาน", href: "#/history" }, { label: sourceRound.snapshot?.stationCode || "ประวัติ", href: `#/history/${encodeURIComponent(sourceRound.id)}` }, { label: "จัดทำฉบับแก้ไข" }]} />
      <PageHeader eyebrow="CREATE REVISION" title={`จัดทำฉบับแก้ไขครั้งที่ ${revisionNumber}`} description="สร้างฉบับร่างใหม่จากรอบเดิม โดยเก็บประวัติข้อมูล ณ วันที่เริ่มรอบการตรวจต้นฉบับไว้อ่านอย่างเดียว" actions={<Button href={`#/history/${encodeURIComponent(sourceRound.id)}`} icon="close">ยกเลิก</Button>} />
      <section className="ops-panel ops-revision-form">
        <div className="ops-revision-banner"><div><p className="ops-eyebrow">SOURCE ROUND</p><h3>{sourceRound.meta.projectName || sourceRound.snapshot?.stationName}</h3><p>{sourceRound.snapshot?.stationCode} · ปิดเมื่อ {formatDateTime(sourceRound.closedAt)} · รอบการตรวจ {shortId(sourceRound.id)}</p></div><StatusBadge status="closed">ต้นฉบับอ่านอย่างเดียว</StatusBadge></div>
        <div className="ops-review-grid"><div><span>Snapshot</span><strong>{sourceRound.snapshot?.equipment?.length || 0}</strong><small>อุปกรณ์ที่ถูกล็อก</small></div><div><span>รายการตรวจ</span><strong>{summary?.total || 0}</strong><small>{summary?.done || 0} รายการมีสถานะแล้ว</small></div><div><span>หลักฐาน</span><strong>{summary?.evidenceComplete || 0}/{summary?.evidenceTotal || 0}</strong><small>ช่องที่มีข้อมูลครบ</small></div><div><span>ฉบับใหม่</span><strong>{revisionNumber}</strong><small>ผู้ใช้เครื่องนี้</small></div></div>
        <label className="ops-field ops-revision-reason" htmlFor="revision-reason"><span>เหตุผลการสร้างฉบับแก้ไข <em>(จำเป็น)</em></span><textarea ref={reasonRef} id="revision-reason" rows="4" maxLength="500" value={reason} onChange={(event) => { setReason(event.target.value); if (error) setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "revision-reason-error" : "revision-reason-help"} placeholder="เช่น แก้ค่าตามใบตรวจหน้างานฉบับแก้ไข" />{error ? <span id="revision-reason-error" className="ops-field-error" role="alert">{error}</span> : <small id="revision-reason-help" className="ops-field-helper">เหตุผลจะถูกเก็บคู่กับฉบับแก้ไขนี้ ไม่เกิน 500 ตัวอักษร</small>}</label>
        <div className="ops-info-banner"><Icon name="archive" /><span>ข้อมูลในรอบต้นฉบับจะไม่ถูกแก้ไข ไฟล์หลักฐานเดิมจะถูกอ้างอิงร่วมจนกว่าคุณจะเปลี่ยนหรือแนบไฟล์ใหม่ใน draft</span></div>
        <div className="ops-page-actions ops-page-actions-end"><Button href={`#/history/${encodeURIComponent(sourceRound.id)}`} icon="close">ยกเลิก</Button><Button onClick={submit} variant="primary" icon="edit" disabled={saving}>{saving ? "กำลังสร้าง..." : "สร้างฉบับแก้ไข"}</Button></div>
      </section>
    </section>;
  }
}

