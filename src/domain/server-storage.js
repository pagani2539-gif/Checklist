const storageMode = String(import.meta.env?.VITE_STORAGE_MODE || "local").trim().toLowerCase();
const PENDING_DB_NAME = "checklist-server-workspace-v1";
const PENDING_STORE_NAME = "pending-states";
const PENDING_KEY = "latest";
const PENDING_FALLBACK_KEY = "checklist-server-pending-v1";
const STATE_REQUEST_TIMEOUT_MS = 20000;
const ATTACHMENT_REQUEST_TIMEOUT_MS = 60000;

export const isServerStorageEnabled = () => storageMode === "server";

function canUseIndexedDb() {
  return typeof window !== "undefined" && Boolean(window.indexedDB);
}

function openPendingDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(PENDING_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(PENDING_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("เปิดพื้นที่เก็บ draft ไม่สำเร็จ"));
  });
}

async function writePendingFallback(value) {
  try {
    window.localStorage.setItem(PENDING_FALLBACK_KEY, JSON.stringify(value));
    return true;
  } catch { return false; }
}

async function readPendingFallback() {
  try { return JSON.parse(window.localStorage.getItem(PENDING_FALLBACK_KEY) || "null"); } catch { return null; }
}

export async function savePendingServerState(state, expectedVersion, reason = "state-update", status = "offline") {
  const value = { state, expectedVersion, reason, status, queuedAt: new Date().toISOString() };
  if (!canUseIndexedDb()) return writePendingFallback(value);
  try {
    const db = await openPendingDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, "readwrite");
      tx.objectStore(PENDING_STORE_NAME).put(value, PENDING_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("บันทึก draft ไม่สำเร็จ"));
    });
    db.close();
    return true;
  } catch {
    return writePendingFallback(value);
  }
}

export async function loadPendingServerState() {
  if (!canUseIndexedDb()) return readPendingFallback();
  try {
    const db = await openPendingDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, "readonly");
      const request = tx.objectStore(PENDING_STORE_NAME).get(PENDING_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("อ่าน draft ไม่สำเร็จ"));
    });
    db.close();
    return value || readPendingFallback();
  } catch {
    return readPendingFallback();
  }
}

export async function clearPendingServerState() {
  let cleared = true;
  try { window.localStorage.removeItem(PENDING_FALLBACK_KEY); } catch { cleared = false; }
  if (!canUseIndexedDb()) return cleared;
  try {
    const db = await openPendingDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE_NAME, "readwrite");
      tx.objectStore(PENDING_STORE_NAME).delete(PENDING_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error("ล้าง draft ไม่สำเร็จ"));
    });
    db.close();
  } catch { cleared = false; }
  return cleared;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Server request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function loadServerState() {
  const response = await fetchWithTimeout("/api/v1/state", { credentials: "include", headers: { Accept: "application/json" } }, STATE_REQUEST_TIMEOUT_MS);
  return parseResponse(response);
}

export async function saveServerState(state, expectedVersion, reason = "state-update") {
  try {
    const response = await fetchWithTimeout("/api/v1/state", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ state, expectedVersion, reason }),
    }, STATE_REQUEST_TIMEOUT_MS);
    return await parseResponse(response);
  } catch (error) {
    if (error?.status == null) {
      error.draftPreserved = await savePendingServerState(state, expectedVersion, reason, "offline");
      error.offline = true;
    } else if (error.status === 409) {
      error.draftPreserved = await savePendingServerState(state, expectedVersion, reason, "conflict");
    }
    throw error;
  }
}

export async function getServerAttachment(id) {
  if (!id) return null;
  const response = await fetchWithTimeout(`/api/v1/attachments/${encodeURIComponent(id)}`, { credentials: "include" }, ATTACHMENT_REQUEST_TIMEOUT_MS);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`อ่านไฟล์แนบไม่สำเร็จ (${response.status})`);
  return response.blob();
}

export async function saveServerAttachment(id, file, { stationId = "" } = {}) {
  const response = await fetchWithTimeout(`/api/v1/attachments/${encodeURIComponent(id)}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": file?.type || "application/octet-stream",
      "X-Filename": encodeURIComponent(file?.name || "attachment"),
      "X-Filename-Encoding": "percent-encoded-utf8",
      ...(stationId ? { "X-Station-Id": stationId } : {}),
    },
    body: file,
  }, ATTACHMENT_REQUEST_TIMEOUT_MS);
  return parseResponse(response);
}

export async function deleteServerAttachment(id) {
  if (!id) return;
  const response = await fetchWithTimeout(`/api/v1/attachments/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" }, ATTACHMENT_REQUEST_TIMEOUT_MS);
  if (!response.ok && response.status !== 404) await parseResponse(response);
}
