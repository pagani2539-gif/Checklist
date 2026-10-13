(() => {
  const nativeFetch = window.fetch.bind(window);
  const nativePrint = window.print.bind(window);
  const MAX_CONCURRENT_READS = 8;
  const REQUEST_RETRY_WINDOW_MS = 60_000;
  let activeReads = 0;
  const waitingReads = [];

  function abortError(signal) {
    return signal?.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
  }

  function acquireRead(signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(abortError(signal)); return; }
      if (activeReads < MAX_CONCURRENT_READS) { activeReads += 1; resolve(); return; }
      const waiter = {
        signal,
        abort: null,
        resolve: () => {
          signal?.removeEventListener("abort", waiter.abort);
          resolve();
        },
        reject,
      };
      waiter.abort = () => {
        const index = waitingReads.indexOf(waiter);
        if (index >= 0) waitingReads.splice(index, 1);
        signal?.removeEventListener("abort", waiter.abort);
        reject(abortError(signal));
      };
      waitingReads.push(waiter);
      signal?.addEventListener("abort", waiter.abort, { once: true });
    });
  }

  function releaseRead() {
    while (waitingReads.length) {
      const waiter = waitingReads.shift();
      if (waiter.signal?.aborted) {
        waiter.signal.removeEventListener("abort", waiter.abort);
        waiter.reject(abortError(waiter.signal));
        continue;
      }
      waiter.resolve();
      return;
    }
    activeReads -= 1;
  }

  function isAttachmentRead(input, init = {}) {
    const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : String(input?.url || "");
    const method = String(init.method || input?.method || "GET").toUpperCase();
    try {
      const url = new URL(rawUrl, window.location.href);
      return url.origin === window.location.origin
        && /^\/api\/v1\/attachments\/[A-Za-z0-9._-]+$/.test(url.pathname)
        && (method === "GET" || method === "HEAD");
    } catch {
      return false;
    }
  }

  function retryDelay(response, attempt) {
    const header = String(response?.headers?.get("Retry-After") || "").trim();
    const seconds = Number(header);
    if (header && Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    const date = Date.parse(header);
    if (header && Number.isFinite(date) && date > Date.now()) return date - Date.now();
    return Math.min(250 * (2 ** attempt), 5000);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  window.fetch = async (input, init = {}) => {
    if (!isAttachmentRead(input, init)) return nativeFetch(input, init);
    const signal = init.signal || input?.signal || null;
    const deadline = Date.now() + REQUEST_RETRY_WINDOW_MS;
    let attempt = 0;

    while (true) {
      let response;
      try {
        await acquireRead(signal);
        try { response = await nativeFetch(input, init); }
        finally { releaseRead(); }
      } catch (error) {
        if (signal?.aborted) throw error;
        const delay = Math.min(250 * (2 ** attempt), 5000);
        if (Date.now() + delay >= deadline) throw error;
        await wait(delay);
        attempt += 1;
        continue;
      }

      if (response.status !== 429 && response.status < 500) return response;
      const delay = retryDelay(response, attempt);
      if (Date.now() + delay >= deadline || signal?.aborted) return response;
      await wait(delay);
      if (signal?.aborted) return response;
      attempt += 1;
    }
  };

  function showPrintWarning(message) {
    let notice = document.querySelector(".checklist-print-attachment-warning");
    if (!notice) {
      notice = document.createElement("div");
      notice.className = "checklist-print-attachment-warning";
      notice.setAttribute("role", "alert");
      notice.setAttribute("aria-live", "assertive");
      Object.assign(notice.style, {
        position: "fixed", right: "20px", bottom: "20px", zIndex: "2147483647",
        maxWidth: "min(480px, calc(100vw - 40px))", padding: "14px 18px", borderRadius: "12px",
        background: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74",
        boxShadow: "0 8px 24px rgba(15, 23, 42, .18)", font: "600 14px/1.5 system-ui, sans-serif",
      });
      document.body.append(notice);
    }
    notice.textContent = message;
    window.clearTimeout(notice.dismissTimer);
    notice.dismissTimer = window.setTimeout(() => notice.remove(), 8000);
  }

  window.print = async (...args) => {
    const report = document.querySelector(".ops-print-report");
    const deadline = Date.now() + 30000;
    while (report?.querySelector('[data-analytics-layout="pending"]') && Date.now() < deadline) {
      await new Promise(resolve => window.setTimeout(resolve, 50));
    }
    const layoutError = report?.querySelector('[data-analytics-layout="error"], [data-analytics-layout="pending"]');
    if (layoutError) { showPrintWarning(layoutError.textContent || 'จัดหน้าตารางยังไม่เสร็จ'); return; }
    const missingCount = report?.querySelectorAll('[data-print-attachment="missing"]').length || 0;
    const loadingCount = report?.querySelectorAll('[data-print-attachment="loading"]').length || 0;
    if (missingCount || loadingCount) {
      const count = missingCount || loadingCount;
      showPrintWarning(`ยังมีรูปหรือไฟล์หลักฐาน ${count} รายการที่โหลดไม่ครบ จึงหยุดพิมพ์ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง`);
      return;
    }
    return nativePrint(...args);
  };
})();
