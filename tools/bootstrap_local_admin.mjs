import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createConfiguredStore } from "../server/store.mjs";
import { hashLocalPassword } from "../server/auth.mjs";

function ask(question) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => prompt.question(question, (answer) => { prompt.close(); resolve(answer); }));
}

function askHidden(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("คำสั่งนี้ต้องรันใน Terminal ที่รับรหัสผ่านแบบซ่อนได้");
  }
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(question);
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") return finish(new Error("ยกเลิกการสร้างบัญชี"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

function copySecretToWindowsClipboard(secret) {
  if (process.platform !== "win32") throw new Error("โหมดสร้าง Admin เริ่มต้นต้องรันบน Windows");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-Sta", "-Command", "$secret = $env:CHECKLIST_BOOTSTRAP_SECRET_CLIPBOARD; Set-Clipboard -Value $secret; if ((Get-Clipboard -Raw) -ne $secret) { exit 2 }"],
      {
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
        env: { ...process.env, CHECKLIST_BOOTSTRAP_SECRET_CLIPBOARD: secret },
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`คัดลอกรหัสผ่านเริ่มต้นลง clipboard ไม่สำเร็จ: ${stderr.replaceAll(secret, "[redacted]").trim()}`)));
  });
}

let store;
try {
  store = await createConfiguredStore();
  if (await store.countLocalUsers()) throw new Error("พบ Local User แล้ว คำสั่งสร้างผู้ดูแลคนแรกใช้ได้เฉพาะฐานข้อมูลที่ยังไม่มีบัญชีเท่านั้น");

  const defaultAdmin = process.argv.includes("--default");
  const username = defaultAdmin ? "admin" : (await ask("ชื่อผู้ดูแล (a-z, 0-9, . _ -): ")).trim().toLowerCase();
  const displayName = defaultAdmin ? "ผู้ดูแลระบบ" : (await ask("ชื่อที่แสดงในระบบ: ")).trim();
  const password = defaultAdmin ? crypto.randomBytes(32).toString("base64url") : await askHidden("รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัวอักษร): ");
  if (defaultAdmin) await copySecretToWindowsClipboard(password);
  else {
    const confirmation = await askHidden("ยืนยันรหัสผ่าน: ");
    if (password !== confirmation) throw new Error("รหัสผ่านสองครั้งไม่ตรงกัน");
  }

  const user = await store.createLocalUser({
    id: crypto.randomUUID(),
    username,
    displayName,
    passwordHash: await hashLocalPassword(password),
    role: "admin",
    stationIds: [],
    mustChangePassword: defaultAdmin,
    createdBy: defaultAdmin ? "local-bootstrap-default" : "local-bootstrap",
  }, { firstAdminOnly: true });
  await store.audit("admin.bootstrap.create", { id: user.id, role: user.role }, "user", user.id, { username: user.username });
  process.stdout.write(defaultAdmin
    ? "สร้างผู้ดูแลสูงสุดเริ่มต้นแล้ว: admin; รหัสสุ่มถูกคัดลอกลง clipboard และต้องเปลี่ยนหลัง login ครั้งแรก\n"
    : `สร้างผู้ดูแลสูงสุดเรียบร้อย: ${user.username}\n`);
} catch (error) {
  process.stderr.write(`${error?.message || "สร้างผู้ดูแลไม่สำเร็จ"}\n`);
  process.exitCode = 1;
} finally {
  await store?.close?.().catch(() => {});
}
