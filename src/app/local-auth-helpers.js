export const MIN_PASSWORD_LENGTH = 8;

export function showThaiPasswordValidation(event) {
  const input = event.currentTarget;
  if (input.validity.valueMissing) input.setCustomValidity("กรุณากรอกรหัสผ่าน");
  else if (input.validity.tooShort) input.setCustomValidity(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
}

export function clearThaiPasswordValidation(event) {
  event.currentTarget.setCustomValidity("");
}

export async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `ทำรายการไม่สำเร็จ (${response.status})`);
  return payload;
}
