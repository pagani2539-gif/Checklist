export const DEFAULT_ROUTE_HASH = "#/dashboard";
const APP_HISTORY_KEY = "__checklistAppNavigation";
const APP_HISTORY_VERSION = 1;
const trailEnds = new Map();

function rememberTrailEnd(entry, index) {
  trailEnds.set(entry.trailId, index);
  try { window.sessionStorage.setItem(`checklist-navigation:${entry.trailId}`, String(index)); } catch {}
}

function trailEnd(entry) {
  if (!entry?.trailId) return entry?.index ?? 0;
  try {
    const stored = window.sessionStorage.getItem(`checklist-navigation:${entry.trailId}`);
    if (stored !== null && Number.isInteger(Number(stored))) return Number(stored);
  } catch {}
  return trailEnds.get(entry.trailId) ?? entry.index;
}

function currentAppHistoryState() {
  if (typeof window === "undefined") return null;
  const entry = window.history.state?.[APP_HISTORY_KEY];
  return entry?.version === APP_HISTORY_VERSION && Number.isInteger(entry.index)
    ? entry
    : null;
}

function currentHistoryState() {
  return typeof window.history.state === "object" && window.history.state !== null
    ? window.history.state
    : {};
}

export function initializeRouteHistory() {
  if (typeof window === "undefined") return;
  const current = currentAppHistoryState();
  if (current?.trailId) return;
  const entry = { version: APP_HISTORY_VERSION, index: current?.index ?? 0, trailId: `${Date.now()}-${Math.random()}` };
  rememberTrailEnd(entry, entry.index);
  window.history.replaceState(
    { ...currentHistoryState(), [APP_HISTORY_KEY]: entry },
    "",
    window.location.href,
  );
}

export function canNavigateBackInApp() {
  return Boolean(currentAppHistoryState()?.index > 0);
}

export function canNavigateForwardInApp() {
  const entry = currentAppHistoryState();
  return Boolean(entry && entry.index < trailEnd(entry));
}

export function navigateForward() {
  if (!canNavigateForwardInApp()) return false;
  window.history.forward();
  return true;
}

export function normalizeHash(target) {
  const value = String(target ?? "").trim();
  if (!value) return DEFAULT_ROUTE_HASH;
  if (value.startsWith("#/")) return value;
  if (value.startsWith("#")) return `#/${value.slice(1).replace(/^\/+/, "")}`;
  return `#/${value.replace(/^\/+/, "")}`;
}

export function navigate(target) {
  if (typeof window === "undefined") return;
  const nextHash = normalizeHash(target);
  if (window.location.hash === nextHash) return;
  initializeRouteHistory();
  const currentIndex = currentAppHistoryState()?.index ?? 0;
  const nextEntry = { ...currentAppHistoryState(), index: currentIndex + 1 };
  window.history.pushState(
    { ...currentHistoryState(), [APP_HISTORY_KEY]: nextEntry },
    "",
    nextHash,
  );
  rememberTrailEnd(nextEntry, nextEntry.index);
  window.dispatchEvent(new Event("hashchange"));
}

export function replaceRoute(target) {
  if (typeof window === "undefined") return;
  const nextHash = normalizeHash(target);
  if (window.location.hash === nextHash) return;
  initializeRouteHistory();
  window.history.replaceState(
    { ...currentHistoryState(), [APP_HISTORY_KEY]: currentAppHistoryState() || { version: APP_HISTORY_VERSION, index: 0 } },
    "",
    nextHash,
  );
  window.dispatchEvent(new Event("hashchange"));
}

export function navigateBack(fallbackTarget) {
  if (typeof window === "undefined") return false;
  if (canNavigateBackInApp()) {
    window.history.back();
    return true;
  }
  if (!fallbackTarget) return false;
  replaceRoute(fallbackTarget);
  return true;
}
