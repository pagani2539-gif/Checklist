import { formatThaiDate } from "../domain/date-time.js";

export function formatDate(value) {
  return formatThaiDate(value);
}

export function shortId(value) {
  return value ? value.slice(-8).toUpperCase() : "—";
}

export function roundFor(state, roundId) {
  return state.inspectionRounds.find((round) => round.id === roundId) || null;
}

export const SIDEBAR_SHORT_LABELS = Object.freeze({
  dashboard: "ภาพรวม",
  stations: "ทะเบียนสถานี",
  inspections: "รอบตรวจ",
  history: "ประวัติ",
});
