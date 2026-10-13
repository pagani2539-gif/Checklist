import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/print-attachment-guard.js", import.meta.url), "utf8");
const indexHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const themeScriptIndex = indexHtml.indexOf('<script type="module" src="/theme-preference.js">');
const guardScriptIndex = indexHtml.indexOf('<script type="module" src="/print-attachment-guard.js">');
const appScriptIndex = indexHtml.indexOf('<script type="module" src="./src/main.jsx">');
assert.ok(themeScriptIndex >= 0 && themeScriptIndex < guardScriptIndex, "theme preference module should load before attachment safeguards");
assert.ok(guardScriptIndex >= 0 && guardScriptIndex < appScriptIndex, "attachment safeguards should load before the app module");

let active = 0;
let maximumActive = 0;
let retryCalls = 0;
let missingCount = 0;
let loadingCount = 0;
let printCalls = 0;
const notices = [];
const report = {
  querySelector: () => null,
  querySelectorAll(selector) {
    if (selector.includes('="missing"')) return Array.from({ length: missingCount });
    if (selector.includes('="loading"')) return Array.from({ length: loadingCount });
    return [];
  },
};
const document = {
  body: { append: (node) => notices.push(node) },
  querySelector: (selector) => selector === ".ops-print-report" ? report : notices.at(-1) || null,
  createElement: () => ({ style: {}, setAttribute() {}, remove() { this.removed = true; } }),
};
const window = {
  location: { href: "https://checklist.test/", origin: "https://checklist.test" },
  fetch: async (input) => {
    const url = new URL(String(input), window.location.href);
    if (url.pathname.endsWith("/retry-test")) {
      retryCalls += 1;
      if (retryCalls === 1) return new Response("busy", { status: 429, headers: { "Retry-After": "1" } });
      return new Response("image-bytes", { status: 200 });
    }
    if (url.pathname.endsWith("/missing-test")) return new Response("missing", { status: 404 });
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return new Response("image-bytes", { status: 200 });
  },
  print: () => { printCalls += 1; },
  setTimeout,
  clearTimeout,
};

vm.runInNewContext(source, { window, document, URL, Request, Response, DOMException, Date, Promise, setTimeout, clearTimeout });

const reads = await Promise.all(Array.from({ length: 24 }, (_, index) => window.fetch(`/api/v1/attachments/evidence-${String(index).padStart(8, "0")}`)));
assert.equal(reads.length, 24);
assert.equal(maximumActive, 8, "at most eight attachment requests should be active in one browser");

const retried = await window.fetch("/api/v1/attachments/retry-test");
assert.equal(retried.status, 200);
assert.equal(retryCalls, 2, "a 429 response should be retried after its Retry-After delay");

const missing = await window.fetch("/api/v1/attachments/missing-test");
assert.equal(missing.status, 404);

missingCount = 2;
await window.print();
assert.equal(printCalls, 0, "printing should stop while attachments remain missing");
assert.match(notices.at(-1).textContent, /หยุดพิมพ์/);
missingCount = 0;
loadingCount = 1;
await window.print();
assert.equal(printCalls, 0, "printing should stop while attachments are still loading");
loadingCount = 0;
await window.print();
assert.equal(printCalls, 1, "printing should proceed when every attachment is ready");

console.log("test_print_attachment_guard: pass");
