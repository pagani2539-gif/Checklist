import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FilesystemAttachmentStore } from "../server/attachment-store.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "checklist-attachments-test-"));
try {
  const store = new FilesystemAttachmentStore({ root });
  assert.equal(store.isReady(), true);
  const body = Buffer.from("attachment-test");
  await store.put("random-object.txt", body, { contentType: "text/plain" });
  assert.deepEqual(await store.get("random-object.txt"), body);
  await store.delete("random-object.txt");
  await assert.rejects(() => store.get("random-object.txt"));
  console.log("test_attachment_store: pass");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
