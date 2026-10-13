// Only recorded truth is returned. An unchanged legacy field is not assumed confirmed.
const emptyValues = new Set(["", "—", "-", "ยังไม่ยืนยัน", "ไม่พบข้อมูล", "ไม่ระบุประเภทรถ", "ไม่พบผลอ่านป้าย", "ไม่พบผลอ่านเลขทะเบียน", "ไม่พบทะเบียน", "ไม่พบจังหวัด", "ไม่พบผลอ่านจังหวัด", "ไม่พบจังหวัดจาก API"]);
export function vehicleValue(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return emptyValues.has(text) ? "" : text;
}

export function getConfirmedVehicleField(row, detail, status, field) {
  if (status === "pending") return "";
  if (status === "correct") return vehicleValue(row[field]);
  if (field === "vehicleClassLabel") return status === "incorrect" ? vehicleValue(detail.correctedValue) : "";
  if (status === "unable-to-verify") {
    const allowed = field === "province" ? "number-unverified" : "province-unverified";
    if (detail.verificationScope !== allowed) return "";
  }
  const explicit = field === "province" ? detail.confirmedProvince : detail.confirmedPlateNumber;
  if (vehicleValue(explicit)) return vehicleValue(explicit);
  const target = field === "province" ? "province" : "plate-number";
  if (status === "incorrect" && detail.correctionTarget === target || status === "unable-to-verify") return vehicleValue(detail.correctedValue);
  return "";
}

export function getPlateEvidenceComparison(entry, status) {
  return [{ key: "plate-number", field: "plateNumber", label: "ทะเบียน" }, { key: "province", field: "province", label: "จังหวัด" }].map(({ key, field, label }) => {
    const confirmed = getConfirmedVehicleField(entry.row, entry.detail, status, field);
    return { key, label, value: entry.row[field], confirmed: confirmed || "ยังไม่ยืนยัน", different: status === "incorrect" && Boolean(confirmed) && vehicleValue(entry.row[field]).replace(/\s+/g, "") !== confirmed.replace(/\s+/g, "") };
  });
}
