export function domSafeId(value) {
  return String(value || "item").replace(/[^a-zA-Z0-9_-]/g, "-");
}
