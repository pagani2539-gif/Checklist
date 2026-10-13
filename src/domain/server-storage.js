const storageMode = String(import.meta.env?.VITE_STORAGE_MODE || "local").trim().toLowerCase();
const PENDING_DB_NAME = "checklist-server-workspace-v1";
const PENDING_STORE_NAME = "pending-states";
const PENDING_KEY = "latest";
const PENDING_FALLBACK_KEY = "checklist-server-pending-v1";
const STATE_REQUEST_TIMEOUT_MS = 20000;
const ATTACHMENT_REQUEST_TIMEOUT_MS = 60000;
const ATTACHMENT_MAX_CONCURRENT_READS = 8;
const ATTACHMENT_CACHE_MAX_BYTES = 32 * 1024 * 1024;
const attachmentReadQueue = [];
const attachmentReadsInFlight = new Map();
const attachmentBlobCache = new Map();
let attachmentBlobCacheBytes = 0;
let activeAttachmentReads = 0;

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
    const retryAfterSeconds = Number(response.headers?.get?.("Retry-After"));
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) error.retryAfterMs = retryAfterSeconds * 1000;
    throw error;
  }
  return payload;
}

function scheduleAttachmentRead(task) {
  return new Promise((resolve, reject) => {
    attachmentReadQueue.push({ task, resolve, reject });
    runAttachmentReads();
  });
}

function runAttachmentReads() {
  while (activeAttachmentReads < ATTACHMENT_MAX_CONCURRENT_READS && attachmentReadQueue.length) {
    const next = attachmentReadQueue.shift();
    activeAttachmentReads += 1;
    Promise.resolve().then(next.task).then(next.resolve, next.reject).finally(() => {
      activeAttachmentReads -= 1;
      runAttachmentReads();
    });
  }
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
    if (error?.status == null) error.offline = true;
    if (error?.status === 429) error.rateLimited = true;
    throw error;
  }
}

export async function saveServerOperations(operations, operationId, reason = 'state-update') {
  const body = JSON.stringify({ operations, operationId, reason });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchWithTimeout('/api/v1/state', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body }, STATE_REQUEST_TIMEOUT_MS);
      const result = await parseResponse(response);
      if (result.operationId !== operationId || !Number.isFinite(Number(result.version))) throw Object.assign(new Error('Invalid save acknowledgement'), { status: 502 });
      return result;
    } catch (error) {
      if (!attempt && (error.status == null || error.status >= 500)) continue;
      if (error.status == null) error.offline = true;
      if (error.status === 429) error.rateLimited = true;
      throw error;
    }
  }
}

export async function getServerAttachment(id) {
  if (!id) return null;
  const key = String(id);
  if (attachmentBlobCache.has(key)) {
    const blob = attachmentBlobCache.get(key);
    attachmentBlobCache.delete(key);
    attachmentBlobCache.set(key, blob);
    return blob;
  }
  if (attachmentReadsInFlight.has(key)) return attachmentReadsInFlight.get(key);
  const pending = scheduleAttachmentRead(async () => {
    const response = await fetchWithTimeout(`/api/v1/attachments/${encodeURIComponent(key)}`, { credentials: "include" }, ATTACHMENT_REQUEST_TIMEOUT_MS);
    if (response.status === 404) return null;
    if (!response.ok) {
      const error = new Error(`อ่านไฟล์แนบไม่สำเร็จ (${response.status})`);
      error.status = response.status;
      const retryAfterSeconds = Number(response.headers?.get?.("Retry-After"));
      if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) error.retryAfterMs = retryAfterSeconds * 1000;
      throw error;
    }
    const blob = await response.blob();
    if (blob.size <= ATTACHMENT_CACHE_MAX_BYTES) {
      while (attachmentBlobCache.size && attachmentBlobCacheBytes + blob.size > ATTACHMENT_CACHE_MAX_BYTES) {
        const oldestKey = attachmentBlobCache.keys().next().value;
        attachmentBlobCacheBytes -= attachmentBlobCache.get(oldestKey)?.size || 0;
        attachmentBlobCache.delete(oldestKey);
      }
      attachmentBlobCache.set(key, blob);
      attachmentBlobCacheBytes += blob.size;
    }
    return blob;
  });
  attachmentReadsInFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    if (attachmentReadsInFlight.get(key) === pending) attachmentReadsInFlight.delete(key);
  }
}

export async function saveServerAttachment(id, file, { stationId = "", roundId = "", kind = "inspection/originals" } = {}) {
  const response = await fetchWithTimeout(`/api/v1/attachments/${encodeURIComponent(id)}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": file?.type || "application/octet-stream",
      "X-Filename": encodeURIComponent(file?.name || "attachment"),
      "X-Filename-Encoding": "percent-encoded-utf8",
      ...(stationId ? { "X-Station-Id": stationId } : {}),
      ...(roundId ? { "X-Round-Id": roundId } : {}),
      'X-Attachment-Kind': kind,
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
