// Presentation only: do not change review outcomes or close readiness.
export function getVehicleRowProgress(row, dimensions) {
  const statuses = dimensions.map(({ statusKey }) => row[statusKey] || "pending");
  const pending = statuses.filter((status) => status === "pending").length;
  const unable = statuses.filter((status) => status === "unable-to-verify").length;
  const incorrect = statuses.filter((status) => status === "incorrect").length;
  const recorded = statuses.length - pending;
  return { pending, unable, incorrect, recorded, recordedComplete: statuses.length > 0 && pending === 0,
    verifiedComplete: statuses.length > 0 && pending === 0 && unable === 0,
    label: recorded === 0 ? "ยังไม่ตรวจ" : pending ? "บันทึกบางส่วน" : "บันทึกครบทุกหัวข้อ" };
}

export function getVehicleRecordedProgress(rows, dimensions) {
  const progress = rows.map((row) => getVehicleRowProgress(row, dimensions));
  const recordedRows = progress.filter((row) => row.recordedComplete).length;
  return { total: rows.length, recordedRows, remainingRows: rows.length - recordedRows,
    verifiedRows: progress.filter((row) => row.verifiedComplete).length,
    pendingChecks: progress.reduce((sum, row) => sum + row.pending, 0),
    unableChecks: progress.reduce((sum, row) => sum + row.unable, 0) };
}

export function isVehicleDecisionDirty(status, detail, draft) {
  const text = (value) => String(value || "").trim();
  return status !== draft.status || ["correctedValue", "confirmedPlateNumber", "confirmedProvince", "correctionTarget", "verificationScope", "reasonCode", "note"]
    .some((key) => text(detail[key]) !== text(draft[key]));
}

export function getVehiclePersistenceResult(result) {
  if (result?.demo) return { success: true, label: "บันทึกในตัวอย่างแล้ว" };
  if (Array.isArray(result?.inspectionRounds)) return { success: true, label: "บันทึกลงเครื่องแล้ว" };
  if (result?.version != null && Number.isFinite(Number(result.version))) return { success: true, label: "บันทึกส่วนกลางแล้ว" };
  return { success: false, label: result?.draftState ? "ข้อมูลชนกับส่วนกลาง · เก็บค่าที่กรอกไว้แล้ว" : "บันทึกไม่สำเร็จ · เก็บค่าที่กรอกไว้แล้ว กรุณาลองอีกครั้ง" };
}

export async function persistVehicleReviewChange(onChange, value) {
  const persistence = getVehiclePersistenceResult(await onChange?.(value));
  if (!persistence.success) {
    const message = persistence.label.startsWith("ข้อมูลชนกับส่วนกลาง")
      ? "ข้อมูลชนกับส่วนกลาง · ชุดเดิมยังอยู่ กรุณาโหลดข้อมูลล่าสุดแล้วลองใหม่"
      : "บันทึกชุดใหม่ไม่สำเร็จ · ชุดเดิมยังอยู่ กรุณาลองอีกครั้ง";
    throw new Error(message);
  }
  return persistence;
}

export async function continueAfterVehicleDecisionSave(save, advance) {
  const result = await save();
  if (result?.success) advance?.();
  return result;
}
