import assert from "node:assert/strict";
import http from "node:http";
import { createApi } from "../server/api.mjs";

const attachmentBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const users = Array.from({ length: 10 }, (_, index) => ({ id: `user-${String(index).padStart(2, "0")}`, role: "inspector" }));
let activeAttachmentReads = 0;
let maxActiveAttachmentReads = 0;

const auth = {
  mode: "local",
  authenticate: async (request) => {
    const token = String(request.headers.cookie || "").match(/checklist_session=([^;]+)/)?.[1];
    const user = users.find((entry) => entry.id === token);
    if (!user) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
    return user;
  },
  requireRole: () => {},
  isStationAllowed: () => true,
  oidcConfig: () => ({}),
};

const store = {
  audit: async () => {},
  getAttachment: async (id) => ({ id, storageName: id, contentType: "image/png", originalName: "evidence.png" }),
  countLocalUsers: async () => users.length,
};
const attachmentStore = {
  get: async () => {
    activeAttachmentReads += 1;
    maxActiveAttachmentReads = Math.max(maxActiveAttachmentReads, activeAttachmentReads);
    try { await wait(5); return attachmentBytes; }
    finally { activeAttachmentReads -= 1; }
  },
  isReady: async () => true,
  kind: "memory-test",
};
const api = createApi({ store, auth, attachmentStore });
const server = http.createServer(async (request, response) => {
  const handled = await api.handle(request, response);
  if (!handled) { response.writeHead(404); response.end(); }
});

async function request(path, user = null) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    headers: user ? { Cookie: `checklist_session=${user.id}` } : {},
  });
  return { status: response.status, retryAfter: response.headers.get("Retry-After") };
}

try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const startedAt = Date.now();
  const results = users.map(() => []);

  // Ten users share one source IP. Each browser keeps at most eight image reads active.
  for (let offset = 0; offset < 141; offset += 8) {
    const batch = await Promise.all(users.map(async (user, userIndex) => {
      const count = Math.min(8, 141 - offset);
      return Promise.all(Array.from({ length: count }, (_, index) => {
        const attachmentId = `evidence-${String(userIndex).padStart(2, "0")}-${String(offset + index).padStart(3, "0")}`;
        return request(`/api/v1/attachments/${attachmentId}`, user);
      }));
    }));
    batch.forEach((entries, index) => results[index].push(...entries));
    assert.ok(Date.now() - startedAt < 60_000, "the ten-user attachment run should finish within one minute");
  }

  for (const [index, entries] of results.entries()) {
    assert.equal(entries.length, 141);
    assert.ok(entries.every((entry) => entry.status === 200), `user ${index} should load all 141 attachments`);
  }
  assert.equal(maxActiveAttachmentReads, 16, "server should cap simultaneous attachment reads at 16");

  const generalLimit = await Promise.all(Array.from({ length: 121 }, () => request("/api/v1/auth/me", users[0])));
  assert.equal(generalLimit.filter((entry) => entry.status === 200).length, 120, "general API quota should be 120 per user");
  assert.equal(generalLimit.at(-1).status, 429);
  assert.ok(Number(generalLimit.at(-1).retryAfter) > 0 && Number(generalLimit.at(-1).retryAfter) <= 60);
  assert.equal((await request("/api/v1/auth/me", users[1])).status, 200, "one user's general quota must not block another");

  const attachmentLimit = await Promise.all(Array.from({ length: 159 }, (_, index) => {
    const attachmentId = `overflow-${String(index).padStart(3, "0")}`;
    return request(`/api/v1/attachments/${attachmentId}`, users[0]);
  }));
  assert.ok(attachmentLimit.every((entry) => entry.status === 200), "attachment reads should have a separate limit from general API requests");
  for (let offset = 0; offset < 900; offset += 16) {
    const count = Math.min(16, 900 - offset);
    const batch = await Promise.all(Array.from({ length: count }, (_, index) => {
      const attachmentId = `within-read-limit-${String(offset + index).padStart(3, "0")}`;
      return request(`/api/v1/attachments/${attachmentId}`, users[0]);
    }));
    assert.ok(batch.every((entry) => entry.status === 200), "a user should be able to read up to 1,200 attachments per minute");
  }
  const blockedUser = await request("/api/v1/attachments/overflow-final", users[0]);
  assert.equal(blockedUser.status, 429);
  assert.ok(Number(blockedUser.retryAfter) > 0 && Number(blockedUser.retryAfter) <= 60);
  assert.equal((await request("/api/v1/attachments/other-user-001", users[1])).status, 200, "one user's attachment quota must not block another");

  const unauthenticated = await Promise.all(Array.from({ length: 121 }, () => request("/api/v1/auth/config")));
  assert.equal(unauthenticated.filter((entry) => entry.status === 200).length, 120, "unauthenticated public routes should retain an IP limit");
  assert.equal(unauthenticated.at(-1).status, 429);
  assert.ok(Number(unauthenticated.at(-1).retryAfter) > 0 && Number(unauthenticated.at(-1).retryAfter) <= 60);

  console.log(`test_api_rate_limits: pass (10 users x 141 attachments in ${Date.now() - startedAt}ms)`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
