export function getConfirmedVehicleClass(originalLabel, status, correctedValue) {
  if (status === "correct") return originalLabel || "";
  if (status === "incorrect") return correctedValue || "";
  return "";
}
