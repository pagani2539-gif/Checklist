export function createChecklistPage(runtime) {
  const { Breadcrumb, Button, ChecklistEvidenceDrawer, ChecklistItem, ChecklistPager, ChecklistTaskQueue, CloseReadinessDialog, EmptyState, Icon, MAX_ATTACHMENT_BYTES, PageHeader, PrintableReport, REPORT_COMPANIES, REPORT_COVER_FIELD_LABELS, REPORT_COVER_REQUIRED_FIELDS, StatusBadge, UI_DEMO_ROUND_ID, UI_VEHICLE_DEMO_ROUND_ID, VEHICLE_API_REVIEW_VERSION, VEHICLE_REVIEW_SCOPE_VERSION, appendStationInspectionReportRevision, attachmentIdsForRound, buildInspectionSections, buildItemState, createId, createUiDemoRound, createUiVehicleDemoRound, deleteStoredAttachment, deleteStoredAttachments, domSafeId, formatDate, formatDateTime, getChecklistCoverageSummary, getChecklistPageNavigationItems, getChecklistScopeMeta, getChecklistWorkContext, getCloseReadiness, getCorrectionSummary, getInspectionProgressModel, getItemsForSnapshot, getReportCoverMeta, getReportCoverReadiness, getSectionEvidenceStats, getVehicleReviewContext, getVehicleReviewState, inferReportCompanyId, isEvidenceBypassItemStatus, isEvidenceSlotComplete, isVehicleApiReviewItem, isVehicleReviewScopeState, navigate, normalizeReportCoverMeta, normalizeVehicleReviewState, normalizeVehicleSearchState, roundFor, saveStationInspectionReportCover, saveStoredAttachment, shortId, stationInspectionReportForRound, useCallback, useEffect, useMemo, useRef, useState, vehicleApiHref } = runtime;
  return function ChecklistPage({ state, update: persistUpdate, notify, requestConfirm, route, readOnly = false, savedAt = null }) {
    const storedRound = roundFor(state, route.id);
    const isDemoRoute = !storedRound && route.name === "checklist" && [UI_DEMO_ROUND_ID, UI_VEHICLE_DEMO_ROUND_ID].includes(route.id);
    const [demoRound, setDemoRound] = useState(() => {
      if (!isDemoRoute) return null;
      return route.id === UI_VEHICLE_DEMO_ROUND_ID ? createUiVehicleDemoRound() : createUiDemoRound();
    });
    const round = storedRound || demoRound;
    const isDemoRound = Boolean(isDemoRoute && demoRound);
    const update = useCallback((recipe, message = "") => {
      if (!isDemoRound) {
        persistUpdate(recipe, message);
        return;
      }
      setDemoRound((current) => {
        if (!current) return current;
        const demoState = { inspectionRounds: [current], activeRoundId: current.id, activeStationId: current.stationId };
        const nextState = typeof recipe === "function" ? recipe(demoState) : recipe;
        return nextState?.inspectionRounds?.find((entry) => entry.id === current.id) || current;
      });
      if (message) notify(message);
    }, [isDemoRound, notify, persistUpdate]);
    const revisionAttachmentIdsRef = useRef(new Set());
    const visibleRound = round;
    const formReadOnly = readOnly;
    const isRevisionRound = Boolean(round?.basedOnRoundId);
    const saveStateLabel = readOnly ? "อ่านอย่างเดียว" : isDemoRound ? "ตัวอย่าง · ไม่บันทึกรอบจริง" : savedAt ? "บันทึกแล้ว" : "พร้อมบันทึกอัตโนมัติ";
    const sections = useMemo(() => visibleRound ? buildInspectionSections(visibleRound.snapshot, visibleRound.templateVersion || visibleRound.snapshot?.templateVersion) : [], [visibleRound]);
    const [selectedSection, setSelectedSection] = useState(() => route.id === UI_VEHICLE_DEMO_ROUND_ID ? "5.1" : "");
    const [currentItemId, setCurrentItemId] = useState(() => route.id === UI_VEHICLE_DEMO_ROUND_ID ? "5.1.plate-document" : "");
    const [pendingFocusItemId, setPendingFocusItemId] = useState("");
    const [pendingFocusEvidence, setPendingFocusEvidence] = useState(null);
    const [workspacePanel, setWorkspacePanel] = useState("result");
    const [isCompactWorkspace, setIsCompactWorkspace] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 1279px)").matches === true);
    const [reportPreviewMode, setReportPreviewMode] = useState("none");
    const [reportCompanyId, setReportCompanyId] = useState("");
    const [reportCoverMeta, setReportCoverMeta] = useState(() => getReportCoverMeta(visibleRound, { state }));
    const [reportMenuOpen, setReportMenuOpen] = useState(false);
    useEffect(() => {
      const media = window.matchMedia?.("(max-width: 1279px)");
      if (!media) return undefined;
      const sync = () => setIsCompactWorkspace(media.matches);
      sync();
      media.addEventListener?.("change", sync);
      return () => media.removeEventListener?.("change", sync);
    }, []);
    useEffect(() => { setReportCompanyId(""); }, [route.id, visibleRound?.id]);
    useEffect(() => { setReportCoverMeta(getReportCoverMeta(visibleRound, { state })); }, [route.id, visibleRound?.id, state.stationInspectionReports]);
    const [closeReadinessDialog, setCloseReadinessDialog] = useState(false);
    const clearPendingFocusEvidence = useCallback(() => setPendingFocusEvidence(null), []);
    const visibleSections = useMemo(() => sections.map((section) => {
      const items = section.items.filter((item) => item.applicable !== false);
      return { ...section, sourceItems: items, items, excludedItemCount: section.items.length - items.length };
    }).filter((section) => section.items.length > 0), [sections]);
    useEffect(() => { if (visibleSections.length && !visibleSections.some((section) => section.code === selectedSection)) setSelectedSection(visibleSections[0].code); }, [visibleSections, selectedSection]);
    useEffect(() => {
      if (!pendingFocusItemId) return undefined;
      const frame = window.requestAnimationFrame(() => {
        const heading = document.getElementById("checklist-current-item-heading") || document.getElementById(`check-item-${domSafeId(pendingFocusItemId)}-heading`);
        if (!heading) return;
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const behavior = reducedMotion ? "auto" : "smooth";
         heading.focus({ preventScroll: true });
         document.querySelector("#workspace-panel-result")?.scrollTo({ top: 0, behavior });
        setPendingFocusItemId("");
      });
      return () => window.cancelAnimationFrame(frame);
    }, [pendingFocusItemId, selectedSection]);
    if (!round) return <section className="ops-page"><PageHeader eyebrow="NOT FOUND" title="ไม่พบรอบการตรวจ" description="ลิงก์นี้อาจถูกลบหรือข้อมูลยังไม่ได้ปรับรูปแบบ" actions={<Button href="#/inspections" variant="primary" icon="arrow">กลับหน้ารอบการตรวจ</Button>} /><section className="ops-panel"><EmptyState icon="alert" title="ไม่สามารถเปิดรอบการตรวจนี้ได้">เลือกอีกรอบจากหน้ารอบการตรวจทั้งหมด</EmptyState></section></section>;
    const nextRoundHref = `#/inspections/new?stationId=${encodeURIComponent(round.stationId)}`;
    if (readOnly && route.query?.edit === "1") return <section className="ops-page"><PageHeader eyebrow="LEGACY LINK" title="กำลังเปิดขั้นตอนจัดทำฉบับแก้ไข" description="ลิงก์แก้ไขย้อนหลังแบบเดิมไม่เขียนทับประวัติ ระบบกำลังพาไปยังขั้นตอนจัดทำฉบับแก้ไข" actions={<Button href={`#/history/${encodeURIComponent(round.id)}/revise`} variant="primary" icon="edit">ไปจัดทำฉบับแก้ไข</Button>} /><section className="ops-panel"><EmptyState icon="refresh" title="เปลี่ยนเส้นทางแล้ว">หากหน้านี้ไม่เปลี่ยนอัตโนมัติ ให้กดปุ่มด้านบน</EmptyState></section></section>;
    if (!readOnly && round.status === "closed") return <section className="ops-page"><Breadcrumb items={[{ label: "รอบการตรวจ", href: "#/inspections" }, { label: "รอบการตรวจที่ปิดแล้ว" }]} /><PageHeader eyebrow="ROUND CLOSED" title="รอบการตรวจนี้ปิดแล้ว" description="ข้อมูลถูกล็อกเพื่อรักษาประวัติข้อมูล ณ วันที่เริ่มรอบการตรวจเดิม" actions={<div className="ops-page-actions"><Button href={`#/history/${encodeURIComponent(round.id)}`} variant="primary" icon="archive">เปิดประวัติ</Button><Button href={nextRoundHref} icon="plus">เริ่มตรวจสถานีนี้อีกครั้ง</Button></div>} /><section className="ops-panel"><EmptyState icon="archive" title="รอบนี้อ่านอย่างเดียว">เพื่อเริ่มตรวจซ้ำ ให้เลือกสถานีและวันที่ตรวจ แล้วผูกสัญญาภายหลังได้</EmptyState></section></section>;
    if (readOnly && round.status !== "closed") return <section className="ops-page"><Breadcrumb items={[{ label: "ประวัติ / พิมพ์รายงาน", href: "#/history" }, { label: "ลิงก์ไม่ถูกต้อง" }]} /><PageHeader eyebrow="NOT A CLOSED ROUND" title="รอบนี้ยังไม่ปิด" description="เปิดรอบฉบับร่างจากเมนูรอบการตรวจเพื่อกรอกต่อ" actions={<Button href={`#/inspections/${encodeURIComponent(round.id)}`} variant="primary" icon="list">เปิดรอบการตรวจ</Button>} /><section className="ops-panel"><EmptyState icon="info" title="ยังไม่ใช่ประวัติ">ประวัติจะแสดงเฉพาะรอบการตรวจที่ปิดแล้วเท่านั้น</EmptyState></section></section>;
    const progressModel = getInspectionProgressModel(visibleRound);
    const summary = progressModel;
    const closeReadiness = !readOnly ? getCloseReadiness(visibleRound) : { canClose: false, canConfirmClose: false, blockers: [], issues: [], firstBlocker: null, blockerCount: 0, issueCount: 0 };
    const allItems = progressModel.items;
    const coverage = getChecklistCoverageSummary(visibleRound.snapshot, allItems);
    const selectedSectionData = visibleSections.find((section) => section.code === selectedSection) || null;
    const visibleItems = useMemo(() => getChecklistPageNavigationItems(visibleSections), [visibleSections]);
    const currentVisibleItem = visibleItems.find((item) => item.id === currentItemId) || visibleItems[0];
    const currentItemScope = getChecklistScopeMeta(currentVisibleItem);
    const currentSection = visibleSections.find((section) => section.items.some((item) => item.id === currentVisibleItem?.id)) || selectedSectionData || visibleSections[0] || sections[0];
    const currentSectionSource = currentSection || { items: [] };
    const currentSectionEvidence = getSectionEvidenceStats(currentSectionSource, visibleRound);
    const currentItemIndex = Math.max(0, visibleItems.findIndex((item) => item.id === currentVisibleItem?.id));
    const currentItemValue = currentVisibleItem ? (visibleRound.inspectionItems[currentVisibleItem.id] || {}) : {};
    const currentIsVehicleApiReview = visibleRound.snapshot?.vehicleReviewVersion === VEHICLE_API_REVIEW_VERSION
      && isVehicleApiReviewItem(currentVisibleItem, visibleRound.snapshot);
    const currentIsLegacyVehicleApiReview = !currentIsVehicleApiReview && isVehicleApiReviewItem(currentVisibleItem, visibleRound.snapshot);
    const currentIsVehicleReview = currentIsVehicleApiReview || currentIsLegacyVehicleApiReview;
    const currentVehicleContext = (currentIsVehicleApiReview || currentIsLegacyVehicleApiReview) ? getVehicleReviewContext(currentVisibleItem) : null;
    const currentVehicleReview = getVehicleReviewState(visibleRound.vehicleSearch, { reviewVersion: visibleRound.snapshot?.vehicleReviewVersion, context: currentVehicleContext?.key });
    const currentEvidenceSlots = currentVisibleItem?.evidenceSlots || [];
    const currentEvidenceBypassed = currentVisibleItem?.applicable === false || isEvidenceBypassItemStatus(currentItemValue.status || "pending");
    const currentEvidenceComplete = currentEvidenceBypassed ? 0 : currentEvidenceSlots.filter((slot) => isEvidenceSlotComplete(slot, currentItemValue.evidence?.[slot.id])).length;
    const currentChecklistContext = getChecklistWorkContext(currentVisibleItem, currentItemValue, { vehicleReview: currentIsVehicleReview });
    const workspaceContextRef = useRef({ itemId: currentVisibleItem?.id || "", contextKey: currentChecklistContext.key });
    useEffect(() => {
      const nextContext = { itemId: currentVisibleItem?.id || "", contextKey: currentChecklistContext.key };
      const contextChanged = workspaceContextRef.current.itemId !== nextContext.itemId || workspaceContextRef.current.contextKey !== nextContext.contextKey;
      if (!contextChanged) return;
      workspaceContextRef.current = nextContext;
      setWorkspacePanel(currentIsVehicleReview || currentChecklistContext.key !== "evidence" ? "result" : "evidence");
    }, [currentChecklistContext.key, currentIsVehicleReview, currentVisibleItem?.id]);
    useEffect(() => {
      if (currentIsVehicleReview && workspacePanel === "evidence") setWorkspacePanel("result");
    }, [currentIsVehicleReview, workspacePanel]);
    const handleWorkspaceTabKeyDown = (event) => {
      const panelOrder = currentIsVehicleReview ? ["queue", "result"] : ["queue", "evidence", "result"];
      const currentIndex = panelOrder.indexOf(workspacePanel);
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % panelOrder.length;
      else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + panelOrder.length) % panelOrder.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = panelOrder.length - 1;
      else return;
      event.preventDefault();
      const nextPanel = panelOrder[nextIndex];
      setWorkspacePanel(nextPanel);
      window.requestAnimationFrame(() => document.getElementById(`workspace-tab-${nextPanel}`)?.focus());
    };
    const navigateItem = (step) => {
      if (!visibleItems.length) return;
      const currentIndex = visibleItems.findIndex((item) => item.id === currentVisibleItem?.id);
      const nextIndex = Math.min(visibleItems.length - 1, Math.max(0, (currentIndex < 0 ? 0 : currentIndex) + step));
      const target = visibleItems[nextIndex];
      if (!target || target.id === currentVisibleItem?.id) return;
      setCurrentItemId(target.id);
      setSelectedSection(target.sectionCode);
      setWorkspacePanel("result");
      setPendingFocusItemId(target.id);
    };
    const firstIncompleteRequiredEvidence = (item, itemValue) => (item.evidenceSlots || []).find((slot) => slot.required !== false && !isEvidenceSlotComplete(slot, itemValue?.evidence?.[slot.id]));
    const handleStatusChange = (item, nextStatus, itemValue) => {
      setPendingFocusEvidence(null);
      if (nextStatus === "normal") {
        const missingEvidence = firstIncompleteRequiredEvidence(item, itemValue);
        updateItem(item.id, { status: nextStatus });
        if (missingEvidence) {
          setWorkspacePanel("evidence");
          setPendingFocusEvidence({ itemId: item.id, slotId: missingEvidence.id });
          notify("บันทึกสถานะแล้ว · กรุณาตรวจหลักฐานที่จำเป็น");
          return;
        }
        navigateItem(1);
        return;
      }
      updateItem(item.id, { status: nextStatus });
      if (isEvidenceBypassItemStatus(nextStatus)) {
        navigateItem(1);
        return;
      }
    };
    const selectSection = (sectionCode) => {
      setSelectedSection(sectionCode);
      const section = visibleSections.find((entry) => entry.code === sectionCode);
      const firstItem = section?.items[0];
      if (firstItem) {
        setCurrentItemId(firstItem.id);
        setPendingFocusItemId(firstItem.id);
      }
    };
    const updateItem = (itemId, patch) => {
      update((current) => ({ ...current, activeRoundId: round.id, activeStationId: round.stationId, inspectionRounds: current.inspectionRounds.map((entry) => entry.id === round.id ? { ...entry, updatedAt: new Date().toISOString(), inspectionItems: { ...entry.inspectionItems, [itemId]: { ...(entry.inspectionItems[itemId] || {}), ...patch } } } : entry) }));
    };
    const updateVehicleSearch = useCallback((nextVehicleSearch) => {
      if (formReadOnly || round.status === "closed") return;
      update((current) => ({ ...current, activeRoundId: round.id, activeStationId: round.stationId, inspectionRounds: current.inspectionRounds.map((entry) => {
        if (entry.id !== round.id) return entry;
        const fallbackCriteria = { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate, stationCode: entry.snapshot?.stationCode };
        const options = { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile };
        const vehicleSearch = entry.snapshot?.vehicleReviewScopeVersion === VEHICLE_REVIEW_SCOPE_VERSION && isVehicleReviewScopeState(nextVehicleSearch)
          ? normalizeVehicleReviewState(nextVehicleSearch, fallbackCriteria, options)
          : normalizeVehicleSearchState(nextVehicleSearch, fallbackCriteria, options);
        return { ...entry, updatedAt: new Date().toISOString(), vehicleSearch };
      }) }));
    }, [formReadOnly, round.id, round.stationId, round.status, update]);
    const openVehicleApiReview = () => {
      if (!currentVehicleContext) return;
      navigate(vehicleApiHref(visibleRound, currentVehicleContext.key, { history: formReadOnly }));
    };
    const handleAttachmentChange = async (itemId, slotIdOrFile, maybeFile, fieldType = "photo") => {
      if (formReadOnly || round.status === "closed") return;
      const slotId = typeof slotIdOrFile === "string" ? slotIdOrFile : null;
      const file = slotId ? maybeFile : slotIdOrFile;
      const accepted = fieldType === "photo"
        ? file?.type?.startsWith("image/")
        : fieldType === "video"
          ? file?.type?.startsWith("video/")
          : file?.type?.startsWith("image/") || file?.type?.startsWith("video/") || ["application/pdf", "text/plain"].includes(file?.type);
      if (!accepted) {
        notify("กรุณาเลือกไฟล์ภาพ วิดีโอ PDF หรือข้อความ");
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        notify("ขนาดไฟล์หลักฐานต้องไม่เกิน 10 MB");
        return;
      }
      const attachmentId = createId("attachment");
      const metadata = {
        id: attachmentId,
        name: file.name || "หลักฐานแนบ",
        type: file.type || "application/octet-stream",
        size: file.size || 0,
        addedAt: new Date().toISOString(),
      };
      try {
        await saveStoredAttachment(attachmentId, file, { stationId: round.stationId });
        const currentItem = visibleRound.inspectionItems[itemId] || {};
        const previousAttachment = slotId ? currentItem.evidence?.[slotId]?.attachment : currentItem.attachment;
        const patch = slotId
          ? { evidence: { ...(currentItem.evidence || {}), [slotId]: { ...(currentItem.evidence?.[slotId] || {}), attachment: metadata, status: "complete" } } }
          : { attachment: metadata };
        if (isRevisionRound) {
          revisionAttachmentIdsRef.current.add(attachmentId);
          if (previousAttachment?.id && previousAttachment.id !== attachmentId && revisionAttachmentIdsRef.current.has(previousAttachment.id)) {
            revisionAttachmentIdsRef.current.delete(previousAttachment.id);
            await deleteStoredAttachment(previousAttachment.id).catch(() => {});
          }
        }
        updateItem(itemId, patch);
        if (!isRevisionRound && previousAttachment?.id && previousAttachment.id !== attachmentId) await deleteStoredAttachment(previousAttachment.id);
        notify(fieldType === "video" ? "แนบวิดีโอแล้ว" : "แนบหลักฐานแล้ว");
      } catch (error) {
        await deleteStoredAttachment(attachmentId).catch(() => {});
        notify(error?.message || "บันทึกภาพไม่สำเร็จ");
      }
    };
    const handleAttachmentRemove = async (itemId, slotIdOrAttachment, attachmentOrLabel, maybeLabel) => {
      const slotId = typeof slotIdOrAttachment === "string" ? slotIdOrAttachment : null;
      const attachment = slotId ? attachmentOrLabel : slotIdOrAttachment;
      const label = slotId ? maybeLabel : attachmentOrLabel;
      if (formReadOnly || round.status === "closed" || !attachment?.id) return;
      const confirmed = await requestConfirm({
        title: "ลบหลักฐานแนบ",
        description: `หลักฐานของ ${label || "รายการนี้"} จะถูกลบจาก browser เครื่องนี้`,
        confirmLabel: "ยืนยันลบหลักฐาน",
      });
      if (!confirmed) return;
      try {
        if (!isRevisionRound || revisionAttachmentIdsRef.current.has(attachment.id)) {
          await deleteStoredAttachment(attachment.id);
          revisionAttachmentIdsRef.current.delete(attachment.id);
        }
        const currentItem = visibleRound.inspectionItems[itemId] || {};
        const patch = slotId
          ? { evidence: { ...(currentItem.evidence || {}), [slotId]: { ...(currentItem.evidence?.[slotId] || {}), attachment: null, status: "pending" } } }
          : { attachment: null };
        updateItem(itemId, patch);
        notify("ลบหลักฐานแนบแล้ว");
      } catch (error) {
        notify(error?.message || "ลบภาพไม่สำเร็จ");
      }
    };
    const resetRound = async () => { const confirmed = await requestConfirm({ title: "ล้างค่าตรวจของรอบการตรวจนี้", description: "ค่าตัวเลข สถานะ หมายเหตุ ไฟล์แนบหลักฐาน และผลค้นหาป้ายทะเบียนทั้งหมดจะถูกล้างออกจากรอบนี้ ไฟล์ของรอบต้นฉบับจะยังคงอยู่", confirmLabel: "ยืนยันล้างค่า" }); if (!confirmed) return; const inheritedIds = new Set(isRevisionRound ? attachmentIdsForRound(roundFor(state, round.basedOnRoundId)) : []); const attachmentIds = attachmentIdsForRound(round).filter((id) => !inheritedIds.has(id)); try { await deleteStoredAttachments(attachmentIds); revisionAttachmentIdsRef.current.clear(); } catch { notify("ล้างค่าแล้ว แต่มีบางไฟล์แนบที่ลบจากพื้นที่จัดเก็บไม่สำเร็จ"); } update((current) => ({ ...current, inspectionRounds: current.inspectionRounds.map((entry) => entry.id === round.id ? { ...entry, updatedAt: new Date().toISOString(), inspectionItems: buildItemState(getItemsForSnapshot(entry.snapshot)), vehicleSearch: entry.snapshot?.vehicleReviewScopeVersion === VEHICLE_REVIEW_SCOPE_VERSION ? createVehicleReviewState({ dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate }) : normalizeVehicleSearchState(null, { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate, stationCode: entry.snapshot?.stationCode }, { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile }) } : entry) }), "ล้างค่าตรวจของรอบการตรวจนี้แล้ว"); };
    const closeRound = async () => {
      if (isDemoRound) {
        notify("Demo UI fixture ใช้สำหรับทดสอบหน้าจอเท่านั้น จึงไม่สามารถปิดรอบหรือสร้างประวัติจริงได้");
        return;
      }
      if (closeReadiness.blockers.length > 0 || closeReadiness.issues.length > 0) {
        setCloseReadinessDialog(true);
        return;
      }
      const confirmed = await requestConfirm({
        title: "ยืนยันปิดรอบการตรวจ",
        description: "ยังไม่พบรายการตรวจหรือหลักฐานที่ค้าง ระบบจะเก็บรอบนี้ไว้ในประวัติ",
        confirmLabel: "ยืนยันปิดรอบการตรวจ",
        confirmVariant: "primary",
        confirmIcon: "archive",
      });
      if (!confirmed) return;
      finalizeCloseRound();
    };
    const finalizeCloseRound = () => {
      setCloseReadinessDialog(false);
      update((current) => ({ ...current, inspectionRounds: current.inspectionRounds.map((entry) => entry.id === round.id ? { ...entry, status: "closed", closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : entry) }), "ปิดรอบการตรวจแล้ว");
        navigate(`#/history/${encodeURIComponent(round.id)}`);
    };
    const navigateToCloseBlocker = (blocker) => {
      setCloseReadinessDialog(false);
      if (blocker.type === "vehicle-search-review") {
        const vehicleItem = visibleItems.find((item) => item.id === blocker.itemId);
        const vehicleContext = getVehicleReviewContext(vehicleItem) || currentVehicleContext;
        const href = vehicleApiHref(visibleRound, vehicleContext?.key || "plate", { history: formReadOnly });
        const query = new URLSearchParams();
        if (blocker.rowId) query.set("rowId", blocker.rowId);
        if (blocker.reviewKind) query.set("reviewKind", blocker.reviewKind);
        if (blocker.scope) query.set("scope", blocker.scope);
        navigate(query.size ? `${href}?${query.toString()}` : href);
        return;
      }
      setSelectedSection(visibleSections.find((section) => section.items.some((item) => item.id === blocker.itemId))?.code || blocker.sectionCode);
      setCurrentItemId(blocker.itemId);
      setPendingFocusItemId(blocker.itemId);
      setWorkspacePanel(blocker.type === "evidence" || blocker.type === "evidence-photo" || blocker.type === "evidence-note" ? "evidence" : "result");
      setPendingFocusEvidence(blocker.type === "evidence" || blocker.type === "evidence-photo" || blocker.type === "evidence-note" ? (blocker.slotId ? { itemId: blocker.itemId, slotId: blocker.slotId } : null) : null);
    };
    const selectedReportCompany = REPORT_COMPANIES.find((company) => company.id === reportCompanyId) || null;
    const reportCoverReadiness = getReportCoverReadiness(visibleRound, reportCoverMeta);
    const canEditReportCover = readOnly && visibleRound?.status === "closed" && !isDemoRound;
    const canPrintDraftReport = !readOnly && visibleRound?.status !== "closed" && !isDemoRound;
    const stationReport = stationInspectionReportForRound(state, visibleRound.id);
    const saveReportCover = () => {
      if (!canEditReportCover || !visibleRound) return false;
      const normalized = normalizeReportCoverMeta(reportCoverMeta);
      update((current) => saveStationInspectionReportCover(current, visibleRound.id, normalized), "บันทึกข้อมูลหน้าปกแล้ว");
      return true;
    };
    const confirmReportCompany = async ({ draft = false } = {}) => {
      if (!selectedReportCompany) {
        notify("กรุณาเลือก Template บริษัทบนรายงานก่อนดูหรือพิมพ์รายงาน");
        return false;
      }
      if (draft) {
        if (!canPrintDraftReport) {
          notify("พิมพ์ฉบับร่างได้เฉพาะรอบที่กำลังตรวจ");
          return false;
        }
        return true;
      }
      if (!canEditReportCover) {
        notify("ปิดรอบการตรวจก่อนจึงจะจัดทำหน้าปกรายงานได้");
        return false;
      }
      if (!reportCoverReadiness.ready) {
        notify(`ข้อมูลหน้าปกยังไม่ครบ: ${reportCoverReadiness.missingLabels.join(" · ")}`);
        setReportMenuOpen(true);
        return false;
      }
      saveReportCover();
      return true;
    };
    const handlePrint = async (mode = "standard", { draft = false } = {}) => {
      if (!await confirmReportCompany({ draft })) return;
      if (reportPreviewMode !== mode) {
        setReportPreviewMode(mode);
        await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
      }
      const report = document.querySelector(".ops-print-report");
      const hasLoadingAttachments = () => report?.querySelector('[data-print-attachment="loading"]');
      if (hasLoadingAttachments()) {
        notify("กำลังเตรียมภาพสำหรับรายงาน...");
        const deadline = Date.now() + 5000;
        while (hasLoadingAttachments() && Date.now() < deadline) await new Promise((resolve) => window.setTimeout(resolve, 60));
      }
      if (hasLoadingAttachments()) {
        notify("ภาพหลักฐานบางไฟล์ยังโหลดไม่เสร็จ จึงยังไม่เริ่มพิมพ์");
        return;
      }
      const brandImages = [...(report?.querySelectorAll('img[data-company-asset]') || [])];
      const brandReady = await Promise.all(brandImages.map(image => Promise.race([
        image.decode().then(() => image.naturalWidth > 0).catch(() => false),
        new Promise(resolve => window.setTimeout(() => resolve(false), 5000)),
      ])));
      if (brandReady.some(ready => !ready)) { notify("ภาพหน้าปกยังไม่พร้อม กรุณาลองพิมพ์อีกครั้ง"); return; }
      await document.fonts.ready;
      if (!draft) {
        update((current) => appendStationInspectionReportRevision(current, visibleRound.id, {
          companyId: reportCompanyId,
          format: mode === "presentation" ? "presentation" : "standard",
          templateId: "checklist-report-a4-portrait-v1",
          templateSchemaVersion: "checklist-report-model-v2",
          coverMeta: normalizeReportCoverMeta(reportCoverMeta),
          generatedAt: new Date().toISOString(),
        }), "บันทึกฉบับรายงานแล้ว");
      }
      window.print();
    };
    const toggleReportPreview = async () => {
      if (!await confirmReportCompany({ draft: canPrintDraftReport })) return;
      const nextMode = reportPreviewMode === "standard" ? "none" : "standard";
      setReportPreviewMode(nextMode);
      if (nextMode !== "none") window.requestAnimationFrame(() => document.querySelector(".ops-print-report.is-report-preview")?.scrollIntoView({ behavior: "auto", block: "start", inline: "center" }));
    };
    const togglePresentationPreview = async () => {
      if (!await confirmReportCompany({ draft: canPrintDraftReport })) return;
      const nextMode = reportPreviewMode === "presentation" ? "none" : "presentation";
      setReportPreviewMode(nextMode);
      if (nextMode !== "none") window.requestAnimationFrame(() => document.querySelector(".ops-print-report.is-report-preview")?.scrollIntoView({ behavior: "auto", block: "start", inline: "center" }));
    };
    const closeReportPreview = () => {
      setReportPreviewMode("none");
      setReportMenuOpen(false);
    };
    const correction = getCorrectionSummary(round);
    const standardReportPreviewActive = reportPreviewMode === "standard";
    const presentationReportPreviewActive = reportPreviewMode === "presentation";
    const reportMenu = visibleRound.status === "closed" || canPrintDraftReport ? <details className="ops-report-menu" open={Boolean(reportMenuOpen || reportPreviewMode !== "none")} onToggle={(event) => setReportMenuOpen(event.currentTarget.open)}>
      <summary><Icon name="print" />{canPrintDraftReport ? "พิมพ์ฉบับร่าง" : "รายงาน"}</summary>
      <div className="ops-report-menu-panel">
        <div className="company-selector">
          <div className="company-selector-main">
            <label htmlFor="report-company">Template บริษัทบนรายงาน</label>
            <select id="report-company" value={reportCompanyId} onChange={event => setReportCompanyId(event.target.value)}><option value="">เลือกบริษัท</option>{REPORT_COMPANIES.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
            <small>ใช้กับหน้าปก A4 และ Presentation 16:9 · ไม่เปลี่ยนข้อมูล Snapshot หรือผลตรวจ</small>
          </div>
        </div>
        {canPrintDraftReport ? <div className="ops-info-banner"><Icon name="info" /><span>พิมพ์ข้อมูลระหว่างตรวจได้เลย เอกสารจะแสดงว่าเป็นฉบับร่าง ใช้ผลตรวจและหลักฐาน ณ ตอนนี้ และไม่ปิดรอบหรือบันทึกเป็นรายงานฉบับสมบูรณ์</span></div> : <section className={`report-cover-editor${reportCoverReadiness.ready ? " is-ready" : " has-missing"}`} aria-labelledby="report-cover-editor-title">
          <div className="report-cover-editor-heading"><div><strong id="report-cover-editor-title">ข้อมูลหน้าปกรายงานตรวจสถานี</strong><small>กรอกชื่อรายงาน โครงการ และเลขสัญญาที่ต้องการแสดงบนปก</small></div><span className="report-cover-readiness">{reportCoverReadiness.ready ? "พร้อมพิมพ์" : "ข้อมูลหน้าปกยังไม่ครบ"}</span></div>
          <div className="report-cover-form-grid">
            {Object.entries(REPORT_COVER_FIELD_LABELS).map(([field, label]) => {
              const required = REPORT_COVER_REQUIRED_FIELDS.includes(field) && !(reportCoverReadiness.isQuickField && field === "contractNo");
              const wide = field === "reportTitle";
              return <label key={field} className={`report-cover-field${wide ? " report-cover-field-wide" : ""}`}><span>{label}{required && <b> *</b>}</span><input data-report-cover-field={field} value={reportCoverMeta[field] || ""} disabled={!canEditReportCover} onChange={(event) => setReportCoverMeta((current) => ({ ...current, [field]: event.target.value }))} placeholder={field === "reportTitle" ? "เช่น รายงานผลการตรวจสอบสถานี" : ""} /></label>;
            })}
          </div>
          {canEditReportCover && <div className="report-cover-editor-actions"><span>{reportCoverReadiness.missingLabels.length ? "ต้องกรอก " + reportCoverReadiness.missingLabels.join(" · ") : "กรอกข้อมูลครบแล้ว · วันที่ตรวจ " + (visibleRound.meta?.inspectionDate ? formatDate(visibleRound.meta.inspectionDate) : "ยังไม่ระบุ")}</span><Button onClick={saveReportCover} variant="secondary" icon="save">บันทึกข้อมูลหน้าปก</Button></div>}
        </section>}
        {canPrintDraftReport ? <div className="ops-report-menu-actions"><Button onClick={toggleReportPreview} variant="secondary" icon="print" disabled={!selectedReportCompany}>{standardReportPreviewActive ? "ซ่อนตัวอย่างฉบับร่าง" : "ดูตัวอย่างฉบับร่าง"}</Button><Button onClick={togglePresentationPreview} variant="secondary" icon="display" disabled={!selectedReportCompany}>{presentationReportPreviewActive ? "ซ่อนรายงานพรีเซนต์" : "ดูพรีเซนต์ฉบับร่าง"}</Button><Button onClick={() => handlePrint("standard", { draft: true })} variant="primary" icon="print" disabled={!selectedReportCompany}>พิมพ์ฉบับร่าง</Button><Button onClick={() => handlePrint("presentation", { draft: true })} variant="secondary" icon="print" disabled={!selectedReportCompany}>พิมพ์พรีเซนต์ฉบับร่าง</Button></div> : <div className="ops-report-menu-actions">
          <Button onClick={toggleReportPreview} variant="secondary" icon="print" disabled={!selectedReportCompany || !reportCoverReadiness.ready}>{standardReportPreviewActive ? "ซ่อนตัวอย่างรายงาน" : "ดูตัวอย่างรายงาน"}</Button>
          <Button onClick={togglePresentationPreview} variant="secondary" icon="display" disabled={!selectedReportCompany || !reportCoverReadiness.ready}>{presentationReportPreviewActive ? "ซ่อนรายงานพรีเซนต์" : "ดูรายงานพรีเซนต์"}</Button>
          <Button onClick={() => handlePrint("standard")} variant="primary" icon="print" disabled={!selectedReportCompany || !reportCoverReadiness.ready}>พิมพ์รายงาน</Button>
          <Button onClick={() => handlePrint("presentation")} variant="secondary" icon="print" disabled={!selectedReportCompany || !reportCoverReadiness.ready}>พิมพ์รายงานพรีเซนต์</Button>
        </div>}
        {!canPrintDraftReport && <section className="station-report-revisions" aria-label="ประวัติฉบับรายงาน"><strong>ฉบับรายงานที่เคยสร้าง</strong>{stationReport?.revisions?.length ? <ol>{[...stationReport.revisions].sort((a, b) => b.version - a.version).map((revision) => <li key={revision.id}><span>ฉบับที่ {revision.version} · {REPORT_COMPANIES.find((company) => company.id === revision.companyId)?.name || revision.companyId || "ไม่ระบุแบบรายงาน"} · {revision.format === "presentation" ? "Presentation" : "A4"}</span><small>{revision.generatedAt ? formatDateTime(revision.generatedAt) : "ไม่ระบุเวลา"}</small></li>)}</ol> : <small>ยังไม่มีฉบับรายงานที่สร้างไว้</small>}</section>}
      </div>
    </details> : null;
    const roundActions = readOnly
      ? <div className="ops-page-actions"><Button href={`#/history/${encodeURIComponent(round.id)}/revise`} variant="secondary" icon="edit">จัดทำฉบับแก้ไข</Button>{reportMenu}</div>
      : <div className="ops-page-actions"><details className="ops-secondary-menu"><summary>เมนูรอบการตรวจนี้</summary><div><Button onClick={resetRound} variant="danger-ghost" icon="delete">ล้างค่ารอบการตรวจนี้</Button></div></details>{reportMenu}{!isDemoRound && <Button onClick={closeRound} variant="primary" icon="archive">ปิดรอบการตรวจ</Button>}</div>;
    return (
      <section data-checklist-context={currentChecklistContext.key} data-checklist-mode={readOnly ? "history" : "active"} className={`ops-page checklist-page field-command-rail ${readOnly ? "history-detail" : ""} ${reportPreviewMode !== "none" ? "is-report-previewing" : ""} ${currentIsVehicleReview ? "is-vehicle-review-entry" : ""}`.trim()}>
        <Breadcrumb items={[{ label: "รอบการตรวจ", href: "#/inspections" }, { label: visibleRound.snapshot?.stationCode || "รอบการตรวจ", mono: true }, { label: readOnly ? "ประวัติข้อมูล ณ วันที่เริ่มรอบการตรวจ" : "รายการตรวจและหลักฐาน" }]} />
        <header className="ops-checklist-context-header">
          <div className="ops-checklist-strip-title"><Icon name="clipboard" /><div className="ops-checklist-strip-title-copy"><h1 id="page-heading" tabIndex="-1">หมวดตรวจ</h1><small className="ops-checklist-mobile-context">{currentSection?.title || "ยังไม่เลือกหมวด"} · {visibleItems.length ? `${currentItemIndex + 1}/${visibleItems.length}` : "0"}</small></div></div>
          <span className="ops-checklist-strip-metric is-section"><small>หมวดตรวจ</small><strong>{currentSection?.title || "ยังไม่เลือกหมวด"}</strong></span>
          <span className="ops-checklist-strip-metric is-item"><small>รายการ</small><strong>{visibleItems.length ? `${currentItemIndex + 1} จาก ${visibleItems.length}` : "0"}</strong></span>
          <span className="ops-checklist-strip-metric is-status"><small>บันทึกสถานะ</small><strong>{summary.done}/{summary.total} รายการ</strong></span>
          <span className="ops-checklist-strip-metric is-evidence"><small>หลักฐานครบ</small><strong>{summary.evidenceComplete}/{summary.evidenceTotal} ช่อง</strong></span>
          <span className={`ops-save-state ${savedAt || readOnly || isDemoRound ? "is-current" : ""}`} role="status" aria-live="polite"><Icon name="save" />{saveStateLabel}</span>
        <div className="ops-checklist-round-actions" aria-label="คำสั่งรอบตรวจ">{roundActions}</div>
          <small className="ops-context-snapshot-meta sr-only">ข้อมูล ณ วันที่เริ่มรอบการตรวจ {visibleRound.snapshot?.equipment?.length || 0} อุปกรณ์</small>
        </header>
        {isDemoRound && <div className="ops-demo-banner" role="note"><Icon name="info" /><span><strong>DEMO UI FIXTURE</strong>ข้อมูลตัวอย่างสำหรับทดสอบ layout และ responsive · การแก้ไขจะอยู่เฉพาะหน้านี้และไม่เขียนทับข้อมูลรอบการตรวจ</span></div>}
         {formReadOnly && <div className="ops-readonly-banner"><Icon name="archive" /><span><strong>ผลตรวจของรอบนี้ปิดแล้วและอ่านอย่างเดียว</strong>{correction.count ? <> มีการแก้ไขย้อนหลังแบบเดิมแล้ว {correction.count} ครั้ง · ล่าสุด {formatDateTime(correction.latestAt)} · เหตุผล: {correction.latestReason}</> : " หน้าปกรายงานยังแก้และบันทึกได้จากเมนูรายงาน โดยไม่เปลี่ยนผลตรวจ"}</span></div>}
         {visibleRound.basedOnRoundId && <section className="ops-panel ops-revision-banner"><div><p className="ops-eyebrow">REVISION DRAFT</p><h3>ฉบับแก้ไขครั้งที่ {visibleRound.revisionNumber || 1}</h3><p>สร้างจากรอบเดิม {shortId(visibleRound.basedOnRoundId)} · เหตุผล: {visibleRound.revisionReason || "—"}</p></div><StatusBadge status="draft">ยังไม่ปิดรอบ</StatusBadge></section>}
        <section className="ops-checklist-layout ops-taskflow-layout" data-workspace-panel={workspacePanel}>
          <div className="ops-workspace-tabs" role="tablist" aria-label="พื้นที่ทำงานรอบการตรวจ">
            <button id="workspace-tab-queue" type="button" role="tab" aria-selected={workspacePanel === "queue"} aria-controls="workspace-panel-queue" tabIndex={workspacePanel === "queue" ? 0 : -1} onClick={() => setWorkspacePanel("queue")} onKeyDown={handleWorkspaceTabKeyDown}><Icon name="list" /><span>หมวด</span><strong>{Math.max(0, summary.total - summary.done)}</strong></button>
            <button id="workspace-tab-evidence" type="button" role="tab" aria-selected={workspacePanel === (currentIsVehicleReview ? "result" : "evidence")} aria-controls={currentIsVehicleReview ? "workspace-panel-result" : "workspace-panel-evidence"} tabIndex={workspacePanel === (currentIsVehicleReview ? "result" : "evidence") ? 0 : -1} onClick={() => setWorkspacePanel(currentIsVehicleReview ? "result" : "evidence")} onKeyDown={handleWorkspaceTabKeyDown}><Icon name={currentIsVehicleReview ? "search" : "camera"} /><span>{currentIsVehicleReview ? "ตรวจ API" : "หลักฐาน"}</span><strong>{currentIsVehicleReview ? (currentVehicleReview.summary.total ? `${currentVehicleReview.summary.completeRows}/${currentVehicleReview.summary.total}` : "API") : (currentEvidenceBypassed ? "ข้าม" : `${currentEvidenceComplete}/${currentEvidenceSlots.length}`)}</strong></button>
            <button id="workspace-tab-result" type="button" role="tab" aria-selected={workspacePanel === "result"} aria-controls="workspace-panel-result" tabIndex={workspacePanel === "result" ? 0 : -1} onClick={() => setWorkspacePanel("result")} onKeyDown={handleWorkspaceTabKeyDown}><Icon name="clipboard" /><span>ตรวจ</span><strong>{visibleItems.length ? `${currentItemIndex + 1}/${visibleItems.length}` : "0"}</strong></button>
          </div>
          <aside className="ops-panel ops-section-panel ops-task-queue-panel" id="workspace-panel-queue" role="tabpanel" aria-labelledby="workspace-tab-queue" tabIndex="0" hidden={isCompactWorkspace && workspacePanel !== "queue"} aria-hidden={isCompactWorkspace && workspacePanel !== "queue" ? "true" : undefined}>
             <div className="ops-panel-heading ops-task-queue-heading"><div><p className="ops-eyebrow">STATION CHECKLIST</p><h3>หมวดตรวจ</h3></div><div className="ops-task-queue-heading-summary"><div className="ops-task-queue-status-metric" aria-label={`บันทึกสถานะแล้ว ${summary.done} จาก ${summary.total} รายการ`}><span>บันทึกสถานะ</span><strong>{summary.done}/{summary.total}</strong><em>รายการ</em></div><div className="ops-task-queue-heading-progress" role="progressbar" aria-label="ความคืบหน้าการบันทึกสถานะในหมวดตรวจ" aria-valuemin="0" aria-valuemax="100" aria-valuenow={summary.progress}><span style={{ width: `${summary.progress}%` }} /></div><div className="ops-task-queue-legend" aria-label="คำอธิบายสถานะหมวดตรวจ"><span className="is-complete"><Icon name="check" size="small" />หลักฐานครบ</span><span className="is-pending"><Icon name="info" size="small" />รอตรวจ</span><span className="is-issue"><Icon name="alert" size="small" />มีประเด็น</span></div></div></div>
            <ChecklistTaskQueue sections={visibleSections} hierarchy="station-categories" selected={currentSection?.code || selectedSection} currentItemId={currentVisibleItem?.id} round={visibleRound} summary={summary} coverage={coverage} onSelect={(sectionCode, itemId) => { setSelectedSection(sectionCode); setCurrentItemId(itemId); setWorkspacePanel(currentIsVehicleReview ? "result" : "evidence"); setPendingFocusItemId(itemId); }} readOnly={formReadOnly} />
          </aside>
          <div className="ops-panel ops-items-panel ops-taskflow-main" id="workspace-panel-result" role="tabpanel" aria-labelledby="workspace-tab-result" tabIndex="0" hidden={isCompactWorkspace && workspacePanel !== "result"} aria-hidden={isCompactWorkspace && workspacePanel !== "result" ? "true" : undefined}>
            <div className="ops-panel-heading ops-taskflow-heading"><div><p className="ops-item-breadcrumb">{formReadOnly ? "ข้อมูล Snapshot · อ่านอย่างเดียว" : `รายการที่ ${currentItemIndex + 1} จาก ${visibleItems.length}`}</p><h3 id="checklist-current-item-heading" tabIndex="-1">{currentIsVehicleReview ? (currentVehicleContext?.key === "classification" ? "คัดแยกประเภทรถ" : "ตรวจป้ายทะเบียน") : "ข้อมูลรายการตรวจ"}</h3>{!currentIsVehicleReview && currentVisibleItem && <div className="ops-current-item-facts"><span><small>ขอบเขตการตรวจ</small><strong>{currentItemScope.label}</strong></span>{currentVisibleItem.relationshipPath && <span><small>ตำแหน่งในผังระบบ</small><strong>{currentVisibleItem.relationshipPath}</strong></span>}{currentVisibleItem.assetNo && <span><small>Asset No.</small><strong className="ops-code">{currentVisibleItem.assetNo}</strong></span>}<span><small>Serial No.</small><strong className="ops-code">{currentVisibleItem.serialNo || "ยังไม่ระบุ"}</strong></span><span><small>ตำแหน่ง</small><strong>{currentVisibleItem.location || "ยังไม่ระบุ"}</strong></span></div>}<div className="ops-work-context"><span className="ops-work-context-icon"><Icon name={currentChecklistContext.icon} size="small" /></span><div><strong>{currentChecklistContext.label}</strong><small>{formReadOnly ? `ข้อมูล Snapshot · ${currentChecklistContext.hint}` : currentChecklistContext.hint}</small></div></div></div></div>
            <div className="ops-check-section-list">{currentSection && currentVisibleItem ? currentIsVehicleReview ? <section className="ops-vehicle-review-entry" aria-labelledby="vehicle-review-entry-title"><div className="ops-vehicle-review-entry-icon"><Icon name="search" /></div><div className="ops-vehicle-review-entry-copy"><p className="ops-eyebrow">ตรวจรถแยกตามงาน</p><h4 id="vehicle-review-entry-title">{currentVehicleContext?.key === "classification" ? "คัดแยกประเภทรถ" : "ตรวจป้ายทะเบียน"}</h4><p>{currentVehicleContext?.key === "classification" ? "ดูภาพรถ ประเภทรถ จำนวนเพลา และน้ำหนักที่ API ส่งมา" : "เทียบเลขทะเบียนและจังหวัดกับภาพ พร้อมเวลา เลน และสถานี"}</p><div className="ops-vehicle-review-entry-summary"><span>รายการในคิว <strong>{currentVehicleReview.summary.total || 0}</strong></span><span>ตรวจแล้ว <strong>{currentVehicleReview.summary.completeRows || 0}</strong></span></div></div><Button href={vehicleApiHref(visibleRound, currentVehicleContext?.key, { history: formReadOnly })} variant="primary" icon="arrow">{formReadOnly ? "เปิดผลตรวจจาก Snapshot" : "เปิดหน้าตรวจ"}</Button></section> : <section className="ops-check-section" aria-labelledby={`check-section-${domSafeId(currentSection.code)}`}><h3 className="sr-only" id={`check-section-${domSafeId(currentSection.code)}`}>{currentSection.title}</h3><div className="ops-check-items"><ChecklistItem item={currentVisibleItem} value={visibleRound.inspectionItems[currentVisibleItem.id]} readOnly={formReadOnly} hideEvidence focusLayout apiReview={currentIsLegacyVehicleApiReview} vehicleSearch={visibleRound.vehicleSearch} vehicleReviewVersion={visibleRound.snapshot?.vehicleReviewVersion} onOpenApiReview={openVehicleApiReview} onChange={updateItem} onStatusChange={handleStatusChange} onAttachmentChange={handleAttachmentChange} onAttachmentRemove={handleAttachmentRemove} focusEvidenceId={pendingFocusEvidence?.itemId === currentVisibleItem.id ? pendingFocusEvidence.slotId : ""} onFocusEvidenceComplete={clearPendingFocusEvidence} /></div></section> : <EmptyState icon="search" title="ยังไม่มีรายการตรวจในรอบนี้">รอบนี้ไม่มีรายการตรวจที่เปิดใช้งาน</EmptyState>}</div>
             <ChecklistPager currentIndex={currentItemIndex} total={visibleItems.length} onPrevious={() => navigateItem(-1)} onNext={() => navigateItem(1)} />
          </div>
          {!currentIsVehicleReview && <ChecklistEvidenceDrawer hidden={isCompactWorkspace && workspacePanel !== "evidence"} panelId="workspace-panel-evidence" labelledBy="workspace-tab-evidence" item={currentVisibleItem} itemValue={currentVisibleItem ? visibleRound.inspectionItems[currentVisibleItem.id] : null} readOnly={formReadOnly} onChange={(patch) => currentVisibleItem && updateItem(currentVisibleItem.id, patch)} onAttachmentChange={handleAttachmentChange} onAttachmentRemove={handleAttachmentRemove} focusSlotId={pendingFocusEvidence?.itemId === currentVisibleItem?.id ? pendingFocusEvidence.slotId : ""} onFocusComplete={clearPendingFocusEvidence} round={visibleRound} vehicleSearch={visibleRound.vehicleSearch} onVehicleSearchChange={updateVehicleSearch} notify={notify} />}
        </section>
        {reportPreviewMode !== "none" && <div className="ops-report-preview-toolbar" role="status" aria-live="polite">
          <div><span className="ops-eyebrow">REPORT PREVIEW</span><strong>{presentationReportPreviewActive ? "ตัวอย่างรายงานพรีเซนต์" : "ตัวอย่างรายงาน"}</strong></div>
          <Button onClick={closeReportPreview} variant="secondary" icon="arrow">กลับหน้าตรวจ</Button>
        </div>}
        <PrintableReport round={visibleRound} state={state} preview={reportPreviewMode !== "none"} mode={presentationReportPreviewActive ? "presentation" : "standard"} companyId={reportCompanyId} reportCoverMeta={reportCoverMeta} draft={canPrintDraftReport} />
        {closeReadinessDialog && <CloseReadinessDialog blockers={closeReadiness.blockers} issues={closeReadiness.issues} sections={visibleSections} allowConfirm={closeReadiness.canConfirmClose} onNavigate={navigateToCloseBlocker} onClose={() => setCloseReadinessDialog(false)} onConfirm={finalizeCloseRound} />}
      </section>
    );
  }
}
