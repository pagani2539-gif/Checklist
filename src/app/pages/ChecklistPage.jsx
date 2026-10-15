import "../../styles/vehicle-review-entry.css";
import AcDcLegacyArchive from "../AcDcLegacyArchive.jsx";
import { getPendingChecklistItems } from "../../domain/master-checklist.js";
import { annotationAttachmentIds, renderAnnotatedImage } from '../../domain/image-annotation.js';
import { attachmentIdsForState } from '../../domain/storage.js';
import SaveStatus from "../SaveStatus.jsx";
import CustomSelect from "../CustomSelect.jsx";
import { isSystemVehicleRound, setSystemVehicleSearch, normalizeSystemVehicleSearch } from "../../domain/vehicle-review-systems.js";
import { getChecklistQueueItemLabel } from "../checklist-queue-state.js";
import { canUseNotInstalled } from "../../domain/checklist-completion.js";
import { archiveVehicleEvidence, vehicleEvidenceTasksForReport } from "../../domain/vehicle-evidence-images.js";
import { createUiVehicleSystemsDemoRound } from "../../domain/demo-fixture.js";
import { useCentralEnglishNames } from "../../domain/equipment-names.js";
import { preparePrintableImageCopies } from "../reports/print-image-optimizer.js";
export function getChecklistPrintTitle(round, coverMeta) {
  const clean = (value) => String(value ?? "").trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "");
  return [clean(coverMeta?.reportTitle), clean(round?.snapshot?.stationName || round?.snapshot?.stationCode), coverMeta?.contractNo?.trim() ? `สัญญา${clean(coverMeta.contractNo)}` : ""].filter(Boolean).join("_") || "รายงานตรวจบำรุงรักษา";
}
export function createChecklistPage(runtime) {
  const { Breadcrumb, Button, CHECKLIST_PROGRESS_POLICY_VERSION, ChecklistEvidenceDrawer, ChecklistItem, ChecklistPager, ChecklistTaskQueue, CloseReadinessDialog, EmptyState, Icon, MAX_ATTACHMENT_BYTES, PageHeader, PrintableReport, REPORT_COMPANIES, REPORT_COVER_FIELD_LABELS, REPORT_COVER_REQUIRED_FIELDS, StatusBadge, UI_DEMO_ROUND_ID, UI_VEHICLE_DEMO_ROUND_ID, VEHICLE_API_REVIEW_VERSION, VEHICLE_REVIEW_SCOPE_VERSION, appendStationInspectionReportRevision, attachmentIdsForRound, buildInspectionSections, buildItemState, createId, createUiDemoRound, createUiVehicleDemoRound, deleteStoredAttachment, deleteStoredAttachments, domSafeId, formatDate, formatDateTime, getChecklistCoverageSummary, getChecklistPageNavigationItems, getChecklistScopeMeta, getChecklistWorkContext, getCloseReadiness, getCorrectionSummary, getItemsForSnapshot, getReportCoverMeta, getReportCoverReadiness, getRoundSummary, getSectionEvidenceStats, getStoredAttachment, getVehicleReviewContext, getVehicleReviewState, inferReportCompanyId, isEvidenceBypassItemStatus, isEvidenceSlotComplete, isVehicleApiReviewItem, isVehicleReviewScopeState, navigate, normalizeReportCoverMeta, normalizeVehicleReviewState, normalizeVehicleSearchState, roundFor, saveStationInspectionReportCover, saveStoredAttachment, shortId, stationInspectionReportForRound, useCallback, useEffect, useMemo, useRef, useState, vehicleApiHref } = runtime;
  return function ChecklistPage({ state, update: persistUpdate, notify, requestConfirm, route, readOnly = false, savedAt = null, serverSaveState = "idle", navigationControls = null, accountControls = null, serverWritable = true }) {
    const storedRound = roundFor(state, route.id);
    const isDemoRoute = !storedRound && route.name === "checklist" && [UI_DEMO_ROUND_ID, UI_VEHICLE_DEMO_ROUND_ID].includes(route.id);
    const [demoRound, setDemoRound] = useState(() => {
      if (!isDemoRoute) return null;
      if (route.query?.demoSystems === '1') return createUiVehicleSystemsDemoRound(route.query.demoFormat || 'SC');
      return route.id === UI_VEHICLE_DEMO_ROUND_ID ? createUiVehicleDemoRound() : createUiDemoRound();
    });
    const demoForRoute = demoRound?.id === route.id ? demoRound : null;
    const round = storedRound || demoForRoute;
    useEffect(() => {
      setDemoRound(isDemoRoute ? (route.query?.demoSystems === '1' ? createUiVehicleSystemsDemoRound(route.query.demoFormat || 'SC') : route.id === UI_VEHICLE_DEMO_ROUND_ID ? createUiVehicleDemoRound() : createUiDemoRound()) : null);
    }, [route.id, isDemoRoute, route.query?.demoSystems, route.query?.demoFormat]);
    const finalizingRef = useRef(false);
    const latestRoundRef = useRef(round);
    latestRoundRef.current = round;
    const isDemoRound = Boolean(isDemoRoute && demoRound);
    const update = useCallback((recipe, message = "") => {
      if (!isDemoRound) {
        return persistUpdate(recipe, message);
      }
      setDemoRound((current) => {
        if (!current) return current;
        const demoState = { inspectionRounds: [current], activeRoundId: current.id, activeStationId: current.stationId };
        const nextState = typeof recipe === "function" ? recipe(demoState) : recipe;
        return nextState?.inspectionRounds?.find((entry) => entry.id === current.id) || current;
      });
      if (message) notify(message);
      return Promise.resolve({ demo: true });
    }, [isDemoRound, notify, persistUpdate]);
    const revisionAttachmentIdsRef = useRef(new Set());
    const visibleRound = round;
    const formReadOnly = readOnly || round?.status === "closed";
    const isRevisionRound = Boolean(round?.basedOnRoundId);
    const saveStateLabel = readOnly ? "อ่านอย่างเดียว" : isDemoRound ? "ตัวอย่าง · ไม่บันทึกรอบจริง" : serverSaveState === "pending" ? "รอส่งข้อมูลส่วนกลาง" : serverSaveState === "saving" ? "กำลังบันทึกส่วนกลาง" : serverSaveState === "failed" ? "บันทึกส่วนกลางไม่สำเร็จ" : savedAt ? "บันทึกแล้ว" : "พร้อมบันทึกอัตโนมัติ";
    const sections = useMemo(() => visibleRound ? buildInspectionSections(visibleRound.snapshot, visibleRound.templateVersion || visibleRound.snapshot?.templateVersion) : [], [visibleRound?.snapshot, visibleRound?.templateVersion]);
    const summary = useMemo(() => visibleRound ? getRoundSummary(visibleRound) : null, [visibleRound]);
    const closeReadiness = useMemo(() => visibleRound ? getCloseReadiness(visibleRound) : null, [visibleRound]);
    const allItems = useMemo(() => visibleRound ? getItemsForSnapshot(visibleRound.snapshot, visibleRound.templateVersion || visibleRound.snapshot?.templateVersion) : [], [visibleRound?.snapshot, visibleRound?.templateVersion]);
    const coverage = useMemo(() => visibleRound ? getChecklistCoverageSummary(visibleRound.snapshot, allItems) : null, [visibleRound?.snapshot, allItems]);
    const [selectedSection, setSelectedSection] = useState(() => route.id === UI_VEHICLE_DEMO_ROUND_ID ? "5.1" : "");
    const [currentItemId, setCurrentItemId] = useState(() => route.id === UI_VEHICLE_DEMO_ROUND_ID ? "5.1.plate-document" : "");
    const [pendingFocusItemId, setPendingFocusItemId] = useState("");
    const [pendingFocusEvidence, setPendingFocusEvidence] = useState(null);
    const [workspacePanel, setWorkspacePanel] = useState("result");
    const [isStackedWorkspace, setIsStackedWorkspace] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 1279px)").matches === true);
    useEffect(() => {
      const media = window.matchMedia?.("(max-width: 1279px)");
      if (!media) return;
      const sync = () => setIsStackedWorkspace(media.matches);
      sync();
      media.addEventListener?.("change", sync);
      return () => media.removeEventListener?.("change", sync);
    }, []);
    const [isCompactVehicleWorkspace, setIsCompactVehicleWorkspace] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 1279px)").matches === true);
    const [isCompactChecklistWorkspace, setIsCompactChecklistWorkspace] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 1279px)").matches === true);
    const [reportPreviewMode, setReportPreviewMode] = useState("none");
    const [reportCompanyId, setReportCompanyId] = useState("");
    const [reportCoverMeta, setReportCoverMeta] = useState(() => getReportCoverMeta(visibleRound, { state }));
    const [reportMenuOpen, setReportMenuOpen] = useState(false);
    const [printPreparation, setPrintPreparation] = useState(null);
    const printPreparationRef = useRef(false);
    const printAbortControllerRef = useRef(null);
    const pendingPrintRef = useRef(null);
    const printDialogRef = useRef(null);
    const pendingResultsDialogRef = useRef(null);
    const openPrintButtonRef = useRef(null);
    const printDialogReturnFocusRef = useRef(null);
    useEffect(() => {
      if (printPreparation) {
        printDialogRef.current?.focus();
        return;
      }
      if (printDialogReturnFocusRef.current instanceof HTMLElement) printDialogReturnFocusRef.current.focus();
      printDialogReturnFocusRef.current = null;
    }, [Boolean(printPreparation)]);
    useEffect(() => {
      if (printPreparation?.stage === "ready") openPrintButtonRef.current?.focus();
    }, [printPreparation?.stage]);
    useEffect(() => {
      const media = window.matchMedia?.("(max-width: 1279px)");
      if (!media) return undefined;
      const sync = () => setIsCompactVehicleWorkspace(media.matches);
      sync();
      media.addEventListener?.("change", sync);
      return () => media.removeEventListener?.("change", sync);
    }, []);
    useEffect(() => {
      const media = window.matchMedia?.("(max-width: 1279px)");
      if (!media) return undefined;
      const sync = () => setIsCompactChecklistWorkspace(media.matches);
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
         if (isStackedWorkspace) heading.scrollIntoView({ block: "start", behavior });
         else document.querySelector("#workspace-panel-result")?.scrollTo({ top: 0, behavior });
        setPendingFocusItemId("");
      });
      return () => window.cancelAnimationFrame(frame);
    }, [pendingFocusItemId, selectedSection, isStackedWorkspace]);
    if (!round) return <section className="ops-page"><PageHeader eyebrow="NOT FOUND" title="ไม่พบรอบการตรวจ" description="ลิงก์นี้อาจถูกลบหรือข้อมูลยังไม่ได้ปรับรูปแบบ" actions={<Button href="#/inspections" variant="primary" icon="arrow">กลับหน้ารอบการตรวจ</Button>} /><section className="ops-panel"><EmptyState icon="alert" title="ไม่สามารถเปิดรอบการตรวจนี้ได้">เลือกอีกรอบจากหน้ารอบการตรวจทั้งหมด</EmptyState></section></section>;
    const nextRoundHref = `#/inspections/new?stationId=${encodeURIComponent(round.stationId)}`;
    if (readOnly && route.query?.edit === "1") return <section className="ops-page"><PageHeader eyebrow="LEGACY LINK" title="กำลังเปิดขั้นตอนจัดทำฉบับแก้ไข" description="ลิงก์แก้ไขย้อนหลังแบบเดิมไม่เขียนทับประวัติ ระบบกำลังพาไปยังขั้นตอนจัดทำฉบับแก้ไข" actions={<Button href={`#/history/${encodeURIComponent(round.id)}/revise`} variant="primary" icon="edit">ไปจัดทำฉบับแก้ไข</Button>} /><section className="ops-panel"><EmptyState icon="refresh" title="เปลี่ยนเส้นทางแล้ว">หากหน้านี้ไม่เปลี่ยนอัตโนมัติ ให้กดปุ่มด้านบน</EmptyState></section></section>;
    if (!readOnly && round.status === "closed") return <section className="ops-page"><Breadcrumb items={[{ label: "รอบการตรวจ", href: "#/inspections" }, { label: "รอบการตรวจที่ปิดแล้ว" }]} /><PageHeader eyebrow="ROUND CLOSED" title="รอบการตรวจนี้ปิดแล้ว" description="ข้อมูลถูกล็อกเพื่อรักษาประวัติข้อมูล ณ วันที่เริ่มรอบการตรวจเดิม" actions={<div className="ops-page-actions"><Button href={`#/history/${encodeURIComponent(round.id)}`} variant="primary" icon="archive">เปิดประวัติ</Button><Button href={nextRoundHref} icon="plus">เริ่มตรวจสถานีนี้อีกครั้ง</Button></div>} /><section className="ops-panel"><EmptyState icon="archive" title="รอบนี้อ่านอย่างเดียว">เพื่อเริ่มตรวจซ้ำ ให้เลือกสถานีและวันที่ตรวจ แล้วผูกสัญญาภายหลังได้</EmptyState></section></section>;
    if (readOnly && round.status !== "closed") return <section className="ops-page"><Breadcrumb items={[{ label: "ประวัติ / พิมพ์รายงาน", href: "#/history" }, { label: "ลิงก์ไม่ถูกต้อง" }]} /><PageHeader eyebrow="NOT A CLOSED ROUND" title="รอบนี้ยังไม่ปิด" description="เปิดรอบฉบับร่างจากเมนูรอบการตรวจเพื่อกรอกต่อ" actions={<Button href={`#/inspections/${encodeURIComponent(round.id)}`} variant="primary" icon="list">เปิดรอบการตรวจ</Button>} /><section className="ops-panel"><EmptyState icon="info" title="ยังไม่ใช่ประวัติ">ประวัติจะแสดงเฉพาะรอบการตรวจที่ปิดแล้วเท่านั้น</EmptyState></section></section>;
    const selectedSectionData = visibleSections.find((section) => section.code === selectedSection) || null;
    const visibleItems = useMemo(() => getChecklistPageNavigationItems(visibleSections, visibleRound.snapshot?.stationFormat, visibleRound.snapshot), [visibleSections, visibleRound.snapshot]);
    const pendingItems = useMemo(() => getPendingChecklistItems(visibleRound), [visibleRound]);
    useEffect(() => {
      const target = visibleItems.find((item) => item.id === route.query?.itemId);
      if (!target) return;
      setCurrentItemId(target.id);
      setSelectedSection(visibleSections.find((section) => section.items.some((item) => item.id === target.id))?.code || target.sectionCode);
      setWorkspacePanel("result");
      setPendingFocusItemId(target.id);
    }, [route.id, route.query?.itemId, visibleItems]);
    const openPendingItem = (itemId) => {
      pendingResultsDialogRef.current?.close();
      setCurrentItemId(itemId);
      setSelectedSection(visibleSections.find((section) => section.items.some((item) => item.id === itemId))?.code || "");
      setWorkspacePanel("result");
      setPendingFocusEvidence(null);
      setPendingFocusItemId(itemId);
    };
    const currentVisibleItem = visibleItems.find((item) => item.id === currentItemId) || visibleItems[0];
    const currentItemScope = getChecklistScopeMeta(currentVisibleItem);
    const currentSection = visibleSections.find((section) => section.items.some((item) => item.id === currentVisibleItem?.id)) || selectedSectionData || visibleSections[0] || sections[0];
    const currentSectionSource = currentSection || { items: [] };
    const currentSectionEvidence = getSectionEvidenceStats(currentSectionSource, visibleRound);
    const currentItemIndex = Math.max(0, visibleItems.findIndex(item => item.id === currentVisibleItem?.id));
    const currentItemValue = currentVisibleItem ? (visibleRound.inspectionItems[currentVisibleItem.id] || {}) : {};
    const currentIsVehicleApiReview = visibleRound.snapshot?.vehicleReviewVersion === VEHICLE_API_REVIEW_VERSION
      && isVehicleApiReviewItem(currentVisibleItem, visibleRound.snapshot);
    const currentIsLegacyVehicleApiReview = !currentIsVehicleApiReview && isVehicleApiReviewItem(currentVisibleItem, visibleRound.snapshot);
    const currentIsVehicleReview = currentIsVehicleApiReview || currentIsLegacyVehicleApiReview;
    const isCompactWorkspace = !isStackedWorkspace && (currentIsVehicleReview ? isCompactVehicleWorkspace : isCompactChecklistWorkspace);
    const currentVehicleContext = (currentIsVehicleApiReview || currentIsLegacyVehicleApiReview) ? getVehicleReviewContext(currentVisibleItem) : null;
    const currentVehicleReview = useMemo(() => currentIsVehicleReview ? getVehicleReviewState(visibleRound.vehicleSearch, { reviewVersion: visibleRound.snapshot?.vehicleReviewVersion, context: currentVehicleContext?.key, systemKey: currentVisibleItem?.vehicleReviewSystemKey }) : null, [currentIsVehicleReview, visibleRound.vehicleSearch, visibleRound.snapshot?.vehicleReviewVersion, currentVehicleContext?.key, currentVisibleItem?.vehicleReviewSystemKey]);
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
      const currentIndex = visibleItems.findIndex(item => item.id === currentVisibleItem?.id);
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
      if (nextStatus === "not-installed" && !canUseNotInstalled(item)) { notify("รายการนี้ไม่ใช่อุปกรณ์ติดตั้ง กรุณาเลือกผลตรวจที่ตรงกับงาน"); return; }
      if (nextStatus === "normal") {
        const missingEvidence = firstIncompleteRequiredEvidence(item, itemValue);
        updateItem(item.id, { status: nextStatus });
        if (missingEvidence) {
          setWorkspacePanel("evidence");
          setPendingFocusEvidence({ itemId: item.id, slotId: missingEvidence.id });
          notify("เลือกสถานะแล้ว · กรุณาตรวจหลักฐานที่จำเป็น และตรวจสถานะการบันทึก");
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
      return update((current) => ({ ...current, activeRoundId: round.id, activeStationId: round.stationId, inspectionRounds: current.inspectionRounds.map((entry) => entry.id === round.id ? { ...entry, updatedAt: new Date().toISOString(), inspectionItems: { ...entry.inspectionItems, [itemId]: { ...(entry.inspectionItems[itemId] || {}), ...patch } } } : entry) }));
    };
    const updateVehicleSearch = useCallback((nextVehicleSearch) => {
      if (formReadOnly || round.status === "closed") return;
      return update((current) => ({ ...current, activeRoundId: round.id, activeStationId: round.stationId, inspectionRounds: current.inspectionRounds.map((entry) => {
        if (entry.id !== round.id) return entry;
        if (isSystemVehicleRound(entry)) return { ...setSystemVehicleSearch(entry, currentVisibleItem?.vehicleReviewSystemKey, currentVehicleContext?.key, nextVehicleSearch), updatedAt: new Date().toISOString() };
        const fallbackCriteria = { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate, stationCode: entry.snapshot?.stationCode };
        const options = { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile };
        const vehicleSearch = isVehicleReviewScopeState(nextVehicleSearch)
          ? normalizeVehicleReviewState(nextVehicleSearch, fallbackCriteria, options)
          : normalizeVehicleSearchState(nextVehicleSearch, fallbackCriteria, options);
        return { ...entry, updatedAt: new Date().toISOString(), vehicleSearch };
      }) }));
    }, [formReadOnly, round.id, round.stationId, round.status, update]);
    const openVehicleApiReview = () => {
      if (!currentVehicleContext) return;
      navigate(vehicleApiHref(visibleRound, currentVehicleContext.key, { history: formReadOnly, systemKey: currentVisibleItem?.vehicleReviewSystemKey }));
    };
    const removeUnreferencedFiles = async (ids, nextAttachment, itemId, slotId) => {
      const item = round.inspectionItems[itemId] || {};
      const nextItem = slotId ? { ...item, evidence: { ...item.evidence, [slotId]: { ...item.evidence?.[slotId], attachment: nextAttachment } } } : { ...item, attachment: nextAttachment };
      const nextRound = { ...round, inspectionItems: { ...round.inspectionItems, [itemId]: nextItem } };
      const rounds = (state.inspectionRounds || []).map(r => r.id === round.id ? nextRound : r);
      const aliases = records => (records || []).map(record => record.id === round.id || record.roundId === round.id || (round.snapshot?.id && record.snapshot?.id === round.snapshot.id && record.status !== 'closed') ? { ...record, inspectionItems: nextRound.inspectionItems, items: nextRound.inspectionItems } : record);
      const retained = new Set(attachmentIdsForState({ ...state, inspectionRounds: rounds, inspectionHistory: aliases(state.inspectionHistory), inspectionWorkspaces: aliases(state.inspectionWorkspaces), items: state.activeRoundId === round.id ? nextRound.inspectionItems : state.items }));
      await deleteStoredAttachments(ids.filter(id => !retained.has(id))).catch(() => notify('บันทึกแล้ว แต่ลบไฟล์สำเนาที่เลิกใช้ไม่สำเร็จ'));
    };
    const handleAttachmentAnnotation = async (itemId, slotId, marks) => {
      if (formReadOnly || round.status === 'closed' || !serverWritable) throw new Error('รอบนี้ไม่สามารถแก้ไขได้');
      const item = round.inspectionItems[itemId] || {};
      const original = slotId ? item.evidence?.[slotId]?.attachment : item.attachment;
      if (!original?.type?.startsWith('image/')) throw new Error('ไม่พบภาพต้นฉบับ');
      let renderedId = null;
      try {
        const blob = await getStoredAttachment(original.id);
        if (!blob) throw new Error('ไม่พบภาพต้นฉบับ');
        const rendered = await renderAnnotatedImage(blob, marks);
        let imageAnnotation;
        if (marks.length) {
          renderedId = createId('attachment');
          await saveStoredAttachment(renderedId, rendered.blob, { stationId: round.stationId, roundId: round.id, kind: 'inspection/annotated' });
          imageAnnotation = { version: 1, originalWidth: rendered.width, originalHeight: rendered.height, marks, renderedAttachment: { id: renderedId, type: rendered.blob.type, name: rendered.blob.type === 'image/webp' ? 'หลักฐานมีเครื่องหมาย.webp' : 'หลักฐานมีเครื่องหมาย.png', size: rendered.blob.size, addedAt: new Date().toISOString() } };
        }
        const metadata = { ...original }; delete metadata.imageAnnotation;
        if (imageAnnotation) metadata.imageAnnotation = imageAnnotation;
        let applied = false;
        const result = await update(current => ({ ...current, inspectionRounds: current.inspectionRounds.map(entry => {
          if (entry.id !== round.id || entry.status === 'closed') return entry;
          const currentItem = entry.inspectionItems[itemId] || {};
          const attachment = slotId ? currentItem.evidence?.[slotId]?.attachment : currentItem.attachment;
          if (attachment?.id !== original.id || JSON.stringify(attachment.imageAnnotation) !== JSON.stringify(original.imageAnnotation)) return entry;
          applied = true;
          const nextItem = slotId ? { ...currentItem, evidence: { ...currentItem.evidence, [slotId]: { ...currentItem.evidence[slotId], attachment: metadata } } } : { ...currentItem, attachment: metadata };
          return { ...entry, updatedAt: new Date().toISOString(), inspectionItems: { ...entry.inspectionItems, [itemId]: nextItem } };
        }) }));
        if (!result || !applied) throw new Error('บันทึกเครื่องหมายไม่สำเร็จ กรุณาเปิดข้อมูลล่าสุดแล้วลองใหม่');
        if (renderedId) revisionAttachmentIdsRef.current.add(renderedId);
        await removeUnreferencedFiles(annotationAttachmentIds(original).filter(id => id !== original.id), metadata, itemId, slotId);
        notify('บันทึกเครื่องหมายแล้ว');
      } catch (error) {
        // Keep uploaded files on uncertain central-save failures: a committed state may reference them.
        throw error;
      }
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
        await saveStoredAttachment(attachmentId, file, { stationId: round.stationId, roundId: round.id, kind: 'inspection/originals' });
        const currentItem = visibleRound.inspectionItems[itemId] || {};
        const previousAttachment = slotId ? currentItem.evidence?.[slotId]?.attachment : currentItem.attachment;
        const patch = slotId
          ? { evidence: { ...(currentItem.evidence || {}), [slotId]: { ...(currentItem.evidence?.[slotId] || {}), attachment: metadata, status: "complete" } } }
          : { attachment: metadata };
        const result = await updateItem(itemId, patch);
        if (!result) throw new Error('บันทึกข้อมูลหลักฐานไม่สำเร็จ');
        revisionAttachmentIdsRef.current.add(attachmentId);
        await removeUnreferencedFiles(annotationAttachmentIds(previousAttachment), metadata, itemId, slotId);
        notify(fieldType === "video" ? "แนบวิดีโอแล้ว" : "แนบหลักฐานแล้ว");
      } catch (error) {
        // Preserve uploaded files if central persistence has an uncertain outcome.
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
        description: `หลักฐานของ ${label || "รายการนี้"} จะถูกนำออกจากรอบนี้ โดยไฟล์ที่ประวัติยังใช้อยู่จะคงไว้`,
        confirmLabel: "ยืนยันลบหลักฐาน",
      });
      if (!confirmed) return;
      try {
        const currentItem = visibleRound.inspectionItems[itemId] || {};
        const patch = slotId
          ? { evidence: { ...(currentItem.evidence || {}), [slotId]: { ...(currentItem.evidence?.[slotId] || {}), attachment: null, status: "pending" } } }
          : { attachment: null };
        const result = await updateItem(itemId, patch);
        if (!result) throw new Error("บันทึกการลบหลักฐานไม่สำเร็จ");
        await removeUnreferencedFiles(annotationAttachmentIds(attachment), null, itemId, slotId);
        notify("ลบหลักฐานแนบแล้ว");
      } catch (error) {
        notify(error?.message || "ลบภาพไม่สำเร็จ");
      }
    };
    const resetRound = async () => { const confirmed = await requestConfirm({ title: "ล้างค่าตรวจของรอบการตรวจนี้", description: "ค่าตัวเลข สถานะ หมายเหตุ ไฟล์แนบหลักฐาน และผลค้นหาป้ายทะเบียนทั้งหมดจะถูกล้างออกจากรอบนี้ ไฟล์ของรอบต้นฉบับจะยังคงอยู่", confirmLabel: "ยืนยันล้างค่า" }); if (!confirmed) return; const inheritedIds = new Set(isRevisionRound ? attachmentIdsForRound(roundFor(state, round.basedOnRoundId)) : []); const attachmentIds = attachmentIdsForRound(round).filter((id) => !inheritedIds.has(id)); try { await deleteStoredAttachments(attachmentIds); revisionAttachmentIdsRef.current.clear(); } catch { notify("ล้างค่าแล้ว แต่มีบางไฟล์แนบที่ลบจากพื้นที่จัดเก็บไม่สำเร็จ"); } update((current) => ({ ...current, inspectionRounds: current.inspectionRounds.map((entry) => entry.id === round.id ? { ...entry, updatedAt: new Date().toISOString(), inspectionItems: buildItemState(getItemsForSnapshot(entry.snapshot)), vehicleSearch: isSystemVehicleRound(entry) ? normalizeSystemVehicleSearch(null, entry.snapshot, { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate }) : entry.snapshot?.vehicleReviewScopeVersion === VEHICLE_REVIEW_SCOPE_VERSION ? createVehicleReviewState({ dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate }) : normalizeVehicleSearchState(null, { dateFrom: entry.meta?.inspectionDate, dateTo: entry.meta?.inspectionDate, stationCode: entry.snapshot?.stationCode }, { baseUrl: entry.snapshot?.vehicleSearchConfig?.baseUrl, apiProfile: entry.snapshot?.vehicleSearchConfig?.apiProfile }) } : entry) }), "ล้างค่าตรวจของรอบการตรวจนี้แล้ว"); };
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
      await finalizeCloseRound();
    };
    const finalizeCloseRound = async () => {
      if (finalizingRef.current) return;
      finalizingRef.current = true;
      let vehicleEvidenceArchive;
      let partialArchive = round.vehicleEvidenceArchive || {};
      try {
        const reportTasks = vehicleEvidenceTasksForReport(round);
        vehicleEvidenceArchive = round.vehicleEvidenceArchive || {};
        if (reportTasks.length) {
          notify("กำลังเก็บภาพที่รายงานและ Snapshot ใช้ก่อนปิดรอบ...");
          vehicleEvidenceArchive = await archiveVehicleEvidence(round, { tasks: reportTasks, save: saveStoredAttachment, loadStored: getStoredAttachment, createId, onProgress: (done, total, archive) => {
            partialArchive = { ...archive };
            if (done % 10 === 0 || done === total) notify(`เก็บภาพที่รายงานใช้ ${done}/${total} ภาพ`);
          } });
        }
      } catch (error) {
        update(current => ({ ...current, inspectionRounds: current.inspectionRounds.map(entry => entry.id === round.id ? { ...entry, vehicleEvidenceArchive: partialArchive } : entry) }));
        finalizingRef.current = false;
        notify(`ยังปิดรอบไม่ได้ เพราะเก็บสำเนาภาพ API ไม่สำเร็จ: ${error?.message || "โปรดลองอีกครั้ง"}`);
        return;
      }
      if (JSON.stringify(latestRoundRef.current?.vehicleSearch) !== JSON.stringify(round.vehicleSearch)) { finalizingRef.current = false; notify("ข้อมูลรถเปลี่ยนระหว่างเก็บภาพ กรุณาตรวจความพร้อมแล้วปิดรอบอีกครั้ง"); return; }
      setCloseReadinessDialog(false);
      const outcome = await update((current) => ({ ...current, inspectionRounds: current.inspectionRounds.map((entry) => entry.id === round.id ? { ...entry, vehicleEvidenceArchive, status: "closed", progressPolicyVersion: CHECKLIST_PROGRESS_POLICY_VERSION, closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : entry) }), "ปิดรอบการตรวจแล้ว");
      finalizingRef.current = false;
      if (outcome === null) { notify("ปิดรอบไม่สำเร็จ กรุณาตรวจสถานะบันทึกและโหลดข้อมูลล่าสุด"); return; }
      navigate(`#/history/${encodeURIComponent(round.id)}`);
    };
    const navigateToCloseBlocker = (blocker) => {
      setCloseReadinessDialog(false);
      if (blocker.type === "vehicle-search-review") {
        const vehicleItem = visibleItems.find((item) => item.id === blocker.itemId);
        const vehicleContext = getVehicleReviewContext(vehicleItem) || currentVehicleContext;
        const href = vehicleApiHref(visibleRound, vehicleContext?.key || "plate", { history: formReadOnly, systemKey: vehicleItem?.vehicleReviewSystemKey });
        const query = new URLSearchParams();
        if (blocker.rowId) query.set("rowId", blocker.rowId);
        if (blocker.reviewKind) query.set("reviewKind", blocker.reviewKind);
        if (blocker.scope) query.set("scope", blocker.scope);
        navigate(query.size ? `${href}${href.includes("?") ? "&" : "?"}${query.toString()}` : href);
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
    const saveReportCover = async () => {
      if (!canEditReportCover || !visibleRound) return false;
      const normalized = normalizeReportCoverMeta(reportCoverMeta);
      const outcome = await update((current) => saveStationInspectionReportCover(current, visibleRound.id, normalized), "บันทึกข้อมูลหน้าปกแล้ว");
      return outcome !== null;
    };
    const confirmReportCompany = async ({ draft = false } = {}) => {
      if (!selectedReportCompany) {
        notify("กรุณาเลือก รูปแบบหน้าปกรายงานก่อนดูหรือพิมพ์รายงาน");
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
      return true;
    };
    const handlePrint = async (mode = "standard", { draft = false } = {}) => {
      if (printPreparationRef.current) return;
      printPreparationRef.current = true;
      printDialogReturnFocusRef.current = document.activeElement;
      const abortController = new AbortController();
      printAbortControllerRef.current = abortController;
      let waitingForUserPrintClick = false;
      setPrintPreparation({ stage: "report", completed: 0, total: 0, percent: 0 });
      try {
        if (!await confirmReportCompany({ draft })) return;
        if (abortController.signal.aborted) return;
        if (!draft && !await saveReportCover()) return;
        if (abortController.signal.aborted) return;
        if (reportPreviewMode !== mode) {
          setReportPreviewMode(mode);
          await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
        }
        if (abortController.signal.aborted) return;
        const report = document.querySelector(".ops-print-report");
        if (!report) { notify("ยังไม่พบตัวอย่างรายงาน กรุณาเปิดตัวอย่างอีกครั้งก่อนพิมพ์"); return; }
        const hasLoadingAttachments = () => report?.querySelector('[data-print-attachment="loading"]');
        const missingAttachments = () => report?.querySelectorAll('[data-print-attachment="missing"]') || [];
        const attachmentDeadline = Date.now() + 180_000;
        const waitForAttachments = async () => {
          while (!abortController.signal.aborted && hasLoadingAttachments() && Date.now() < attachmentDeadline) {
            const attachments = [...report.querySelectorAll('[data-print-attachment]')];
            const total = attachments.length;
            const completed = attachments.filter((entry) => entry.dataset.printAttachment === "ready").length;
            const percent = total ? Math.floor(50 * completed / total) : 0;
            setPrintPreparation((current) => current?.percent === percent ? current : { stage: "report", completed, total, percent });
            await new Promise((resolve) => window.setTimeout(resolve, 80));
          }
        };
        if (hasLoadingAttachments()) {
          notify("กำลังเตรียมรูปและไฟล์หลักฐานสำหรับรายงาน (รอได้ไม่เกิน 180 วินาที)...");
          await waitForAttachments();
        }
        if (abortController.signal.aborted) return;
        if (hasLoadingAttachments()) {
          notify("หลักฐานบางไฟล์ยังโหลดไม่เสร็จภายใน 180 วินาที จึงหยุดพิมพ์");
          return;
        }
        if (missingAttachments().length) {
          notify(`พบรูปหลักฐานโหลดไม่สำเร็จ ${missingAttachments().length} รายการ กำลังลองโหลดใหม่...`);
          window.dispatchEvent(new CustomEvent("checklist:retry-report-attachments", { detail: { deadline: attachmentDeadline } }));
          await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
          await waitForAttachments();
        }
        if (abortController.signal.aborted) return;
        if (hasLoadingAttachments() || missingAttachments().length) {
          notify(`ยังมีหลักฐาน ${missingAttachments().length || "บาง"} รายการโหลดไม่สำเร็จ จึงหยุดพิมพ์เพื่อไม่ให้ออกรายงานขาดหลักฐาน`);
          return;
        }
        const brandImages = [...(report?.querySelectorAll('img[data-company-asset]') || [])];
        const brandReady = await Promise.all(brandImages.map(image => Promise.race([
          image.decode().then(() => image.naturalWidth > 0).catch(() => false),
          new Promise(resolve => window.setTimeout(() => resolve(false), 5000)),
        ])));
        if (abortController.signal.aborted) return;
        if (brandReady.some(ready => !ready)) { notify("ภาพหน้าปกยังไม่พร้อม กรุณาลองพิมพ์อีกครั้ง"); return; }
        await document.fonts.ready;
        if (abortController.signal.aborted) return;
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
        const imageCount = report.querySelectorAll('img[data-print-image="true"]').length;
        const progressStep = Math.max(1, Math.ceil(imageCount / 40));
        setPrintPreparation({ stage: "images", completed: 0, total: imageCount, percent: 50 });
        const printCopies = await preparePrintableImageCopies(report, {
          maxConcurrency: 3,
          signal: abortController.signal,
          onProgress: ({ completed, total }) => {
            if (!abortController.signal.aborted && (completed === total || completed % progressStep === 0)) {
              setPrintPreparation({ stage: "images", completed, total, percent: total ? 50 + Math.floor(50 * completed / total) : 100 });
            }
          },
        });
        if (printCopies.cancelled || abortController.signal.aborted) { printCopies.restore(); return; }
        const pendingPrint = {
          printCopies,
          originalTitle: document.title,
          printTitle: getChecklistPrintTitle(visibleRound, reportCoverMeta),
          listenersAttached: false,
          restored: false,
        };
        pendingPrint.restore = () => {
          if (pendingPrint.restored) return;
          pendingPrint.restored = true;
          window.removeEventListener("afterprint", pendingPrint.restore);
          window.removeEventListener("pagehide", pendingPrint.restore);
          pendingPrint.printCopies.restore();
          document.title = pendingPrint.originalTitle;
          if (pendingPrintRef.current === pendingPrint) pendingPrintRef.current = null;
          printAbortControllerRef.current = null;
          printPreparationRef.current = false;
          setPrintPreparation(null);
        };
        pendingPrintRef.current = pendingPrint;
        waitingForUserPrintClick = true;
        setPrintPreparation({ stage: "ready", completed: imageCount, total: imageCount, percent: 100 });
      } catch {
        if (!abortController.signal.aborted) notify("เตรียมรายงานพิมพ์ไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        if (!waitingForUserPrintClick) {
          printAbortControllerRef.current = null;
          printPreparationRef.current = false;
          setPrintPreparation(null);
        }
      }
    };
    const cancelPrintPreparation = () => {
      const pendingPrint = pendingPrintRef.current;
      if (pendingPrint) {
        pendingPrint.restore();
        return;
      }
      if (!printAbortControllerRef.current) return;
      printAbortControllerRef.current.abort();
      setPrintPreparation((current) => current ? { ...current, stage: "canceling" } : current);
    };
    const openPreparedPrint = () => {
      const pendingPrint = pendingPrintRef.current;
      if (!pendingPrint || pendingPrint.restored) return;
      if (!pendingPrint.listenersAttached) {
        window.addEventListener("afterprint", pendingPrint.restore, { once: true });
        window.addEventListener("pagehide", pendingPrint.restore, { once: true });
        pendingPrint.listenersAttached = true;
      }
      document.title = pendingPrint.printTitle;
      setPrintPreparation((current) => current ? { ...current, stage: "printing" } : current);
      try {
        // Call directly from the user's click so the browser can open its print UI.
        window.print();
      } catch {
        pendingPrint.restore();
        notify("เปิดหน้าพิมพ์ไม่สำเร็จ กรุณากดเปิดหน้าพิมพ์อีกครั้ง");
      }
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
            <label htmlFor="report-company">รูปแบบหน้าปกรายงาน</label>
            <CustomSelect id="report-company" value={reportCompanyId} onChange={event => setReportCompanyId(event.target.value)}><option value="">เลือกบริษัท</option>{REPORT_COMPANIES.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</CustomSelect>
            <small>ใช้กับหน้าปก A4 และ Presentation 16:9 · ไม่เปลี่ยนข้อมูล Snapshot หรือผลตรวจ</small>
          </div>
        </div>
        {canPrintDraftReport ? <div className="ops-info-banner"><Icon name="info" /><span>พิมพ์ข้อมูลระหว่างตรวจได้เลย เอกสารจะแสดงว่าเป็นฉบับร่าง ใช้ผลตรวจและหลักฐาน ณ ตอนนี้ และไม่ปิดรอบหรือบันทึกเป็นรายงานฉบับสมบูรณ์</span></div> : <section className={`report-cover-editor${reportCoverReadiness.ready ? " is-ready" : " has-missing"}`} aria-labelledby="report-cover-editor-title">
          <div className="report-cover-editor-heading"><div><strong id="report-cover-editor-title">ข้อมูลหน้าปกรายงานตรวจสถานี</strong><small>กรอกชื่อรายงาน โครงการ และเลขสัญญาที่ต้องการแสดงบนปก</small></div><span className="report-cover-readiness">{reportCoverReadiness.ready ? (selectedReportCompany ? "ข้อมูลพร้อม · ตรวจไฟล์ก่อนพิมพ์" : "ข้อมูลครบ · ยังไม่เลือกรูปแบบหน้าปก") : "ข้อมูลหน้าปกยังไม่ครบ"}</span></div>
          <div className="report-cover-form-grid">
            {Object.entries(REPORT_COVER_FIELD_LABELS).map(([field, label]) => {
              const required = REPORT_COVER_REQUIRED_FIELDS.includes(field) && !(reportCoverReadiness.isQuickField && field === "contractNo");
              const wide = field === "reportTitle";
              return <label key={field} className={`report-cover-field${wide ? " report-cover-field-wide" : ""}`}><span>{label}{required && <b> *</b>}</span><input data-report-cover-field={field} value={reportCoverMeta[field] || ""} disabled={!canEditReportCover} onChange={(event) => setReportCoverMeta((current) => ({ ...current, [field]: event.target.value }))} placeholder={field === "reportTitle" ? "เช่น รายงานผลการตรวจสอบสถานี" : ""} /></label>;
            })}
          </div>
          {canEditReportCover && <div className="report-cover-editor-actions"><span>{reportCoverReadiness.missingLabels.length ? "ต้องกรอก " + reportCoverReadiness.missingLabels.join(" · ") : "กรอกข้อมูลครบแล้ว · วันที่ตรวจ " + (visibleRound.meta?.inspectionDate ? formatDate(visibleRound.meta.inspectionDate) : "ยังไม่ระบุ")}</span><Button onClick={saveReportCover} variant="secondary" icon="save">บันทึกข้อมูลหน้าปก</Button></div>}
        </section>}
        {canPrintDraftReport ? <div className="ops-report-menu-actions"><Button onClick={toggleReportPreview} variant="secondary" icon="print" disabled={!selectedReportCompany || Boolean(printPreparation)}>{standardReportPreviewActive ? "ซ่อนตัวอย่างฉบับร่าง" : "ดูตัวอย่างฉบับร่าง"}</Button><Button onClick={togglePresentationPreview} variant="secondary" icon="display" disabled={!selectedReportCompany || Boolean(printPreparation)}>{presentationReportPreviewActive ? "ซ่อนรายงานพรีเซนต์" : "ดูพรีเซนต์ฉบับร่าง"}</Button><Button onClick={() => handlePrint("standard", { draft: true })} variant="primary" icon="print" disabled={!selectedReportCompany || Boolean(printPreparation)}>พิมพ์ฉบับร่าง</Button><Button onClick={() => handlePrint("presentation", { draft: true })} variant="secondary" icon="print" disabled={!selectedReportCompany || Boolean(printPreparation)}>พิมพ์พรีเซนต์ฉบับร่าง</Button></div> : <div className="ops-report-menu-actions">
          <Button onClick={toggleReportPreview} variant="secondary" icon="print" disabled={!selectedReportCompany || !reportCoverReadiness.ready || Boolean(printPreparation)}>{standardReportPreviewActive ? "ซ่อนตัวอย่างรายงาน" : "ดูตัวอย่างรายงาน"}</Button>
          <Button onClick={togglePresentationPreview} variant="secondary" icon="display" disabled={!selectedReportCompany || !reportCoverReadiness.ready || Boolean(printPreparation)}>{presentationReportPreviewActive ? "ซ่อนรายงานพรีเซนต์" : "ดูรายงานพรีเซนต์"}</Button>
          <Button onClick={() => handlePrint("standard")} variant="primary" icon="print" disabled={!selectedReportCompany || !reportCoverReadiness.ready || Boolean(printPreparation)}>พิมพ์รายงาน</Button>
          <Button onClick={() => handlePrint("presentation")} variant="secondary" icon="print" disabled={!selectedReportCompany || !reportCoverReadiness.ready || Boolean(printPreparation)}>พิมพ์รายงานพรีเซนต์</Button>
        </div>}
        {!canPrintDraftReport && <section className="station-report-revisions" aria-label="ประวัติฉบับรายงาน"><strong>ฉบับรายงานที่เคยสร้าง</strong>{stationReport?.revisions?.length ? <ol>{[...stationReport.revisions].sort((a, b) => b.version - a.version).map((revision) => <li key={revision.id}><span>ฉบับที่ {revision.version} · {REPORT_COMPANIES.find((company) => company.id === revision.companyId)?.name || revision.companyId || "ไม่ระบุแบบรายงาน"} · {revision.format === "presentation" ? "Presentation" : "A4"}</span><small>{revision.generatedAt ? formatDateTime(revision.generatedAt) : "ไม่ระบุเวลา"}</small></li>)}</ol> : <small>ยังไม่มีฉบับรายงานที่สร้างไว้</small>}</section>}
      </div>
    </details> : null;
    const roundActions = readOnly
      ? <div className="ops-page-actions"><Button href={`#/history/${encodeURIComponent(round.id)}/revise`} variant="secondary" icon="edit">จัดทำฉบับแก้ไข</Button>{reportMenu}</div>
      : <div className="ops-page-actions"><details className="ops-secondary-menu"><summary>เมนูรอบ</summary><div><Button onClick={resetRound} variant="danger-ghost" icon="delete">ล้างค่ารอบการตรวจนี้</Button></div></details>{reportMenu}{!isDemoRound && <Button onClick={closeRound} variant="primary" icon="archive">ปิดรอบการตรวจ</Button>}</div>;
    return (
      <section data-stacked-workspace={isStackedWorkspace ? "true" : "false"} data-checklist-context={currentChecklistContext.key} data-checklist-mode={readOnly ? "history" : "active"} className={`ops-page checklist-page field-command-rail ${readOnly ? "history-detail" : ""} ${reportPreviewMode !== "none" ? "is-report-previewing" : ""} ${currentIsVehicleReview ? "is-vehicle-review-entry" : ""}`.trim()}>
        <Breadcrumb items={[{ label: "รอบการตรวจ", href: "#/inspections" }, { label: visibleRound.snapshot?.stationCode || "รอบการตรวจ", mono: true }, { label: readOnly ? "ประวัติข้อมูล ณ วันที่เริ่มรอบการตรวจ" : "รายการตรวจและหลักฐาน" }]} />
        <header className={`ops-checklist-context-header ${navigationControls ? "is-unified" : ""}`}>
          <div className="ops-checklist-strip-title">{navigationControls}<Icon name="clipboard" /><div className="ops-checklist-strip-title-copy"><h1 id="page-heading" tabIndex="-1">หมวดตรวจ</h1><small className="ops-checklist-mobile-context">{useCentralEnglishNames(currentSection?.title) || "ยังไม่เลือกหมวด"} · {visibleItems.length ? `${currentItemIndex + 1}/${visibleItems.length}` : "0"}</small></div></div>
          <span className="ops-checklist-strip-metric is-section"><small>หมวดตรวจ</small><strong>{useCentralEnglishNames(currentSection?.title) || "ยังไม่เลือกหมวด"}</strong></span>
          <span className="ops-checklist-strip-metric is-item"><small>รายการตรวจ</small><strong>{visibleItems.length ? `${currentItemIndex + 1} จาก ${visibleItems.length}` : "0"}</strong></span>
          <span className="ops-checklist-strip-metric is-status"><small>มีผลตรวจ</small><strong>{summary.done}/{summary.total} รายการ</strong></span>
          <span className="ops-checklist-strip-metric is-evidence"><small>ข้อมูลหลักฐาน</small><strong>{summary.evidenceComplete}/{summary.evidenceTotal} ช่อง</strong></span>
          <SaveStatus className={`ops-save-state ${serverSaveState === "idle" && (savedAt || readOnly || isDemoRound) ? "is-current" : ""} ${serverSaveState !== "idle" ? "is-pending" : ""}`} label={saveStateLabel} icon={readOnly ? "eye" : isDemoRound ? "info" : serverSaveState === "failed" ? "alert" : serverSaveState === "saving" ? "refresh" : serverSaveState === "pending" ? "clock" : savedAt || serverSaveState === "saved" ? "check" : "save"} />
        <div className="ops-checklist-round-actions" aria-label="คำสั่งรอบตรวจ">{!formReadOnly && pendingItems.length > 0 && <Button variant="secondary" icon="alert" aria-haspopup="dialog" onClick={() => pendingResultsDialogRef.current?.showModal()}>ผลตรวจค้าง {pendingItems.length}</Button>}<div className="ops-inspection-round-controls" inert={!serverWritable}>{roundActions}</div>{accountControls}</div>
          <small className="ops-context-snapshot-meta sr-only">ข้อมูล ณ วันที่เริ่มรอบการตรวจ {visibleRound.snapshot?.equipment?.length || 0} อุปกรณ์</small>
        </header>
        {!formReadOnly && <dialog ref={pendingResultsDialogRef} className="ops-pending-results-dialog" aria-labelledby="pending-results-title" aria-describedby="pending-results-description">
          <div className="ops-pending-results-dialog-header"><h2 id="pending-results-title">ผลตรวจที่ค้าง {pendingItems.length} รายการ</h2><Button variant="secondary" onClick={() => pendingResultsDialogRef.current?.close()}>ปิด</Button></div>
          <p id="pending-results-description">{summary.evidenceTotal > 0 && summary.evidenceComplete === summary.evidenceTotal ? "หลักฐานครบแล้ว แต่ยังไม่ได้เลือกผลตรวจในรายการต่อไปนี้" : "เลือกรายการเพื่อไปบันทึกผลตรวจ"}</p>
          {pendingItems.length > 0 ? <ul>{pendingItems.map((item) => <li key={item.id}><Button variant="secondary" icon="arrow" onClick={() => openPendingItem(item.id)}>{getChecklistQueueItemLabel(item)}</Button></li>)}</ul> : <p>เลือกผลตรวจครบแล้ว</p>}
        </dialog>}
        {isDemoRound && <div className="ops-demo-banner" role="note"><Icon name="info" /><span><strong>DEMO UI FIXTURE</strong>ข้อมูลตัวอย่างสำหรับทดสอบ layout และ responsive · การแก้ไขจะอยู่เฉพาะหน้านี้และไม่เขียนทับข้อมูลรอบการตรวจ</span></div>}
         {formReadOnly && <div className="ops-readonly-banner"><Icon name="archive" /><span><strong>ผลตรวจของรอบนี้ปิดแล้วและอ่านอย่างเดียว</strong>{correction.count ? <> มีการแก้ไขย้อนหลังแบบเดิมแล้ว {correction.count} ครั้ง · ล่าสุด {formatDateTime(correction.latestAt)} · เหตุผล: {correction.latestReason}</> : " หน้าปกรายงานยังแก้และบันทึกได้จากเมนูรายงาน โดยไม่เปลี่ยนผลตรวจ"}</span></div>}
         {visibleRound.basedOnRoundId && <section className="ops-panel ops-revision-banner"><div><p className="ops-eyebrow">REVISION DRAFT</p><h3>ฉบับแก้ไขครั้งที่ {visibleRound.revisionNumber || 1}</h3><p>สร้างจากรอบเดิม {shortId(visibleRound.basedOnRoundId)} · เหตุผล: {visibleRound.revisionReason || "—"}</p></div><StatusBadge status="draft">ยังไม่ปิดรอบ</StatusBadge></section>}
        <section inert={!serverWritable} className="ops-checklist-layout ops-taskflow-layout" data-workspace-panel={workspacePanel}>
          <div className="ops-workspace-tabs" role="tablist" aria-label="พื้นที่ทำงานรอบการตรวจ" hidden={isStackedWorkspace}>
            <button id="workspace-tab-queue" type="button" role="tab" aria-selected={workspacePanel === "queue"} aria-controls="workspace-panel-queue" tabIndex={workspacePanel === "queue" ? 0 : -1} onClick={() => setWorkspacePanel("queue")} onKeyDown={handleWorkspaceTabKeyDown}><Icon name="list" /><span>ยังไม่ตรวจ</span><strong>{Math.max(0, summary.total - summary.done)}</strong></button>
            <button id="workspace-tab-evidence" type="button" role="tab" aria-selected={workspacePanel === (currentIsVehicleReview ? "result" : "evidence")} aria-controls={currentIsVehicleReview ? "workspace-panel-result" : "workspace-panel-evidence"} tabIndex={workspacePanel === (currentIsVehicleReview ? "result" : "evidence") ? 0 : -1} onClick={() => setWorkspacePanel(currentIsVehicleReview ? "result" : "evidence")} onKeyDown={handleWorkspaceTabKeyDown}><Icon name={currentIsVehicleReview ? "search" : "camera"} /><span>{currentIsVehicleReview ? "ตรวจ API" : "หลักฐาน"}</span><strong>{currentIsVehicleReview ? (currentVehicleReview.summary.total ? `${currentVehicleReview.summary.completeRows}/${currentVehicleReview.summary.total}` : "API") : (currentEvidenceBypassed ? "ข้าม" : `${currentEvidenceComplete}/${currentEvidenceSlots.length}`)}</strong></button>
            <button id="workspace-tab-result" type="button" role="tab" aria-selected={workspacePanel === "result"} aria-controls="workspace-panel-result" tabIndex={workspacePanel === "result" ? 0 : -1} onClick={() => setWorkspacePanel("result")} onKeyDown={handleWorkspaceTabKeyDown}><Icon name="clipboard" /><span>ตรวจ</span><strong>{visibleItems.length ? `${currentItemIndex + 1}/${visibleItems.length}` : "0"}</strong></button>
          </div>
          <aside className="ops-panel ops-section-panel ops-task-queue-panel" id="workspace-panel-queue" role="tabpanel" aria-labelledby="workspace-tab-queue" tabIndex="0" hidden={isCompactWorkspace && workspacePanel !== "queue"} aria-hidden={isCompactWorkspace && workspacePanel !== "queue" ? "true" : undefined}>
             <div className="ops-panel-heading ops-task-queue-heading"><div><p className="ops-eyebrow">STATION CHECKLIST</p><h3>หมวดตรวจ</h3></div><div className="ops-task-queue-heading-summary"><div className="ops-task-queue-status-metric" aria-label={`บันทึกสถานะแล้ว ${summary.done} จาก ${summary.total} รายการ`}><span>บันทึกสถานะ</span><strong>{summary.done}/{summary.total}</strong><em>รายการ</em></div><div className="ops-task-queue-heading-progress" role="progressbar" aria-label="ความคืบหน้าการบันทึกสถานะในหมวดตรวจ" aria-valuemin="0" aria-valuemax="100" aria-valuenow={summary.progress}><span style={{ width: `${summary.progress}%` }} /></div><div className="ops-task-queue-legend" aria-label="คำอธิบายสถานะหมวดตรวจ"><span className="is-complete"><Icon name="check" size="small" />หลักฐานครบ</span><span className="is-pending"><Icon name="info" size="small" />รอตรวจ</span><span className="is-issue"><Icon name="alert" size="small" />มีประเด็น</span></div></div></div>
            <ChecklistTaskQueue sections={visibleSections} hierarchy="station-categories" selected={currentSection?.code || selectedSection} currentItemId={currentVisibleItem?.id} round={visibleRound} summary={summary} coverage={coverage} onSelect={(sectionCode, itemId) => { setSelectedSection(sectionCode); setCurrentItemId(itemId); setWorkspacePanel(currentIsVehicleReview ? "result" : "evidence"); setPendingFocusItemId(itemId); }} readOnly={formReadOnly} />
          </aside>
          <div className="ops-panel ops-items-panel ops-taskflow-main" id="workspace-panel-result" role="tabpanel" aria-labelledby="workspace-tab-result" tabIndex="0" hidden={isCompactWorkspace && workspacePanel !== "result"} aria-hidden={isCompactWorkspace && workspacePanel !== "result" ? "true" : undefined}>
            <div className="ops-panel-heading ops-taskflow-heading"><div><p className="ops-item-breadcrumb">{formReadOnly ? "ข้อมูล Snapshot · อ่านอย่างเดียว" : `รายการตรวจที่ ${currentItemIndex + 1} จาก ${visibleItems.length} ในรายการที่แสดง`}</p><h3 id="checklist-current-item-heading" tabIndex="-1">{currentIsVehicleReview ? (currentVisibleItem?.vehicleReviewSystemKey ? getChecklistQueueItemLabel(currentVisibleItem) : (currentVehicleContext?.key === "classification" ? "คัดแยกประเภทรถ" : "ตรวจป้ายทะเบียน")) : (currentVisibleItem ? getChecklistQueueItemLabel(currentVisibleItem) : "ข้อมูลรายการตรวจ")}</h3>{!currentIsVehicleReview && currentVisibleItem && <div className="ops-current-item-facts"><span><small>ขอบเขตการตรวจ</small><strong>{currentItemScope.label}</strong></span>{currentVisibleItem.relationshipPath && <span><small>ตำแหน่งในผังระบบ</small><strong>{currentVisibleItem.relationshipPath}</strong></span>}{currentVisibleItem.assetNo && <span><small>Asset No.</small><strong className="ops-code">{currentVisibleItem.assetNo}</strong></span>}{canUseNotInstalled(currentVisibleItem) && <><span><small>หมายเลขเครื่อง</small><strong className="ops-code">{currentVisibleItem.serialNo || "ยังไม่ระบุ"}</strong></span><span><small>ตำแหน่ง</small><strong>{currentVisibleItem.location || "ยังไม่ระบุ"}</strong></span></>}</div>}<div className="ops-work-context"><span className="ops-work-context-icon"><Icon name={currentChecklistContext.icon} size="small" /></span><div><strong>{currentChecklistContext.label}</strong><small>{formReadOnly ? `ข้อมูล Snapshot · ${currentChecklistContext.hint}` : currentChecklistContext.hint}</small></div></div></div></div>
            <div className="ops-check-section-list">{currentSection && currentVisibleItem ? currentIsVehicleReview ? <section className="ops-vehicle-review-entry" aria-labelledby="vehicle-review-entry-title"><div className="ops-vehicle-review-entry-icon"><Icon name="search" /></div><div className="ops-vehicle-review-entry-copy"><p className="ops-eyebrow">ตรวจรถแยกตามงาน</p><h4 id="vehicle-review-entry-title">{currentVisibleItem.label}</h4><p>{currentVehicleContext?.key === "classification" ? "ดูภาพรถ ประเภทรถ จำนวนเพลา และน้ำหนักที่ API ส่งมา" : "เทียบเลขทะเบียนและจังหวัดกับภาพ พร้อมเวลา เลน และสถานี"}</p><div className="ops-vehicle-review-entry-summary"><span>รายการในคิว <strong>{currentVehicleReview.summary.total || 0}</strong></span><span>ตรวจยืนยันแล้ว <strong>{currentVehicleReview.summary.completeRows || 0}</strong></span></div></div><Button href={vehicleApiHref(visibleRound, currentVehicleContext?.key, { history: formReadOnly, systemKey: currentVisibleItem?.vehicleReviewSystemKey })} variant="primary" icon="arrow">{formReadOnly ? "เปิดผลตรวจจาก Snapshot" : currentVehicleContext?.key === "classification" ? "ตรวจประเภทรถ" : "ตรวจป้ายทะเบียน"}</Button></section> : <section className="ops-check-section" aria-labelledby={`check-section-${domSafeId(currentSection.code)}`}><h3 className="sr-only" id={`check-section-${domSafeId(currentSection.code)}`}>{currentSection.title}</h3><div className="ops-check-items"><ChecklistItem key={currentVisibleItem.id} item={currentVisibleItem} value={visibleRound.inspectionItems[currentVisibleItem.id]} readOnly={formReadOnly} hideEvidence focusLayout apiReview={currentIsLegacyVehicleApiReview} vehicleSearch={visibleRound.vehicleSearch} vehicleReviewVersion={visibleRound.snapshot?.vehicleReviewVersion} onOpenApiReview={openVehicleApiReview} onChange={updateItem} onStatusChange={handleStatusChange} onAttachmentChange={handleAttachmentChange} onAttachmentAnnotation={handleAttachmentAnnotation} onAttachmentRemove={handleAttachmentRemove} focusEvidenceId={pendingFocusEvidence?.itemId === currentVisibleItem.id ? pendingFocusEvidence.slotId : ""} onFocusEvidenceComplete={clearPendingFocusEvidence} /></div></section> : <EmptyState icon="search" title="ยังไม่มีรายการตรวจในรอบนี้">รอบนี้ไม่มีรายการตรวจที่เปิดใช้งาน</EmptyState>}</div>
             <ChecklistPager currentIndex={currentItemIndex} total={visibleItems.length} onPrevious={() => navigateItem(-1)} onNext={() => navigateItem(1)} />
          </div>
          {!currentIsVehicleReview && <ChecklistEvidenceDrawer hidden={isCompactWorkspace && workspacePanel !== "evidence"} panelId="workspace-panel-evidence" labelledBy="workspace-tab-evidence" item={currentVisibleItem} itemValue={currentVisibleItem ? visibleRound.inspectionItems[currentVisibleItem.id] : null} readOnly={formReadOnly} allowClipboardPaste={!formReadOnly && visibleRound.status !== "closed"} onChange={(patch) => currentVisibleItem && updateItem(currentVisibleItem.id, patch)} onAttachmentChange={handleAttachmentChange} onAttachmentAnnotation={handleAttachmentAnnotation} onAttachmentRemove={handleAttachmentRemove} focusSlotId={pendingFocusEvidence?.itemId === currentVisibleItem?.id ? pendingFocusEvidence.slotId : ""} onFocusComplete={clearPendingFocusEvidence} round={visibleRound} vehicleSearch={visibleRound.vehicleSearch} onVehicleSearchChange={updateVehicleSearch} notify={notify} />}
        </section>
        {reportPreviewMode !== "none" && <div className="ops-report-preview-toolbar" role="status" aria-live="polite">
          <div><span className="ops-eyebrow">REPORT PREVIEW</span><strong>{presentationReportPreviewActive ? "ตัวอย่างรายงานพรีเซนต์" : "ตัวอย่างรายงาน"}</strong></div>
          <Button onClick={closeReportPreview} variant="secondary" icon="arrow">กลับหน้าตรวจ</Button>
        </div>}
        <AcDcLegacyArchive archive={visibleRound.acDcSplitArchive} renderEvidence={(item, value) => <ChecklistEvidenceDrawer item={item} itemValue={value} readOnly allowClipboardPaste={false} round={visibleRound} notify={notify} />} />
        {reportPreviewMode !== "none" && <PrintableReport round={visibleRound} state={state} preview mode={presentationReportPreviewActive ? "presentation" : "standard"} companyId={reportCompanyId} reportCoverMeta={reportCoverMeta} draft={canPrintDraftReport} />}
        {printPreparation && <div className="ops-dialog-layer" role="presentation">
          <section ref={printDialogRef} tabIndex={-1} className="ops-dialog ops-print-preparation-dialog" role="dialog" aria-modal="true" aria-labelledby="print-preparation-title" aria-describedby="print-preparation-description" onKeyDown={(event) => { if (event.key === "Escape" && printPreparation.stage !== "ready" && printPreparation.stage !== "printing") { event.preventDefault(); cancelPrintPreparation(); } }}>
            <div className="ops-dialog-icon"><Icon name="print" /></div>
            <div className="ops-dialog-content">
              <p className="ops-eyebrow">พิมพ์รายงาน</p>
              <h2 id="print-preparation-title">{printPreparation.stage === "ready" ? "รายงานพร้อมพิมพ์" : printPreparation.stage === "printing" ? "ยังไม่เห็นหน้าต่างพิมพ์ใช่ไหม" : printPreparation.stage === "canceling" ? "กำลังยกเลิก" : "กำลังเตรียมรายงาน"}</h2>
              <p id="print-preparation-description" role="status" aria-live="polite">{printPreparation.stage === "ready" ? `เตรียมรายงานเสร็จแล้ว ${printPreparation.total} ภาพ กด “เปิดหน้าพิมพ์” เพื่อแสดงหน้าต่างพิมพ์` : printPreparation.stage === "printing" ? "ถ้าหน้าต่างพิมพ์ไม่เปิด ให้กด “เปิดหน้าพิมพ์อีกครั้ง” ด้านล่าง" : printPreparation.stage === "canceling" ? "กำลังหยุดการเตรียมรายงาน…" : printPreparation.stage === "images" ? `กำลังเตรียมภาพ ${printPreparation.completed}/${printPreparation.total} ภาพ กรุณารอสักครู่` : "กำลังโหลดหลักฐานและจัดเตรียมเอกสาร กรุณารอสักครู่"}</p>
              <div className="ops-print-preparation-meter">
                <div className="ops-print-preparation-meter-label"><span>{printPreparation.stage === "ready" || printPreparation.stage === "printing" ? "พร้อมพิมพ์" : printPreparation.stage === "images" ? "กำลังปรับภาพสำหรับพิมพ์" : "กำลังโหลดหลักฐาน"}</span><strong>{printPreparation.percent ?? 0}%</strong></div>
                <div className={`ops-print-preparation-progress${printPreparation.stage === "ready" || printPreparation.stage === "printing" ? " is-complete" : ""}`} role="progressbar" aria-label="ความคืบหน้าการเตรียมรายงาน" aria-valuemin={0} aria-valuemax={100} aria-valuenow={printPreparation.percent ?? 0}><span style={{ width: `${printPreparation.percent ?? 0}%` }} /></div>
              </div>
            </div>
            <div className="ops-dialog-actions">
              {printPreparation.stage === "ready" || printPreparation.stage === "printing" ? <>
                <Button onClick={cancelPrintPreparation} variant="secondary">ยกเลิก</Button>
                <Button buttonRef={openPrintButtonRef} onClick={openPreparedPrint} variant="primary" icon="print">{printPreparation.stage === "ready" ? "เปิดหน้าพิมพ์" : "เปิดหน้าพิมพ์อีกครั้ง"}</Button>
              </> : <Button onClick={cancelPrintPreparation} variant="secondary" disabled={printPreparation.stage === "canceling"}>{printPreparation.stage === "canceling" ? "กำลังยกเลิก…" : "ยกเลิก"}</Button>}
            </div>
          </section>
        </div>}
        {serverWritable && closeReadinessDialog && <CloseReadinessDialog blockers={closeReadiness.blockers} issues={closeReadiness.issues} sections={visibleSections} allowConfirm={closeReadiness.canConfirmClose} onNavigate={navigateToCloseBlocker} onClose={() => setCloseReadinessDialog(false)} onConfirm={finalizeCloseRound} />}
      </section>
    );
  }
}
