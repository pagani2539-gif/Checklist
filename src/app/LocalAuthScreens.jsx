import ThemePreference from "./ThemePreference.jsx";
import { useEffect, useState } from "react";
import { clearThaiPasswordValidation, jsonRequest, MIN_PASSWORD_LENGTH, showThaiPasswordValidation } from "./local-auth-helpers.js";

function AuthFrame({ eyebrow, title, description, children }) {
  return <main className="local-auth-page"><section className="local-auth-card"><p className="ops-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="local-auth-description">{description}</p>{children}<ThemePreference /></section></main>;
}

export function LocalLoginScreen({ authConfig, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authConfig?.mode === "oidc") window.location.assign("/api/v1/auth/login");
  }, [authConfig?.mode]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await jsonRequest("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      onLogin?.();
    } catch (reason) {
      setError(reason?.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <AuthFrame eyebrow="CHECKLIST · SECURE SIGN IN" title="เข้าสู่ระบบ" description="ใช้บัญชีที่ผู้ดูแลสูงสุดสร้างให้ สิทธิ์เข้าถึงสถานีขึ้นอยู่กับ role ของบัญชี">
    {authConfig?.hasLocalUsers === false && <div className="local-auth-notice" role="status">ยังไม่มีผู้ใช้ ให้ผู้ดูแลระบบเริ่มสร้างบัญชีผู้ดูแลสูงสุดจาก Terminal บนเครื่องเซิร์ฟเวอร์</div>}
    {authConfig?.mode === "oidc" ? <p className="local-auth-notice">กำลังเชื่อมต่อระบบยืนยันตัวตนขององค์กร…</p> : <form className="local-auth-form" onSubmit={submit}>
      <label className="ops-field"><span>ชื่อผู้ใช้</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required autoFocus /></label>
      <label className="ops-field"><span>รหัสผ่าน</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {error && <p className="ops-form-error-banner" role="alert">{error}</p>}
      <button className="ops-button ops-button-primary" type="submit" disabled={busy || !authConfig?.hasLocalUsers}>{busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
    </form>}
  </AuthFrame>;
}

export function PasswordChangeScreen({ onComplete }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (newPassword.length < MIN_PASSWORD_LENGTH) { setError(`รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`); return; }
    if (newPassword !== confirmation) { setError("รหัสผ่านใหม่สองครั้งไม่ตรงกัน"); return; }
    setBusy(true);
    try {
      await jsonRequest("/api/v1/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      onComplete?.();
    } catch (reason) {
      setError(reason?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <AuthFrame eyebrow="ACCOUNT SECURITY" title="ตั้งรหัสผ่านส่วนตัว" description="บัญชีนี้ใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษรก่อนเริ่มใช้งาน">
    <form className="local-auth-form" onSubmit={submit}>
      <label className="ops-field"><span>รหัสผ่านปัจจุบัน</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} onInvalid={showThaiPasswordValidation} onInput={clearThaiPasswordValidation} required autoFocus /></label>
      <label className="ops-field"><span>รหัสผ่านใหม่</span><input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} onInvalid={showThaiPasswordValidation} onInput={clearThaiPasswordValidation} required /></label>
      <label className="ops-field"><span>ยืนยันรหัสผ่านใหม่</span><input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} onInvalid={showThaiPasswordValidation} onInput={clearThaiPasswordValidation} required /></label>
      {error && <p className="ops-form-error-banner" role="alert">{error}</p>}
      <button className="ops-button ops-button-primary" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
    </form>
  </AuthFrame>;
}
