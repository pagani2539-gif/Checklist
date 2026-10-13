import { normalizeThaiDateTimeInput } from "./date-time.js";
import { getConfirmedVehicleField, vehicleValue } from "./vehicle-review-confirmation.js";

const statuses = ["correct", "incorrect", "unable-to-verify", "pending"];
const percent = (count, total) => total ? Number((count / total * 100).toFixed(2)) : 0;
const thaiCompare = (a, b) => a.localeCompare(b, "th", { numeric: true });

function aggregate(entries, keyForEntry, { chronological = false } = {}) {
  const groups = new Map();
  for (const entry of entries) {
    const label = keyForEntry(entry);
    const group = groups.get(label) || { label, entries: [], correct: 0, incorrect: 0, unableToVerify: 0, pending: 0 };
    group.entries.push(entry);
    group[entry.status === "unable-to-verify" ? "unableToVerify" : entry.status]++;
    groups.set(label, group);
  }
  const rows = [...groups.values()].map(group => ({ ...group, count: group.entries.length, share: percent(group.entries.length, entries.length), errorRate: percent(group.incorrect, group.entries.length) }));
  rows.sort(chronological ? (a, b) => thaiCompare(a.label, b.label) : (a, b) => b.count - a.count || thaiCompare(a.label, b.label));
  let rank = 0;
  return rows.map((row, index) => {
    if (!index || row.count !== rows[index - 1].count) rank = index + 1;
    return { ...row, rank: chronological ? null : rank };
  });
}

/** Derive analytics from the exact scored report entries; never mutate stored rows. */
export function buildVehicleReviewAnalytics(entries, dimension) {
  const statusKey = dimension === "plate" ? "reviewStatus" : "classificationReviewStatus";
  const field = dimension === "plate" ? "province" : "vehicleClassLabel";
  const subject = dimension === "plate" ? "จังหวัด" : "ประเภทรถ";
  const members = entries.map(entry => ({ ...entry, status: statuses.includes(entry.row[statusKey]) ? entry.row[statusKey] : "pending" }));
  const original = entry => vehicleValue(entry.row[field]) || "ไม่ระบุจากระบบ";
  const confirmed = entry => getConfirmedVehicleField(entry.row, entry.detail, entry.status, field) || "ยังไม่มีข้อมูลยืนยัน";
  const section = (key, title, rows, options = {}) => ({ key, title, dimension, total: members.length, rows, ...options });
  const pairs = members.filter(entry => entry.status === "incorrect" && confirmed(entry) !== "ยังไม่มีข้อมูลยืนยัน" && vehicleValue(entry.row[field]).replace(/\s+/g, "") !== confirmed(entry).replace(/\s+/g, ""));
  // Structured pair keys avoid collisions if a source value happens to contain an arrow.
  const pairRows = aggregate(pairs, entry => JSON.stringify([original(entry), confirmed(entry)])).map(row => {
    const [from, to] = JSON.parse(row.label);
    return { ...row, label: `${from} → ${to}`, from, to, share: percent(row.count, members.length) };
  });
  const hour = entry => {
    const value = normalizeThaiDateTimeInput(entry.row.occurredAt);
    return value ? `${value.slice(11, 13)}:00–${value.slice(11, 13)}:59` : "ไม่พบเวลา";
  };
  const period = entry => {
    const value = normalizeThaiDateTimeInput(entry.row.occurredAt);
    if (!value) return "ไม่พบเวลา";
    const hour = Number(value.slice(11, 13));
    return hour >= 6 && hour < 18 ? "กลางวัน · 06:00–17:59" : "กลางคืน · 18:00–05:59";
  };
  const periodRows = aggregate(members, period, { chronological: true }).sort((a, b) => {
    const order = label => label.startsWith("กลางวัน") ? 0 : label.startsWith("กลางคืน") ? 1 : 2;
    return order(a.label) - order(b.label);
  });
  const agreed = members.length > 0 && members.every(entry => confirmed(entry) !== "ยังไม่มีข้อมูลยืนยัน" && original(entry) === confirmed(entry));
  const rankings = agreed
    ? [section("agreed", `${subject}จากระบบตรงกับที่ผู้ตรวจสอบยืนยัน · เรียงมากไปน้อย`, aggregate(members, original), { ranked: true, basis: "both" })]
    : [section("api", `${subject}ที่ระบบ${dimension === "plate" ? "อ่านได้" : "ระบุ"} · เรียงมากไปน้อย`, aggregate(members, original), { ranked: true, basis: "api" }),
      section("confirmed", `${subject}ที่ผู้ตรวจสอบยืนยัน · เรียงมากไปน้อย`, aggregate(members, confirmed), { ranked: true, basis: "confirmed" })];
  return [
    ...rankings,
    section("pairs", `คู่${subject}ที่ระบบระบุไม่ถูกต้อง`, pairRows, { ranked: true, pairs: true }),
    section("lanes", "ผลตรวจแยกช่องทาง", aggregate(members, entry => vehicleValue(entry.row.lane) || "ไม่ระบุช่องทาง")),
    section("hours", "ผลตรวจรายชั่วโมง · เวลาไทย", aggregate(members, hour, { chronological: true })),
    // A daylight-only classification table repeats the existing summary exactly.
    ...(dimension === "plate" || periodRows.some(row => !row.label.startsWith("กลางวัน")) ? [section("periods", "ผลตรวจแยกกลางวัน–กลางคืน", periodRows)] : []),
  ];
}

export function buildVehicleAnalyticsPages(base, entries) {
  return buildVehicleReviewAnalytics(entries, base.dimension).map(section => {
    const periodSuffix = base.dimension === "classification" ? "" : ` · ${base.period.label}`;
    const title = `${section.title}${periodSuffix}`;
    return {
      ...base, kind: "analytics", title, analytics: { ...section, title, periodLabel: base.dimension === "classification" ? "" : base.period.label },
      page: 1, pageCount: 1, key: `${base.dimension}-${base.period.key}-analytics-${section.key}`,
    };
  });
}
