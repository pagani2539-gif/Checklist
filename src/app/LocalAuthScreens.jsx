import { useEffect, useState } from "react";

const MIN_PASSWORD_LENGTH = 8;

function showThaiPasswordValidation(event) {
  const input = event.currentTarget;
  if (input.validity.valueMissing) input.setCustomValidity("กรุณากรอกรหัสผ่าน");
  else if (input.validity.tooShort) input.setCustomValidity(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
}

function clearThaiPasswordValidation(event) {
  event.currentTarget.setCustomValidity("");
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `ทำรายการไม่สำเร็จ (${response.status})`);
  return payload;
}

function AuthFrame({ eyebrow, title, description, children }) {
  return <main className="local-auth-page"><section className="local-auth-card"><p className="ops-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="local-auth-description">{description}</p>{children}</section></main>;
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

const ROLE_LABELS = { admin: "ผู้ดูแลสูงสุด", "station-manager": "ผู้จัดการสถานี", inspector: "ผู้ตรวจ", viewer: "ผู้ดูอย่างเดียว" };

export function AdminUsersPage({ state }) {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("inspector");
  const [stationIds, setStationIds] = useState([]);
  const [password, setPassword] = useState("");
  const [resetPasswords, setResetPasswords] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const stations = (state?.stationProfiles || []).filter((station) => station?.id);

  async function refresh() {
    const payload = await jsonRequest("/api/v1/admin/users");
    setUsers(payload.users || []);
  }

  useEffect(() => { refresh().catch((reason) => setError(reason.message)); }, []);

  async function createUser(event) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) { setError(`รหัสผ่านชั่วคราวต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await jsonRequest("/api/v1/admin/users", { method: "POST", body: JSON.stringify({ username, displayName, role, stationIds: role === "viewer" ? stationIds : [], password }) });
      setUsername(""); setDisplayName(""); setRole("inspector"); setStationIds([]); setPassword("");
      await refresh();
      setMessage("สร้างบัญชีแล้ว ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก");
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  async function toggleActive(user) {
    setError(""); setMessage("");
    try {
      await jsonRequest(`/api/v1/admin/users/${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ active: !user.active }) });
      await refresh();
      setMessage(user.active ? "ระงับบัญชีแล้ว และยกเลิก session ของบัญชีนั้น" : "เปิดบัญชีกลับมาแล้ว");
    } catch (reason) { setError(reason.message); }
  }

  async function resetPassword(user) {
    const value = String(resetPasswords[user.id] || "");
    setError(""); setMessage("");
    if (value.length < MIN_PASSWORD_LENGTH) { setError(`รหัสผ่านชั่วคราวต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`); return; }
    try {
      await jsonRequest(`/api/v1/admin/users/${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ password: value }) });
      setResetPasswords((current) => ({ ...current, [user.id]: "" }));
      await refresh();
      setMessage(`ตั้งรหัสชั่วคราวใหม่ให้ ${user.username} แล้ว และยกเลิก session เดิม`);
    } catch (reason) { setError(reason.message); }
  }

  return <section className="ops-page contracts-page"><header className="ops-page-header"><div><p className="ops-eyebrow">ACCESS CONTROL</p><h1>จัดการบัญชีผู้ใช้</h1><p>สร้างบัญชี กำหนด role และขอบเขตสถานี ระงับบัญชี หรือออก password ชั่วคราวใหม่</p></div></header>
    <section className="ops-context-note"><span>รหัสผ่านถูกเก็บเป็น hash ใน PostgreSQL; ระบบไม่แสดงรหัสเดิมและบังคับเปลี่ยนรหัสเมื่อสร้างหรือ reset บัญชี</span></section>
    {message && <p className="local-auth-success" role="status">{message}</p>}{error && <p className="ops-form-error-banner" role="alert">{error}</p>}
    <section className="ops-panel"><h2>สร้างบัญชีใหม่</h2><form className="ops-form-grid local-user-create" onSubmit={createUser}>
      <label className="ops-field"><span>ชื่อผู้ใช้</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" required minLength={3} maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,63}" /></label>
      <label className="ops-field"><span>ชื่อที่แสดง</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={120} /></label>
      <label className="ops-field"><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="ops-field"><span>รหัสผ่านชั่วคราว</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={MIN_PASSWORD_LENGTH} onInvalid={showThaiPasswordValidation} onInput={clearThaiPasswordValidation} /><small>อย่างน้อย 8 ตัวอักษร</small></label>
      {role === "inspector" && <div className="local-auth-notice" role="status">ผู้ตรวจเข้าถึงและตรวจได้ทุกสถานี รวมถึงสถานีที่เพิ่มภายหลัง</div>}
      {role === "viewer" && <fieldset className="ops-field local-user-stations"><legend>สถานีที่อนุญาต</legend>{stations.length ? stations.map((station) => <label key={station.id}><input type="checkbox" checked={stationIds.includes(String(station.id))} onChange={(event) => setStationIds((current) => event.target.checked ? [...current, String(station.id)] : current.filter((id) => id !== String(station.id)))} /><span>{station.stationCode || station.id} · {station.stationName || "ไม่ระบุชื่อสถานี"}</span></label>) : <small>ยังไม่มี Station Profile ในระบบ</small>}</fieldset>}
      <div className="ops-field"><span>&nbsp;</span><button className="ops-button ops-button-primary" type="submit" disabled={busy || (role === "viewer" && !stationIds.length)}>{busy ? "กำลังสร้าง…" : "สร้างบัญชี"}</button></div>
    </form></section>
    <section className="ops-panel"><h2>บัญชีในระบบ <span className="local-user-count">{users.length}</span></h2><div className="local-user-list">
      {users.map((user) => <article className="local-user-row" key={user.id}><div className="local-user-main"><strong>{user.displayName}</strong><span>{user.username} · {ROLE_LABELS[user.role] || user.role}</span><small>{["admin", "station-manager", "inspector"].includes(user.role) ? "ทุกสถานี" : (user.stationIds || []).map((id) => stations.find((station) => String(station.id) === String(id))?.stationCode || id).join(" · ")}</small></div><span className={`local-user-status ${user.active ? "is-active" : ""}`}>{user.active ? (user.mustChangePassword ? "รอเปลี่ยนรหัส" : "ใช้งาน") : "ระงับ"}</span>
        <div className="local-user-actions"><label className="ops-field"><span>รหัสชั่วคราวใหม่</span><input type="password" value={resetPasswords[user.id] || ""} onChange={(event) => setResetPasswords((current) => ({ ...current, [user.id]: event.target.value }))} /><small>อย่างน้อย 8 ตัวอักษร</small></label><button className="ops-button ops-button-secondary" type="button" onClick={() => resetPassword(user)}>Reset รหัส</button><button className={`ops-button ${user.active ? "ops-button-danger-ghost" : "ops-button-secondary"}`} type="button" onClick={() => toggleActive(user)}>{user.active ? "ระงับบัญชี" : "เปิดบัญชี"}</button></div>
      </article>)}
      {!users.length && <div className="ops-empty-state"><strong>ยังไม่มีบัญชี</strong><span>สร้างบัญชีผู้ใช้แรกได้จากแบบฟอร์มด้านบน</span></div>}
    </div></section>
  </section>;
}
