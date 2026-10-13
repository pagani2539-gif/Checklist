import crypto from 'node:crypto';

export const ATTACHMENT_KINDS = new Set(['inspection/originals', 'inspection/annotated', 'vehicle-api/originals', 'vehicle-api/webp']);

export function attachmentSegment(value) {
  const segment = String(value || '');
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(segment)) throw Object.assign(new Error('Invalid attachment owner'), { statusCode: 400 });
  return segment;
}

export function stationFolderSegment(stationName, stationId) {
  const id = attachmentSegment(stationId);
  const normalized = String(stationName || "สถานี")
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}-]+/gu, "-")
    .replace(/[-_. ]{2,}/g, "-")
    .replace(/^[. -]+|[. -]+$/g, "");
  let slug = [...(normalized || "สถานี")].slice(0, 64).join("").replace(/[. ]+$/g, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(slug)) slug = `สถานี-${slug}`;
  const maxSlugBytes = Math.max(1, 240 - Buffer.byteLength(`--${id}`, "utf8"));
  while (Buffer.byteLength(slug, "utf8") > maxSlugBytes) slug = [...slug].slice(0, -1).join("");
  return `${slug || "สถานี"}--${id}`;
}

export function stationAttachmentPrefix(stationName, stationId) {
  return `stations/${stationFolderSegment(stationName, stationId)}/`;
}

export function attachmentKey({ stationId, stationName, roundId, kind = 'inspection/originals', createdAt = new Date(), filename }) {
  if (!ATTACHMENT_KINDS.has(kind)) throw Object.assign(new Error('Invalid attachment kind'), { statusCode: 400 });
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(createdAt));
  if (!/^[0-9]{4}$/.test(year)) throw new Error('Invalid attachment date');
  const name = String(filename || crypto.randomUUID());
  if (!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9]+)?$/.test(name)) throw new Error('Invalid attachment filename');
  if (!stationId) return `unassigned/${year}/${name}`;
  const owner = `stations/${stationFolderSegment(stationName, stationId)}`;
  return roundId ? `${owner}/${year}/rounds/${attachmentSegment(roundId)}/${kind}/${name}` : `${owner}/unassigned/${year}/${name}`;
}
