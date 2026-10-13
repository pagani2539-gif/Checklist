const imageTasks = [];
export const SNAPSHOT_IMAGE_CONCURRENCY = 6;
export const VEHICLE_EVIDENCE_ARCHIVE_CONCURRENCY = 3;
export const VEHICLE_EVIDENCE_RENDITION_VERSION = 1;
export const VEHICLE_EVIDENCE_CACHE_MAX_BYTES = 16 * 1024 * 1024;
export const VEHICLE_EVIDENCE_RENDITION_MAX_LONG_EDGE = 1800;
export const VEHICLE_EVIDENCE_WEBP_QUALITY = 0.92;

const IMAGE_EXTENSION = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
});
const VEHICLE_EVIDENCE_FIELDS_BY_CONTEXT = Object.freeze({
  plate: Object.freeze(["plateImage", "lprImage"]),
  classification: Object.freeze(["overviewImage"]),
});

const imageRequests = new Map();
const imageBlobCache = new Map();
const archiveSourceRequests = new Map();
let imageBlobCacheBytes = 0;
let activeImageTasks = 0;
let webpEncodeChain = Promise.resolve();

export function vehicleEvidenceRowKey(row) {
  if (row.systemKey || row.vehicleReviewContext || row.vehicleReviewScope) {
    return `${row.systemKey || "legacy"}:${row.vehicleReviewContext || "legacy"}:${row.vehicleReviewScope || "all"}:${row.id}`;
  }
  return row.id;
}

export function getVehicleEvidenceArchiveForRow(archive, row) {
  const matchingContextFields = Object.fromEntries(Object.entries(archive || {})
    .filter(([key]) => key.endsWith(`:${row.id}`))
    .flatMap(([, fields]) => Object.entries(fields || {}).filter(([field, attachment]) =>
      row[field] && attachment?.sourceUrl === row[field])));
  const fields = { ...(archive?.[row.id] || {}), ...matchingContextFields, ...(archive?.[vehicleEvidenceRowKey(row)] || {}) };
  const entries = Object.entries(fields).filter(([field, attachment]) => row[field] && (!attachment.sourceUrl || attachment.sourceUrl === row[field]));
  return entries.length ? Object.fromEntries(entries) : null;
}

export function vehicleEvidenceAttachmentIds(archive) {
  return [...new Set(Object.values(archive || {}).flatMap(fields => Object.values(fields || {}).flatMap(attachment => [
    attachment?.id,
    attachment?.renditions?.webp?.id,
    attachment?.renditions?.print?.id,
  ].filter(Boolean).map(String))))];
}

export function vehicleEvidenceWebpCount(archive) {
  return Object.values(archive || {}).flatMap(fields => Object.values(fields || {}))
    .filter(attachment => attachment?.type === "image/webp" || attachment?.renditions?.webp?.id).length;
}

function rowsFromDataset(dataset, { systemKey = "", context = "", defaultScope = "", reportOnly = false } = {}) {
  if (!dataset || typeof dataset !== "object") return [];
  const scopes = dataset.scopes && typeof dataset.scopes === "object"
    ? Object.entries(dataset.scopes)
    : [[defaultScope, dataset]];
  return scopes.flatMap(([scopeKey, scope]) => {
    const reportRows = scope?.rows || [];
    const appendixRows = reportOnly
      ? (scope?.sourceRows || []).filter(row => row.sampleEligibility?.status === "excluded")
      : (scope?.sourceRows || []);
    const rows = [...reportRows, ...appendixRows];
    return rows.map(row => {
      const reviewContext = row.vehicleReviewContext || context;
      const reviewScope = row.vehicleReviewScope || scopeKey || defaultScope;
      if (!systemKey && !reviewContext && !reviewScope) return row;
      return {
        ...row,
        ...(row.systemKey || !systemKey ? {} : { systemKey }),
        ...(row.vehicleReviewContext || !reviewContext ? {} : { vehicleReviewContext: reviewContext }),
        ...(row.vehicleReviewScope || !reviewScope ? {} : { vehicleReviewScope: reviewScope }),
      };
    });
  });
}

function rowsForRound(round, { reportOnly = false } = {}) {
  const search = round?.vehicleSearch;
  if (!search) return [];
  if (search.systems && typeof search.systems === "object") {
    return Object.entries(search.systems).flatMap(([systemKey, contexts]) =>
      Object.entries(contexts || {}).flatMap(([context, dataset]) => rowsFromDataset(dataset, { systemKey, context, reportOnly })));
  }
  if (search.scopes || search.classification) {
    const rows = [];
    if (search.scopes) rows.push(...rowsFromDataset({ scopes: search.scopes }, { context: search.independentContext || "plate", reportOnly }));
    if (search.classification) rows.push(...rowsFromDataset(search.classification, { context: "classification", defaultScope: "day", reportOnly }));
    if (!search.scopes && search.rows) rows.push(...rowsFromDataset(search, { context: search.independentContext || "plate", reportOnly }));
    return rows;
  }
  return rowsFromDataset(search, { context: search.independentContext || "", reportOnly });
}

function evidenceTasksFromRows(rows) {
  const tasks = rows.flatMap(row => ["plateImage", "lprImage", "overviewImage"]
    .filter(field => row[field])
    .map(field => ({ row, field, src: row[field] })));
  return [...new Map(tasks.map(task => [`${vehicleEvidenceRowKey(task.row)}:${task.field}`, task])).values()];
}

export function vehicleEvidenceTasksForRound(round) {
  return evidenceTasksFromRows(rowsForRound(round));
}

export function vehicleEvidenceTasksForReview(round, { systemKey = "", context = "", scopeKey = "", rowId = "" } = {}) {
  const fields = new Set(VEHICLE_EVIDENCE_FIELDS_BY_CONTEXT[context] || []);
  return vehicleEvidenceTasksForRound(round).filter(({ row, field }) => fields.has(field)
    && (!systemKey || (row.systemKey || "") === systemKey)
    && (!context || !row.vehicleReviewContext || row.vehicleReviewContext === context)
    && (!scopeKey || !row.vehicleReviewScope || row.vehicleReviewScope === scopeKey)
    && (!rowId || row.id === rowId));
}

export function vehicleEvidenceTasksForReport(round) {
  return evidenceTasksFromRows(rowsForRound(round, { reportOnly: true })).filter(({ row, field }) => {
    if (row.vehicleReviewContext === "plate") return VEHICLE_EVIDENCE_FIELDS_BY_CONTEXT.plate.includes(field);
    if (row.vehicleReviewContext === "classification") return VEHICLE_EVIDENCE_FIELDS_BY_CONTEXT.classification.includes(field);
    return true;
  });
}

export function mergeVehicleEvidenceArchives(existing, incoming, currentRound = null) {
  const currentSources = currentRound ? new Map() : null;
  if (currentSources) for (const { row, field, src } of vehicleEvidenceTasksForRound(currentRound)) {
    currentSources.set(`${vehicleEvidenceRowKey(row)}:${field}`, src);
    if (!currentSources.has(`${row.id}:${field}`)) currentSources.set(`${row.id}:${field}`, src);
  }
  const merged = { ...(existing || {}) };
  for (const [rowKey, fields] of Object.entries(incoming || {})) {
    const nextFields = { ...(merged[rowKey] || {}) };
    for (const [field, attachment] of Object.entries(fields || {})) {
      const taskKey = `${rowKey}:${field}`;
      if (currentSources && currentSources.get(taskKey) !== attachment?.sourceUrl) continue;
      nextFields[field] = attachment;
    }
    if (Object.keys(nextFields).length) merged[rowKey] = nextFields;
  }
  return merged;
}

export async function normalizeVehicleEvidenceImage(blob) {
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  const mime = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "image/jpeg"
    : bytes[0] === 137 && text.slice(1, 4) === "PNG" ? "image/png"
    : text.startsWith("GIF") ? "image/gif"
    : text.startsWith("RIFF") && text.slice(8, 12) === "WEBP" ? "image/webp"
    : text.startsWith("BM") ? "image/bmp" : blob.type.startsWith("image/") ? blob.type : "";
  if (!blob.size || !mime) throw new Error("API ไม่ส่งข้อมูลภาพที่ใช้งานได้");
  return blob.type === mime ? blob : new Blob([blob], { type: mime });
}

export function loadSnapshotImage(src, { priority = "auto" } = {}) {
  if (!src) return Promise.reject(new Error("ไม่พบที่อยู่ภาพหลักฐาน"));
  const cached = imageBlobCache.get(src);
  if (cached) {
    imageBlobCache.delete(src);
    imageBlobCache.set(src, cached);
    return Promise.resolve(cached);
  }
  if (imageRequests.has(src)) return imageRequests.get(src);
  const request = new Promise((resolve, reject) => {
    imageTasks.push(async () => {
      try {
        for (let attempt = 0; attempt < 4; attempt++) {
          const response = await fetch(src, { credentials: "same-origin", priority });
          if (response.ok) {
            resolve(await normalizeVehicleEvidenceImage(await response.blob()));
            return;
          }
          if (![429, 502, 503, 504].includes(response.status) || attempt === 3) throw new Error("โหลดภาพไม่สำเร็จ");
          const seconds = Number(response.headers.get("Retry-After"));
          await new Promise(done => setTimeout(done, Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1500 * (attempt + 1)));
        }
      } catch (error) { reject(error); }
    });
    pumpImageTasks();
  });
  imageRequests.set(src, request);
  request.then(blob => {
    if (imageRequests.get(src) === request) imageRequests.delete(src);
    if (!blob || blob.size > VEHICLE_EVIDENCE_CACHE_MAX_BYTES) return;
    while (imageBlobCache.size && imageBlobCacheBytes + blob.size > VEHICLE_EVIDENCE_CACHE_MAX_BYTES) {
      const oldestUrl = imageBlobCache.keys().next().value;
      imageBlobCacheBytes -= imageBlobCache.get(oldestUrl)?.size || 0;
      imageBlobCache.delete(oldestUrl);
    }
    imageBlobCache.set(src, blob);
    imageBlobCacheBytes += blob.size;
  }, () => {
    if (imageRequests.get(src) === request) imageRequests.delete(src);
  });
  return request;
}

function pumpImageTasks() {
  while (activeImageTasks < SNAPSHOT_IMAGE_CONCURRENCY && imageTasks.length) {
    const task = imageTasks.shift();
    activeImageTasks++;
    task().finally(() => { activeImageTasks--; pumpImageTasks(); });
  }
}

export function retrySnapshotImage(src) {
  imageRequests.delete(src);
  const cached = imageBlobCache.get(src);
  if (cached) imageBlobCacheBytes = Math.max(0, imageBlobCacheBytes - cached.size);
  imageBlobCache.delete(src);
}

function idleBeforeImageEncode() {
  if (typeof requestIdleCallback === "function") {
    return new Promise(resolve => requestIdleCallback(() => resolve(), { timeout: 1000 }));
  }
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function withWebpEncodeSlot(action) {
  const previous = webpEncodeChain;
  let release;
  webpEncodeChain = new Promise(resolve => { release = resolve; });
  await previous;
  try { return await action(); }
  finally { release(); }
}

function canvasBlob(canvas, type, quality) {
  if (typeof canvas.convertToBlob === "function") return canvas.convertToBlob({ type, quality });
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function createVehicleEvidenceRenditions(blob) {
  const sourceType = String(blob?.type || "").toLowerCase();
  if (!sourceType.startsWith("image/") || sourceType === "image/gif" || sourceType === "image/svg+xml") return null;
  if (typeof document === "undefined" || (typeof createImageBitmap !== "function" && typeof Image !== "function")) return null;
  return withWebpEncodeSlot(async () => {
    await idleBeforeImageEncode();
    let image;
    let objectUrl = "";
    try {
      if (typeof createImageBitmap === "function") image = await createImageBitmap(blob);
      else {
        objectUrl = URL.createObjectURL(blob);
        image = new Image();
        image.src = objectUrl;
        if (typeof image.decode === "function") await image.decode();
        else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      }
      const width = Number(image?.width || image?.naturalWidth) || 0;
      const height = Number(image?.height || image?.naturalHeight) || 0;
      if (!width || !height) return null;
      if (sourceType === "image/webp" && Math.max(width, height) <= VEHICLE_EVIDENCE_RENDITION_MAX_LONG_EDGE) return { width, height, webp: null };
      const scale = Math.min(1, VEHICLE_EVIDENCE_RENDITION_MAX_LONG_EDGE / Math.max(width, height));
      const outputWidth = Math.max(1, Math.round(width * scale));
      const outputHeight = Math.max(1, Math.round(height * scale));
      const canvas = typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(outputWidth, outputHeight)
        : document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      try {
        const context = canvas.getContext("2d", { alpha: true });
        if (!context) return null;
        context.drawImage(image, 0, 0, outputWidth, outputHeight);
        const webpBlob = await canvasBlob(canvas, "image/webp", VEHICLE_EVIDENCE_WEBP_QUALITY);
        if (!webpBlob?.size || webpBlob.type !== "image/webp") return null;
        return {
          width: outputWidth,
          height: outputHeight,
          webp: webpBlob,
        };
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      image?.close?.();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  });
}

function extensionFor(blob) {
  return IMAGE_EXTENSION[blob?.type] || "bin";
}

async function saveWithRetry(save, id, file, options, wait) {
  for (let attempt = 0; ; attempt++) {
    try { await save(id, file, options); return; }
    catch (error) {
      if (attempt >= 3 || (error.status != null && ![429, 502, 503, 504].includes(error.status))) throw error;
      await wait(error.retryAfterMs || 1500 * (attempt + 1));
    }
  }
}

async function addRendition(attachment, format, blob, { round, row, field, createId, save, wait }) {
  if (!blob?.size) return null;
  const id = createId(`vehicle-evidence-${format}`);
  const name = `${row.id}-${field}-${format}.${extensionFor(blob)}`;
  const file = new File([blob], name, { type: blob.type });
  try {
    await saveWithRetry(save, id, file, { stationId: round.stationId, roundId: round.id, kind: 'vehicle-api/webp' }, wait);
  } catch {
    // The source image is the evidence of record; a failed optimization must not block closing.
    return null;
  }
  return {
    id,
    name,
    type: blob.type,
    size: blob.size,
    width: Number(attachment.width) || null,
    height: Number(attachment.height) || null,
    version: VEHICLE_EVIDENCE_RENDITION_VERSION,
    createdAt: new Date().toISOString(),
    source: "vehicle-api-rendition",
  };
}

async function createStoredImage(src, row, field, round, { save, createId, wait }) {
  const requestKey = `${round.stationId || ""}:${src}`;
  if (archiveSourceRequests.has(requestKey)) return archiveSourceRequests.get(requestKey);
  const request = (async () => {
    const blob = await loadSnapshotImage(src, { priority: "low" });
    const id = createId("vehicle-evidence");
    const name = `${row.id}-${field}.${extensionFor(blob)}`;
    const file = new File([blob], name, { type: blob.type });
    await saveWithRetry(save, id, file, { stationId: round.stationId, roundId: round.id, kind: 'vehicle-api/originals' }, wait);
    const renditions = await createVehicleEvidenceRenditions(blob).catch(() => null);
    const attachment = { id, name, type: blob.type, size: blob.size, sourceUrl: src, capturedAt: new Date().toISOString(), source: "vehicle-api", ...(renditions ? { width: renditions.width, height: renditions.height } : {}) };
    if (renditions?.webp) {
      const webp = await addRendition(attachment, "webp", renditions.webp, { round, row, field, createId, save, wait });
      if (webp) attachment.renditions = { webp };
    }
    return attachment;
  })();
  archiveSourceRequests.set(requestKey, request);
  try { return await request; }
  finally { if (archiveSourceRequests.get(requestKey) === request) archiveSourceRequests.delete(requestKey); }
}

async function createMissingRenditions(previous, row, field, round, { save, createId, loadStored, wait }) {
  if (!previous?.id || previous.sourceUrl == null) return previous;
  if (previous.renditions?.webp?.id) return previous;
  if (previous.type === "image/webp" && Math.max(Number(previous.width) || 0, Number(previous.height) || 0) > 0
      && Math.max(Number(previous.width) || 0, Number(previous.height) || 0) <= VEHICLE_EVIDENCE_RENDITION_MAX_LONG_EDGE) return previous;
  const requestKey = `${round.stationId || ""}:${previous.sourceUrl}:${previous.id}`;
  if (archiveSourceRequests.has(requestKey)) return archiveSourceRequests.get(requestKey);
  const request = (async () => {
    let blob = null;
    if (loadStored) {
      try { blob = await loadStored(previous.id); } catch { /* Fall back to the source URL. */ }
    }
    blob ||= await loadSnapshotImage(previous.sourceUrl, { priority: "low" });
    if (!blob) return previous;
    const renditions = await createVehicleEvidenceRenditions(blob).catch(() => null);
    if (!renditions) return previous;
    const attachment = { ...previous, width: renditions.width, height: renditions.height };
    if (!renditions.webp) return attachment;
    const webp = previous.renditions?.webp?.id || await addRendition(attachment, "webp", renditions.webp, { round, row, field, createId, save, wait });
    if (webp) attachment.renditions = { ...(previous.renditions || {}), webp: typeof webp === "object" ? webp : previous.renditions?.webp };
    return attachment;
  })();
  archiveSourceRequests.set(requestKey, request);
  try { return await request; }
  finally { if (archiveSourceRequests.get(requestKey) === request) archiveSourceRequests.delete(requestKey); }
}

function hasPreparedImage(attachment, src) {
  if (!attachment?.id || attachment.sourceUrl !== src) return false;
  if (attachment.type === "image/webp" && Math.max(Number(attachment.width) || 0, Number(attachment.height) || 0) <= VEHICLE_EVIDENCE_RENDITION_MAX_LONG_EDGE
      && Math.max(Number(attachment.width) || 0, Number(attachment.height) || 0) > 0) return true;
  return Boolean(attachment.renditions?.webp?.id);
}

export function vehicleEvidenceArchivePendingCount(round, tasks = vehicleEvidenceTasksForReport(round)) {
  const archive = round?.vehicleEvidenceArchive || {};
  return tasks.filter(({ row, field, src }) => !hasPreparedImage(archive[vehicleEvidenceRowKey(row)]?.[field] || archive[row.id]?.[field], src)).length;
}

export async function archiveVehicleEvidence(round, { save, createId, loadStored, onProgress, tasks = vehicleEvidenceTasksForReport(round), wait = ms => new Promise(resolve => setTimeout(resolve, ms)), maxConcurrency = VEHICLE_EVIDENCE_ARCHIVE_CONCURRENCY } = {}) {
  const archive = { ...(round.vehicleEvidenceArchive || {}) };
  const unique = [...new Map((tasks || []).filter(task => task?.row?.id && task.field && task.src)
    .map(task => [`${vehicleEvidenceRowKey(task.row)}:${task.field}`, task])).values()];
  const storedBySource = new Map();
  for (const fields of Object.values(archive)) for (const attachment of Object.values(fields || {})) {
    if (attachment?.id && attachment.sourceUrl) storedBySource.set(attachment.sourceUrl, attachment);
  }
  let completed = 0;
  let nextIndex = 0;
  const errors = [];
  const concurrency = Math.min(unique.length || 1, Math.max(1, Math.floor(Number(maxConcurrency) || 1)));
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= unique.length) return;
      const { row, field, src } = unique[index];
      const rowKey = vehicleEvidenceRowKey(row);
      const previous = archive[rowKey]?.[field] || archive[row.id]?.[field];
      try {
        let attachment;
        if (previous?.id && previous.sourceUrl === src) {
          attachment = await createMissingRenditions(previous, row, field, round, { save, createId, loadStored, wait });
          storedBySource.set(src, attachment);
        } else {
          const stored = storedBySource.get(src);
          attachment = stored
            ? await createMissingRenditions(stored, row, field, round, { save, createId, loadStored, wait })
            : await createStoredImage(src, row, field, round, { save, createId, wait });
          if (attachment.sourceUrl !== src) attachment = { ...attachment, sourceUrl: src };
          storedBySource.set(src, attachment);
        }
        archive[rowKey] = { ...(archive[rowKey] || {}), [field]: attachment };
        completed++;
        try { onProgress?.(completed, unique.length, archive); } catch { /* Progress updates must not interrupt archiving. */ }
      } catch (error) {
        errors.push(error);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (errors.length) {
    const error = errors[0];
    error.partialArchive = archive;
    throw error;
  }
  return archive;
}
