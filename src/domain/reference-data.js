/*
 * Shared reference data for contract-first forms.
 *
 * Keep these records separate from Contract and Station Profile so a label can
 * be selected consistently without changing historical snapshots. The display
 * strings remain on legacy records for backwards compatibility.
 */

function text(value) {
  return String(value ?? "").trim();
}

function normalized(value) {
  return text(value).toLocaleLowerCase("th-TH").replace(/\s+/g, "");
}

function slug(value) {
  return normalized(value).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "unknown";
}

export const PROVINCE_OPTIONS = Object.freeze([
  ["กระบี่", "south"], ["กรุงเทพมหานคร", "central"], ["กาญจนบุรี", "west"], ["กาฬสินธุ์", "northeast"],
  ["กำแพงเพชร", "north"], ["ขอนแก่น", "northeast"], ["จันทบุรี", "east"], ["ฉะเชิงเทรา", "east"],
  ["ชลบุรี", "east"], ["ชัยนาท", "central"], ["ชัยภูมิ", "northeast"], ["ชุมพร", "south"],
  ["ตรัง", "south"], ["ตราด", "east"], ["ตาก", "west"], ["นครนายก", "central"],
  ["นครปฐม", "central"], ["นครพนม", "northeast"], ["นครราชสีมา", "northeast"], ["นครศรีธรรมราช", "south"],
  ["นครสวรรค์", "north"], ["นนทบุรี", "central"], ["นราธิวาส", "south"], ["น่าน", "north"],
  ["บึงกาฬ", "northeast"], ["บุรีรัมย์", "northeast"], ["ปทุมธานี", "central"], ["ประจวบคีรีขันธ์", "west"],
  ["ปราจีนบุรี", "east"], ["ปัตตานี", "south"], ["พะเยา", "north"], ["พังงา", "south"],
  ["พัทลุง", "south"], ["พิจิตร", "north"], ["พิษณุโลก", "north"], ["ภูเก็ต", "south"],
  ["มหาสารคาม", "northeast"], ["มุกดาหาร", "northeast"], ["ยะลา", "south"], ["ยโสธร", "northeast"],
  ["ร้อยเอ็ด", "northeast"], ["ระนอง", "south"], ["ระยอง", "east"], ["ราชบุรี", "west"],
  ["ลพบุรี", "central"], ["ลำปาง", "north"], ["ลำพูน", "north"], ["ศรีสะเกษ", "northeast"],
  ["สกลนคร", "northeast"], ["สงขลา", "south"], ["สตูล", "south"], ["สมุทรปราการ", "central"],
  ["สมุทรสงคราม", "central"], ["สมุทรสาคร", "central"], ["สระบุรี", "central"], ["สระแก้ว", "east"],
  ["สิงห์บุรี", "central"], ["สุพรรณบุรี", "central"], ["สุราษฎร์ธานี", "south"], ["สุรินทร์", "northeast"],
  ["สุโขทัย", "north"], ["หนองคาย", "northeast"], ["หนองบัวลำภู", "northeast"], ["อำนาจเจริญ", "northeast"],
  ["อุดรธานี", "northeast"], ["อุตรดิตถ์", "north"], ["อุทัยธานี", "north"], ["อุบลราชธานี", "northeast"],
  ["อ่างทอง", "central"], ["เชียงราย", "north"], ["เชียงใหม่", "north"], ["เพชรบุรี", "west"],
  ["เพชรบูรณ์", "north"], ["เลย", "northeast"], ["แพร่", "north"], ["แม่ฮ่องสอน", "north"], ["พระนครศรีอยุธยา", "central"],
].map(([name, regionCode], index) => Object.freeze({
  id: `province-${String(index + 1).padStart(2, "0")}`,
  code: String(index + 1).padStart(2, "0"),
  name,
  regionCode,
  active: true,
})));

export const DEFAULT_REGION_DEFINITIONS = Object.freeze([
  { id: "region-central", code: "central", name: "ภาคกลาง" },
  { id: "region-north", code: "north", name: "ภาคเหนือ" },
  { id: "region-northeast", code: "northeast", name: "ภาคตะวันออกเฉียงเหนือ" },
  { id: "region-east", code: "east", name: "ภาคตะวันออก" },
  { id: "region-west", code: "west", name: "ภาคตะวันตก" },
  { id: "region-south", code: "south", name: "ภาคใต้" },
]);

export const DEFAULT_CONTRACTOR_RECORDS = Object.freeze([
  Object.freeze({ id: "contractor-ntr-engineer", name: "บริษัท เอ็นทีอาร์ เอ็นจิเนียร์ จำกัด" }),
  Object.freeze({ id: "contractor-ismart8", name: "บริษัท ไอ-สมาร์ท 8 จำกัด" }),
  Object.freeze({ id: "contractor-ltp-engineering", name: "บริษัท แอลทีพี เอ็นจิเนียริ่ง จำกัด" }),
]);

export const DEFAULT_AGENCY_RECORDS = Object.freeze([
  Object.freeze({ id: "agency-department-of-highways", name: "กรมทางหลวง" }),
]);

const PROVINCE_ALIASES = Object.freeze({
  "กรุงเทพมหานคร": ["กรุงเทพฯ", "กทม", "กทม."],
  "พระนครศรีอยุธยา": ["อยุธยา"],
  "นครราชสีมา": ["โคราช"],
  "อุบลราชธานี": ["อุบลฯ"],
  "นครศรีธรรมราช": ["นครศรีฯ"],
});

export function normalizeReferenceRecord(value = {}, kind = "reference") {
  const source = value && typeof value === "object" ? value : {};
  const name = text(source.name || source.label);
  return {
    id: text(source.id) || `${kind}-${slug(name)}`,
    name,
    aliases: [...new Set((Array.isArray(source.aliases) ? source.aliases : []).map(text).filter(Boolean))],
    parentId: text(source.parentId),
    regionId: text(source.regionId),
    regionCode: text(source.regionCode),
    active: source.active !== false,
  };
}

export function normalizeReferenceData(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const contractors = mergeDefaultReferenceRecords(source.contractors, DEFAULT_CONTRACTOR_RECORDS, "contractor");
  const agencies = mergeDefaultReferenceRecords(source.agencies, DEFAULT_AGENCY_RECORDS, "agency");
  return {
    provinces: PROVINCE_OPTIONS.map((province) => ({ ...province, aliases: PROVINCE_ALIASES[province.name] || [] })),
    contractors,
    agencies,
  };
}

function mergeDefaultReferenceRecords(entries, defaults, kind) {
  const existing = dedupeReferenceRecords((Array.isArray(entries) ? entries : []).map((entry) => normalizeReferenceRecord(entry, kind)).filter((entry) => entry.name));
  const names = new Set(existing.map((entry) => normalized(entry.name)));
  const additions = defaults.filter((entry) => !names.has(normalized(entry.name))).map((entry) => normalizeReferenceRecord(entry, kind));
  return [...existing, ...additions];
}

function dedupeReferenceRecords(entries) {
  const seen = new Map();
  const result = [];
  entries.forEach((entry) => {
    const key = normalized(entry.name);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, entry);
      result.push(entry);
      return;
    }
    existing.aliases = [...new Set([...existing.aliases, ...entry.aliases].filter((alias) => normalized(alias) !== key))];
    existing.parentId ||= entry.parentId;
    existing.regionId ||= entry.regionId;
    existing.regionCode ||= entry.regionCode;
    existing.active = existing.active || entry.active;
  });
  return result;
}

export function normalizeReferenceName(value) {
  return normalized(value);
}

export function legacyReferenceId(kind, value) {
  return `${kind}-legacy-${slug(value)}`;
}

export function mergeLegacyReferenceValues(referenceData = {}, values = {}, kind) {
  const key = kind === "agency" ? "agencies" : "contractors";
  const current = Array.isArray(referenceData[key]) ? referenceData[key] : [];
  const byName = new Map(current.flatMap((entry) => [entry?.name, ...(entry?.aliases || [])]).filter(Boolean).map((entry) => [normalized(entry), true]));
  const additions = [];
  (Array.isArray(values) ? values : []).map(text).filter(Boolean).forEach((name) => {
    if (byName.has(normalized(name))) return;
    byName.set(normalized(name), true);
    additions.push({ id: legacyReferenceId(kind, name), name, aliases: [], parentId: "", regionId: "", regionCode: "", active: true });
  });
  return additions.length ? { ...referenceData, [key]: [...current, ...additions] } : referenceData;
}

export function provinceOptionFor(value, referenceData = {}) {
  const candidates = [referenceData?.provinces, PROVINCE_OPTIONS].find((list) => Array.isArray(list) && list.length) || [];
  const key = normalized(value);
  return candidates.find((entry) => normalized(entry?.name) === key || normalized(entry?.code) === key || normalized(entry?.id) === key || (PROVINCE_ALIASES[entry?.name] || entry?.aliases || []).some((alias) => normalized(alias) === key)) || null;
}

export function referenceOptionsFor(referenceData = {}, kind = "province") {
  if (kind === "province") return (referenceData.provinces || PROVINCE_OPTIONS).filter((entry) => entry?.active !== false);
  if (kind === "contractor") return (referenceData.contractors || []).filter((entry) => entry?.active !== false);
  if (kind === "agency") return (referenceData.agencies || []).filter((entry) => entry?.active !== false);
  return [];
}

export function filterReferenceOptions(options = [], query = "") {
  const normalizedQuery = normalized(query);
  if (!normalizedQuery) return options;
  return options.filter((entry) => [entry?.name, entry?.code, ...(entry?.aliases || [])].some((value) => normalized(value).includes(normalizedQuery)));
}
