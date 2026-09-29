import { useCallback, useEffect, useRef, useState } from "react";
import { CURRENT_STATE_VERSION, normalizeServerChecklistState } from "../domain/storage.js";
import {
  clearPendingServerState,
  loadPendingServerState,
  loadServerState,
  savePendingServerState,
  saveServerState,
} from "../domain/server-storage.js";

function conflictFromDraft(draft, preserved = true) {
  return {
    expectedVersion: draft?.expectedVersion,
    detectedAt: draft?.queuedAt || new Date().toISOString(),
    downloaded: false,
    draftPreserved: preserved,
  };
}

export function useServerWorkspaceSync({ serverStorage, setState, notify }) {
  const [remoteLoaded, setRemoteLoaded] = useState(!serverStorage);
  const [authRequired, setAuthRequired] = useState(false);
  const [authConfig, setAuthConfig] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [serverConflict, setServerConflict] = useState(null);
  const remoteVersionRef = useRef(0);
  const remoteSaveChainRef = useRef(Promise.resolve());
  const serverConflictRef = useRef(null);
  const conflictDraftRef = useRef(null);

  const activateConflict = (draft, preserved = true) => {
    const conflict = conflictFromDraft(draft, preserved);
    conflictDraftRef.current = draft ? { ...draft, status: "conflict" } : null;
    serverConflictRef.current = conflict;
    setServerConflict(conflict);
    return conflict;
  };

  const queueServerStateSave = (payload, reason = "state-update") => {
    remoteSaveChainRef.current = remoteSaveChainRef.current.then(async () => {
      if (serverConflictRef.current) {
        const conflict = serverConflictRef.current;
        const draft = { state: payload, expectedVersion: conflict.expectedVersion, reason, status: "conflict" };
        conflictDraftRef.current = draft;
        const saved = await savePendingServerState(payload, conflict.expectedVersion, reason, "conflict");
        if (!saved) notify("draft ที่ชนกับข้อมูลส่วนกลางยังอยู่ในหน่วยความจำ แต่บันทึกลงเครื่องไม่สำเร็จ");
        return null;
      }
      const result = await saveServerState(payload, remoteVersionRef.current, reason);
      remoteVersionRef.current = result.version;
      const pendingCleared = await clearPendingServerState();
      if (!pendingCleared) notify("บันทึกส่วนกลางแล้ว แต่ล้าง draft ในเบราว์เซอร์ไม่สำเร็จ");
      return result;
    }).catch((error) => {
      if (error?.status === 409) {
        const draft = { state: payload, expectedVersion: remoteVersionRef.current, reason, status: "conflict" };
        const conflict = activateConflict(draft, Boolean(error.draftPreserved));
        loadServerState().then((latest) => {
          remoteVersionRef.current = Number(latest.version) || 0;
          setState(normalizeServerChecklistState(latest.state));
        }).catch(() => {});
        notify(error.draftPreserved
          ? "ข้อมูลชนกับผู้ใช้อื่น: เก็บ draft ไว้แล้ว ดาวน์โหลดเพื่อตรวจสอบก่อนโหลดข้อมูลส่วนกลาง"
          : "ข้อมูลชนกับผู้ใช้อื่น แต่เก็บ draft ลงเครื่องไม่สำเร็จ กรุณาส่งออก draft จากหน้าจอนี้ก่อนออก");
        return conflict;
      }
      notify(error?.offline
        ? (error.draftPreserved ? "เน็ตหลุด: เก็บ draft ไว้ในเครื่องแล้ว จะซิงก์เมื่อเชื่อมต่อได้" : "เน็ตหลุดและเก็บ draft ไม่สำเร็จ กรุณาอย่าปิดหน้านี้")
        : "บันทึกข้อมูลส่วนกลางไม่สำเร็จ");
      return null;
    });
    return remoteSaveChainRef.current;
  };

  const persistServerState = useCallback((payload, reason = "state-update") => {
    if (!serverStorage) return;
    if (serverConflictRef.current) {
      const conflict = serverConflictRef.current;
      const draft = { state: payload, expectedVersion: conflict.expectedVersion, reason, status: "conflict" };
      conflictDraftRef.current = draft;
      void savePendingServerState(payload, conflict.expectedVersion, reason, "conflict").then((saved) => {
        if (saved) {
          conflict.draftPreserved = true;
          setServerConflict((current) => current ? { ...current, draftPreserved: true } : current);
        } else notify("draft ที่ชนกับข้อมูลส่วนกลางยังอยู่ในหน่วยความจำ แต่บันทึกลงเครื่องไม่สำเร็จ");
      });
      return;
    }
    return queueServerStateSave(payload, reason);
  }, [serverStorage, notify]);

  useEffect(() => {
    if (!serverStorage) return undefined;
    let cancelled = false;
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
      if (session.user?.mustChangePassword) { setRemoteLoaded(true); return null; }
      return loadServerState();
    }).then(async (payload) => {
      if (cancelled || !payload) return;
      remoteVersionRef.current = Number(payload.version) || 0;
      const pending = await loadPendingServerState();
      if (pending?.state && typeof pending.state === "object" && pending.status !== "conflict") {
        const pendingState = normalizeServerChecklistState(pending.state);
        setState(pendingState);
        try {
          const result = await saveServerState(pendingState, pending.expectedVersion, pending.reason || "offline-sync");
          remoteVersionRef.current = result.version;
          if (await clearPendingServerState()) notify("ซิงก์ draft ที่ค้างไว้เรียบร้อยแล้ว");
          else notify("ซิงก์ข้อมูลแล้ว แต่ล้าง draft ในเบราว์เซอร์ไม่สำเร็จ");
        } catch (error) {
          if (error?.status === 409) {
            activateConflict(pending, Boolean(error.draftPreserved));
            setState(normalizeServerChecklistState(payload.state));
            notify("draft ในเครื่องชนกับข้อมูลส่วนกลาง จึงโหลดข้อมูลล่าสุดและเก็บ draft ไว้ให้ตรวจสอบ");
          }
        }
      } else {
        const normalizedState = normalizeServerChecklistState(payload.state);
        setState(normalizedState);
        if (Number(payload.state?.version || 0) < CURRENT_STATE_VERSION) {
          queueServerStateSave(normalizedState, "asset-no-scope-migration");
        }
        if (pending?.state && typeof pending.state === "object" && pending.status === "conflict") {
          activateConflict(pending, true);
        }
      }
      setRemoteLoaded(true);
    }).catch(async (error) => {
      if (cancelled) return;
      if (error?.status === 401) {
        const configResponse = await fetch("/api/v1/auth/config", { headers: { Accept: "application/json" } }).catch(() => null);
        setAuthConfig(configResponse?.ok ? await configResponse.json().catch(() => null) : null);
        setAuthRequired(true);
        setRemoteLoaded(true);
        return;
      }
      const pending = await loadPendingServerState();
      if (pending?.state && typeof pending.state === "object") {
        setState(normalizeServerChecklistState(pending.state));
        if (pending.status === "conflict") activateConflict(pending, true);
      }
      setRemoteLoaded(true);
      notify(pending?.state ? "เชื่อมต่อส่วนกลางไม่ได้: กำลังใช้ draft ในเครื่องชั่วคราว" : "เชื่อมต่อฐานข้อมูลส่วนกลางไม่สำเร็จ");
    });
    return () => { cancelled = true; };
  }, [serverStorage]);

  useEffect(() => {
    if (!serverStorage || !remoteLoaded) return undefined;
    const flush = async () => {
      const pending = await loadPendingServerState();
      if (!pending?.state) return;
      if (pending.status === "conflict") {
        activateConflict(pending, true);
        return;
      }
      const pendingState = normalizeServerChecklistState(pending.state);
      try {
        const result = await saveServerState(pendingState, pending.expectedVersion, pending.reason || "offline-sync");
        remoteVersionRef.current = result.version;
        if (await clearPendingServerState()) {
          setState(pendingState);
          notify("ซิงก์ draft ที่ค้างไว้เรียบร้อยแล้ว");
        } else notify("ซิงก์ข้อมูลแล้ว แต่ล้าง draft ในเบราว์เซอร์ไม่สำเร็จ");
      } catch (error) {
        if (error?.status === 409) {
          activateConflict(pending, Boolean(error.draftPreserved));
          loadServerState().then((latest) => {
            remoteVersionRef.current = Number(latest.version) || 0;
            setState(normalizeServerChecklistState(latest.state));
          }).catch(() => {});
          notify("draft ที่ค้างไว้ชนกับข้อมูลส่วนกลาง จึงหยุดซิงก์อัตโนมัติและเก็บ draft ให้ตรวจสอบ");
        }
      }
    };
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [serverStorage, remoteLoaded]);

  const downloadConflictDraft = async () => {
    const pending = await loadPendingServerState();
    const draft = pending?.status === "conflict" ? pending : conflictDraftRef.current;
    if (!draft?.state) {
      notify("ไม่พบ draft ที่จะส่งออก กรุณาอย่าปิดหน้านี้และติดต่อผู้ดูแลระบบ");
      return;
    }
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `checklist-conflict-draft-${new Date().toISOString().replaceAll(":", "-")}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    setServerConflict((current) => current ? { ...current, downloaded: true } : current);
    if (serverConflictRef.current) serverConflictRef.current.downloaded = true;
    notify("ดาวน์โหลด draft แล้ว ตรวจสอบไฟล์ก่อนกลับไปใช้ข้อมูลส่วนกลาง");
  };

  const returnToServerState = async (requestConfirm) => {
    if (!serverConflictRef.current?.downloaded) return false;
    const confirmed = await requestConfirm({
      title: "ละทิ้ง draft ที่ชนกับข้อมูลส่วนกลาง",
      description: "ระบบจะโหลดข้อมูลล่าสุดจากส่วนกลางและลบ draft ในเบราว์เซอร์นี้ ไฟล์ที่ดาวน์โหลดไว้จะเป็นสำเนาเดียวของการแก้ไขที่ชนกัน",
      confirmLabel: "โหลดข้อมูลส่วนกลาง",
      confirmVariant: "danger",
      confirmIcon: "refresh",
    });
    if (!confirmed) return false;
    try {
      const latest = await loadServerState();
      if (!await clearPendingServerState()) {
        notify("ล้าง draft ในเบราว์เซอร์ไม่สำเร็จ จึงยังไม่เปลี่ยนข้อมูลบนหน้าจอ");
        return false;
      }
      remoteVersionRef.current = Number(latest.version) || 0;
      conflictDraftRef.current = null;
      serverConflictRef.current = null;
      setServerConflict(null);
      setState(normalizeServerChecklistState(latest.state));
      notify("โหลดข้อมูลล่าสุดจากส่วนกลางแล้ว");
      return true;
    } catch {
      notify("โหลดข้อมูลส่วนกลางไม่สำเร็จ draft ยังเก็บอยู่ในเบราว์เซอร์");
      return false;
    }
  };

  return {
    authConfig,
    authRequired,
    currentUser,
    downloadConflictDraft,
    persistServerState,
    remoteLoaded,
    returnToServerState,
    serverConflict,
  };
}
