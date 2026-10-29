import { flushSync } from "react-dom";
import VehicleConnectionDialog from "../vehicle-review/VehicleConnectionDialog.jsx";
import { replaceRoute } from "../navigation.js";
import { createVehicleSearchConfig } from '../../domain/vehicle-search-config.js';
import { adoptRoundVehicleConnection, getRoundVehicleSearchConfig, hasVehicleConnectionData } from '../../domain/round-vehicle-connection.js';
import { createUiVehicleSystemsDemoRound } from "../../domain/demo-fixture.js";
import { isSystemVehicleRound, projectVehicleRound, setSystemVehicleSearch, getVehicleSystemLabel, updateSystemVehicleRowReview, getVehicleSystemConfig, getInstalledVehicleSystems } from "../../domain/vehicle-review-systems.js";
import { archiveVehicleEvidence, mergeVehicleEvidenceArchives, vehicleEvidenceArchivePendingCount, vehicleEvidenceTasksForReview, vehicleEvidenceWebpCount } from "../../domain/vehicle-evidence-images.js";

function vehicleArchiveSignature(round, tasks) {
  if (!tasks.length) return "";
  let hash = 2166136261;
  const text = tasks.map(task => `${task.row.id}:${task.row.vehicleReviewScope || ""}:${task.field}:${task.src}`).join("\n");
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${round.id}:${tasks[0]?.row.systemKey || "legacy"}:${tasks[0]?.row.vehicleReviewContext || "legacy"}:${tasks[0]?.row.vehicleReviewScope || "all"}:${tasks[0]?.row.id}:${tasks.length}:${(hash >>> 0).toString(36)}`;
}

const VEHICLE_EVIDENCE_ARCHIVE_SAVE_IDLE_MS = 1800;
const VEHICLE_EVIDENCE_ARCHIVE_WORK_IDLE_MS = 4000;

function waitForNextVehicleImages(previousRowId, nextRowId, isCurrent, timeoutMs = 30000) {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve(false);
  if (!nextRowId) return Promise.resolve(true);
  const startedAt = Date.now();
  return new Promise(resolve => {
    const check = () => {
      if (!isCurrent()) return resolve(false);
      const focus = document.querySelector("[data-vehicle-review-focus]");
      const focusedRowId = focus?.getAttribute("data-vehicle-review-focus") || "";
      if (focusedRowId === nextRowId && focusedRowId !== previousRowId) {
        const images = [...document.querySelectorAll(".ops-vehicle-focus-evidence-stack img")];
        if (!images.length || images.every(image => image.complete && image.naturalWidth > 0)) return resolve(true);
      }
      if (Date.now() - startedAt >= timeoutMs) return resolve(false);
      window.setTimeout(check, 50);
    };
    check();
  });
}

function hasVehicleEvidenceArchiveEntries(archive) {
  return Object.values(archive || {}).some(fields => Object.keys(fields || {}).length > 0);
}

function mergeVehicleEvidenceArchiveIntoState(state, roundId, archive) {
  if (!roundId || !hasVehicleEvidenceArchiveEntries(archive)) return state;
  return {
    ...state,
    inspectionRounds: (state.inspectionRounds || []).map(entry => entry.id === roundId && entry.status !== "closed"
      ? { ...entry, vehicleEvidenceArchive: mergeVehicleEvidenceArchives(entry.vehicleEvidenceArchive, archive, entry) }
      : entry),
  };
}

function removePersistedVehicleEvidenceArchiveEntries(pending, persisted) {
  const remaining = { ...(pending || {}) };
  for (const [rowKey, fields] of Object.entries(persisted || {})) {
    const currentFields = { ...(remaining[rowKey] || {}) };
    for (const [field, attachment] of Object.entries(fields || {})) {
      if (currentFields[field]?.id === attachment?.id) delete currentFields[field];
    }
    if (Object.keys(currentFields).length) remaining[rowKey] = currentFields;
    else delete remaining[rowKey];
  }
  return remaining;
}

function hasPendingVehicleEvidenceArchive(pendingByRound, roundId) {
  return hasVehicleEvidenceArchiveEntries(pendingByRound?.[roundId]);
}

export function createVehicleApiReviewPage(runtime) {
  const { Button, EmptyState, EvidenceField, Icon, MAX_ATTACHMENT_BYTES, PageHeader, StatusBadge, UI_VEHICLE_DEMO_ROUND_ID, VEHICLE_API_REVIEW_VERSION, VEHICLE_REVIEW_CONTEXT_OPTIONS, VEHICLE_REVIEW_SCOPE_VERSION, VehicleFocusReviewPanel, VehicleSearchReviewPanelLegacy, buildInspectionSections, createId, createUiVehicleDemoRound, deleteStoredAttachment, getStoredAttachment, getVehicleReviewContext, getVehicleReviewContextByKey, getVehicleReviewScopeState, isVehicleReviewScopeState, normalizeVehicleReviewState, normalizeVehicleSearchState, roundFor, saveStoredAttachment, updateVehicleSearchScope, useCallback, useEffect, useMemo, useRef, useState, vehicleApiHref } = runtime;
  return function VehicleApiReviewPage({ state, update: persistUpdate, notify, requestConfirm, route, currentUser, serverSaveError = null, serverWritable = true }) {
    const storedRound = roundFor(state, route.id);
    const isDemoRoute = !storedRound && route.name === "vehicleApi" && route.id === UI_VEHICLE_DEMO_ROUND_ID;
    const [demoRound, setDemoRound] = useState(() => isDemoRoute ? route.query?.demoSystems === "1" ? createUiVehicleSystemsDemoRound(route.query?.demoFormat === "IMPS" ? "IMPS" : "SC") : createUiVehicleDemoRound() : null);
    const [vehicleReviewStatus, setVehicleReviewStatus] = useState(null);
    const [archiveProgress, setArchiveProgress] = useState(null);
    const [connectionBusy, setConnectionBusy] = useState(false);
    const [connectionOpen, setConnectionOpen] = useState(false);
    const closeConnection = useCallback(() => setConnectionOpen(false), []);
    const archiveJobsRef = useRef(new Set());
    const lastEvidenceArchiveJobRef = useRef(null);
    const queuedEvidenceArchiveJobsRef = useRef([]);
    const failedEvidenceArchiveJobsRef = useRef([]);
    const archiveDrainTimerRef = useRef(null);
    const archiveDrainGenerationRef = useRef(0);
    const archiveDrainInFlightRef = useRef(new Set());
    const archiveDrainRef = useRef(null);
    const pendingVehicleEvidenceArchiveRef = useRef({});
    const archiveFlushTimerRef = useRef(null);
    const archiveFlushRef = useRef(null);
    const archiveFlushInFlightRef = useRef(new Map());
    const sourceRound = storedRound || demoRound;
    const systems = isSystemVehicleRound(sourceRound) ? sourceRound.snapshot.vehicleReviewSystems : [];
    const systemKey = systems.some(system => system.key === route.query?.system) ? route.query.system : route.query?.system ? "" : systems[0]?.key;
    const round = useMemo(() => sourceRound && (systems.length ? projectVehicleRound(sourceRound, systemKey, route.context === "classification" ? "classification" : "plate") : sourceRound), [sourceRound, systemKey, route.context]);
    const archiveRoundRef = useRef(sourceRound);
    archiveRoundRef.current = sourceRound;
    const hasStoredRound = Boolean(storedRound);
    const context = getVehicleReviewContextByKey(route.context) || VEHICLE_REVIEW_CONTEXT_OPTIONS[0];
    const archiveViewRef = useRef({ roundId: sourceRound?.id, systemKey, contextKey: context.key });
    archiveViewRef.current = { roundId: sourceRound?.id, systemKey, contextKey: context.key };
    const updateArchiveProgressForCurrentView = useCallback((roundId, progressSystemKey, contextKey, recipe) => {
      const matchesView = () => {
        const active = archiveViewRef.current;
        return active.roundId === roundId && active.systemKey === progressSystemKey && active.contextKey === contextKey;
      };
      if (!matchesView()) return;
      setArchiveProgress(current => matchesView()
        ? (typeof recipe === "function" ? recipe(current) : recipe)
        : current);
    }, []);
    const updateArchiveProgressForRound = useCallback((roundId, recipe) => {
      const active = archiveViewRef.current;
      if (active.roundId !== roundId) return;
      updateArchiveProgressForCurrentView(roundId, active.systemKey, active.contextKey, current => {
        if (current?.roundId !== roundId || current.systemKey !== active.systemKey || current.context !== active.contextKey) return current;
        return recipe(current);
      });
    }, [updateArchiveProgressForCurrentView]);
    useEffect(() => { setArchiveProgress(null); }, [sourceRound?.id, systemKey, context.key]);
    const readOnly = route.name === "historyVehicleApi" || round?.status === "closed";
    const station = state.stationProfiles?.find(profile => profile.id === sourceRound?.stationId);
    const currentConnection = getRoundVehicleSearchConfig(sourceRound, systemKey || '');
    const installedSystems = getInstalledVehicleSystems(station);
    const selectedSystem = installedSystems.find(system => system.key === systemKey);
    const latestConnection = systemKey
      ? selectedSystem ? getVehicleSystemConfig(station, selectedSystem, installedSystems) : null
      : station ? createVehicleSearchConfig(station.vehicleSearchConfig, '') : null;
    const connectionDataset = systemKey ? sourceRound?.vehicleSearch?.systems?.[systemKey] : sourceRound?.vehicleSearch;
    const connectionHasData = hasVehicleConnectionData(connectionDataset);
    const connectionReady = Boolean(latestConnection?.baseUrl && (latestConnection.apiProfile !== 'imps-v2' || latestConnection.searchUrl));
    const connectionChanged = connectionReady && ['baseUrl', 'searchUrl', 'apiProfile', 'connectionMode', 'stationId', 'stationName'].some(key => (currentConnection[key] || '') !== (latestConnection[key] || ''));
    const adoptConnection = async () => {
      if (connectionBusy || !connectionChanged || connectionHasData || readOnly || !serverWritable || !requestConfirm) return;
      setConnectionBusy(true);
      try {
        const config = { ...latestConnection };
        const confirmed = await requestConfirm({ title: `รับค่า API จากทะเบียนสถานี${systemKey ? ` · ${getVehicleSystemLabel(systemKey)}` : ''}`,
          description: 'ระบบจะบันทึกค่าเชื่อมต่อสำหรับรอบนี้ ผลตรวจและหลักฐานเดิมยังอยู่ครบ แล้วจึงกดดึงข้อมูลรถได้',
          details: [{ label: 'ค่าเดิม', value: currentConnection.searchUrl || currentConnection.baseUrl || 'ยังไม่มี API' },
            { label: 'ค่าใหม่', value: config.searchUrl || config.baseUrl }],
          confirmLabel: 'รับค่า API สำหรับรอบนี้', confirmVariant: 'primary', confirmIcon: 'refresh' });
        if (!confirmed) return;
        const saved = await persistUpdate(current => ({ ...current,
          inspectionRounds: current.inspectionRounds.map(entry => entry.id === sourceRound.id
            ? adoptRoundVehicleConnection(entry, config, { systemKey: systemKey || '', userLabel: currentUser?.displayName || currentUser?.name || currentUser?.username || '' })
            : entry),
        }));
        if (saved === null) throw new Error('บันทึกค่า API ไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุดแล้วลองอีกครั้ง');
        notify('บันทึกค่า API สำหรับรอบนี้แล้ว · กดดึงข้อมูลรถเพื่อเริ่มตรวจได้');
      } catch (error) { notify(error.message || 'รับค่า API ไม่สำเร็จ'); }
      finally { setConnectionBusy(false); }
    };
    const sections = useMemo(() => round ? buildInspectionSections(round.snapshot, round.templateVersion || round.snapshot?.templateVersion) : [], [round]);
    const item = sections.flatMap((section) => section.items).find((candidate) => getVehicleReviewContext(candidate)?.key === context.key && (!systemKey || candidate.vehicleReviewSystemKey === systemKey)) || null;
    const itemValue = item ? (round?.inspectionItems?.[item.id] || { status: "pending", evidence: {}, attachment: null }) : { status: "pending", evidence: {}, attachment: null };
    const scheduleArchiveFlush = useCallback((roundId) => {
      if (!roundId || !hasPendingVehicleEvidenceArchive(pendingVehicleEvidenceArchiveRef.current, roundId)) return;
      window.clearTimeout(archiveFlushTimerRef.current);
      archiveFlushTimerRef.current = window.setTimeout(() => {
        void archiveFlushRef.current?.(roundId);
      }, VEHICLE_EVIDENCE_ARCHIVE_SAVE_IDLE_MS);
    }, []);
    const scheduleArchiveDrain = useCallback((roundId, generation, delay = VEHICLE_EVIDENCE_ARCHIVE_WORK_IDLE_MS) => {
      if (!roundId || generation !== archiveDrainGenerationRef.current || !queuedEvidenceArchiveJobsRef.current.some(job => job.roundId === roundId)) return;
      window.clearTimeout(archiveDrainTimerRef.current);
      archiveDrainTimerRef.current = window.setTimeout(() => {
        if (generation !== archiveDrainGenerationRef.current) return;
        void archiveDrainRef.current?.(roundId);
      }, delay);
    }, []);
    const flushPendingVehicleEvidenceArchive = useCallback(async (roundId) => {
      if (!roundId || !hasPendingVehicleEvidenceArchive(pendingVehicleEvidenceArchiveRef.current, roundId)) return null;
      const inFlight = archiveFlushInFlightRef.current.get(roundId);
      if (inFlight) return inFlight;
      window.clearTimeout(archiveFlushTimerRef.current);
      const archiveSnapshot = pendingVehicleEvidenceArchiveRef.current[roundId];
      const operation = (async () => {
        const saved = await persistUpdate(current => mergeVehicleEvidenceArchiveIntoState(current, roundId, archiveSnapshot), "", "vehicle-evidence-archive");
        if (saved === null) {
          updateArchiveProgressForRound(roundId, current => ({ ...current, state: "partial", archiveSaveFailed: true }));
          return null;
        }
        const remaining = removePersistedVehicleEvidenceArchiveEntries(pendingVehicleEvidenceArchiveRef.current[roundId], archiveSnapshot);
        pendingVehicleEvidenceArchiveRef.current = { ...pendingVehicleEvidenceArchiveRef.current, [roundId]: remaining };
        if (!Object.keys(remaining).length) {
          updateArchiveProgressForRound(roundId, current => {
            if (current.complete || current.archiveSaveFailed) return { ...current, state: "ready", archiveSaveFailed: false };
            return current;
          });
        } else scheduleArchiveFlush(roundId);
        return saved;
      })();
      archiveFlushInFlightRef.current.set(roundId, operation);
      try { return await operation; }
      finally { if (archiveFlushInFlightRef.current.get(roundId) === operation) archiveFlushInFlightRef.current.delete(roundId); }
    }, [persistUpdate, scheduleArchiveFlush, updateArchiveProgressForRound]);
    archiveFlushRef.current = flushPendingVehicleEvidenceArchive;
    const drainQueuedVehicleEvidenceArchive = useCallback(async (roundId) => {
      if (!roundId || archiveDrainInFlightRef.current.has(roundId)) return;
      const queue = queuedEvidenceArchiveJobsRef.current;
      const first = queue.find(job => job.roundId === roundId);
      if (!first) return;
      const batch = queue.filter(job => job.roundId === roundId && job.systemKey === first.systemKey && job.contextKey === first.contextKey);
      queuedEvidenceArchiveJobsRef.current = queue.filter(job => !batch.includes(job));
      archiveDrainInFlightRef.current.add(roundId);
      const jobRoundSource = batch[batch.length - 1]?.jobRound;
      const stagedArchive = pendingVehicleEvidenceArchiveRef.current[roundId];
      const jobRound = jobRoundSource && hasVehicleEvidenceArchiveEntries(stagedArchive)
        ? { ...jobRoundSource, vehicleEvidenceArchive: mergeVehicleEvidenceArchives(jobRoundSource.vehicleEvidenceArchive, stagedArchive, jobRoundSource) }
        : jobRoundSource;
      const uniqueTasks = [...new Map(batch.flatMap(job => job.tasks).map(task => [
        `${task.row.systemKey || ""}:${task.row.vehicleReviewContext || ""}:${task.row.vehicleReviewScope || ""}:${task.row.id}:${task.field}`,
        task,
      ])).values()];
      const tasks = jobRound ? uniqueTasks.filter(task => vehicleEvidenceArchivePendingCount(jobRound, [task]) > 0) : [];
      const systemKeyForBatch = first.systemKey;
      const contextKeyForBatch = first.contextKey;
      const signatures = batch.map(job => job.signature);
      const signature = jobRound && tasks.length ? vehicleArchiveSignature(jobRound, tasks) : signatures[0] || "";
      const plateNumber = batch.length > 1 ? `${batch.length} คัน` : (tasks[0]?.row?.plateNumber || "คันนี้");
      let partialArchive = jobRound?.vehicleEvidenceArchive || {};
      let lastProgressAt = 0;
      if (!jobRound || !tasks.length) {
        archiveDrainInFlightRef.current.delete(roundId);
        if (queuedEvidenceArchiveJobsRef.current.some(job => job.roundId === roundId)) scheduleArchiveDrain(roundId, archiveDrainGenerationRef.current);
        return;
      }
      updateArchiveProgressForCurrentView(roundId, systemKeyForBatch, contextKeyForBatch, { roundId, systemKey: systemKeyForBatch, signature, done: 0, total: tasks.length, state: "running", context: contextKeyForBatch, plateNumber });
      try {
        const archive = await archiveVehicleEvidence(jobRound, {
          tasks,
          save: saveStoredAttachment,
          loadStored: getStoredAttachment,
          createId,
          onProgress(done, total, nextArchive) {
            partialArchive = nextArchive;
            const now = Date.now();
            if (done === total || now - lastProgressAt > 500) {
              lastProgressAt = now;
              updateArchiveProgressForCurrentView(roundId, systemKeyForBatch, contextKeyForBatch, { roundId, systemKey: systemKeyForBatch, signature, done, total, state: "running", context: contextKeyForBatch, plateNumber });
            }
          },
        });
        pendingVehicleEvidenceArchiveRef.current = {
          ...pendingVehicleEvidenceArchiveRef.current,
          [roundId]: mergeVehicleEvidenceArchives(pendingVehicleEvidenceArchiveRef.current[roundId], archive, jobRound),
        };
        const complete = vehicleEvidenceArchivePendingCount({ ...jobRound, vehicleEvidenceArchive: archive }, tasks) === 0;
        updateArchiveProgressForCurrentView(roundId, systemKeyForBatch, contextKeyForBatch, { roundId, systemKey: systemKeyForBatch, signature, done: tasks.length, total: tasks.length, webpCount: vehicleEvidenceWebpCount(archive), complete, state: "saving", context: contextKeyForBatch, plateNumber });
        scheduleArchiveFlush(roundId);
      } catch (error) {
        partialArchive = error?.partialArchive || partialArchive;
        if (hasVehicleEvidenceArchiveEntries(partialArchive)) {
          pendingVehicleEvidenceArchiveRef.current = {
            ...pendingVehicleEvidenceArchiveRef.current,
            [roundId]: mergeVehicleEvidenceArchives(pendingVehicleEvidenceArchiveRef.current[roundId], partialArchive, jobRound),
          };
          scheduleArchiveFlush(roundId);
        }
        for (const queuedJob of batch) archiveJobsRef.current.delete(queuedJob.signature);
        failedEvidenceArchiveJobsRef.current = [...failedEvidenceArchiveJobsRef.current, ...batch];
        const done = tasks.length - vehicleEvidenceArchivePendingCount({ ...jobRound, vehicleEvidenceArchive: partialArchive }, tasks);
        updateArchiveProgressForCurrentView(roundId, systemKeyForBatch, contextKeyForBatch, { roundId, systemKey: systemKeyForBatch, signature, done, total: tasks.length, complete: false, state: "partial", context: contextKeyForBatch, plateNumber, message: error?.message || "มีภาพบางส่วนที่ยังเตรียมไม่สำเร็จ" });
      } finally {
        archiveDrainInFlightRef.current.delete(roundId);
        if (queuedEvidenceArchiveJobsRef.current.some(job => job.roundId === roundId)) scheduleArchiveDrain(roundId, archiveDrainGenerationRef.current);
      }
    }, [createId, getStoredAttachment, saveStoredAttachment, scheduleArchiveFlush, scheduleArchiveDrain, updateArchiveProgressForCurrentView]);
    archiveDrainRef.current = drainQueuedVehicleEvidenceArchive;
    const updateRound = useCallback((recipe, message = "", { includePendingArchive = true } = {}) => {
      if (readOnly) return;
      if (isDemoRoute) {
        setDemoRound((current) => {
          if (!current) return current;
          const demoState = { inspectionRounds: [current], activeRoundId: current.id, activeStationId: current.stationId };
          const nextState = typeof recipe === "function" ? recipe(demoState) : recipe;
          return nextState?.inspectionRounds?.find((entry) => entry.id === current.id) || current;
        });
        if (message) notify(message);
        return Promise.resolve({ demo: true });
      }
      const roundId = sourceRound?.id;
      const pendingArchive = includePendingArchive && roundId ? pendingVehicleEvidenceArchiveRef.current[roundId] : null;
      if (hasVehicleEvidenceArchiveEntries(pendingArchive)) window.clearTimeout(archiveFlushTimerRef.current);
      if (!includePendingArchive && hasPendingVehicleEvidenceArchive(pendingVehicleEvidenceArchiveRef.current, roundId)) window.clearTimeout(archiveFlushTimerRef.current);
      const saved = persistUpdate(current => {
        const next = typeof recipe === "function" ? recipe(current) : recipe;
        return includePendingArchive ? mergeVehicleEvidenceArchiveIntoState(next, roundId, pendingArchive) : next;
      }, message);
      return Promise.resolve(saved).then(result => {
        if (!includePendingArchive) {
          if (hasPendingVehicleEvidenceArchive(pendingVehicleEvidenceArchiveRef.current, roundId)) scheduleArchiveFlush(roundId);
          return result;
        }
        if (result === null || !hasVehicleEvidenceArchiveEntries(pendingArchive)) return result;
        const remaining = removePersistedVehicleEvidenceArchiveEntries(pendingVehicleEvidenceArchiveRef.current[roundId], pendingArchive);
        pendingVehicleEvidenceArchiveRef.current = { ...pendingVehicleEvidenceArchiveRef.current, [roundId]: remaining };
        if (!Object.keys(remaining).length) {
          setArchiveProgress(current => {
            if (current?.roundId !== roundId) return current;
            if (current.complete || current.archiveSaveFailed) return { ...current, state: "ready", archiveSaveFailed: false };
            return current;
          });
        } else scheduleArchiveFlush(roundId);
        return result;
      });
    }, [isDemoRoute, notify, persistUpdate, readOnly, scheduleArchiveFlush, sourceRound?.id]);
    const updateItem = useCallback((patch) => {
      if (!round || !item || readOnly) return;
      return updateRound((current) => ({
        ...current,
        activeRoundId: round.id,
        activeStationId: round.stationId,
        inspectionRounds: current.inspectionRounds.map((entry) => entry.id === round.id
          ? { ...entry, updatedAt: new Date().toISOString(), inspectionItems: { ...entry.inspectionItems, [item.id]: { ...(entry.inspectionItems[item.id] || {}), ...patch } } }
          : entry),
      }));
    }, [item, readOnly, round, updateRound]);
    const updateVehicleSearch = useCallback(async (nextVehicleSearch) => {
      if (!round || readOnly) return;
      try { return await updateRound((current) => ({
        ...current,
        activeRoundId: round.id,
        activeStationId: round.stationId,
        inspectionRounds: current.inspectionRounds.map(entry => {
          if (entry.id !== round.id) return entry;
          if (isSystemVehicleRound(entry)) return { ...setSystemVehicleSearch(entry, systemKey, context.key, nextVehicleSearch), updatedAt: new Date().toISOString() };
          const options = { ...getRoundVehicleSearchConfig(entry), stationProfileId: entry.stationId };
          return { ...entry, updatedAt: new Date().toISOString(), vehicleSearch: isVehicleReviewScopeState(nextVehicleSearch)
            ? normalizeVehicleReviewState(nextVehicleSearch, {}, options) : normalizeVehicleSearchState(nextVehicleSearch, {}, options) };
        }),
      })); } catch { return null; }
    }, [readOnly, round, updateRound, systemKey, context.key]);
    const updateVehicleRowReview = useCallback(async (decision) => {
      if (!round || readOnly || decision.dimension !== context.key) return null;
      try {
        return await updateRound(current => ({ ...current, activeRoundId: round.id, activeStationId: round.stationId,
          inspectionRounds: current.inspectionRounds.map(entry => entry.id === round.id
            ? { ...updateSystemVehicleRowReview(entry, { ...decision, systemKey, context: context.key }), updatedAt: new Date().toISOString() }
            : entry),
        }), "", { includePendingArchive: false });
      } catch (error) { notify(error.message); return null; }
    }, [round, readOnly, context.key, systemKey, updateRound, notify]);
    const archiveSavedVehicleEvidence = useCallback(({ rowId, context: reviewContext, scopeKey, deferUntilNextImages = false, nextRowId = "" }) => {
      const jobRound = archiveRoundRef.current;
      const roundId = jobRound?.id;
      if (!jobRound || !hasStoredRound || isDemoRoute || readOnly) return;
      const reviewContextKey = typeof reviewContext === "string" ? reviewContext : reviewContext?.key;
      if (!reviewContextKey) return;
      const stagedArchive = roundId ? pendingVehicleEvidenceArchiveRef.current[roundId] : null;
      const roundWithStagedArchive = hasVehicleEvidenceArchiveEntries(stagedArchive)
        ? { ...jobRound, vehicleEvidenceArchive: mergeVehicleEvidenceArchives(jobRound.vehicleEvidenceArchive, stagedArchive, jobRound) }
        : jobRound;
      const tasks = vehicleEvidenceTasksForReview(roundWithStagedArchive, { systemKey, context: reviewContextKey, scopeKey, rowId });
      const signature = vehicleArchiveSignature(roundWithStagedArchive, tasks);
      if (!signature || archiveJobsRef.current.has(signature) || !vehicleEvidenceArchivePendingCount(roundWithStagedArchive, tasks)) return;
      archiveJobsRef.current.add(signature);
      const job = { roundId, systemKey, contextKey: reviewContextKey, rowId, scopeKey, tasks, signature, jobRound };
      queuedEvidenceArchiveJobsRef.current = [...queuedEvidenceArchiveJobsRef.current, job];
      lastEvidenceArchiveJobRef.current = { rowId, context: reviewContextKey, scopeKey, deferUntilNextImages, nextRowId };
      updateArchiveProgressForCurrentView(roundId, systemKey, reviewContextKey, {
        roundId, systemKey, signature, done: 0, total: tasks.length, state: "queued", context: reviewContextKey,
        plateNumber: tasks[0]?.row?.plateNumber || "คันนี้",
      });
      const generation = ++archiveDrainGenerationRef.current;
      window.clearTimeout(archiveDrainTimerRef.current);
      const scheduleAfterVisibleImages = () => scheduleArchiveDrain(roundId, generation);
      if (deferUntilNextImages && nextRowId) {
        void waitForNextVehicleImages(rowId, nextRowId, () => generation === archiveDrainGenerationRef.current)
          .then(scheduleAfterVisibleImages);
      } else scheduleAfterVisibleImages();
    }, [hasStoredRound, isDemoRoute, readOnly, systemKey, scheduleArchiveDrain, updateArchiveProgressForCurrentView]);
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
        await saveStoredAttachment(attachmentId, file, { stationId: round.stationId, roundId: round.id, kind: 'inspection/originals' });
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
    if (!round) return <section className="ops-page"><PageHeader eyebrow="NOT FOUND" title="ไม่พบรอบการตรวจ" description="ลิงก์นี้อาจถูกลบหรือข้อมูลยังไม่ได้ปรับรูปแบบ" actions={<Button href="#/inspections" variant="primary" icon="arrow">กลับหน้ารอบการตรวจ</Button>} /><section className="ops-panel"><EmptyState icon="alert" title="ไม่สามารถเปิดหน้าตรวจนี้ได้">เลือกอีกรอบจากหน้ารอบการตรวจหรือประวัติ</EmptyState></section></section>;
    if (isSystemVehicleRound(sourceRound) && (!systems.length || !systemKey)) return <section className="ops-page"><PageHeader title="ไม่มีงานตรวจรถของระบบนี้" /><EmptyState title={systems.length ? "ไม่พบระบบที่เลือกในรอบนี้" : "ไม่มีระบบตรวจรถที่ติดตั้ง"}>เปิดรายการตรวจจากรอบการตรวจเพื่อเลือกระบบที่ติดตั้ง</EmptyState></section>;
    const backToHistory = route.name === "historyVehicleApi" || round.status === "closed";
    const backHref = backToHistory ? `#/history/${encodeURIComponent(round.id)}` : `#/inspections/${encodeURIComponent(round.id)}`;
    const reportHref = `#/${backToHistory ? "history" : "inspections"}/${encodeURIComponent(round.id)}/vehicle-api-report/${encodeURIComponent(context.key)}?${new URLSearchParams({ ...(systemKey ? { system: systemKey } : {}), ...(route.query?.scope ? { scope: route.query.scope } : {}) })}`;
    const apiOnlyReview = round.snapshot?.vehicleReviewVersion === VEHICLE_API_REVIEW_VERSION;
    const reviewContextLabel = apiOnlyReview
      ? (context.key === "plate" ? "ตรวจผลอ่านป้ายทะเบียนจาก API" : "ตรวจผลคัดแยกประเภทรถจาก API")
      : context.label;
    const archiveContextLabel = archiveProgress?.context === "classification" ? "ภาพรถ" : "ภาพป้ายทะเบียน";
    const archiveStatusLabel = archiveProgress?.state === "running"
      ? `กำลังเก็บ${archiveContextLabel} ${archiveProgress.plateNumber} ${archiveProgress.done}/${archiveProgress.total}`
      : archiveProgress?.state === "saving"
        ? `กำลังบันทึกข้อมูล${archiveContextLabel} ${archiveProgress.plateNumber}`
      : archiveProgress?.state === "ready"
        ? `เก็บ${archiveContextLabel} ${archiveProgress.plateNumber} แล้ว`
        : archiveProgress?.state === "partial"
          ? archiveProgress.archiveSaveFailed
            ? `บันทึกข้อมูล${archiveContextLabel} ${archiveProgress.plateNumber} ไม่สำเร็จ`
            : `เก็บ${archiveContextLabel} ${archiveProgress.plateNumber} ไม่ครบ ${archiveProgress.done}/${archiveProgress.total}`
          : "";
    const retryEvidenceArchive = () => {
      if (archiveProgress?.archiveSaveFailed && archiveProgress.roundId) {
        setArchiveProgress(current => current?.roundId === archiveProgress.roundId ? { ...current, state: "saving" } : current);
        void flushPendingVehicleEvidenceArchive(archiveProgress.roundId);
      } else if (failedEvidenceArchiveJobsRef.current.length) {
        const failedJobs = failedEvidenceArchiveJobsRef.current.splice(0);
        for (const job of failedJobs) archiveJobsRef.current.add(job.signature);
        queuedEvidenceArchiveJobsRef.current = [...queuedEvidenceArchiveJobsRef.current, ...failedJobs];
        const generation = ++archiveDrainGenerationRef.current;
        scheduleArchiveDrain(failedJobs[0]?.roundId, generation, 0);
      } else if (lastEvidenceArchiveJobRef.current) archiveSavedVehicleEvidence(lastEvidenceArchiveJobRef.current);
    };
    const workbenchActions = (sessionAction = null) => <div className="ops-vehicle-review-header-actions">{systems.length > 1 && <nav className="ops-vehicle-review-context-tabs" aria-label="เลือกระบบที่ตรวจ">{systems.map(system => <a key={system.key} className={system.key === systemKey ? "is-active" : ""} aria-current={system.key === systemKey ? "page" : undefined} href={`${vehicleApiHref(round, context.key, { history: readOnly, systemKey: system.key })}${route.query?.scope ? `&scope=${encodeURIComponent(route.query.scope)}` : ""}`}>{getVehicleSystemLabel(system)}</a>)}</nav>}{isDemoRoute && <span className="ops-vehicle-demo-badge" role="status">ตัวอย่าง · ไม่บันทึกรอบจริง</span>}{archiveStatusLabel && (archiveProgress?.state === "partial" ? <button type="button" className="ops-vehicle-archive-progress" onClick={retryEvidenceArchive} aria-live="polite">{archiveStatusLabel} · ลองอีกครั้ง</button> : <span className="ops-vehicle-archive-progress" role="status" aria-live="polite">{archiveStatusLabel}</span>)}{apiOnlyReview && vehicleReviewStatus?.label === "เปลี่ยนช่วงเวลาแล้ว · ต้องดึงข้อมูลใหม่" && <StatusBadge status={vehicleReviewStatus.tone}>{vehicleReviewStatus.label}</StatusBadge>}<div className="ops-vehicle-review-setup-actions" role="group" aria-label="รายละเอียดและการเชื่อมต่อ">{sessionAction}{!isDemoRoute && <Button variant="secondary" onClick={() => setConnectionOpen(true)} aria-haspopup="dialog">การเชื่อมต่อ API</Button>}</div><div className="ops-vehicle-review-navigation-actions" role="group" aria-label="รายงานและรายการตรวจ">{!isDemoRoute && <Button href={reportHref} variant="secondary">รายงานผล</Button>}<Button href={backHref} variant="secondary" icon="arrow">กลับรายการตรวจ</Button></div></div>;
    return <section className={`ops-page ops-vehicle-api-page is-context-${context.key}`}>
      <PageHeader inShell eyebrow={context.checklistNumber} title={`${context.key === "plate" ? "ตรวจป้ายทะเบียน" : "คัดแยกประเภทรถ"}${round.snapshot?.vehicleReviewSystemLabel ? ` · ${round.snapshot.vehicleReviewSystemLabel}` : ""}`} />
      {isSystemVehicleRound(sourceRound) && !systems.length && <EmptyState title="ไม่มีระบบตรวจรถที่ติดตั้ง">สถานีนี้ไม่มีงานตรวจรถจาก API</EmptyState>}
      {backToHistory && <div className="ops-readonly-banner"><Icon name="archive" /><span>รอบการตรวจนี้ปิดแล้ว · ข้อมูลและผลตรวจจาก Snapshot เป็นแบบอ่านอย่างเดียว</span></div>}
      {connectionOpen && <VehicleConnectionDialog current={currentConnection} latest={latestConnection} readOnly={readOnly} changed={connectionChanged} hasData={connectionHasData} ready={connectionReady} writable={serverWritable} busy={connectionBusy} adopted={Boolean(sourceRound.vehicleConnectionUpdates?.[systemKey || 'legacy'])} stationHref={`#/stations/${encodeURIComponent(sourceRound.stationId)}`} onClose={closeConnection} onAdopt={() => { flushSync(() => setConnectionOpen(false)); adoptConnection(); }} />}
      {apiOnlyReview && (!isSystemVehicleRound(sourceRound) || systems.length > 0) ? <VehicleFocusReviewPanel key={`${systemKey || "legacy"}:${context.key}`} workbenchActions={workbenchActions} round={round} value={round.vehicleSearch} onScopeChange={systemKey ? scope => replaceRoute(`${vehicleApiHref(round, context.key, { history: backToHistory, systemKey })}&scope=${scope}`) : undefined} scopeKey={route.query?.scope || ""} focusRowId={route.query?.rowId || ""} focusReviewKind={route.query?.reviewKind || ""} readOnly={readOnly} onChange={updateVehicleSearch} onRowReview={isSystemVehicleRound(sourceRound) ? updateVehicleRowReview : undefined} onEvidenceRowSaved={archiveSavedVehicleEvidence} notify={notify} currentUser={currentUser} contextKey={context.key} allowLiveSearch={!isDemoRoute} onReviewStatusChange={setVehicleReviewStatus} evidenceItem={item} evidenceItemValue={itemValue} onEvidenceAttachmentChange={handleAttachmentChange} onEvidenceAttachmentRemove={handleAttachmentRemove} serverSaveError={serverSaveError} serverWritable={serverWritable} /> : <section className="ops-vehicle-api-page-grid">
        <div className="ops-vehicle-workbench-toolbar">{workbenchActions()}</div>
        <section className="ops-panel ops-vehicle-document-panel" aria-labelledby="vehicle-document-evidence-title">
          <div className="ops-panel-heading"><div><p className="ops-eyebrow">DOCUMENT / EVIDENCE</p><h2 id="vehicle-document-evidence-title">{context.label}</h2><p>แนบเอกสารหรือหลักฐานของบริบทนี้แยกจากผลตรวจรายคัน</p></div><StatusBadge status={itemValue.evidence?.[item?.evidenceSlots?.[0]?.id]?.attachment ? "normal" : "pending"}>{itemValue.evidence?.[item?.evidenceSlots?.[0]?.id]?.attachment ? "มีหลักฐานแล้ว" : "รอหลักฐาน"}</StatusBadge></div>
          {item ? item.evidenceSlots.map((slot) => <EvidenceField key={slot.id} item={item} slot={slot} value={itemValue.evidence?.[slot.id]} readOnly={readOnly} disabled={false} onChange={(slotId, patch) => updateItem({ evidence: { ...(itemValue.evidence || {}), [slotId]: { ...(itemValue.evidence?.[slotId] || {}), ...patch } } })} onAttachmentChange={handleAttachmentChange} onAttachmentRemove={handleAttachmentRemove} />) : <EmptyState icon="info" title="ไม่พบรายการหลักฐานของบริบทนี้">รายการนี้อาจเป็น Snapshot รุ่นเก่า</EmptyState>}
        </section>
        <VehicleSearchReviewPanelLegacy round={round} value={round.vehicleSearch} readOnly={readOnly} onChange={updateVehicleSearch} onEvidenceRowSaved={archiveSavedVehicleEvidence} notify={notify} contextKey={context.key} />
      </section>}
    </section>;
  }
}
