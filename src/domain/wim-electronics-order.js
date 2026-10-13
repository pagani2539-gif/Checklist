// Presentation order only. This is not an electrical wiring diagram.
export const WIM_ELECTRONICS_DISPLAY_TYPES = Object.freeze([
  "CONTROL_CABINET", "WIM_SUB_BREAKER", "WIM_PHASE_PROTECTION",
  "WIM_TRANSFORMER_24VAC", "WIM_SWITCHING_DC", "WIM_AC_DC_POWER_SUPPLY",
  "WIM_CONTROLLER", "WIM_NETWORK_EQUIPMENT",
]);

export function electronicsTypeOrder(type) {
  const index = WIM_ELECTRONICS_DISPLAY_TYPES.indexOf(type);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

export function getElectronicsPointTitle(item) {
  const id = item.id || "";
  if (/device-.+-condition/.test(id)) return "สภาพอุปกรณ์และจุดต่อ";
  if (/device-.+-input/.test(id)) return "ไฟขาเข้า";
  if (/device-.+-output/.test(id)) return "ไฟขาออก DC";
  if (/device-.+-function/.test(id)) return "การทำงาน";
  return item.label;
}

export function sortElectronicsByCabinet(records = [], getRecord = record => record) {
  const cabinets = new Map(records.map(getRecord).filter(record => record.type === "CONTROL_CABINET").map(record => [record.id, record]));
  const owner = record => record.type === "CONTROL_CABINET" ? record : cabinets.get(record.parentAssetId);
  return [...records].sort((left, right) => {
    const a = getRecord(left), b = getRecord(right);
    const ca = owner(a), cb = owner(b);
    return Number(!ca) - Number(!cb)
      || String(ca?.assetNo || ca?.id || "").localeCompare(String(cb?.assetNo || cb?.id || ""), undefined, { numeric: true })
      || electronicsTypeOrder(a.type) - electronicsTypeOrder(b.type)
      || String(a.assetNo || a.id || "").localeCompare(String(b.assetNo || b.id || ""), undefined, { numeric: true });
  });
}

export function getElectronicsChecklistPages(items = [], snapshot = {}) {
  const assets = new Map((snapshot.equipment || []).map(asset => [asset.id, asset]));
  const pages = [], byAsset = new Map();
  for (const item of items) {
    const isElectronics = WIM_ELECTRONICS_DISPLAY_TYPES.includes(assets.get(item.assetId)?.type);
    const key = isElectronics ? item.assetId : item.id;
    if (isElectronics && byAsset.has(key)) byAsset.get(key).items.push(item);
    else {
      const page = { id: item.id, assetId: isElectronics ? item.assetId : null, items: [item] };
      pages.push(page);
      if (isElectronics) byAsset.set(key, page);
    }
  }
  const pointOrder = item => {
    if (item.isEquipmentCleaning || item.isAreaCleaning) return 5;
    if (/cabinet-overview|electrical-control|identity|condition/.test(item.id)) return 0;
    if (/incoming-main|main-current|device-.+-input/.test(item.id)) return 1;
    if (/output|switching-dc|transformer-|sub-breaker-/.test(item.id)) return 2;
    return 3;
  };
  for (const page of pages) if (page.assetId) page.items.sort((a, b) => pointOrder(a) - pointOrder(b));
  return pages;
}
