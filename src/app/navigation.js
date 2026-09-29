export const DEFAULT_ROUTE_HASH = "#/dashboard";
const APP_HISTORY_KEY = "__checklistAppNavigation";
const APP_HISTORY_VERSION = 1;

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
  if (currentAppHistoryState()) return;
  window.history.replaceState(
    { ...currentHistoryState(), [APP_HISTORY_KEY]: { version: APP_HISTORY_VERSION, index: 0 } },
    "",
    window.location.href,
  );
}

export function canNavigateBackInApp() {
  return Boolean(currentAppHistoryState()?.index > 0);
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
  window.history.pushState(
    { ...currentHistoryState(), [APP_HISTORY_KEY]: { version: APP_HISTORY_VERSION, index: currentIndex + 1 } },
    "",
    nextHash,
  );
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
