export function describeWorkspaceSaveError(error, { preparationError = false } = {}) {
  const rawStatus = Number(error?.status ?? error?.statusCode);
  const status = Number.isInteger(rawStatus) && rawStatus > 0 ? rawStatus : null;
  let message;

  if (preparationError) message = "ระบบเตรียมข้อมูลชุดนี้เพื่อบันทึกไม่สำเร็จ";
  else if (status === 400) message = "ระบบปฏิเสธรูปแบบข้อมูลที่ส่งไปบันทึก (400)";
  else if (status === 401) message = "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ (401)";
  else if (status === 403) message = "บัญชีนี้ไม่มีสิทธิ์บันทึกข้อมูลชุดนี้ (403)";
  else if (status === 404) message = "ไม่พบข้อมูลรอบตรวจที่กำลังบันทึก (404)";
  else if (status === 409) message = "ข้อมูลส่วนกลางเปลี่ยนระหว่างบันทึก กรุณาโหลดข้อมูลล่าสุดก่อนลองใหม่ (409)";
  else if (status === 413) message = "ข้อมูลชุดนี้ใหญ่เกินกว่าระบบจะรับได้ (413)";
  else if (status === 429) message = "ระบบจำกัดการบันทึกชั่วคราว กรุณารอสักครู่แล้วลองใหม่ (429)";
  else if (status >= 500) message = `ระบบส่วนกลางขัดข้องชั่วคราว (${status})`;
  else if (status) message = `บันทึกข้อมูลส่วนกลางไม่สำเร็จ (${status})`;
  else message = "ติดต่อหรือเตรียมข้อมูลเพื่อบันทึกไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุดแล้วลองใหม่";

  const requestId = String(error?.payload?.requestId || error?.requestId || "").trim();
  const detail = status != null && status < 500
    ? String(error?.payload?.message || "").trim().slice(0, 180)
    : "";
  return { message, status, requestId, detail };
}
