

import SaveStatus from "./SaveStatus.jsx";
import StationBrandMark from "./StationBrandMark.jsx";
import { InspectionNavigation, InspectionAccountMenu } from "./InspectionHeaderControls.jsx";
import ThemePreference from "./ThemePreference.jsx";

import { AppIcon as Icon } from "./icon-system.jsx";
import { Button, ConfirmDialog } from "./controls/ActionControls.jsx";
import { CloseSuccessDialog } from "./dialogs/CloseSuccessDialog.jsx";
import { shouldShowCloseSuccess } from "./close-round-success.js";


import { createPageRuntime, PAGE_RUNTIME_KEYS } from "./page-runtime.js";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";


import { getBackFallbackTarget, parseHash, primaryRouteFor, PRIMARY_ROUTES } from "./router.js";
import { canNavigateBackInApp, canNavigateForwardInApp, initializeRouteHistory, navigate, navigateBack, navigateForward, replaceRoute, skipToMainContent } from "./navigation.js";

import { createLazyPage, renderPage } from "./page-registry.jsx";
import { LocalLoginScreen, PasswordChangeScreen } from "./LocalAuthScreens.jsx";
import { useServerWorkspaceSync } from "./useServerWorkspaceSync.js";
import { removeInspectionRoundFromState } from "../domain/conflict-round-deletion.js";


import { deleteStoredAttachments } from "../domain/attachments.js";

import { isServerStorageEnabled } from "../domain/server-storage.js";

import { UI_DEMO_ROUND_ID, UI_VEHICLE_DEMO_ROUND_ID } from "../domain/demo-ids.js";

import { attachmentIdsForRoundAndAliases } from "./attachment-cleanup.js";
import { formatDate, roundFor, shortId, SIDEBAR_SHORT_LABELS } from "./page-runtime-shell.js";

function createInitialChecklistState() {
  return {
    stationProfiles: [],
    inspectionRounds: [],
    inspectionHistory: [],
    inspectionWorkspaces: [],
    itemCatalog: [],
    regions: [],
    referenceData: { provinces: [], contractors: [], agencies: [] },
    contracts: [],
    workPackages: [],
    contractStationAssignments: [],
    contractWorkReports: [],
    contractAgreementCovers: [],
    inspectionRoundContextLinks: [],
    stationInspectionReports: [],
  };
}

const LazyContractContextBar = lazy(() => import("./ContractContextBar.jsx"));
const CONTRACT_CONTEXT_ROUTES = new Set([
  "newInspection", "checklist", "historyDetail", "historyVehicleApi", "historyRevise", "vehicleApi", "stationDetail",
]);

const PAGE_RUNTIME_LOADERS = Object.freeze({
  checklist: () => import("./page-runtimes/checklist.runtime.js"),
  contextualStation: () => import("./page-runtimes/contextual-station.runtime.js"),
  history: () => import("./page-runtimes/history.runtime.js"),
  inspections: () => import("./page-runtimes/inspections.runtime.js"),
  newInspection: () => import("./page-runtimes/new-inspection.runtime.js"),
  referenceData: () => import("./page-runtimes/reference-data.runtime.js"),
  revision: () => import("./page-runtimes/revision.runtime.js"),
  stationDetail: () => import("./page-runtimes/station-detail.runtime.js"),
  stations: () => import("./page-runtimes/stations.runtime.js"),
  vehicleApi: () => import("./page-runtimes/vehicle-api.runtime.js"),
});

async function loadPageRuntime(key) {
  const loader = PAGE_RUNTIME_LOADERS[key];
  if (!loader) throw new TypeError(`No page runtime loader for ${key}`);
  const module = await loader();
  return createPageRuntime(module.createRuntime(), PAGE_RUNTIME_KEYS[key]);
}

function lazyPageFactory(loadModule, factoryName, runtimeKey) {
  return createLazyPage(async () => {
    const [pageModule, runtime] = await Promise.all([
      loadModule(),
      runtimeKey ? loadPageRuntime(runtimeKey) : Promise.resolve(null),
    ]);
    const factory = pageModule[factoryName];
    if (typeof factory !== "function") throw new TypeError(`Page factory ${factoryName} is unavailable`);
    return runtimeKey ? factory(runtime) : factory();
  });
}

const checklistPage = lazyPageFactory(() => import("./pages/ChecklistPage.jsx"), "createChecklistPage", "checklist");
const vehicleApiPage = lazyPageFactory(() => import("./pages/VehicleApiReviewPage.jsx"), "createVehicleApiReviewPage", "vehicleApi");

const PAGE_COMPONENTS = Object.freeze({
  referenceData: lazyPageFactory(() => import("./pages/ReferenceDataPage.jsx"), "createReferenceDataPage", "referenceData"),
  stations: lazyPageFactory(() => import("./pages/StationsPage.jsx"), "createStationsPage", "stations"),
  stationDetail: lazyPageFactory(() => import("./pages/StationDetailPage.jsx"), "createStationDetailPage", "stationDetail"),
  newStation: lazyPageFactory(() => import("./pages/ContextualStationPage.jsx"), "createContextualStationPage", "contextualStation"),
  inspections: lazyPageFactory(() => import("./pages/InspectionsPage.jsx"), "createInspectionsPage", "inspections"),
  newInspection: lazyPageFactory(() => import("./pages/NewInspectionPage.jsx"), "createNewInspectionPage", "newInspection"),
  checklist: checklistPage,
  vehicleApi: vehicleApiPage,
  vehicleApiReport: lazyPageFactory(() => import("./pages/VehicleApiReportPage.jsx"), "createVehicleApiReportPage"),
  history: lazyPageFactory(() => import("./pages/HistoryPage.jsx"), "createHistoryPage", "history"),
  historyDetail: checklistPage,
  historyVehicleApi: vehicleApiPage,
  historyVehicleApiReport: lazyPageFactory(() => import("./pages/VehicleApiReportPage.jsx"), "createVehicleApiReportPage"),
  historyRevise: lazyPageFactory(() => import("./pages/RevisionPage.jsx"), "createRevisionPage", "revision"),
  adminUsers: createLazyPage(async () => (await import("./AdminUsersPage.jsx")).AdminUsersPage),
});

function App() {
  initializeRouteHistory();
  const serverStorage = isServerStorageEnabled();
  const [route, setRoute] = useState(() => parseHash());
  const [closeSuccessRoundId, setCloseSuccessRoundId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarToggleRef = useRef(null);
  const [state, setState] = useState(createInitialChecklistState);
  const [localBootstrapReady, setLocalBootstrapReady] = useState(serverStorage);
  const [toast, setToast] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [purgeRetry, setPurgeRetry] = useState(null);
  const confirmResolverRef = useRef(null);
  const handleCloseSuccess = useCallback((roundId) => setCloseSuccessRoundId(roundId), []);
  const dismissCloseSuccess = useCallback(() => setCloseSuccessRoundId(null), []);
  const notify = (message) => { setToast(message); window.clearTimeout(window.__checklistToast); window.__checklistToast = window.setTimeout(() => setToast(""), 2800); };
  const serverSync = useServerWorkspaceSync({ serverStorage, setState, notify });
  const { authConfig, authRequired, currentUser, persistServerState, remoteLoaded, refreshServerState, serverSaveError, serverSaveState, serverWritable } = serverSync;
  useEffect(() => {
    if (serverStorage) return undefined;
    let cancelled = false;
    import("../domain/storage.js").then(({ loadChecklistBootstrap }) => {
      if (cancelled) return;
      setState(loadChecklistBootstrap().state);
      setLocalBootstrapReady(true);
    }).catch(() => {
      if (!cancelled) setLocalBootstrapReady(true);
    });
    return () => { cancelled = true; };
  }, [serverStorage]);
  const handleShellRouteClick = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target?.closest?.('a[href^="#/"]');
    if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    event.preventDefault();
    navigate(link.getAttribute("href"));
  };
  const persistState = (payload, reason = "state-update") => {
    if (serverStorage) return persistServerState(payload, reason);
    return import("../domain/storage.js").then(({ saveChecklistState }) => saveChecklistState(payload));
  };
  const update = (recipe, message = "", reason = "state-update") => {
    let resolvePersistence;
    const persistence = new Promise((resolve) => { resolvePersistence = resolve; });
    setState((current) => {
      const next = typeof recipe === "function" ? recipe(current) : recipe;
      const payload = { ...next, ui: { ...(next.ui || {}), lastSavedAt: new Date().toISOString() } };
      try {
        Promise.resolve(persistState(payload, reason)).then((result) => {
          if (!serverStorage || result?.version != null) {
            setSavedAt(Date.now());
            if (message) notify(message);
          }
          resolvePersistence(result);
        }, () => resolvePersistence(null));
      } catch {
        resolvePersistence(null);
      }
      return payload;
    });
    return persistence;
  };
  useEffect(() => {
    const pendingIds = [...new Set((Array.isArray(state.impsPurgePendingAttachmentIds) ? state.impsPurgePendingAttachmentIds : []).filter(Boolean))];
    if (!pendingIds.length) return undefined;
    let cancelled = false;
    deleteStoredAttachments(pendingIds).then(() => {
      if (cancelled) return;
      setState((current) => {
        const currentPending = Array.isArray(current.impsPurgePendingAttachmentIds) ? current.impsPurgePendingAttachmentIds : [];
        if (!currentPending.some((id) => pendingIds.includes(id))) return current;
        const next = { ...current, impsPurgePendingAttachmentIds: currentPending.filter((id) => !pendingIds.includes(id)) };
        persistState(next, "attachment-purge");
        return next;
      });
    }).catch(() => {
      if (!cancelled) notify("ลบไฟล์แนบของ ImPS ไม่สำเร็จ จะลองใหม่เมื่อเปิดระบบครั้งถัดไป");
    });
    return () => { cancelled = true; };
  }, [state.impsPurgePendingAttachmentIds]);
  useEffect(() => {
    const pendingIds = [...new Set((Array.isArray(state.videoPurgePendingAttachmentIds) ? state.videoPurgePendingAttachmentIds : []).filter(Boolean))];
    if (!pendingIds.length) return undefined;
    let cancelled = false;
    deleteStoredAttachments(pendingIds).then(() => {
      if (cancelled) return;
      setState((current) => {
        const currentPending = Array.isArray(current.videoPurgePendingAttachmentIds) ? current.videoPurgePendingAttachmentIds : [];
        const remaining = currentPending.filter((id) => !pendingIds.includes(id));
        if (remaining.length === currentPending.length) return current;
        const next = { ...current };
        if (remaining.length) next.videoPurgePendingAttachmentIds = remaining;
        else delete next.videoPurgePendingAttachmentIds;
        persistState(next, "attachment-purge");
        return next;
      });
    }).catch(() => {
      if (!cancelled) notify("ลบไฟล์แนบวิดีโอเก่าไม่สำเร็จ ระบบจะลองใหม่เมื่อเปิดครั้งถัดไป");
    });
    return () => { cancelled = true; };
  }, [state.videoPurgePendingAttachmentIds]);
  useEffect(() => {
    const onHashChange = () => {
      const nextRoute = parseHash();
      if (nextRoute.redirectTo) {
        replaceRoute(nextRoute.redirectTo);
        return;
      }
      setRoute(nextRoute);
    };
    window.addEventListener("hashchange", onHashChange);
    if (!window.location.hash) replaceRoute("#/inspections");
    else if (parseHash().redirectTo) replaceRoute(parseHash().redirectTo);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  useEffect(() => {
    if (!closeSuccessRoundId) return;
    const closingRoute = route.id === closeSuccessRoundId && ["checklist", "historyDetail"].includes(route.name);
    if (!closingRoute) setCloseSuccessRoundId(null);
  }, [closeSuccessRoundId, route.id, route.name]);
  useEffect(() => {
    if (route.name === "historyDetail" && route.query?.edit === "1") {
      navigate(`#/history/${encodeURIComponent(route.id)}/revise`);
      return;
    }
    if (route.name === "stations" && route.query?.stationId && state.stationProfiles.some((profile) => profile.id === route.query.stationId)) {
      navigate(`#/stations/${encodeURIComponent(route.query.stationId)}`);
    }
  }, [route.name, route.id, route.query?.edit, route.query?.stationId, state.stationProfiles]);
  useEffect(() => { const heading = document.getElementById("page-heading"); if (heading && !shouldShowCloseSuccess(closeSuccessRoundId, route)) requestAnimationFrame(() => heading.focus()); }, [route.name, route.id, closeSuccessRoundId]);
  const requestConfirm = useCallback((request) => {
    if (confirmResolverRef.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmRequest(request);
    });
  }, []);
  const resolveConfirm = useCallback((result) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmRequest(null);
    resolver?.(result);
  }, []);
  const archiveStation = async (profile) => {
    if (!profile) return;
    const stationCode = String(profile.stationCode || "").trim() || "สถานีนี้";
    const archived = profile.active === false;
    const confirmed = await requestConfirm({
      title: archived ? `เปิดใช้งานสถานี ${stationCode}` : `ปิดใช้งานสถานี ${stationCode}`,
      description: archived
        ? "สถานีจะกลับมาเลือกสร้างรอบการตรวจใหม่ได้ ข้อมูลฉบับร่าง ประวัติ และข้อมูลประจำรอบเดิมจะคงเดิม"
        : "สถานีจะไม่แสดงในตัวเลือกสร้างรอบการตรวจใหม่ แต่ฉบับร่าง ประวัติ และข้อมูลประจำรอบเดิมจะคงอยู่ครบถ้วน",
      confirmLabel: archived ? "ยืนยันเปิดใช้งานสถานี" : "ยืนยันปิดใช้งานสถานี",
      confirmVariant: archived ? "primary" : "danger-ghost",
      confirmIcon: archived ? "refresh" : "archive",
    });
    if (!confirmed) return;
    update((current) => {
      const nextProfiles = current.stationProfiles.map((entry) => entry.id === profile.id ? { ...entry, active: archived } : entry);
      const activeProfiles = nextProfiles.filter((entry) => entry.active !== false);
      const nextStationId = archived
        ? (activeProfiles.some((entry) => entry.id === current.activeStationId) ? current.activeStationId : activeProfiles[0]?.id || null)
        : profile.id;
      const currentActiveRound = current.inspectionRounds.find((round) => round.id === current.activeRoundId) || null;
      const nextActiveRound = (currentActiveRound?.stationId === nextStationId ? currentActiveRound : null)
        || current.inspectionRounds.find((round) => round.status === "draft" && round.stationId === nextStationId)
        || null;
      return {
        ...current,
        stationProfiles: nextProfiles,
        activeStationId: nextStationId,
        activeRoundId: nextActiveRound?.id || null,
        ui: { ...(current.ui || {}), selectedStationId: nextStationId },
      };
    }, archived ? "เปิดใช้งานสถานีแล้ว" : "ปิดใช้งานสถานีแล้ว");
  };
  const finishStationPurge = async (stationId, impact, stateAlreadyDeleted = false) => {
    if (!stateAlreadyDeleted) {
      const { purgeStationFromState } = await import("../domain/storage.js");
      const result = await update((current) => purgeStationFromState(current, stationId), "", "station-delete");
      if (serverStorage && result?.version == null) return false;
    }
    try {
      await deleteStoredAttachments(impact.attachmentIds);
    } catch (error) {
      const message = "ลบข้อมูลสถานีแล้ว แต่ลบไฟล์แนบบางส่วนไม่สำเร็จ";
      setPurgeRetry({ stationId, impact, stateAlreadyDeleted: true, message, busy: false });
      notify(message);
      navigate("#/stations");
      return false;
    }
    setPurgeRetry(null);
    notify("ลบสถานีและข้อมูลที่เกี่ยวข้องแล้ว");
    navigate("#/stations");
    return true;
  };
  const retryStationPurge = async () => {
    const pending = purgeRetry;
    if (!pending || pending.busy) return;
    setPurgeRetry((current) => current ? { ...current, busy: true } : current);
    await finishStationPurge(pending.stationId, pending.impact, pending.stateAlreadyDeleted);
  };
  const permanentlyDeleteStation = async (profile) => {
    if (!profile) return;
    const stationCode = String(profile.stationCode || "").trim();
    const { buildStationDeletionImpact } = await import("../domain/storage.js");
    const impact = buildStationDeletionImpact(state, profile.id);
    const firstConfirmed = await requestConfirm({
      title: `ลบสถานี ${stationCode || "นี้"} ถาวร`,
      description: "การดำเนินการนี้ย้อนกลับไม่ได้ และไม่มี Backup หรือ Undo อัตโนมัติ ข้อมูลของสถานีนี้จะถูกลบออกจากที่จัดเก็บของระบบ",
      details: [
        { label: "สถานี", value: `${stationCode || "—"} · ${profile.stationName || "—"}` },
        { label: "อุปกรณ์", value: `${impact.counts.assets} รายการ` },
        { label: "รอบร่าง", value: `${impact.counts.draftRounds} รอบ` },
        { label: "ประวัติปิดแล้ว", value: `${impact.counts.closedHistory} รอบ` },
        { label: "ข้อมูลประจำรอบ (Snapshot)", value: `${impact.counts.snapshots} ชุด` },
        { label: "ไฟล์แนบที่จะลบ", value: `${impact.counts.attachments} ไฟล์` },
      ],
      confirmLabel: "ดำเนินการต่อ",
      confirmVariant: "danger",
      confirmIcon: "delete",
    });
    if (!firstConfirmed) return;
    const secondConfirmed = await requestConfirm({
      title: "ยืนยันการลบถาวรอีกครั้ง",
      description: "ข้อมูลสถานี รอบการตรวจ ประวัติ ข้อมูลประจำรอบ และไฟล์แนบที่ไม่มีสถานีอื่นใช้งานจะถูกลบถาวร หากต้องการดำเนินการ ให้พิมพ์รหัสสถานีให้ตรงทุกตัว",
      requiredCode: stationCode,
      inputLabel: "พิมพ์รหัสสถานีเพื่อยืนยัน",
      confirmLabel: "ลบสถานีและข้อมูลทั้งหมด",
      confirmVariant: "danger",
      confirmIcon: "delete",
    });
    if (!secondConfirmed) return;
    await finishStationPurge(profile.id, impact);
  };
  const deleteRound = async (round) => {
    if (!round) return;
    const closed = round.status === "closed";
    const roundLabel = `${round.snapshot?.stationCode || "สถานี"} · รอบการตรวจ ${shortId(round.id)}`;
    const confirmed = await requestConfirm({
      title: closed ? `ลบประวัติรอบการตรวจ ${roundLabel}` : `ลบรอบการตรวจ ${roundLabel}`,
      description: closed
        ? "รอบนี้จะถูกนำออกจากประวัติและรายงานสถานี พร้อม Snapshot และผลตรวจ ไฟล์หลักฐานจะลบเมื่อไม่มีรอบอื่นใช้อยู่ การลบย้อนกลับจากหน้าแอปไม่ได้"
        : "ข้อมูลที่กรอกในรอบนี้จะถูกลบจากระบบ",
      details: closed ? [
        { label: "สถานี", value: round.snapshot?.stationName || round.snapshot?.stationCode || "—" },
        { label: "วันที่ตรวจ", value: formatDate(round.meta?.inspectionDate || round.createdAt) },
        { label: "รหัสรอบ", value: shortId(round.id) },
      ] : undefined,
      requiredCode: closed ? shortId(round.id) : undefined,
      inputLabel: closed ? "พิมพ์รหัสรอบเพื่อยืนยัน" : undefined,
      inputMismatchText: closed ? "รหัสรอบยังไม่ตรง กรุณาตรวจสอบอีกครั้ง" : undefined,
      confirmLabel: closed ? "ลบประวัตินี้" : "ยืนยันลบรอบการตรวจ",
      confirmVariant: "danger",
      confirmIcon: "delete",
    });
    if (!confirmed) return;
    const roundAttachmentIds = await attachmentIdsForRoundAndAliases(state, round);
    const { attachmentIdsForState } = await import("../domain/storage.js");
    const remainingAttachmentIds = new Set(attachmentIdsForState(removeInspectionRoundFromState(state, round)));
    const attachmentsToDelete = roundAttachmentIds.filter((id) => !remainingAttachmentIds.has(id));
    const persisted = await update(
      (current) => removeInspectionRoundFromState(current, round),
      "",
      "inspection-round-delete",
    );
    const persistenceSucceeded = !serverStorage || Number.isFinite(Number(persisted?.version));
    if (persistenceSucceeded) {
      notify(closed ? "ลบประวัติรอบการตรวจแล้ว" : "ลบรอบการตรวจแล้ว");
      await deleteStoredAttachments(attachmentsToDelete).catch(() => notify("ลบรอบการตรวจแล้ว แต่มีบางไฟล์แนบที่ลบจากพื้นที่จัดเก็บไม่สำเร็จ"));
    } else {
      notify("รอบนี้ถูกนำออกจากหน้าจอนี้ แต่การบันทึกส่วนกลางยังไม่สำเร็จ จึงยังไม่ลบไฟล์หลักฐาน");
    }
    if (route.id === round.id) navigate(closed ? "#/history" : "#/inspections");
  };
  const activeRoute = useMemo(() => primaryRouteFor(route.name), [route.name]);
  const backFallbackTarget = getBackFallbackTarget(route);
  const canGoBack = canNavigateBackInApp();
  if (serverStorage && authRequired) return <LocalLoginScreen authConfig={authConfig} onLogin={() => window.location.reload()} />;
  if (serverStorage && currentUser?.mustChangePassword) return <PasswordChangeScreen onComplete={() => window.location.reload()} />;
  if (serverStorage && !remoteLoaded) {
    return <main className="ops-main" aria-live="polite"><div className="ops-empty-state"><strong>กำลังเชื่อมต่อฐานข้อมูลส่วนกลาง</strong><span>กำลังโหลดข้อมูลจาก Checklist API…</span></div></main>;
  }
  if (!serverStorage && !localBootstrapReady) {
    return <main className="ops-main" aria-live="polite"><div className="ops-empty-state" role="status"><span>กำลังเปิดข้อมูลที่บันทึกไว้…</span></div></main>;
  }
  const isReadOnlySurface = route.name === "historyDetail" || route.name === "historyVehicleApi" || route.name === "historyVehicleApiReport"
    || (["checklist", "vehicleApi", "vehicleApiReport"].includes(route.name) && state.inspectionRounds.some((round) => round.id === route.id && round.status === "closed"));
  const pageLayout = {
    stations: "station-directory",
    stationDetail: "station-workspace",
    newStation: "station-setup",
    inspections: "round-queue",
    newInspection: "round-setup",
    checklist: "inspection-workspace",
    vehicleApi: "vehicle-review",
    vehicleApiReport: "vehicle-report",
    history: "history-library",
    historyDetail: "history-detail",
    historyVehicleApi: "history-vehicle-review",
    historyVehicleApiReport: "history-vehicle-report",
    historyRevise: "revision-setup",
    adminUsers: "user-management",
  }[route.name] || "round-queue";
  const isDeepWorkspace = ["inspection-workspace", "vehicle-review", "history-detail", "history-vehicle-review"].includes(pageLayout);
  const isDemoSurface = [UI_DEMO_ROUND_ID, UI_VEHICLE_DEMO_ROUND_ID].includes(route.id) && !roundFor(state, route.id);
  const hasInspectionHeader = pageLayout === "inspection-workspace" && Boolean(roundFor(state, route.id) || isDemoSurface);
  const shellSaveIcon = isReadOnlySurface ? "eye" : isDemoSurface ? "info" : serverSaveState === "failed" ? "alert" : serverSaveState === "saving" ? "refresh" : serverSaveState === "pending" ? "clock" : serverStorage && serverSaveState === "saved" ? "check" : route.name === "newStation" ? "edit" : savedAt ? "check" : "save";
  const shellSaveState = isReadOnlySurface
    ? "อ่านอย่างเดียว"
    : isDemoSurface
      ? "ตัวอย่าง · ไม่บันทึกรอบจริง"
    : serverSaveState === "saving"
      ? "กำลังบันทึกส่วนกลาง"
    : serverSaveState === "pending"
      ? "รอส่งข้อมูลส่วนกลาง"
    : serverSaveState === "failed"
      ? "บันทึกส่วนกลางไม่สำเร็จ"
    : serverStorage && serverSaveState === "saved"
      ? "บันทึกส่วนกลางแล้ว"
    : route.name === "newStation"
      ? "ร่างชั่วคราว · บันทึกเมื่อยืนยัน"
    : route.name === "checklist" && route.id === UI_DEMO_ROUND_ID
      ? "ตัวอย่าง · ไม่บันทึกรอบจริง"
      : savedAt
        ? "บันทึกแล้ว"
        : "พร้อมบันทึกอัตโนมัติ";
  const pageContent = renderPage(route, PAGE_COMPONENTS, {
    referenceData: { state, update, notify, route },
    stations: { state },
    stationDetail: { state, update, notify, requestConfirm, onArchiveStation: archiveStation, onPurgeStation: permanentlyDeleteStation, route },
    newStation: { state, update, requestConfirm },
    inspections: { state, onDelete: deleteRound },
    newInspection: { state, update, notify, route },
    checklist: { state, update, notify, requestConfirm, route, onCloseSuccess: handleCloseSuccess, savedAt, serverSaveState, serverWritable: !serverStorage || serverWritable, navigationControls: <InspectionNavigation />, accountControls: <InspectionAccountMenu user={currentUser} refreshServerState={refreshServerState} saveFailed={serverStorage && serverSaveState === "failed"} /> },
    vehicleApi: { state, update, notify, requestConfirm, route, currentUser, serverSaveError, serverWritable: !serverStorage || serverWritable },
    vehicleApiReport: { state, route },
    history: { state, onDelete: deleteRound },
    historyDetail: { state, update, notify, requestConfirm, route, readOnly: true, savedAt },
    historyVehicleApi: { state, update, notify, route, currentUser },
    historyVehicleApiReport: { state, route },
    historyRevise: { state, update, notify, requestConfirm, route },
    adminUsers: { state },
  });
  const page = <>

    {pageContent}
  </>;
  return <div data-page-layout={pageLayout} onClick={handleShellRouteClick} className={`ops-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""} ${isDeepWorkspace ? "is-deep-workspace" : ""}`.trim()}><a className="ops-skip-link" href="#main-content" onClick={skipToMainContent}>ข้ามไปยังเนื้อหาหลัก</a><aside className="ops-sidebar" aria-label="เมนูหลัก"><div className="ops-brand"><span className="ops-brand-mark"><StationBrandMark /></span><span className="ops-brand-copy"><strong>CHECKLIST</strong><small>Operations Hub</small></span><button ref={sidebarToggleRef} type="button" className="ops-sidebar-toggle" aria-label={sidebarCollapsed ? "ขยายเมนู" : "ย่อเมนู"} aria-expanded={!sidebarCollapsed} aria-controls="primary-navigation" title={sidebarCollapsed ? "ขยายเมนู" : "ย่อเมนู"} onClick={() => setSidebarCollapsed((current) => !current)}><Icon name="arrow" /></button></div><nav id="primary-navigation" className={`ops-main-nav${serverStorage && currentUser?.role === "admin" ? " has-admin-link" : ""}`} aria-label="ส่วนของระบบ">{PRIMARY_ROUTES.map((item) => <a key={item.key} className={activeRoute === item.key ? "is-active" : ""} aria-current={activeRoute === item.key ? "page" : undefined} aria-label={item.label} title={item.label} href={item.hash}><Icon name={item.key === "stations" ? "building" : item.key === "inspections" ? "list" : "archive"} /><span className="ops-nav-label-full" aria-hidden="true">{item.label}</span><span className="ops-nav-label-short" aria-hidden="true">{SIDEBAR_SHORT_LABELS[item.key] || item.label}</span></a>)}{serverStorage && currentUser?.role === "admin" && <a className={activeRoute === "adminUsers" ? "is-active" : ""} aria-current={activeRoute === "adminUsers" ? "page" : undefined} aria-label="จัดการผู้ใช้" title="จัดการผู้ใช้" href="#/admin/users"><Icon name="settings" /><span className="ops-nav-label-full" aria-hidden="true">จัดการผู้ใช้</span><span className="ops-nav-label-short" aria-hidden="true">ผู้ใช้</span></a>}</nav><ThemePreference /></aside><main id="main-content" className="ops-main" tabIndex="-1">{!hasInspectionHeader && <header className="ops-topbar"><div className="ops-topbar-leading">{!["vehicle-review", "history-vehicle-review"].includes(pageLayout) && <button type="button" className="ops-button ops-button-secondary ops-shell-back ops-navigation-icon" aria-label="ย้อนกลับ" title="ย้อนกลับ" onClick={() => navigateBack(backFallbackTarget)} disabled={!canGoBack && !backFallbackTarget}><Icon name="arrow-left" /></button>} {!["vehicle-review", "history-vehicle-review"].includes(pageLayout) && <button type="button" className="ops-button ops-button-secondary ops-shell-forward ops-navigation-icon" aria-label="เดินหน้า" title="เดินหน้า" onClick={navigateForward} disabled={!canNavigateForwardInApp()}><Icon name="arrow-right" /></button>}<div className="ops-topbar-context"><p className="ops-eyebrow">FIELD OPERATIONS / CHECKLIST</p></div></div>{["vehicle-review", "history-vehicle-review"].includes(pageLayout) && <><div id="ops-workspace-header" className="ops-workspace-header" /><div id="ops-workspace-periods" className="ops-workspace-periods" /></>}<div className="ops-topbar-actions">{currentUser && <><span className="ops-current-user">{currentUser.displayName}</span><button type="button" className="ops-button ops-button-secondary ops-logout-button" onClick={async () => { await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" }); window.location.reload(); }}>ออกจากระบบ</button></>}<SaveStatus className={`ops-save-indicator ${isReadOnlySurface ? "is-readonly" : ""} ${serverSaveState === "failed" ? "is-conflict" : ""} ${isDemoSurface ? "is-demo" : ""}`.trim()} label={shellSaveState} icon={shellSaveIcon} />{serverStorage && serverSaveState === "failed" && <button type="button" className="ops-button ops-button-secondary" onClick={refreshServerState}>โหลดข้อมูลล่าสุด</button>}</div></header>}{CONTRACT_CONTEXT_ROUTES.has(route.name) && <Suspense fallback={null}><LazyContractContextBar state={state} route={route} /></Suspense>}<div style={{ display: "contents" }} inert={!hasInspectionHeader && serverStorage && !serverWritable}>{page}</div></main>{purgeRetry ? <div className="ops-toast ops-toast-retry" role="alert" aria-live="assertive"><Icon name="alert" /><span>{purgeRetry.message}</span><Button onClick={retryStationPurge} variant="secondary" icon="refresh" disabled={purgeRetry.busy}>{purgeRetry.busy ? "กำลังลองใหม่..." : "ลองลบไฟล์แนบอีกครั้ง"}</Button></div> : toast && <div className="ops-toast" role="status" aria-live="polite"><Icon name="check" />{toast}</div>}<ConfirmDialog request={confirmRequest} onResolve={resolveConfirm} />{shouldShowCloseSuccess(closeSuccessRoundId, route) && <CloseSuccessDialog onClose={dismissCloseSuccess} />}</div>;
}

export default App;
