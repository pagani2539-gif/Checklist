// Browser regression uses the production CSP: displaying blobs is allowed, fetching them is not.
// Run: node tools/serve_snapshot_pdf_regression.mjs
// Open: http://127.0.0.1:5177/tools/fixtures/snapshot-pdf-csp.html
import { createServer } from 'vite';
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 5177, strictPort: true, headers: { 'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'" } } });
await server.listen();
console.log('Snapshot PDF regression: http://127.0.0.1:5177/tools/fixtures/snapshot-pdf-csp.html');
