export function getLaneScope(lane, systems = []) {
  const parent = (Array.isArray(systems) ? systems : []).find((system) => (
    system?.active !== false
    && (String(system?.canonicalItemId || "") === "wim-sorting" || String(system?.id || "") === "wim-sorting")
    && String(system?.laneId || "") === String(lane?.id || "")
  ));
  return String(parent?.scope || lane?.scope || "").trim();
}

export function getNextLaneNumberForScope(lanes = [], scope = "", systems = []) {
  const expectedScope = String(scope || "").trim();
  return (Array.isArray(lanes) ? lanes : [])
    .filter((lane) => lane?.active !== false && getLaneScope(lane, systems) === expectedScope)
    .reduce((highest, lane) => Math.max(highest, Number(lane?.laneNo || lane?.number) || 0), 0) + 1;
}

export function setLaneScope(lanes = [], laneId, scope = "", systems = []) {
  const targetScope = String(scope || "").trim();
  const entries = Array.isArray(lanes) ? lanes : [];
  const current = entries.find((lane) => String(lane?.id || "") === String(laneId || ""));
  if (!current) return entries;

  const currentNumber = Number(current.laneNo || current.number) || 1;
  const hasNumberConflict = entries.some((lane) => (
    lane?.active !== false
    && String(lane?.id || "") !== String(laneId || "")
    && Number(lane?.laneNo || lane?.number) === currentNumber
    && getLaneScope(lane, systems) === targetScope
  ));
  const laneNo = hasNumberConflict
    ? getNextLaneNumberForScope(entries.filter((lane) => String(lane?.id || "") !== String(laneId || "")), targetScope, systems)
    : currentNumber;
  const defaultLabel = "ช่องจราจร " + currentNumber;

  return entries.map((lane) => String(lane?.id || "") === String(laneId || "")
    ? {
      ...lane,
      scope: targetScope,
      laneNo,
      ...(String(lane.label || "") === defaultLabel && laneNo !== currentNumber ? { label: "ช่องจราจร " + laneNo } : {}),
    }
    : lane);
}
