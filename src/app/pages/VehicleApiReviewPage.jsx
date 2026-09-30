export function createVehicleApiReviewPage(runtime) {
  const { Button, EmptyState, EvidenceField, Icon, MAX_ATTACHMENT_BYTES, PageHeader, StatusBadge, UI_VEHICLE_DEMO_ROUND_ID, VEHICLE_API_REVIEW_VERSION, VEHICLE_REVIEW_CONTEXT_OPTIONS, VEHICLE_REVIEW_SCOPE_VERSION, VehicleFocusReviewPanel, VehicleSearchReviewPanelLegacy, buildInspectionSections, createId, createUiVehicleDemoRound, deleteStoredAttachment, getVehicleReviewContext, getVehicleReviewContextByKey, getVehicleReviewDetail, getVehicleReviewScopeState, isVehicleReviewScopeState, normalizeVehicleReviewState, normalizeVehicleSearchState, roundFor, saveStoredAttachment, updateVehicleSearchReviewDetails, updateVehicleSearchScope, useCallback, useMemo, useState, vehicleApiHref } = runtime;
  return function VehicleApiReviewPage({ state, update: persistUpdate, notify, route }) {
    const storedRound = roundFor(state, route.id);
    const isDemoRoute = !storedRound && route.name === "vehicleApi" && route.id === UI_VEHICLE_DEMO_ROUND_ID;
    const [demoRound, setDemoRound] = useState(() => isDemoRoute ? createUiVehicleDemoRound() : null);
    const [vehicleReviewStatus, setVehicleReviewStatus] = useState(null);
    const round = storedRound || demoRound;
    const context = getVehicleReviewContextByKey(route.context) || VEHICLE_REVIEW_CONTEXT_OPTIONS[0];
    const readOnly = route.name === "historyVehicleApi" || round?.status === "closed";
    const sections = useMemo(() => round ? buildInspectionSections(round.snapshot, round.templateVersion || round.snapshot?.templateVersion) : [], [round]);
    const item = sections.flatMap((section) => section.items).find((candidate) => getVehicleReviewContext(candidate)?.key === context.key) || null;
    const itemValue = item ? (round?.inspectionItems?.[item.id] || { status: "pending", evidence: {}, attachment: null }) : { status: "pending", evidence: {}, attachment: null };
    const updateRound = useCallback((recipe, message = "") => {
      if (readOnly) return;
      if (isDemoRoute) {
        setDemoRound((current) => {
          if (!current) return current;
          const demoState = { inspectionRounds: [current], activeRoundId: current.id, activeStationId: current.stationId };
          const nextState = typeof recipe === "function" ? recipe(demoState) : recipe;
          return nextState?.inspectionRounds?.find((entry) => entry.id === current.id) || current;
        });
        if (message) notify(message);
        return;
      }
      persistUpdate(recipe, message);
    }, [isDemoRoute, notify, persistUpdate, readOnly]);
    const updateItem = useCallback((patch) => {
      if (!round || !item || readOnly) return;
      updateRound((current) => ({
        ...current,
        activeRoundId: round.id,
        activeStationId: round.stationId,
        inspectionRounds: current.inspectionRounds.map((entry) => entry.id === round.id
          ? { ...entry, updatedAt: new Date().toISOString(), inspectionItems: { ...entry.inspectionItems, [item.id]: { ...(entry.inspectionItems[item.id] || {}), ...patch } } }
          : entry),
      }));
    }, [item, readOnly, round, updateRound]);
    const updateVehicleSearch = useCallback((nextVehicleSearch) => {
      if (!round || readOnly) return;
      updateRound((current) => ({
        ...current,
        activeRoundId: round.id,
        activeStationId: round.stationId,
        inspectionRounds: current.inspectionRounds.map((entry) => entry.id === round.id ? {
          ...entry,
          updatedAt: new Date().toISOString(),
          vehicleSearch: entry.snapshot?.vehicleReviewScopeVersion === VEHICLE_REVIEW_SCOPE_VERSION && isVehicleReviewScopeState(nextVehicleSearch)
            ? normalizeVehicleReviewState(nextVehicleSearch, { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate, stationCode: entry.snapshot?.stationCode }, { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile, searchUrl: entry.snapshot?.vehicleSearchConfig?.searchUrl, stationProfileId: entry.stationId || entry.snapshot?.stationId })
            : normalizeVehicleSearchState(nextVehicleSearch, { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate, stationCode: entry.snapshot?.stationCode }, { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile, searchUrl: entry.snapshot?.vehicleSearchConfig?.searchUrl, stationProfileId: entry.stationId || entry.snapshot?.stationId }),
        } : entry),
      }));
    }, [readOnly, round, updateRound]);
    const handleAttachmentChange = async (slotDefinition, file) => {
      if (readOnly || !round || !item) return;
      const accepted = slotDefinition.fieldType === "document"
        ? file?.type?.startsWith("image/") || ["application/pdf", "text/plain"].includes(file?.type)
        : file?.type?.startsWith("image/");
      if (!accepted) {
        notify("กรุณาเลือกไฟล์เอกสารหรือภาพหลักฐาน");
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        notify("ขนาดไฟล์หลักฐานต้องไม่เกิน 10 MB");
        return;
      }
      const attachmentId = createId("attachment");
      const metadata = { id: attachmentId, name: file.name || "หลักฐานแนบ", type: file.type || "application/octet-stream", size: file.size || 0, addedAt: new Date().toISOString() };
      try {
        await saveStoredAttachment(attachmentId, file, { stationId: round.stationId });
        const previousAttachment = itemValue.evidence?.[slotDefinition.id]?.attachment;
        updateItem({ evidence: { ...(itemValue.evidence || {}), [slotDefinition.id]: { ...(itemValue.evidence?.[slotDefinition.id] || {}), attachment: metadata, status: "complete" } } });
        if (previousAttachment?.id && previousAttachment.id !== attachmentId) await deleteStoredAttachment(previousAttachment.id);
        notify("บันทึกเอกสารหลักฐานแล้ว");
      } catch (error) {
        await deleteStoredAttachment(attachmentId).catch(() => {});
        notify(error?.message || "บันทึกเอกสารหลักฐานไม่สำเร็จ");
      }
    };
    const handleAttachmentRemove = async (slotDefinition, attachment, label) => {
      if (readOnly || !round || !item || !attachment?.id) return;
      updateItem({ evidence: { ...(itemValue.evidence || {}), [slotDefinition.id]: { ...(itemValue.evidence?.[slotDefinition.id] || {}), attachment: null, status: "pending" } } });
      await deleteStoredAttachment(attachment.id).catch(() => {});
      notify(`ลบหลักฐานของ ${label || context.label} แล้ว`);
    };
    const handleVehicleReviewEvidenceAttachmentChange = async (scopeKey, rowId, dimension, file) => {
      if (readOnly || !round || !file) return;
      const accepted = file.type?.startsWith("image/") || file.type === "application/pdf";
      if (!accepted) throw new Error("กรุณาเลือกภาพหรือ PDF เป็นหลักฐาน");
      if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("ขนาดไฟล์หลักฐานต้องไม่เกิน 10 MB");
      const attachmentId = createId("vehicle-review-evidence");
      const metadata = { id: attachmentId, name: file.name || "หลักฐานตรวจรถ", type: file.type || "application/octet-stream", size: file.size || 0, addedAt: new Date().toISOString() };
      const currentVehicleSearch = round.vehicleSearch;
      const currentScope = isVehicleReviewScopeState(currentVehicleSearch)
        ? getVehicleReviewScopeState(currentVehicleSearch, scopeKey, { dateFrom: round.meta?.inspectionDate, dateTo: round.meta?.inspectionDate }, { baseUrl: round.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: round.snapshot?.vehicleSearchConfig?.apiProfile })
        : normalizeVehicleSearchState(currentVehicleSearch, { dateFrom: round.meta?.inspectionDate, dateTo: round.meta?.inspectionDate }, { baseUrl: round.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: round.snapshot?.vehicleSearchConfig?.apiProfile });
      const previousAttachment = getVehicleReviewDetail(currentScope.rows.find((row) => row.id === rowId), dimension).evidenceAttachment;
      try {
        await saveStoredAttachment(attachmentId, file, { stationId: round.stationId });
        updateRound((current) => ({
          ...current,
          activeRoundId: round.id,
          activeStationId: round.stationId,
          inspectionRounds: current.inspectionRounds.map((entry) => {
            if (entry.id !== round.id) return entry;
            const existing = entry.vehicleSearch;
            const baseScope = isVehicleReviewScopeState(existing)
              ? getVehicleReviewScopeState(existing, scopeKey, { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate }, { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile })
              : normalizeVehicleSearchState(existing, { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate }, { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile });
            const nextScope = updateVehicleSearchReviewDetails(baseScope, rowId, dimension, { evidenceAttachment: metadata });
            const nextVehicleSearch = isVehicleReviewScopeState(existing)
              ? updateVehicleSearchScope(existing, scopeKey, nextScope, { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile })
              : nextScope;
            return { ...entry, updatedAt: new Date().toISOString(), vehicleSearch: nextVehicleSearch };
          }),
        }));
        if (previousAttachment?.id && previousAttachment.id !== attachmentId) await deleteStoredAttachment(previousAttachment.id);
        notify("บันทึกหลักฐานผลตรวจรถแล้ว");
        return metadata;
      } catch (error) {
        await deleteStoredAttachment(attachmentId).catch(() => {});
        throw error;
      }
    };
    const handleVehicleReviewEvidenceAttachmentRemove = async (scopeKey, rowId, dimension, attachment) => {
      if (readOnly || !round || !attachment?.id) return;
      updateRound((current) => ({
        ...current,
        activeRoundId: round.id,
        activeStationId: round.stationId,
        inspectionRounds: current.inspectionRounds.map((entry) => {
          if (entry.id !== round.id) return entry;
          const existing = entry.vehicleSearch;
          const baseScope = isVehicleReviewScopeState(existing)
            ? getVehicleReviewScopeState(existing, scopeKey, { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate }, { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile })
            : normalizeVehicleSearchState(existing, { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate }, { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile });
          const nextScope = updateVehicleSearchReviewDetails(baseScope, rowId, dimension, { evidenceAttachment: null });
          const nextVehicleSearch = isVehicleReviewScopeState(existing)
            ? updateVehicleSearchScope(existing, scopeKey, nextScope, { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile })
            : nextScope;
          return { ...entry, updatedAt: new Date().toISOString(), vehicleSearch: nextVehicleSearch };
        }),
      }));
      await deleteStoredAttachment(attachment.id).catch(() => {});
      notify("นำหลักฐานผลตรวจรถออกแล้ว");
    };
    if (!round) return <section className="ops-page"><PageHeader eyebrow="NOT FOUND" title="ไม่พบรอบการตรวจ" description="ลิงก์นี้อาจถูกลบหรือข้อมูลยังไม่ได้ปรับรูปแบบ" actions={<Button href="#/inspections" variant="primary" icon="arrow">กลับหน้ารอบการตรวจ</Button>} /><section className="ops-panel"><EmptyState icon="alert" title="ไม่สามารถเปิดหน้าตรวจนี้ได้">เลือกอีกรอบจากหน้ารอบการตรวจหรือประวัติ</EmptyState></section></section>;
    const backToHistory = route.name === "historyVehicleApi" || round.status === "closed";
    const backHref = backToHistory ? `#/history/${encodeURIComponent(round.id)}` : `#/inspections/${encodeURIComponent(round.id)}`;
    const reportHref = `#/${backToHistory ? "history" : "inspections"}/${encodeURIComponent(round.id)}/vehicle-api-report/${encodeURIComponent(context.key)}${route.query?.scope ? `?scope=${encodeURIComponent(route.query.scope)}` : ""}`;
    const otherContext = context.key === "plate" ? getVehicleReviewContextByKey("classification") : getVehicleReviewContextByKey("plate");
    const apiOnlyReview = round.snapshot?.vehicleReviewVersion === VEHICLE_API_REVIEW_VERSION;
    const reviewContextLabel = apiOnlyReview
      ? (context.key === "plate" ? "ตรวจผลอ่านป้ายทะเบียนจาก API" : "ตรวจผลคัดแยกประเภทรถจาก API")
      : context.label;
    return <section className={`ops-page ops-vehicle-api-page is-context-${context.key}`}>
      <PageHeader eyebrow={context.checklistNumber} title={context.key === "plate" ? "ตรวจป้ายทะเบียน" : "คัดแยกประเภทรถ"} actions={<div className="ops-vehicle-review-header-actions">{isDemoRoute && <span className="ops-vehicle-demo-badge" role="status">ตัวอย่าง · ไม่บันทึกรอบจริง</span>}{apiOnlyReview && vehicleReviewStatus && <StatusBadge status={vehicleReviewStatus.tone}>{vehicleReviewStatus.label}</StatusBadge>}<nav className="ops-vehicle-review-context-tabs" aria-label="เลือกงานตรวจ"><a className={context.key === "plate" ? "is-active" : ""} href={vehicleApiHref(round, "plate", { history: backToHistory })} aria-current={context.key === "plate" ? "page" : undefined}>ป้ายทะเบียน</a><a className={context.key === "classification" ? "is-active" : ""} href={vehicleApiHref(round, "classification", { history: backToHistory })} aria-current={context.key === "classification" ? "page" : undefined}>คัดแยกประเภทรถ</a></nav>{!isDemoRoute && <Button href={reportHref} variant="primary" icon="document">รายงานผล</Button>}<Button href={backHref} variant="secondary" icon="arrow">กลับรายการตรวจ</Button></div>} />
      {backToHistory && <div className="ops-readonly-banner"><Icon name="archive" /><span>รอบการตรวจนี้ปิดแล้ว · ข้อมูลและผลตรวจจาก Snapshot เป็นแบบอ่านอย่างเดียว</span></div>}
      {apiOnlyReview ? <VehicleFocusReviewPanel round={round} value={round.vehicleSearch} scopeKey={route.query?.scope || ""} focusRowId={route.query?.rowId || ""} focusReviewKind={route.query?.reviewKind || ""} readOnly={readOnly} onChange={updateVehicleSearch} notify={notify} contextKey={context.key} allowLiveSearch={!isDemoRoute} onReviewStatusChange={setVehicleReviewStatus} evidenceItem={item} evidenceItemValue={itemValue} onEvidenceChange={updateItem} onEvidenceAttachmentChange={handleAttachmentChange} onEvidenceAttachmentRemove={handleAttachmentRemove} onVehicleReviewEvidenceAttachmentChange={handleVehicleReviewEvidenceAttachmentChange} onVehicleReviewEvidenceAttachmentRemove={handleVehicleReviewEvidenceAttachmentRemove} /> : <section className="ops-vehicle-api-page-grid">
        <section className="ops-panel ops-vehicle-document-panel" aria-labelledby="vehicle-document-evidence-title">
          <div className="ops-panel-heading"><div><p className="ops-eyebrow">DOCUMENT / EVIDENCE</p><h2 id="vehicle-document-evidence-title">{context.label}</h2><p>แนบเอกสารหรือหลักฐานของบริบทนี้แยกจากผลตรวจรายคัน</p></div><StatusBadge status={itemValue.evidence?.[item?.evidenceSlots?.[0]?.id]?.attachment ? "normal" : "pending"}>{itemValue.evidence?.[item?.evidenceSlots?.[0]?.id]?.attachment ? "มีหลักฐานแล้ว" : "รอหลักฐาน"}</StatusBadge></div>
          {item ? item.evidenceSlots.map((slot) => <EvidenceField key={slot.id} item={item} slot={slot} value={itemValue.evidence?.[slot.id]} readOnly={readOnly} disabled={false} onChange={(slotId, patch) => updateItem({ evidence: { ...(itemValue.evidence || {}), [slotId]: { ...(itemValue.evidence?.[slotId] || {}), ...patch } } })} onAttachmentChange={handleAttachmentChange} onAttachmentRemove={handleAttachmentRemove} />) : <EmptyState icon="info" title="ไม่พบรายการหลักฐานของบริบทนี้">รายการนี้อาจเป็น Snapshot รุ่นเก่า</EmptyState>}
        </section>
        <VehicleSearchReviewPanelLegacy round={round} value={round.vehicleSearch} readOnly={readOnly} onChange={updateVehicleSearch} notify={notify} contextKey={context.key} />
      </section>}
    </section>;
  }
}
