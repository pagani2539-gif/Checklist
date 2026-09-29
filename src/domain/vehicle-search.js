import {
  getVehicleApiAdapter,
  getVehicleApiProfileByImagePath,
  isVehicleApiProfile,
  VEHICLE_API_PROFILES,
} from "./vehicle-api-profiles.js";
import {
  isOriginEndpoint,
  normalizeVehicleSearchBaseUrl,
  normalizeVehicleSearchEndpoint,
  VEHICLE_SEARCH_DEFAULT_BASE_URL,
} from "./vehicle-search-config.js";
import { DEFAULT_PLATE_KEYS, vehicleRecordsFromPayload } from "./vehicle-search-response.js";
import { createVehicleSearchTransport, VehicleSearchError } from "./vehicle-search-transport.js";

export { getVehicleApiAdapter, VEHICLE_API_PROFILE_OPTIONS, VEHICLE_API_PROFILES } from "./vehicle-api-profiles.js";
export {
  buildVehicleSearchConnection,
  createVehicleSearchConfig,
  normalizeVehicleSearchBaseUrl,
  normalizeVehicleSearchEndpoint,
  normalizeVehicleSearchHost,
  normalizeVehicleSearchPort,
  parseVehicleSearchUrl,
  VEHICLE_CONNECTION_MODES,
  VEHICLE_SEARCH_CONNECTION_STATUS,
  VEHICLE_SEARCH_DEFAULT_BASE_URL,
  VEHICLE_SEARCH_DEFAULT_PROXY_BASE_URL,
} from "./vehicle-search-config.js";

export const VEHICLE_SEARCH_ENDPOINT = "/api/vehicle/search";
export const VEHICLE_SEARCH_IMAGE_ENDPOINT = "/api/vehicle/image";

export const VEHICLE_SEARCH_PURPOSE = "ใช้ดึงผลตรวจข้อมูลรถจาก API พร้อมภาพป้ายทะเบียนและภาพรถในหมวด 5.1";

export const VEHICLE_SEARCH_ITEM_ID = "5.1.plate-document";
export const VEHICLE_SEARCH_LEGACY_ITEM_ID = "5.1.vehicle-document";
export const VEHICLE_API_REVIEW_LEGACY_VERSION = "vehicle-api-review-v1";
export const VEHICLE_API_REVIEW_VERSION = "vehicle-api-review-v2";
export const VEHICLE_REVIEW_SCOPE_VERSION = "vehicle-review-day-night-v1";
export const VEHICLE_REVIEW_SCOPE_POLICY_VERSION = "vehicle-daypart-policy-v1";
export const VEHICLE_REVIEW_SCOPE_KEYS = Object.freeze(["day", "night"]);

export const VEHICLE_REVIEW_CONTEXTS = Object.freeze({
  PLATE: "plate",
  CLASSIFICATION: "classification",
});

export const VEHICLE_REVIEW_THRESHOLDS = Object.freeze({
  plate: 80,
  classification: 90,
});

export const VEHICLE_REVIEW_REASON_OPTIONS = Object.freeze({
  plate: Object.freeze([
    { value: "blurred-image", label: "ภาพเบลอ" },
    { value: "dark-or-glare", label: "มืดหรือแสงสะท้อน" },
    { value: "plate-obscured", label: "ป้ายถูกบัง" },
    { value: "dirty-or-damaged", label: "ป้ายสกปรกหรือชำรุด" },
    { value: "out-of-frame", label: "ป้ายอยู่นอกกรอบภาพ" },
    { value: "missing-or-wrong-image", label: "ไม่มีภาพ / ภาพผิดคัน" },
    { value: "api-missing-plate", label: "API ไม่ส่งค่าทะเบียน" },
    { value: "ocr-error", label: "ระบบอ่านตัวอักษรผิด" },
  ]),
  classification: Object.freeze([
    { value: "unclear-image", label: "ภาพรถไม่ชัด" },
    { value: "vehicle-obscured", label: "รถถูกบัง" },
    { value: "axles-not-visible", label: "มองจำนวนเพลาไม่เห็น" },
    { value: "class-mismatch", label: "ประเภทไม่ตรงกับข้อมูลในระบบ" },
    { value: "missing-image", label: "ไม่มีภาพประกอบ" },
    { value: "api-missing-class", label: "API ไม่มีประเภทหรือ Mapping ผิด" },
  ]),
});

export const VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS = Object.freeze({
  plate: Object.freeze([
    { value: "plate-number", label: "เลขทะเบียน", buttonLabel: "เลขทะเบียน" },
    { value: "province", label: "จังหวัด", buttonLabel: "ชื่อจังหวัด" },
  ]),
});

export const VEHICLE_REVIEW_CONTEXT_OPTIONS = Object.freeze([
  { key: VEHICLE_REVIEW_CONTEXTS.PLATE, itemId: VEHICLE_SEARCH_ITEM_ID, checklistNumber: "5.1.5", label: "เอกสารผลการจำแนกป้ายทะเบียน", description: "ตรวจเลขทะเบียนเทียบกับภาพป้ายทะเบียนจาก API", dimensions: ["plate"] },
  { key: VEHICLE_REVIEW_CONTEXTS.CLASSIFICATION, itemId: VEHICLE_SEARCH_LEGACY_ITEM_ID, checklistNumber: "5.1.6", label: "เอกสารผลการจำแนกประเภทรถ", description: "ตรวจประเภทรถเทียบกับภาพรถจาก API โดยแสดงน้ำหนักรวมเป็นหลักฐานประกอบ", dimensions: ["classification"] },
]);

export const VEHICLE_REVIEW_SCOPE_OPTIONS = Object.freeze([
  { key: "day", label: "กลางวัน", timeLabel: "06:00–18:00", startHour: 6, endHour: 18 },
  { key: "night", label: "กลางคืน", timeLabel: "18:00–06:00", startHour: 18, endHour: 6 },
]);

const VEHICLE_REVIEW_SCOPE_BY_KEY = Object.fromEntries(VEHICLE_REVIEW_SCOPE_OPTIONS.map((scope) => [scope.key, scope]));

function isVehicleReviewScopeKey(value) {
  return Object.hasOwn(VEHICLE_REVIEW_SCOPE_BY_KEY, text(value));
}

export function isVehicleReviewScopeState(value) {
  return Boolean(value && typeof value === "object" && value.scopes && typeof value.scopes === "object"
    && VEHICLE_REVIEW_SCOPE_KEYS.some((key) => Object.hasOwn(value.scopes, key)));
}

function dateOnlyFromCriteria(criteria = {}) {
  const normalized = normalizeVehicleSearchCriteria(criteria);
  const source = text(normalized.startAt || normalized.endAt);
  const match = source.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || "";
}

function addCalendarDays(dateOnly, amount) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return "";
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function defaultCriteriaForScope(criteria = {}, scopeKey = "day") {
  const dateOnly = dateOnlyFromCriteria(criteria);
  const scope = VEHICLE_REVIEW_SCOPE_BY_KEY[scopeKey];
  if (!dateOnly || !scope) return normalizeVehicleSearchCriteria(criteria);
  const start = `${dateOnly}T${String(scope.startHour).padStart(2, "0")}:00`;
  const endDate = scopeKey === "night" ? addCalendarDays(dateOnly, 1) : dateOnly;
  const end = `${endDate}T${String(scope.endHour).padStart(2, "0")}:00`;
  return { startAt: start, endAt: end };
}

function dateTimeValue(value) {
  const source = text(value);
  if (!source) return Number.NaN;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(source) ? `${source}:00+07:00` : source;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function bangkokHour(value) {
  const timestamp = dateTimeValue(value);
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return Number.isFinite(hour) ? hour : null;
}

export function getVehicleReviewScopeForTimestamp(value) {
  const hour = bangkokHour(value);
  if (hour === null) return null;
  return hour >= 6 && hour < 18 ? "day" : "night";
}

export function filterVehicleSearchRowsByTimeRange(rows, criteria = {}) {
  const normalized = normalizeVehicleSearchCriteria(criteria);
  const start = dateTimeValue(normalized.startAt);
  const end = dateTimeValue(normalized.endAt);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const occurredAt = text(row?.occurredAt || row?.eventAt || row?.stamp);
    if (!occurredAt) return true;
    const timestamp = dateTimeValue(occurredAt);
    if (!Number.isFinite(timestamp)) return true;
    if (Number.isFinite(start) && timestamp < start) return false;
    if (Number.isFinite(end) && timestamp > end) return false;
    return true;
  });
}

export function filterVehicleSearchRowsByScope(rows, scopeKey, criteria = {}) {
  if (!isVehicleReviewScopeKey(scopeKey)) return Array.isArray(rows) ? rows : [];
  const normalized = normalizeVehicleSearchCriteria(criteria);
  const start = dateTimeValue(normalized.startAt);
  const end = dateTimeValue(normalized.endAt);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const occurredAt = text(row?.occurredAt || row?.eventAt || row?.stamp);
    if (!occurredAt) return true;
    const scope = getVehicleReviewScopeForTimestamp(occurredAt);
    if (scope && scope !== scopeKey) return false;
    const timestamp = dateTimeValue(occurredAt);
    if (Number.isFinite(start) && Number.isFinite(timestamp) && timestamp < start) return false;
    if (Number.isFinite(end) && Number.isFinite(timestamp) && timestamp > end) return false;
    return true;
  });
}

export function createVehicleReviewState(fallbackCriteria = {}) {
  return {
    scopeVersion: VEHICLE_REVIEW_SCOPE_VERSION,
    policyVersion: VEHICLE_REVIEW_SCOPE_POLICY_VERSION,
    scopes: Object.fromEntries(VEHICLE_REVIEW_SCOPE_KEYS.map((scopeKey) => [scopeKey, {
      ...createEmptyVehicleSearchState(defaultCriteriaForScope(fallbackCriteria, scopeKey)),
      scopeKey,
      emptyResultAcknowledgedAt: null,
    }])),
  };
}

export function normalizeVehicleReviewState(value, fallbackCriteria = {}, options = {}) {
  if (!isVehicleReviewScopeState(value)) return normalizeVehicleSearchState(value, fallbackCriteria, options);
  const source = value && typeof value === "object" ? value : {};
  const scopes = Object.fromEntries(VEHICLE_REVIEW_SCOPE_KEYS.map((scopeKey) => {
    const scopeValue = source.scopes?.[scopeKey] || {};
    const normalized = normalizeVehicleSearchState(scopeValue, defaultCriteriaForScope(fallbackCriteria, scopeKey), options);
    return [scopeKey, {
      ...normalized,
      scopeKey,
      emptyResultAcknowledgedAt: text(scopeValue.emptyResultAcknowledgedAt) || null,
    }];
  }));
  return {
    scopeVersion: text(source.scopeVersion) || VEHICLE_REVIEW_SCOPE_VERSION,
    policyVersion: text(source.policyVersion) || VEHICLE_REVIEW_SCOPE_POLICY_VERSION,
    scopes,
  };
}

export function getVehicleReviewScopeState(value, scopeKey, fallbackCriteria = {}, options = {}) {
  if (!isVehicleReviewScopeState(value)) return normalizeVehicleSearchState(value, fallbackCriteria, options);
  const normalized = normalizeVehicleReviewState(value, fallbackCriteria, options);
  return normalized.scopes[scopeKey] || normalized.scopes.day;
}

export function updateVehicleSearchScope(value, scopeKey, nextState, options = {}) {
  if (!isVehicleReviewScopeKey(scopeKey)) return value;
  const normalized = normalizeVehicleReviewState(value, {}, options);
  if (!isVehicleReviewScopeState(normalized)) return nextState;
  return {
    ...normalized,
    scopes: {
      ...normalized.scopes,
      [scopeKey]: {
        ...normalizeVehicleSearchState(nextState, normalized.scopes[scopeKey]?.criteria, options),
        scopeKey,
        emptyResultAcknowledgedAt: text(nextState?.emptyResultAcknowledgedAt) || null,
      },
    },
  };
}

export function setVehicleSearchEmptyResultAcknowledged(value, acknowledged = true) {
  const normalized = normalizeVehicleSearchState(value);
  return {
    ...normalized,
    emptyResultAcknowledgedAt: acknowledged ? new Date().toISOString() : null,
  };
}

export function getVehicleReviewScopeEntries(value, fallbackCriteria = {}, options = {}) {
  if (!isVehicleReviewScopeState(value)) return [{ key: "all", label: "ทุกช่วงเวลา", state: normalizeVehicleSearchState(value, fallbackCriteria, options) }];
  const normalized = normalizeVehicleReviewState(value, fallbackCriteria, options);
  return VEHICLE_REVIEW_SCOPE_OPTIONS.map((scope) => ({ ...scope, state: normalized.scopes[scope.key] }));
}

const VEHICLE_REVIEW_CONTEXT_BY_KEY = Object.fromEntries(VEHICLE_REVIEW_CONTEXT_OPTIONS.map((context) => [context.key, context]));
const VEHICLE_REVIEW_CONTEXT_BY_ITEM_ID = Object.fromEntries(VEHICLE_REVIEW_CONTEXT_OPTIONS.map((context) => [context.itemId, context]));

function itemBaseId(value) {
  return text(value).split("::")[0];
}

export function getVehicleReviewContext(item) {
  if (!item || typeof item !== "object") return null;
  const explicitContext = text(item.vehicleReviewContext || item.reviewContext);
  if (VEHICLE_REVIEW_CONTEXT_BY_KEY[explicitContext]) return VEHICLE_REVIEW_CONTEXT_BY_KEY[explicitContext];
  const ids = [item.id, item.templateId, ...(Array.isArray(item.legacyIds) ? item.legacyIds : []), ...(Array.isArray(item.legacyControlIds) ? item.legacyControlIds : [])].map(itemBaseId);
  const copy = [item.label, item.displayLabel, item.sourceLabel].map(text).join(" ");
  if (ids.includes(VEHICLE_SEARCH_LEGACY_ITEM_ID) && /ป้ายทะเบียน|plate/i.test(copy)) return VEHICLE_REVIEW_CONTEXT_BY_KEY[VEHICLE_REVIEW_CONTEXTS.PLATE];
  const directMatch = ids.map((id) => VEHICLE_REVIEW_CONTEXT_BY_ITEM_ID[id]).find(Boolean);
  if (directMatch) return directMatch;
  return null;
}

export function getVehicleReviewContextByKey(contextKey) {
  return VEHICLE_REVIEW_CONTEXT_BY_KEY[text(contextKey)] || null;
}

export function isVehicleSearchItem(item) {
  return getVehicleReviewContext(item)?.key === VEHICLE_REVIEW_CONTEXTS.PLATE;
}

export function isVehicleClassificationItem(item) {
  return getVehicleReviewContext(item)?.key === VEHICLE_REVIEW_CONTEXTS.CLASSIFICATION;
}

export function isVehicleReviewItem(item) {
  return Boolean(getVehicleReviewContext(item));
}

// This is deliberately Snapshot-scoped. Historic rounds keep the document
// workflow that was captured when they were created.
export function isVehicleApiReviewItem(item, snapshot) {
  const context = getVehicleReviewContext(item);
  if (snapshot?.vehicleReviewVersion === VEHICLE_API_REVIEW_VERSION) return Boolean(context);
  return snapshot?.vehicleReviewVersion === VEHICLE_API_REVIEW_LEGACY_VERSION && context?.key === VEHICLE_REVIEW_CONTEXTS.PLATE;
}

export const VEHICLE_REVIEW_DIMENSIONS = Object.freeze([
  { key: "plate", statusKey: "reviewStatus" },
  { key: "classification", statusKey: "classificationReviewStatus" },
  { key: "axles", statusKey: "axleReviewStatus" },
  { key: "integrity", statusKey: "integrityReviewStatus" },
]);

export function getVehicleReviewDimensions(reviewVersion = VEHICLE_API_REVIEW_VERSION, contextKey = "") {
  const allDimensions = reviewVersion === VEHICLE_API_REVIEW_VERSION
    ? VEHICLE_REVIEW_DIMENSIONS.filter((dimension) => ["plate", "classification"].includes(dimension.key))
    : [VEHICLE_REVIEW_DIMENSIONS[0]];
  const context = getVehicleReviewContextByKey(contextKey);
  return context ? allDimensions.filter((dimension) => context.dimensions.includes(dimension.key)) : allDimensions;
}

function reviewDimensionsForVersion(reviewVersion, contextKey = "") {
  return getVehicleReviewDimensions(reviewVersion, contextKey);
}

function dimensionSummary(rows, statusKey) {
  const total = rows.length;
  const correct = rows.filter((row) => row[statusKey] === "correct").length;
  const incorrect = rows.filter((row) => row[statusKey] === "incorrect").length;
  const unableToVerify = rows.filter((row) => row[statusKey] === "unable-to-verify").length;
  const pending = rows.filter((row) => row[statusKey] === "pending").length;
  const reviewed = correct + incorrect;
  return {
    total,
    reviewed,
    decided: reviewed + unableToVerify,
    correct,
    incorrect,
    unableToVerify,
    pending,
    accuracy: reviewed ? Math.round((correct / reviewed) * 100) : null,
    reviewedAccuracy: reviewed ? Math.round((correct / reviewed) * 100) : null,
  };
}

export function getVehicleSearchReviewSummary(value, { reviewVersion = VEHICLE_API_REVIEW_VERSION, context = "" } = {}) {
  if (isVehicleReviewScopeState(value)) {
    return mergeVehicleSearchReviewSummaries(getVehicleReviewScopeEntries(value).map(({ state }) => getVehicleSearchReviewSummary(state, { reviewVersion, context })));
  }
  const state = normalizeVehicleSearchState(value);
  const dimensions = reviewDimensionsForVersion(reviewVersion, context);
  const summary = Object.fromEntries(dimensions.map(({ key, statusKey }) => [key, dimensionSummary(state.rows, statusKey)]));
  const pendingChecks = dimensions.reduce((total, { key }) => total + summary[key].pending, 0);
  const unableToVerifyChecks = dimensions.reduce((total, { key }) => total + summary[key].unableToVerify, 0);
  const unresolvedChecks = pendingChecks + unableToVerifyChecks;
  const totalChecks = dimensions.reduce((total, { key }) => total + summary[key].total, 0);
  const completeRows = state.rows.filter((row) => dimensions.every(({ statusKey }) => !["pending", "unable-to-verify"].includes(row[statusKey]))).length;
  const primarySummary = summary.plate || summary.classification || summary.axles || summary.integrity || { total: 0, reviewed: 0, decided: 0, correct: 0, incorrect: 0, unableToVerify: 0, pending: 0, accuracy: null };
  return {
    ...primarySummary,
    dimensions: summary,
    classification: dimensionSummary(state.rows, "classificationReviewStatus"),
    axles: dimensionSummary(state.rows, "axleReviewStatus"),
    integrity: dimensionSummary(state.rows, "integrityReviewStatus"),
    totalChecks,
    pendingChecks,
    unableToVerifyChecks,
    unresolvedChecks,
    completeRows,
    complete: unresolvedChecks === 0,
  };
}

function mergeVehicleSearchReviewSummaries(summaries) {
  const dimensions = ["plate", "classification", "axles", "integrity"].reduce((result, key) => {
    const values = summaries.map((summary) => summary.dimensions?.[key] || summary[key]).filter(Boolean);
    if (!values.length) return result;
    const merged = values.reduce((total, value) => ({
      total: total.total + value.total,
      reviewed: total.reviewed + value.reviewed,
      decided: total.decided + value.decided,
      correct: total.correct + value.correct,
      incorrect: total.incorrect + value.incorrect,
      unableToVerify: total.unableToVerify + value.unableToVerify,
      pending: total.pending + value.pending,
    }), { total: 0, reviewed: 0, decided: 0, correct: 0, incorrect: 0, unableToVerify: 0, pending: 0 });
    result[key] = {
      ...merged,
      accuracy: merged.reviewed ? Math.round((merged.correct / merged.reviewed) * 100) : null,
      reviewedAccuracy: merged.reviewed ? Math.round((merged.correct / merged.reviewed) * 100) : null,
    };
    return result;
  }, {});
  const primary = dimensions.plate || dimensions.classification || dimensions.axles || dimensions.integrity || { total: 0, reviewed: 0, decided: 0, correct: 0, incorrect: 0, unableToVerify: 0, pending: 0, accuracy: null, reviewedAccuracy: null };
  return {
    ...primary,
    plate: dimensions.plate || primary,
    dimensions,
    classification: dimensions.classification || { total: 0, reviewed: 0, decided: 0, correct: 0, incorrect: 0, unableToVerify: 0, pending: 0, accuracy: null, reviewedAccuracy: null },
    axles: dimensions.axles || { total: 0, reviewed: 0, decided: 0, correct: 0, incorrect: 0, unableToVerify: 0, pending: 0, accuracy: null, reviewedAccuracy: null },
    integrity: dimensions.integrity || { total: 0, reviewed: 0, decided: 0, correct: 0, incorrect: 0, unableToVerify: 0, pending: 0, accuracy: null, reviewedAccuracy: null },
    totalChecks: summaries.reduce((total, summary) => total + summary.totalChecks, 0),
    pendingChecks: summaries.reduce((total, summary) => total + summary.pendingChecks, 0),
    unableToVerifyChecks: summaries.reduce((total, summary) => total + summary.unableToVerifyChecks, 0),
    unresolvedChecks: summaries.reduce((total, summary) => total + summary.unresolvedChecks, 0),
    completeRows: summaries.reduce((total, summary) => total + summary.completeRows, 0),
    complete: summaries.every((summary) => summary.complete),
  };
}

export function getVehicleReviewState(value, { reviewVersion = VEHICLE_API_REVIEW_VERSION, context = "" } = {}) {
  if (isVehicleReviewScopeState(value)) {
    const entries = getVehicleReviewScopeEntries(value);
    const states = entries.map(({ state }) => getVehicleReviewState(state, { reviewVersion, context }));
    const summary = getVehicleSearchReviewSummary(value, { reviewVersion, context });
    if (states.some((state) => state.key === "not-fetched")) return { key: "not-fetched", label: "ยังดึงข้อมูลกลางวัน/กลางคืนไม่ครบ", tone: "pending", summary };
    if (states.some((state) => state.key === "empty")) return { key: "empty", label: "ต้องยืนยันผลช่วงเวลาที่ไม่พบรถ", tone: "waiting", summary };
    if (states.some((state) => state.key === "reviewing")) return { key: "reviewing", label: `ข้อมูล API พร้อมตรวจ · คงเหลือ ${summary.unresolvedChecks} จุด`, tone: "waiting", summary };
    const outcome = getVehicleReviewOutcome(value, { reviewVersion, context });
    if (outcome.status === "failed") return { key: "failed", label: "ไม่ผ่านเกณฑ์", tone: "damaged", summary, outcome };
    if (outcome.status === "incomplete") return { key: "incomplete", label: "ยังไม่ครบเกณฑ์", tone: "waiting", summary, outcome };
    return { key: "complete", label: "ตรวจกลางวันและกลางคืนครบแล้ว", tone: "normal", summary };
  }
  const state = normalizeVehicleSearchState(value);
  const summary = getVehicleSearchReviewSummary(state, { reviewVersion, context });
  if (!state.fetchedAt) return { key: "not-fetched", label: "ยังไม่ได้ดึงข้อมูลรถ", tone: "pending", summary };
  if (!summary.total) {
    if (!state.scopeKey) return { key: "empty", label: "ไม่พบรถในช่วงเวลา", tone: "normal", summary };
    if (state.emptyResultAcknowledgedAt) return { key: "empty-acknowledged", label: "ยืนยันว่าไม่พบรถในช่วงเวลา", tone: "normal", summary };
    return { key: "empty", label: "ไม่พบรถในช่วงเวลา · ต้องยืนยันผล", tone: "waiting", summary };
  }
  if (summary.pendingChecks || summary.unableToVerifyChecks) return { key: "reviewing", label: `ข้อมูล API พร้อมตรวจ · คงเหลือ ${summary.unresolvedChecks} จุด`, tone: "waiting", summary };
  const outcome = getVehicleReviewOutcome(state, { reviewVersion, context });
  if (outcome.status === "failed") return { key: "failed", label: "ไม่ผ่านเกณฑ์", tone: "damaged", summary, outcome };
  if (outcome.status === "incomplete") return { key: "incomplete", label: "ยังไม่ครบเกณฑ์", tone: "waiting", summary, outcome };
  const contextLabel = getVehicleReviewContextByKey(context)?.label || "ข้อมูลรถ";
  return { key: "complete", label: context ? `ตรวจ${contextLabel.replace(/^เอกสารผลการจำแนก/, "")}ครบแล้ว` : reviewVersion === VEHICLE_API_REVIEW_VERSION ? "ตรวจข้อมูลรถครบแล้ว" : "ตรวจผลอ่านป้ายครบแล้ว", tone: "normal", summary };
}

export const VEHICLE_REVIEW_STATUS_OPTIONS = Object.freeze([
  { value: "pending", label: "ยังไม่ตรวจ" },
  { value: "correct", label: "อ่านถูกต้อง" },
  { value: "incorrect", label: "อ่านไม่ถูกต้อง" },
  { value: "unable-to-verify", label: "ตรวจไม่ได้" },
]);

const VEHICLE_REVIEW_STATUS_VALUES = new Set(VEHICLE_REVIEW_STATUS_OPTIONS.map((option) => option.value));

function durationMinutes(criteria = {}) {
  const start = dateTimeValue(criteria.startAt);
  const end = dateTimeValue(criteria.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

function outcomeForState(value, { reviewVersion = VEHICLE_API_REVIEW_VERSION, context = "" } = {}) {
  const state = normalizeVehicleSearchState(value);
  const summary = getVehicleSearchReviewSummary(state, { reviewVersion, context });
  const dimensions = getVehicleReviewDimensions(reviewVersion, context);
  const duration = durationMinutes(state.criteria);
  const enforcesVehicleApiRoundCriteria = reviewVersion === VEHICLE_API_REVIEW_VERSION;
  const sampleQualified = !enforcesVehicleApiRoundCriteria || Boolean((duration !== null && duration >= 360) || summary.total >= 100);
  const weightMissing = state.rows.filter((row) => row.grossWeight === null || row.grossWeight === undefined);
  const requiredWeight = enforcesVehicleApiRoundCriteria && !context;
  const reasons = [];
  if (!state.fetchedAt) reasons.push({ code: "not-fetched", label: "ยังไม่ได้ดึงข้อมูลจาก API" });
  if (!sampleQualified) reasons.push({ code: "sample-threshold", label: "ยังไม่ครบ 6 ชั่วโมงหรือ 100 คัน" });
  if (!summary.total) reasons.push({ code: "no-sample", label: "ยังไม่มีรถสำหรับคำนวณผล" });
  if (summary.pendingChecks) reasons.push({ code: "pending-review", label: `ยังไม่ได้ตรวจ ${summary.pendingChecks} จุด` });
  if (summary.unableToVerifyChecks) reasons.push({ code: "unable-to-verify", label: `ตรวจไม่ได้ ${summary.unableToVerifyChecks} จุด` });
  if (requiredWeight && weightMissing.length) reasons.push({ code: "missing-weight", label: `ไม่มีน้ำหนักรวม ${weightMissing.length} คัน` });
  if (summary.unresolvedChecks === 0) {
    dimensions.forEach(({ key }) => {
      const dimensionSummaryValue = summary.dimensions?.[key];
      const threshold = VEHICLE_REVIEW_THRESHOLDS[key];
      if (!dimensionSummaryValue || threshold === undefined || dimensionSummaryValue.accuracy === null) return;
      if (dimensionSummaryValue.accuracy < threshold) reasons.push({ code: `${key}-threshold`, label: `${key === "plate" ? "ทะเบียน" : "การคัดแยกประเภทรถ"} ต่ำกว่า ${threshold}%` });
    });
  }
  const status = !state.fetchedAt || !sampleQualified || !summary.total || summary.unresolvedChecks > 0
    ? "incomplete"
    : reasons.some((reason) => ["missing-weight", "plate-threshold", "classification-threshold"].includes(reason.code))
      ? "failed"
      : "passed";
  return {
    status,
    label: status === "passed" ? "ผ่านเกณฑ์" : status === "failed" ? "ไม่ผ่านเกณฑ์" : "ยังไม่ครบเกณฑ์",
    durationMinutes: duration,
    durationHours: duration === null ? null : Number((duration / 60).toFixed(2)),
    sampleQualified,
    sampleBasis: summary.total >= 100 ? "count" : duration !== null && duration >= 360 ? "duration" : null,
    weightComplete: weightMissing.length === 0,
    weightMissingCount: weightMissing.length,
    thresholds: { ...VEHICLE_REVIEW_THRESHOLDS },
    summary,
    reasons,
  };
}

export function getVehicleReviewOutcome(value, options = {}) {
  if (!isVehicleReviewScopeState(value)) return outcomeForState(value, options);
  const scopes = getVehicleReviewScopeEntries(value).map(({ key, label, state }) => ({
    scope: key,
    scopeLabel: label,
    ...outcomeForState(state, options),
  }));
  const status = scopes.some((scope) => scope.status === "incomplete")
    ? "incomplete"
    : scopes.some((scope) => scope.status === "failed")
      ? "failed"
      : "passed";
  return {
    status,
    label: status === "passed" ? "ผ่านเกณฑ์" : status === "failed" ? "ไม่ผ่านเกณฑ์" : "ยังไม่ครบเกณฑ์",
    scopes,
    summary: getVehicleSearchReviewSummary(value, options),
    reasons: scopes.flatMap((scope) => scope.reasons.map((reason) => ({ ...reason, scope: scope.scope }))),
  };
}

const VEHICLE_REVIEW_DETAIL_KEYS = Object.freeze(["plate", "classification", "axles", "integrity"]);

function normalizeReviewEvidenceAttachment(value) {
  if (!value || typeof value !== "object" || !text(value.id)) return null;
  return {
    id: text(value.id),
    name: text(value.name) || "หลักฐานการตรวจ",
    type: text(value.type) || "application/octet-stream",
    size: numberOrNull(value.size) || 0,
    addedAt: text(value.addedAt) || null,
  };
}

function normalizeReviewDetail(value) {
  const source = value && typeof value === "object" ? value : {};
  const history = Array.isArray(source.history)
    ? source.history.map((entry) => ({
      status: VEHICLE_REVIEW_STATUS_VALUES.has(entry?.status) ? entry.status : "pending",
      correctedValue: text(entry?.correctedValue) || null,
      correctionTarget: text(entry?.correctionTarget) || null,
      reasonCode: text(entry?.reasonCode) || null,
      note: text(entry?.note),
      reviewedAt: text(entry?.reviewedAt) || null,
      reviewedBy: text(entry?.reviewedBy) || null,
    })).filter((entry) => entry.status !== "pending" || entry.reasonCode || entry.correctedValue || entry.correctionTarget || entry.note)
    : [];
  return {
    correctedValue: text(source.correctedValue) || null,
    correctionTarget: text(source.correctionTarget) || null,
    reasonCode: text(source.reasonCode) || null,
    note: text(source.note),
    reviewedAt: text(source.reviewedAt) || null,
    reviewedBy: text(source.reviewedBy) || null,
    evidenceAttachment: normalizeReviewEvidenceAttachment(source.evidenceAttachment),
    history,
  };
}

function normalizeReviewDetails(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(VEHICLE_REVIEW_DETAIL_KEYS.map((key) => [key, normalizeReviewDetail(source[key])]));
}

export function getVehicleReviewDetail(row, dimension = "plate") {
  return normalizeReviewDetail(row?.reviewDetails?.[dimension]);
}

export const VEHICLE_SEARCH_REQUEST_FIELDS = Object.freeze({
  dateFrom: "startDate",
  dateTo: "endDate",
});

export const VEHICLE_SEARCH_DEFAULT_PAGE_SIZE = 200;
export const VEHICLE_SEARCH_DEFAULT_PAGE = 1;

const DEFAULT_PLATE_IMAGE_KEYS = Object.freeze([
  "lpr_crop_path",
  "lprCropPath",
  "lpr_crop_url",
  "lprCropUrl",
  "plate_crop_path",
  "plateCropPath",
  "plate_crop_url",
  "plateCropUrl",
  "crop_path",
  "cropPath",
  "crop_url",
  "cropUrl",
  "plate_path",
  "platePath",
  "plate_url",
  "plateUrl",
  "image_url",
  "imageUrl",
]);

const DEFAULT_LPR_IMAGE_KEYS = Object.freeze([
  "lpr_path",
  "lprPath",
  "lpr_url",
  "lprUrl",
  "lpr_image_path",
  "lprImagePath",
  "lpr_image_url",
  "lprImageUrl",
  "lpr_image",
  "lprImage",
  "original_lpr_path",
  "originalLprPath",
]);

const DEFAULT_PROVINCE_KEYS = Object.freeze(["province", "provinceName", "จังหวัด"]);

function text(value) {
  return String(value ?? "").trim();
}

function normalizedKey(value) {
  return text(value).toLowerCase().replace(/[\s_-]+/g, "");
}

function scalarPlate(value) {
  if (typeof value === "string" || typeof value === "number") {
    const result = text(value);
    return result || "";
  }
  return "";
}

export function normalizeVehicleSearchCriteria(criteria = {}) {
  const source = criteria && typeof criteria === "object" ? criteria : {};
  const legacyStart = text(source.dateFrom);
  const legacyEnd = text(source.dateTo);
  return {
    startAt: text(source.startAt) || (legacyStart ? `${legacyStart}T00:00` : ""),
    endAt: text(source.endAt) || (legacyEnd ? `${legacyEnd}T23:59` : ""),
  };
}

export function toBangkokDateTime(value) {
  const local = text(value);
  if (!local) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(local)) return `${local}T00:00:00+07:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return `${local}:00+07:00`;
  return local;
}

export function buildVehicleSearchPayload(criteria = {}, { page = VEHICLE_SEARCH_DEFAULT_PAGE, pageSize = VEHICLE_SEARCH_DEFAULT_PAGE_SIZE, apiProfile = VEHICLE_API_PROFILES.LEGACY_V1 } = {}) {
  const normalized = normalizeVehicleSearchCriteria(criteria);
  const requestFields = getVehicleApiAdapter(apiProfile).requestFields;
  const payload = {
    pageSize,
    page,
  };
  const startDate = toBangkokDateTime(normalized.startAt);
  const endDate = toBangkokDateTime(normalized.endAt);
  if (startDate) payload[requestFields.dateFrom] = startDate;
  if (endDate) payload[requestFields.dateTo] = endDate;
  return payload;
}

export function buildVehicleSearchProxyRequest(criteria = {}, baseUrl = VEHICLE_SEARCH_DEFAULT_BASE_URL, { apiProfile = VEHICLE_API_PROFILES.LEGACY_V1 } = {}) {
  const normalizedBaseUrl = normalizeVehicleSearchBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return null;
  const request = { baseUrl: normalizedBaseUrl, payload: buildVehicleSearchPayload(criteria, { apiProfile }) };
  return apiProfile === VEHICLE_API_PROFILES.LEGACY_V1 ? request : { ...request, apiProfile };
}

function plateFromRecord(record, plateKeys, depth = 0) {
  const direct = scalarPlate(record);
  if (direct) return direct;
  if (!record || typeof record !== "object" || depth > 2) return "";

  const wanted = new Set(plateKeys.map(normalizedKey));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(normalizedKey(key))) {
      const plate = scalarPlate(value);
      if (plate) return plate;
    }
  }

  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const plate = plateFromRecord(value, plateKeys, depth + 1);
      if (plate) return plate;
    }
  }
  return "";
}

function imagePathFromRecord(record, imageKeys = DEFAULT_PLATE_IMAGE_KEYS, depth = 0) {
  if (!record || typeof record !== "object" || depth > 3) return "";
  const entries = Object.entries(record);
  for (const imageKey of imageKeys) {
    const wanted = normalizedKey(imageKey);
    const entry = entries.find(([key]) => normalizedKey(key) === wanted);
    if (entry) {
      const imagePath = scalarPlate(entry[1]);
      if (imagePath) return imagePath;
    }
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const imagePath = imagePathFromRecord(value, imageKeys, depth + 1);
      if (imagePath) return imagePath;
    }
  }
  return "";
}

function fieldFromRecord(record, fieldKeys, depth = 0) {
  if (!record || typeof record !== "object" || depth > 3) return "";
  const entries = Object.entries(record);
  for (const fieldKey of fieldKeys) {
    const wanted = normalizedKey(fieldKey);
    const entry = entries.find(([key]) => normalizedKey(key) === wanted);
    const value = scalarPlate(entry?.[1]);
    if (value) return value;
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const field = fieldFromRecord(value, fieldKeys, depth + 1);
      if (field) return field;
    }
  }
  return "";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function arrayValue(value) {
  return Array.isArray(value) ? value.filter((entry) => entry !== null && entry !== undefined && String(entry).trim() !== "").map((entry) => String(entry)) : [];
}

function booleanOrNull(value) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function normalizeAxle(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    groupId: numberOrNull(source.groupID ?? source.groupId),
    number: numberOrNull(source.number),
    speedLeft: numberOrNull(source.speedLeft),
    speedRight: numberOrNull(source.speedRight),
    weight: numberOrNull(source.weight),
    weightLeft: numberOrNull(source.weightLeft),
    weightRight: numberOrNull(source.weightRight),
    wheelbase: numberOrNull(source.wheelbase),
    dualTire: booleanOrNull(source.dualTire),
  };
}

function normalizeAxleAfterAllowance(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    allowance: numberOrNull(source.allowance),
    axleWeight: numberOrNull(source.axleWeight),
    number: numberOrNull(source.number),
  };
}

function warning(code, message) {
  return { code, message };
}

function addWarning(warnings, code, message) {
  if (!warnings.some((entry) => entry.code === code)) warnings.push(warning(code, message));
  return warnings;
}

export function getVehicleSearchIntegrityWarnings(record = {}) {
  const source = record && typeof record === "object" ? record : {};
  const occurredAt = text(source.occurredAt || source.stamp || source.eventAt);
  const stationId = text(source.stationId || source.stationID);
  const lane = text(source.lane);
  const vehicleClassId = text(source.vehicleClassId || source.VehicleClassID);
  const axleCount = numberOrNull(source.axleCount ?? source.axlesCount);
  const grossWeight = numberOrNull(source.grossWeight ?? source.gvw ?? source.GVW_Weight ?? source.GVWWeight ?? source.weight);
  const grossWeightLimit = numberOrNull(source.grossWeightLimit ?? source.gvwMax ?? source.GVW_Weight_Max ?? source.GVWWeightMax ?? source.weightMax);
  const leftWeight = numberOrNull(source.leftWeight);
  const rightWeight = numberOrNull(source.rightWeight);
  const isOverweight = booleanOrNull(source.isOverweight);
  const axles = Array.isArray(source.axles) ? source.axles : [];
  const errorFlags = arrayValue(source.errorFlags);
  const warningFlags = arrayValue(source.warningFlags);
  const result = [];
  const missing = [
    !occurredAt && "เวลา",
    !stationId && "สถานี",
    !lane && "Lane",
    !vehicleClassId && "ประเภทรถ",
    axleCount === null && "จำนวนเพลา",
    grossWeight === null && "น้ำหนักรวม",
    grossWeightLimit === null && "น้ำหนักสูงสุด",
  ].filter(Boolean);
  if (missing.length) result.push(warning("missing-required-fields", `ข้อมูลหลักไม่ครบ: ${missing.join(", ")}`));
  if (grossWeight !== null && axles.length > 0) {
    const axleTotal = axles.reduce((total, axle) => total + (numberOrNull(axle?.weight) || 0), 0);
    if (Math.abs(grossWeight - axleTotal) > 1) result.push(warning("gross-weight-mismatch", "น้ำหนักรวมไม่ตรงกับผลรวมน้ำหนักเพลา"));
  }
  if (axleCount !== null && axleCount !== axles.length) result.push(warning("axle-count-mismatch", "จำนวนเพลาไม่ตรงกับรายการเพลาที่ส่งมา"));
  if (axles.some((axle) => {
    const axleWeight = numberOrNull(axle?.weight);
    const axleLeft = numberOrNull(axle?.weightLeft);
    const axleRight = numberOrNull(axle?.weightRight);
    return axleWeight !== null && axleLeft !== null && axleRight !== null && Math.abs(axleWeight - axleLeft - axleRight) > 1;
  })) result.push(warning("axle-side-weight-mismatch", "น้ำหนักเพลาไม่ตรงกับซ้ายบวกขวา"));
  if (grossWeight !== null && leftWeight !== null && rightWeight !== null && Math.abs(grossWeight - leftWeight - rightWeight) > 1) result.push(warning("gross-side-weight-mismatch", "น้ำหนักรวมไม่ตรงกับน้ำหนักซ้ายบวกขวา"));
  if (grossWeight !== null && grossWeightLimit !== null && isOverweight !== null && isOverweight !== (grossWeight > grossWeightLimit)) result.push(warning("overweight-flag-mismatch", "สถานะ overload ไม่สอดคล้องกับน้ำหนักรวมและค่าสูงสุด"));
  if (errorFlags.length) result.push(warning("error-flags", `พบ error flags ${errorFlags.length} รายการ`));
  if (warningFlags.length) result.push(warning("warning-flags", `พบ warning flags ${warningFlags.length} รายการ`));
  return result;
}

function overviewPathFromRecord(record) {
  const directPath = scalarPlate(record?.overviewPath || record?.overview_path);
  if (directPath) return directPath;
  const images = Array.isArray(record?.images) ? record.images : [];
  const candidates = images
    .filter((image) => image && typeof image === "object")
    .map((image) => scalarPlate(image.path || image.url))
    .filter(Boolean);
  return candidates.find((value) => /(?:^|\/)overview\//i.test(value)) || "";
}

function imageReferenceHasDirectory(value, directory) {
  const reference = text(value);
  const hasDirectory = (path) => new RegExp(`(?:^|/)${directory}/`, "i").test(text(path).replace(/^\/+/, ""));
  if (hasDirectory(reference)) return true;
  try {
    const parsed = new URL(reference, "http://localhost");
    return hasDirectory(parsed.searchParams.get("path")) || hasDirectory(parsed.pathname);
  } catch {
    return false;
  }
}

function lprImagePathFromCropReference(value) {
  const reference = text(value);
  if (!reference) return "";
  let imagePath = reference;
  try {
    const parsed = new URL(reference, "http://localhost");
    imagePath = parsed.searchParams.get("path") || parsed.pathname.replace(/^\/+/, "");
  } catch {
    imagePath = reference.replace(/^\/+/, "");
  }
  const match = imagePath.match(/^crop\/(.*\/)?([^/]+)_cropped(\.(?:jpe?g|png|webp|bmp))$/i);
  if (!match) return "";
  return `lpr/${match[1] || ""}${match[2]}${match[3]}`;
}

function lprPathFromRecord(record) {
  const directPath = imagePathFromRecord(record, DEFAULT_LPR_IMAGE_KEYS);
  if (directPath) return directPath;
  const lprRecord = record?.lpr && typeof record.lpr === "object" ? record.lpr : null;
  const nestedPath = scalarPlate(lprRecord?.path || lprRecord?.url || lprRecord?.imagePath || lprRecord?.imageUrl || lprRecord?.image);
  if (nestedPath) return nestedPath;
  const genericImagePath = imagePathFromRecord(record, ["image_path", "imagePath", "image_url", "imageUrl"]);
  if (imageReferenceHasDirectory(genericImagePath, "lpr")) return genericImagePath;
  const images = Array.isArray(record?.images) ? record.images : [];
  const taggedImage = images.find((image) => {
    if (!image || typeof image !== "object") return false;
    const kind = normalizedKey(image.type || image.kind || image.role || image.category || image.label || image.name);
    return ["lpr", "lprimage", "lprcamera", "licenseplaterecognition", "licenseplaterecognitionimage"].includes(kind);
  });
  const taggedPath = scalarPlate(taggedImage?.path || taggedImage?.url);
  if (taggedPath) {
    if (/^(?:https?:|data:|blob:)/i.test(taggedPath) || /^(?:crop|lpr|overview)\//i.test(taggedPath.replace(/^\/+/, ""))) return taggedPath;
    return `lpr/${taggedPath.replace(/^\/+/, "")}`;
  }
  return images
    .filter((image) => image && typeof image === "object")
    .map((image) => scalarPlate(image.path || image.url))
    .find((value) => imageReferenceHasDirectory(value, "lpr")) || "";
}

function vehicleMetadataFromRecord(record) {
  const plate = record?.plate && typeof record.plate === "object" ? record.plate : {};
  return {
    stationId: text(record?.stationID || record?.stationId || record?.station?.stationID) || null,
    stationName: text(record?.station?.stationName || record?.stationName) || null,
    vehicleId: text(record?.vehicleId) || null,
    occurredAt: text(record?.stamp || record?.eventAt) || null,
    lane: text(record?.lane) || null,
    vehicleClassId: text(record?.VehicleClassID || record?.vehicleClassId) || null,
    vehicleClassLabel: text(record?.BosureDescription || record?.bosureDescription || record?.vehicleClassLabel || record?.LongDescription || record?.longDescription) || "ไม่ระบุประเภทรถ",
    vehicleDescription: text(record?.LongDescription || record?.longDescription) || null,
    vehicleClassDisplayId: numberOrNull(record?.DisplayID ?? record?.displayId),
    vehicleClassReference: text(record?.Reference || record?.reference) || null,
    axleCount: numberOrNull(record?.axlesCount),
    axles: Array.isArray(record?.axles) ? record.axles.map(normalizeAxle) : [],
    axlesAfterAllowance: Array.isArray(record?.axlesAfterAllowance) ? record.axlesAfterAllowance.map(normalizeAxleAfterAllowance) : [],
    grossWeight: numberOrNull(record?.gvw ?? record?.GVW_Weight ?? record?.GVWWeight ?? record?.weight),
    grossWeightLimit: numberOrNull(record?.GVW_Weight_Max ?? record?.GVWWeightMax ?? record?.gvwMax ?? record?.weightMax),
    leftWeight: numberOrNull(record?.leftWeight),
    rightWeight: numberOrNull(record?.rightWeight),
    speed: numberOrNull(record?.speed),
    length: numberOrNull(record?.length),
    esal: numberOrNull(record?.esal),
    isOverweight: booleanOrNull(record?.isOverweight),
    overweightPercentage: numberOrNull(record?.overweightPercentage),
    errorFlags: arrayValue(record?.errorFlags),
    warningFlags: arrayValue(record?.warningFlags),
    plateNumber: scalarPlate(plate.license_plate) || fieldFromRecord(record, DEFAULT_PLATE_KEYS) || null,
  };
}

function buildVehicleSearchConfiguredImageUrl(imagePath, searchUrl, apiProfile) {
  const normalizedSearchUrl = normalizeVehicleSearchEndpoint(searchUrl);
  if (!normalizedSearchUrl || isOriginEndpoint(normalizedSearchUrl)) return "";
  try {
    const parsed = new URL(normalizedSearchUrl);
    const target = parsed.searchParams.get("target");
    if (target) {
      const targetUrl = new URL(target);
      if (!["http:", "https:"].includes(targetUrl.protocol) || targetUrl.username || targetUrl.password || targetUrl.hash) return "";
      targetUrl.pathname = getVehicleApiAdapter(apiProfile).imagePath;
      targetUrl.searchParams.set("path", imagePath);
      const passthroughParams = [...parsed.searchParams.entries()]
        .filter(([key]) => key !== "target")
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      const query = [`target=${targetUrl.toString()}`, ...passthroughParams].join("&");
      return `${parsed.origin}${parsed.pathname}?${query}`;
    }
    parsed.pathname = getVehicleApiAdapter(apiProfile).imagePath;
    parsed.search = "";
    parsed.searchParams.set("path", imagePath);
    return parsed.toString();
  } catch {
    return "";
  }
}

export function buildVehicleSearchImageUrl(imagePath, baseUrl = VEHICLE_SEARCH_DEFAULT_BASE_URL, { direct = false, apiProfile = VEHICLE_API_PROFILES.LEGACY_V1, searchUrl = "", stationId = "" } = {}) {
  const value = scalarPlate(imagePath).replace(/^\/+/, "");
  const normalizedBaseUrl = normalizeVehicleSearchBaseUrl(baseUrl);
  if (!normalizedBaseUrl || !/^(?:crop|lpr|overview)\/[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=@%/-]*$/.test(value) || value.split("/").includes("..")) return "";
  const configuredImageUrl = buildVehicleSearchConfiguredImageUrl(value, searchUrl, apiProfile);
  if (configuredImageUrl) return configuredImageUrl;
  if (direct) return `${normalizedBaseUrl}${getVehicleApiAdapter(apiProfile).imagePath}?path=${encodeURIComponent(value)}`;
  const profileQuery = apiProfile === VEHICLE_API_PROFILES.LEGACY_V1 ? "" : `&apiProfile=${encodeURIComponent(apiProfile)}`;
  const stationQuery = stationId ? `&stationId=${encodeURIComponent(stationId)}` : "";
  return `${VEHICLE_SEARCH_IMAGE_ENDPOINT}?baseUrl=${encodeURIComponent(normalizedBaseUrl)}${profileQuery}${stationQuery}&path=${encodeURIComponent(value)}`;
}

function normalizeVehicleImageReference(imageUrl, baseUrl, { apiProfile = VEHICLE_API_PROFILES.LEGACY_V1, searchUrl = "", stationId = "" } = {}) {
  const value = text(imageUrl);
  if (!value) return "";
  if (/^(?:data:|blob:)/i.test(value)) return value;
  if (/^https?:/i.test(value)) {
    try {
      const parsed = new URL(value);
      const matchingProfile = getVehicleApiProfileByImagePath(parsed.pathname);
      const imagePath = parsed.searchParams.get("path") || "";
      if (matchingProfile && imagePath) {
        return buildVehicleSearchImageUrl(imagePath, parsed.origin || baseUrl, {
          apiProfile: matchingProfile,
          searchUrl,
          stationId,
        }) || value;
      }
    } catch {
      return value;
    }
  }
  return buildVehicleSearchImageUrl(value, baseUrl, { apiProfile, searchUrl, stationId }) || value;
}

export function buildVehicleSearchDirectImageUrl(imageUrl, fallbackBaseUrl = VEHICLE_SEARCH_DEFAULT_BASE_URL) {
  const value = text(imageUrl);
  if (!value) return "";
  if (/^(?:https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith(`${VEHICLE_SEARCH_IMAGE_ENDPOINT}/`)) {
    const imagePath = value.slice(`${VEHICLE_SEARCH_IMAGE_ENDPOINT}/`.length);
    return buildVehicleSearchDirectImageUrl(buildVehicleSearchImageUrl(imagePath, fallbackBaseUrl));
  }
  if (value.startsWith(`${VEHICLE_SEARCH_IMAGE_ENDPOINT}?`)) {
    try {
      const parsed = new URL(value, "http://localhost");
      const imagePath = parsed.searchParams.get("path") || "";
      const baseUrl = parsed.searchParams.get("baseUrl") || fallbackBaseUrl;
      const apiProfile = parsed.searchParams.get("apiProfile") || VEHICLE_API_PROFILES.LEGACY_V1;
      const normalizedBaseUrl = normalizeVehicleSearchBaseUrl(baseUrl);
      const safePath = buildVehicleSearchImageUrl(imagePath, normalizedBaseUrl, { apiProfile });
      if (!safePath) return "";
      const safeParsed = new URL(safePath, "http://localhost");
      return `${normalizedBaseUrl}${getVehicleApiAdapter(apiProfile).imagePath}?path=${encodeURIComponent(safeParsed.searchParams.get("path") || imagePath)}`;
    } catch {
      return "";
    }
  }
  return "";
}

function imageUrlFromRecord(record, imageKeys, baseUrl, { directImages = false, apiProfile = VEHICLE_API_PROFILES.LEGACY_V1, searchUrl = "", stationId = "" } = {}) {
  const imagePath = imagePathFromRecord(record, imageKeys);
  if (/^(?:https?:|data:|blob:)/i.test(imagePath)) {
    return normalizeVehicleImageReference(imagePath, baseUrl, { apiProfile, searchUrl, stationId });
  }
  return buildVehicleSearchImageUrl(imagePath, baseUrl, { direct: directImages, apiProfile, searchUrl, stationId });
}

function storedImageUrl(value, baseUrl, { direct = false, apiProfile = VEHICLE_API_PROFILES.LEGACY_V1, searchUrl = "", stationId = "" } = {}) {
  const stored = text(value);
  if (!stored) return null;
  if (/^(?:https?:|data:|blob:)/i.test(stored)) return normalizeVehicleImageReference(stored, baseUrl, { apiProfile, searchUrl, stationId }) || stored;
  return buildVehicleSearchImageUrl(stored, baseUrl, { direct, apiProfile, searchUrl, stationId }) || buildVehicleSearchDirectImageUrl(stored, baseUrl) || null;
}

function rowId(record, index) {
  if (record && typeof record === "object") {
    const identifier = record.id || record.eventId || record.vehicleId || record.uuid;
    if (typeof identifier === "string" || typeof identifier === "number") {
      const value = text(identifier);
      if (value) return `vehicle-${value}`;
    }
  }
  return `vehicle-${index + 1}`;
}

export function normalizeVehicleSearchRows(payload, {
  resultPath,
  plateKeys = DEFAULT_PLATE_KEYS,
  imageKeys = DEFAULT_PLATE_IMAGE_KEYS,
  baseUrl,
  directImages = false,
  apiProfile = VEHICLE_API_PROFILES.LEGACY_V1,
  searchUrl = "",
  stationProfileId = "",
} = {}) {
  const records = vehicleRecordsFromPayload(payload, resultPath);
  const rows = [];
  const usedIds = new Map();
  records.forEach((record, index) => {
    const metadata = vehicleMetadataFromRecord(record);
    const plateNumber = metadata.plateNumber || plateFromRecord(record, plateKeys);
    const baseId = rowId(record, index);
    const occurrence = (usedIds.get(baseId) || 0) + 1;
    usedIds.set(baseId, occurrence);
    const imageStationId = stationProfileId || metadata.stationId;
    const plateImagePath = imagePathFromRecord(record, imageKeys);
    const plateImage = plateImagePath
      && !imageReferenceHasDirectory(plateImagePath, "lpr")
      && !imageReferenceHasDirectory(plateImagePath, "overview")
      ? imageUrlFromRecord(record, imageKeys, baseUrl, { directImages, apiProfile, searchUrl, stationId: imageStationId }) || null
      : null;
    const lprImagePath = lprPathFromRecord(record) || lprImagePathFromCropReference(plateImagePath);
    const lprImage = storedImageUrl(lprImagePath, baseUrl, { direct: directImages, apiProfile, searchUrl, stationId: imageStationId });
    const overviewImage = storedImageUrl(overviewPathFromRecord(record), baseUrl, { direct: directImages, apiProfile, searchUrl, stationId: imageStationId });
    const integrityWarnings = getVehicleSearchIntegrityWarnings({ ...metadata, stationId: metadata.stationId, vehicleClassId: metadata.vehicleClassId, axleCount: metadata.axleCount });
    if (!plateNumber) addWarning(integrityWarnings, "missing-plate", "ไม่พบผลอ่านเลขทะเบียน");
    if (!plateImage && !lprImage && !overviewImage) addWarning(integrityWarnings, "missing-images", "ไม่พบ path ภาพ LPR ภาพป้าย หรือภาพรถสำหรับตรวจสอบ");
    rows.push({
      id: occurrence === 1 ? baseId : `${baseId}-${occurrence}`,
      ...metadata,
      plateNumber: plateNumber || "ไม่พบผลอ่านป้าย",
      province: fieldFromRecord(record, DEFAULT_PROVINCE_KEYS) || null,
      plateImage,
      lprImage,
      overviewImage,
      integrityWarnings,
      reviewStatus: "pending",
      classificationReviewStatus: "pending",
      axleReviewStatus: "pending",
      integrityReviewStatus: "pending",
      reviewDetails: normalizeReviewDetails(),
    });
  });
  return rows;
}

export function createEmptyVehicleSearchState(criteria = {}) {
  return {
    criteria: normalizeVehicleSearchCriteria(criteria),
    fetchedAt: null,
    rows: [],
  };
}

export function normalizeVehicleSearchState(value, fallbackCriteria = {}, { baseUrl = VEHICLE_SEARCH_DEFAULT_BASE_URL, apiProfile = VEHICLE_API_PROFILES.LEGACY_V1 } = {}) {
  const source = value && typeof value === "object" ? value : {};
  const usedIds = new Map();
  const rows = Array.isArray(source.rows)
    ? source.rows.map((row, index) => {
      const plateNumber = scalarPlate(row?.plateNumber || row?.licensePlate || row?.plate);
      const reviewStatus = VEHICLE_REVIEW_STATUS_VALUES.has(row?.reviewStatus) ? row.reviewStatus : "pending";
      const baseId = text(row?.id) || `vehicle-${index + 1}`;
      const occurrence = (usedIds.get(baseId) || 0) + 1;
      usedIds.set(baseId, occurrence);
      const storedRowId = text(row?.id);
      const storedImage = text(row?.plateImage || row?.imageUrl || row?.image);
      const storedStationId = text(row?.stationId);
      const legacyImagePath = storedImage.startsWith(`${VEHICLE_SEARCH_IMAGE_ENDPOINT}/`)
        ? storedImage.slice(`${VEHICLE_SEARCH_IMAGE_ENDPOINT}/`.length)
        : "";
      const plateImage = buildVehicleSearchImageUrl(legacyImagePath, baseUrl, { apiProfile, stationId: storedStationId })
        || normalizeVehicleImageReference(storedImage, baseUrl, { apiProfile, stationId: storedStationId })
        || storedImage;
      const explicitLprImage = storedImageUrl(row?.lprImage || row?.lprUrl || row?.lprImageUrl, baseUrl, { apiProfile, stationId: storedStationId });
      const inferredLprPath = lprImagePathFromCropReference(storedImage || plateImage);
      const lprImage = explicitLprImage || storedImageUrl(inferredLprPath, baseUrl, { apiProfile, stationId: storedStationId });
      const overviewImage = storedImageUrl(row?.overviewImage || row?.overviewUrl || row?.vehicleImage, baseUrl, { apiProfile, stationId: storedStationId });
      const province = scalarPlate(row?.province || row?.provinceName || row?.plateProvince);
      const integrityWarnings = Array.isArray(row?.integrityWarnings) ? row.integrityWarnings.map((entry) => ({ code: text(entry?.code), message: text(entry?.message) })).filter((entry) => entry.code && entry.message) : getVehicleSearchIntegrityWarnings(row);
      if (!plateImage && !lprImage && !overviewImage) addWarning(integrityWarnings, "missing-images", "ไม่พบ path ภาพ LPR ภาพป้าย หรือภาพรถสำหรับตรวจสอบ");
      return {
        id: occurrence === 1 ? baseId : `${baseId}-${occurrence}`,
        vehicleId: text(row?.vehicleId) || null,
        plateNumber: plateNumber || "ไม่พบผลอ่านป้าย",
        province: province || null,
        plateImage: plateImage || null,
        lprImage,
        overviewImage,
        reviewStatus,
        classificationReviewStatus: VEHICLE_REVIEW_STATUS_VALUES.has(row?.classificationReviewStatus) ? row.classificationReviewStatus : "pending",
        axleReviewStatus: VEHICLE_REVIEW_STATUS_VALUES.has(row?.axleReviewStatus) ? row.axleReviewStatus : "pending",
        stationId: text(row?.stationId) || null,
        stationName: text(row?.stationName) || null,
        occurredAt: text(row?.occurredAt) || null,
        lane: text(row?.lane) || null,
        vehicleClassId: text(row?.vehicleClassId) || null,
        vehicleClassLabel: text(row?.vehicleClassLabel) || "ไม่ระบุประเภทรถ",
        vehicleDescription: text(row?.vehicleDescription) || null,
        vehicleClassDisplayId: numberOrNull(row?.vehicleClassDisplayId),
        vehicleClassReference: text(row?.vehicleClassReference) || null,
        axleCount: numberOrNull(row?.axleCount),
        axles: Array.isArray(row?.axles) ? row.axles.map(normalizeAxle) : [],
        axlesAfterAllowance: Array.isArray(row?.axlesAfterAllowance) ? row.axlesAfterAllowance.map(normalizeAxleAfterAllowance) : [],
        grossWeight: numberOrNull(row?.grossWeight),
        grossWeightLimit: numberOrNull(row?.grossWeightLimit),
        leftWeight: numberOrNull(row?.leftWeight),
        rightWeight: numberOrNull(row?.rightWeight),
        speed: numberOrNull(row?.speed),
        length: numberOrNull(row?.length),
        esal: numberOrNull(row?.esal),
        isOverweight: booleanOrNull(row?.isOverweight),
        overweightPercentage: numberOrNull(row?.overweightPercentage),
        errorFlags: arrayValue(row?.errorFlags),
        warningFlags: arrayValue(row?.warningFlags),
        integrityWarnings: plateNumber ? integrityWarnings : [...integrityWarnings, { code: "missing-plate", message: "ไม่พบผลอ่านเลขทะเบียน" }].filter((entry, index, entries) => entries.findIndex((candidate) => candidate.code === entry.code) === index),
        integrityReviewStatus: VEHICLE_REVIEW_STATUS_VALUES.has(row?.integrityReviewStatus) ? row.integrityReviewStatus : "pending",
        reviewDetails: normalizeReviewDetails(row?.reviewDetails),
      };
    }).filter(Boolean)
    : [];
  return {
    apiProfile: isVehicleApiProfile(source.apiProfile) ? source.apiProfile : apiProfile,
    criteria: normalizeVehicleSearchCriteria({ ...fallbackCriteria, ...(source.criteria || {}) }),
    fetchedAt: text(source.fetchedAt) || null,
    emptyResultAcknowledgedAt: text(source.emptyResultAcknowledgedAt) || null,
    ...(Object.hasOwn(source, "scopeKey") ? { scopeKey: text(source.scopeKey) || null } : {}),
    pagination: source.pagination && typeof source.pagination === "object" ? {
      totalItems: numberOrNull(source.pagination.totalItems) ?? rows.length,
      totalPages: numberOrNull(source.pagination.totalPages) ?? (rows.length ? 1 : 0),
      pageSize: numberOrNull(source.pagination.pageSize) ?? VEHICLE_SEARCH_DEFAULT_PAGE_SIZE,
    } : { totalItems: rows.length, totalPages: rows.length ? 1 : 0, pageSize: VEHICLE_SEARCH_DEFAULT_PAGE_SIZE },
    sourceStation: source.sourceStation && typeof source.sourceStation === "object" ? { id: text(source.sourceStation.id) || null, name: text(source.sourceStation.name) || null } : null,
    rows,
  };
}

function reviewTimeValue(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function getVehicleReviewGroupKey(row = {}) {
  const vehicleClassId = text(row.vehicleClassId) || "unknown";
  const vehicleClassDescription = text(row.vehicleClassLabel) || "ไม่ระบุประเภทรถ";
  const lane = text(row.lane) || "unknown";
  return `${vehicleClassId}::${vehicleClassDescription}::${lane}`;
}

export function getVehicleReviewRows(value, { baseUrl, apiProfile } = {}) {
  const state = normalizeVehicleSearchState(value, {}, { baseUrl, apiProfile });
  return [...state.rows].sort((left, right) => {
    const byTime = reviewTimeValue(left.occurredAt) - reviewTimeValue(right.occurredAt);
    return byTime || text(left.id).localeCompare(text(right.id), "en");
  });
}

export function getVehicleReviewNavigation(value, { rowId = "", direction = "next" } = {}) {
  const rows = getVehicleReviewRows(value);
  if (!rows.length) return null;
  const currentIndex = rows.findIndex((row) => row.id === text(rowId));
  const offset = direction === "previous" ? -1 : 1;
  const nextIndex = currentIndex < 0 ? (offset < 0 ? rows.length - 1 : 0) : currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= rows.length) return null;
  return rows[nextIndex];
}

export function getNextPendingVehicleId(value, { rowId = "", reviewVersion = VEHICLE_API_REVIEW_VERSION, context = "" } = {}) {
  const rows = getVehicleReviewRows(value);
  if (!rows.length) return null;
  const dimensions = reviewDimensionsForVersion(reviewVersion, context);
  const isPending = (row) => dimensions.some(({ statusKey }) => ["pending", "unable-to-verify"].includes(row[statusKey]));
  const currentIndex = rows.findIndex((row) => row.id === text(rowId));
  const ordered = currentIndex < 0 ? rows : [...rows.slice(currentIndex + 1), ...rows.slice(0, currentIndex + 1)];
  return ordered.find(isPending)?.id || null;
}

export function getVehicleQueueGroups(value, { reviewVersion = VEHICLE_API_REVIEW_VERSION, context = "" } = {}) {
  const state = normalizeVehicleSearchState(value);
  const dimensions = reviewDimensionsForVersion(reviewVersion, context);
  return Object.values(state.rows.reduce((groups, row) => {
    const key = getVehicleReviewGroupKey(row);
    const group = groups[key] || { key, vehicleClassId: row.vehicleClassId, label: row.vehicleClassLabel, lane: row.lane, rows: [], total: 0, reviewed: 0, correct: 0, incorrect: 0, pending: 0, unableToVerify: 0, classificationReviewed: 0, classificationCorrect: 0, classificationIncorrect: 0, classificationPending: 0, classificationUnableToVerify: 0, axleReviewed: 0, axleCorrect: 0, axleIncorrect: 0, axlePending: 0, axleUnableToVerify: 0, integrityReviewed: 0, integrityCorrect: 0, integrityIncorrect: 0, integrityPending: 0, integrityUnableToVerify: 0, pendingChecks: 0, unableToVerifyChecks: 0, unresolvedChecks: 0, completeRows: 0 };
    group.rows.push(row);
    group.total += 1;
    if (row.reviewStatus === "unable-to-verify") group.unableToVerify += 1;
    else if (Object.hasOwn(group, row.reviewStatus)) group[row.reviewStatus] += 1;
    if (["correct", "incorrect"].includes(row.reviewStatus)) group.reviewed += 1;
    const dimensionCounters = [
      ["classification", row.classificationReviewStatus],
      ["axle", row.axleReviewStatus],
      ["integrity", row.integrityReviewStatus],
    ];
    dimensionCounters.forEach(([prefix, statusValue]) => {
      const status = VEHICLE_REVIEW_STATUS_VALUES.has(statusValue) ? statusValue : "pending";
      const suffix = status[0].toUpperCase() + status.slice(1).replaceAll("-", "");
      const keyName = `${prefix}${suffix}`;
      if (Object.hasOwn(group, keyName)) group[keyName] += 1;
    });
    group.pendingChecks += dimensions.filter(({ statusKey }) => row[statusKey] === "pending").length;
    group.unableToVerifyChecks += dimensions.filter(({ statusKey }) => row[statusKey] === "unable-to-verify").length;
    group.unresolvedChecks = group.pendingChecks + group.unableToVerifyChecks;
    if (dimensions.every(({ statusKey }) => !["pending", "unable-to-verify"].includes(row[statusKey]))) group.completeRows += 1;
    groups[key] = group;
    return groups;
  }, {})).sort((a, b) => `${a.label} ${a.lane}`.localeCompare(`${b.label} ${b.lane}`, "th"));
}

export function updateVehicleSearchReview(value, rowIdValue, reviewStatus) {
  return updateVehicleSearchDimensionReview(value, rowIdValue, "plate", reviewStatus);
}

function reviewStatusKeyForDimension(dimension) {
  return dimension === "classification"
    ? "classificationReviewStatus"
    : dimension === "axle" || dimension === "axles"
      ? "axleReviewStatus"
      : dimension === "integrity"
        ? "integrityReviewStatus"
        : dimension === "plate"
          ? "reviewStatus"
          : "";
}

function reviewDetailKeyForDimension(dimension) {
  return dimension === "axles" ? "axles" : text(dimension) || "plate";
}

export function updateVehicleSearchDimensionReview(value, rowIdValue, dimension, reviewStatus, detailPatch = {}) {
  const state = normalizeVehicleSearchState(value);
  if (!VEHICLE_REVIEW_STATUS_VALUES.has(reviewStatus) || reviewStatus === "pending") return state;
  const statusKey = reviewStatusKeyForDimension(dimension);
  if (!statusKey) return state;
  const targetId = text(rowIdValue);
  const detailKey = reviewDetailKeyForDimension(dimension);
  return {
    ...state,
    rows: state.rows.map((row) => {
      if (row.id !== targetId) return row;
      const currentDetail = normalizeReviewDetail(row.reviewDetails?.[detailKey]);
      const nextDetail = normalizeReviewDetail({ ...currentDetail, ...detailPatch, reviewedAt: detailPatch.reviewedAt || new Date().toISOString() });
      const historyEntry = {
        status: reviewStatus,
        correctedValue: nextDetail.correctedValue,
        correctionTarget: nextDetail.correctionTarget,
        reasonCode: nextDetail.reasonCode,
        note: nextDetail.note,
        reviewedAt: nextDetail.reviewedAt,
        reviewedBy: nextDetail.reviewedBy,
      };
      const history = [...currentDetail.history, historyEntry].slice(-20);
      return { ...row, [statusKey]: reviewStatus, reviewDetails: { ...normalizeReviewDetails(row.reviewDetails), [detailKey]: { ...nextDetail, history } } };
    }),
  };
}

export function updateVehicleSearchReviewDetails(value, rowIdValue, dimension, detailPatch = {}) {
  const state = normalizeVehicleSearchState(value);
  const targetId = text(rowIdValue);
  const detailKey = reviewDetailKeyForDimension(dimension);
  if (!targetId || !VEHICLE_REVIEW_DETAIL_KEYS.includes(detailKey)) return state;
  return {
    ...state,
    rows: state.rows.map((row) => row.id === targetId
      ? { ...row, reviewDetails: { ...normalizeReviewDetails(row.reviewDetails), [detailKey]: normalizeReviewDetail({ ...row.reviewDetails?.[detailKey], ...detailPatch }) } }
      : row),
  };
}

export function getVehicleSearchSummary(value) {
  if (isVehicleReviewScopeState(value)) {
    const summary = getVehicleSearchReviewSummary(value, { context: "plate" });
    return {
      total: summary.plate.total,
      reviewed: summary.plate.reviewed,
      correct: summary.plate.correct,
      incorrect: summary.plate.incorrect,
      pending: summary.plate.pending,
      accuracy: summary.plate.accuracy,
    };
  }
  const state = normalizeVehicleSearchState(value);
  const { total, reviewed, correct, incorrect, pending, accuracy } = dimensionSummary(state.rows, "reviewStatus");
  return { total, reviewed, correct, incorrect, pending, accuracy };
}

const VEHICLE_REVIEW_DIMENSION_LABELS = Object.freeze({
  plate: "ป้ายทะเบียน",
  classification: "การคัดประเภทรถ",
  axles: "จำนวน/รายละเอียดเพลา",
  integrity: "น้ำหนักและความสอดคล้องของข้อมูล",
});

const VEHICLE_REVIEW_STATUS_LABELS = Object.freeze(Object.fromEntries(VEHICLE_REVIEW_STATUS_OPTIONS.map((option) => [option.value, option.label])));

export function getVehicleSearchIssueRows(value, { reviewVersion = VEHICLE_API_REVIEW_VERSION, context = "" } = {}) {
  const state = normalizeVehicleSearchState(value);
  const dimensions = reviewDimensionsForVersion(reviewVersion, context);
  const includeIntegrityWarnings = dimensions.some(({ key }) => key === "integrity");
  const issues = [];
  state.rows.forEach((row) => {
    dimensions.forEach(({ key, statusKey }) => {
      const status = VEHICLE_REVIEW_STATUS_VALUES.has(row[statusKey]) ? row[statusKey] : "pending";
      if (["incorrect", "unable-to-verify"].includes(status)) {
        issues.push({
          id: `${row.id}:${key}`,
          kind: "vehicle-review",
          rowId: row.id,
          dimension: key,
          dimensionLabel: VEHICLE_REVIEW_DIMENSION_LABELS[key] || key,
          status,
          statusLabel: VEHICLE_REVIEW_STATUS_LABELS[status],
          plateNumber: row.plateNumber,
          province: row.province,
          occurredAt: row.occurredAt,
          lane: row.lane,
          vehicleClassLabel: row.vehicleClassLabel,
          correctionTarget: getVehicleReviewDetail(row, key).correctionTarget,
          correctionTargetLabel: (VEHICLE_REVIEW_CORRECTION_TARGET_OPTIONS[key] || []).find((option) => option.value === getVehicleReviewDetail(row, key).correctionTarget)?.label || null,
          reasonCode: getVehicleReviewDetail(row, key).reasonCode,
          reasonLabel: (VEHICLE_REVIEW_REASON_OPTIONS[key] || []).find((option) => option.value === getVehicleReviewDetail(row, key).reasonCode)?.label || null,
          note: getVehicleReviewDetail(row, key).note,
          correctedValue: getVehicleReviewDetail(row, key).correctedValue,
          evidenceAttachment: getVehicleReviewDetail(row, key).evidenceAttachment,
        });
      }
    });
    if (!includeIntegrityWarnings) return;
    (row.integrityWarnings || []).forEach((warningEntry, index) => {
      if (!warningEntry?.code || !warningEntry?.message) return;
      issues.push({
        id: `${row.id}:warning:${warningEntry.code}:${index}`,
        kind: "integrity-warning",
        rowId: row.id,
        dimension: "integrity",
        dimensionLabel: VEHICLE_REVIEW_DIMENSION_LABELS.integrity,
        status: "warning",
        statusLabel: "คำเตือนช่วยตรวจ",
        code: warningEntry.code,
        message: warningEntry.message,
        plateNumber: row.plateNumber,
        province: row.province,
        occurredAt: row.occurredAt,
        lane: row.lane,
        vehicleClassLabel: row.vehicleClassLabel,
      });
    });
  });
  return issues;
}

const vehicleSearchTransport = createVehicleSearchTransport({
  buildVehicleSearchPayload,
  normalizeVehicleSearchCriteria,
  normalizeVehicleSearchRows,
  defaultPage: VEHICLE_SEARCH_DEFAULT_PAGE,
  defaultPageSize: VEHICLE_SEARCH_DEFAULT_PAGE_SIZE,
  defaultEndpoint: VEHICLE_SEARCH_ENDPOINT,
});

export { VehicleSearchError };

export async function searchVehicles(...args) {
  return vehicleSearchTransport.searchVehicles(...args);
}

export async function testVehicleSearchConnection(...args) {
  return vehicleSearchTransport.testVehicleSearchConnection(...args);
}
