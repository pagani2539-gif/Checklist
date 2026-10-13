import { useCallback, useEffect, useRef, useState } from "react";
import { CURRENT_STATE_VERSION } from "../domain/state-version.js";
import { clearPendingServerState, loadServerState, saveServerState, saveServerOperations } from "../domain/server-storage.js";
import { prepareWorkspaceViewUpdate } from '../domain/workspace-operations.js';
import { describeWorkspaceSaveError } from "../domain/workspace-save-error.js";

async function normalizeServerChecklistState(state) {
  const storage = await import("../domain/storage.js");
  return storage.normalizeServerChecklistState(state);
}

// Only acknowledged central data survives a reload. No browser recovery queue.
export function useServerWorkspaceSync({ serverStorage, setState, notify }) {
  const [remoteLoaded, setRemoteLoaded] = useState(!serverStorage);
  const [authRequired, setAuthRequired] = useState(false);
  const [authConfig, setAuthConfig] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [serverSaveState, setServerSaveState] = useState("idle");
  const [serverSaveError, setServerSaveError] = useState(null);
  const [serverWritable, setServerWritable] = useState(!serverStorage);
  const remoteVersionRef = useRef(0);
  const remoteSaveChainRef = useRef(Promise.resolve());
  const generationRef = useRef(0);
  const attemptRef = useRef(0);
  const readyRef = useRef(false);
  const mountedRef = useRef(true);
  const operationsVersionRef = useRef(0);
  const requestedStateRef = useRef(null);
  const requestedViewRef = useRef(null);

  const reloadServerState = useCallback(async () => {
    readyRef.current = false;
    setServerWritable(false);
    try {
      const latest = await loadServerState();
      if (!mountedRef.current) return false;
      remoteVersionRef.current = Number(latest.version) || 0;
      operationsVersionRef.current = Number(latest.workspaceOperationsVersion) || 0;
      requestedStateRef.current = latest.state;
      const normalized = await normalizeServerChecklistState(latest.state);
      requestedViewRef.current = normalized;
      setState(normalized);
      readyRef.current = true;
      setServerWritable(true);
      return true;
    } catch {
      if (mountedRef.current) setServerSaveState("failed");
      return false;
    }
  }, [setState]);

  const persistServerState = useCallback((payload, reason = "state-update") => {
    if (!serverStorage) return;
    if (!readyRef.current) return Promise.resolve(null);
    const generation = generationRef.current;
    const attempt = ++attemptRef.current;
    const useOperations = operationsVersionRef.current === 1;
    let operations = null;
    let preparationError = null;
    try {
      if (useOperations) {
        const central = requestedStateRef.current || {};
        const prepared = prepareWorkspaceViewUpdate(central,
          reason === 'asset-no-scope-migration' ? central : requestedViewRef.current || central, payload);
        operations = prepared.operations;
        requestedStateRef.current = prepared.state;
      } else requestedStateRef.current = payload;
    }
    catch (error) { preparationError = error; }
    const operationId = useOperations ? crypto.randomUUID() : null;
    requestedViewRef.current = payload;
    setServerSaveError(null);
    setServerSaveState("saving");
    remoteSaveChainRef.current = remoteSaveChainRef.current.then(async () => {
      // A failed save discards all queued edits from that same view.
      if (generation !== generationRef.current || !mountedRef.current) return null;
      try {
        if (preparationError) throw preparationError;
        if (!readyRef.current) throw new Error("ยังโหลดข้อมูลส่วนกลางไม่สำเร็จ");
        const result = useOperations ? operations.length ? await saveServerOperations(operations, operationId, reason) : { version: remoteVersionRef.current } : await saveServerState(payload, remoteVersionRef.current, reason);
        if (!mountedRef.current) return result;
        remoteVersionRef.current = Number(result.version) || 0;
        if (attempt === attemptRef.current) {
          if (result.state) setState(await normalizeServerChecklistState(result.state));
          setServerSaveError(null);
          setServerSaveState("saved");
        }
        return result;
      } catch (error) {
        generationRef.current += 1;
        readyRef.current = false;
        setServerWritable(false);
        if (!mountedRef.current) return null;
        setServerSaveError(describeWorkspaceSaveError(error, { preparationError: Boolean(preparationError) }));
        setServerSaveState("failed");
        const loaded = await reloadServerState();
        if (mountedRef.current) notify(loaded
          ? "บันทึกไม่สำเร็จ ยกเลิกรายการที่ยังไม่บันทึกและโหลดข้อมูลส่วนกลางล่าสุดแล้ว กรุณาทำรายการใหม่"
          : "บันทึกไม่สำเร็จ ไม่มีข้อมูลสำรองในเบราว์เซอร์ กรุณาโหลดข้อมูลล่าสุดก่อนทำรายการใหม่");
        return null;
      }
    });
    return remoteSaveChainRef.current;
  }, [serverStorage, setState, notify, reloadServerState]);

  useEffect(() => {
    mountedRef.current = true;
    if (!serverStorage) return undefined;
    let cancelled = false;
    // Discard legacy browser drafts; never replay them into central storage.
    void clearPendingServerState();
    fetch("/api/v1/auth/me", { credentials: "include", headers: { Accept: "application/json" } }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.message || "ต้องเข้าสู่ระบบ");
        error.status = response.status;
        throw error;
      }
      return payload;
    }).then(async (session) => {
      if (cancelled) return;
      setCurrentUser(session.user || null);
      if (session.user?.mustChangePassword) { setRemoteLoaded(true); return; }
      const payload = await loadServerState();
      if (cancelled) return;
      remoteVersionRef.current = Number(payload.version) || 0;
      operationsVersionRef.current = Number(payload.workspaceOperationsVersion) || 0;
      requestedStateRef.current = payload.state;
      const normalized = await normalizeServerChecklistState(payload.state);
      requestedViewRef.current = normalized;
      setState(normalized);
      readyRef.current = true;
      setServerWritable(true);
      setRemoteLoaded(true);
      if (Number(payload.state?.version || 0) < CURRENT_STATE_VERSION) {
        void persistServerState(normalized, "asset-no-scope-migration");
      }
    }).catch(async (error) => {
      if (cancelled) return;
      if (error?.status === 401) {
        const response = await fetch("/api/v1/auth/config", { headers: { Accept: "application/json" } }).catch(() => null);
        if (cancelled) return;
        setAuthConfig(response?.ok ? await response.json().catch(() => null) : null);
        setAuthRequired(true);
      } else {
        setServerSaveError(describeWorkspaceSaveError(error));
        setServerSaveState("failed");
        notify("เชื่อมต่อข้อมูลส่วนกลางไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุดก่อนทำรายการ");
      }
      setRemoteLoaded(true);
    });
    return () => { cancelled = true; mountedRef.current = false; readyRef.current = false; };
  }, [serverStorage]);

  const refreshServerState = async () => {
    generationRef.current += 1;
    readyRef.current = false;
    setServerWritable(false);
    await remoteSaveChainRef.current;
    const loaded = await reloadServerState();
    if (loaded) {
      setServerSaveError(null);
      setServerSaveState("idle");
      notify("โหลดข้อมูลส่วนกลางล่าสุดแล้ว");
    } else notify("โหลดข้อมูลส่วนกลางไม่สำเร็จ กรุณาลองอีกครั้ง");
    return loaded;
  };

  return { authConfig, authRequired, currentUser, persistServerState, remoteLoaded, refreshServerState, serverSaveError, serverSaveState, serverWritable };
}
