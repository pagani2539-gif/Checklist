import fs from "node:fs";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function resolvedPath(value, fallback) {
  const result = path.resolve(String(value || fallback));
  fs.mkdirSync(result, { recursive: true });
  return result;
}

async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === "function") return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export class FilesystemAttachmentStore {
  constructor({ root } = {}) {
    this.root = resolvedPath(root, path.resolve("data", "attachments"));
    this.kind = "filesystem";
  }

  isReady() {
    try {
      fs.accessSync(this.root, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  filePath(storageName) {
    const safeName = path.basename(String(storageName || ""));
    const filePath = path.resolve(this.root, safeName);
    if (!safeName || !filePath.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid attachment storage name");
    return filePath;
  }

  async put(storageName, body) {
    fs.writeFileSync(this.filePath(storageName), body, { flag: "wx", mode: 0o600 });
  }

  async get(storageName) {
    return fs.promises.readFile(this.filePath(storageName));
  }

  async delete(storageName) {
    await fs.promises.rm(this.filePath(storageName), { force: true });
  }
}

export class S3AttachmentStore {
  constructor({
    endpoint = process.env.CHECKLIST_S3_ENDPOINT,
    region = process.env.CHECKLIST_S3_REGION || "us-east-1",
    bucket = process.env.CHECKLIST_S3_BUCKET,
    accessKeyId = process.env.CHECKLIST_S3_ACCESS_KEY,
    secretAccessKey = process.env.CHECKLIST_S3_SECRET_KEY,
    forcePathStyle = String(process.env.CHECKLIST_S3_FORCE_PATH_STYLE || (endpoint ? "true" : "false")).toLowerCase() === "true",
  } = {}) {
    if (!bucket) throw new Error("CHECKLIST_S3_BUCKET is required when attachment backend is s3");
    this.bucket = bucket;
    this.kind = "s3";
    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle,
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    });
  }

  async isReady() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  async put(storageName, body, { contentType } = {}) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: storageName, Body: body, ContentType: contentType || "application/octet-stream" }));
  }

  async get(storageName) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageName }));
    return streamToBuffer(result.Body);
  }

  async delete(storageName) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageName }));
  }
}

export function createAttachmentStore({ backend = process.env.CHECKLIST_ATTACHMENT_BACKEND || "filesystem", root } = {}) {
  return String(backend).trim().toLowerCase() === "s3"
    ? new S3AttachmentStore()
    : new FilesystemAttachmentStore({ root });
}
