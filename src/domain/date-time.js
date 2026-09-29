export const THAILAND_TIME_ZONE = "Asia/Bangkok";

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatParts(date, options) {
  const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function parseThaiDateTimeInput(value) {
  const source = String(value ?? "").trim();
  const localMatch = source.match(LOCAL_DATE_TIME_PATTERN);
  if (localMatch) {
    const [, year, month, day, hour, minute] = localMatch;
    const parsed = { year: Number(year), month: Number(month), day: Number(day), hour: Number(hour), minute: Number(minute) };
    const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute));
    if (date.getUTCFullYear() === parsed.year && date.getUTCMonth() === parsed.month - 1 && date.getUTCDate() === parsed.day && date.getUTCHours() === parsed.hour && date.getUTCMinutes() === parsed.minute) return parsed;
    return null;
  }
  if (DATE_ONLY_PATTERN.test(source)) return parseThaiDateTimeInput(`${source}T00:00`);
  return null;
}

export function normalizeThaiDateTimeInput(value) {
  const source = String(value ?? "").trim();
  const local = parseThaiDateTimeInput(source);
  if (local) return `${String(local.year).padStart(4, "0")}-${pad(local.month)}-${pad(local.day)}T${pad(local.hour)}:${pad(local.minute)}`;
  if (!source) return "";
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "";
  const parts = formatParts(date, {
    timeZone: THAILAND_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function getThaiNowDateTimeInput() {
  return normalizeThaiDateTimeInput(new Date().toISOString());
}

export function formatThaiDateTimeInput(value) {
  const parsed = parseThaiDateTimeInput(normalizeThaiDateTimeInput(value));
  if (!parsed) return "";
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute));
  return `${new Intl.DateTimeFormat("th-TH", {
    calendar: "buddhist",
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)} น.`;
}

export function formatThaiDate(value) {
  const source = String(value ?? "").trim();
  if (!source) return "—";
  try {
    const dateOnlyMatch = source.match(DATE_ONLY_PATTERN);
    const date = dateOnlyMatch ? new Date(`${source}T00:00:00Z`) : new Date(source);
    return new Intl.DateTimeFormat("th-TH", {
      calendar: "buddhist",
      timeZone: dateOnlyMatch ? "UTC" : THAILAND_TIME_ZONE,
      dateStyle: "medium",
    }).format(date);
  } catch {
    return value;
  }
}

export function formatBangkokDateTime(value) {
  if (!value) return "—";
  try {
    const source = String(value).trim();
    if (LOCAL_DATE_TIME_PATTERN.test(source) || DATE_ONLY_PATTERN.test(source)) return formatThaiDateTimeInput(source);
    return new Intl.DateTimeFormat("th-TH", {
      calendar: "buddhist",
      timeZone: THAILAND_TIME_ZONE,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(source));
  } catch {
    return value;
  }
}
