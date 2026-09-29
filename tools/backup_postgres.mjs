import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const backupRoot = path.resolve(process.env.CHECKLIST_BACKUP_DIR || path.join(projectRoot, "backups"));
const destination = path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, "-"));
const databaseUrl = process.env.CHECKLIST_DATABASE_URL;
if (!databaseUrl) throw new Error("CHECKLIST_DATABASE_URL is required");
const parsedDatabaseUrl = new URL(databaseUrl);
const databasePassword = decodeURIComponent(parsedDatabaseUrl.password);
parsedDatabaseUrl.password = "";
const safeDatabaseUrl = parsedDatabaseUrl.toString();

await fs.mkdir(destination, { recursive: true });

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.trim()}`)));
  });
}

const databasePath = path.join(destination, "checklist.dump");
await run(
  process.env.PG_DUMP_BIN || "pg_dump",
  ["--format=custom", "--file", databasePath, "--dbname", safeDatabaseUrl],
  { env: { ...process.env, PGPASSWORD: databasePassword } },
);

const manifest = {
  createdAt: new Date().toISOString(),
  database: databasePath,
  attachmentBackend: process.env.CHECKLIST_ATTACHMENT_BACKEND || "filesystem",
  rpoTarget: "1h",
  restoreTarget: "4h",
};

if (manifest.attachmentBackend.toLowerCase() === "filesystem") {
  const source = path.resolve(process.env.CHECKLIST_ATTACHMENTS_DIR || path.join(projectRoot, "data", "attachments"));
  const target = path.join(destination, "attachments");
  await fs.cp(source, target, { recursive: true });
  manifest.attachments = target;
} else {
  const bucket = process.env.CHECKLIST_S3_BUCKET;
  if (!bucket) throw new Error("CHECKLIST_S3_BUCKET is required for S3 backup");
  const client = new S3Client({
    region: process.env.CHECKLIST_S3_REGION || "us-east-1",
    ...(process.env.CHECKLIST_S3_ENDPOINT ? { endpoint: process.env.CHECKLIST_S3_ENDPOINT } : {}),
    forcePathStyle: String(process.env.CHECKLIST_S3_FORCE_PATH_STYLE || "true").toLowerCase() === "true",
    ...(process.env.CHECKLIST_S3_ACCESS_KEY && process.env.CHECKLIST_S3_SECRET_KEY ? { credentials: { accessKeyId: process.env.CHECKLIST_S3_ACCESS_KEY, secretAccessKey: process.env.CHECKLIST_S3_SECRET_KEY } } : {}),
  });
  const target = path.join(destination, "objects");
  await fs.mkdir(target, { recursive: true });
  let token;
  let objectCount = 0;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const item of page.Contents || []) {
      const key = String(item.Key || "");
      if (!key || key.includes("..")) throw new Error(`Unsafe S3 object key: ${key}`);
      const filePath = path.join(target, key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const body = result.Body?.transformToByteArray ? Buffer.from(await result.Body.transformToByteArray()) : Buffer.alloc(0);
      await fs.writeFile(filePath, body);
      objectCount += 1;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  manifest.objects = target;
  manifest.objectCount = objectCount;
}

const manifestPath = path.join(destination, "manifest.json");
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ ok: true, backupDir: destination, manifest }));
