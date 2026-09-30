import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleVehicleSearchProxyRequest } from './server/vehicle-search-proxy.mjs';
import { createConfiguredStore } from './server/store.mjs';
import { createAttachmentStore } from './server/attachment-store.mjs';
import { createAuth } from './server/auth.mjs';
import { createApi } from './server/api.mjs';
import { createVehicleSearchConfig, normalizeVehicleSearchBaseUrl } from './src/domain/vehicle-search.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = String(process.env.HOST || '127.0.0.1');
const staticRootConfig = String(process.env.CHECKLIST_DIST_DIR || '').trim() || path.join(root, 'dist');
const staticRootCandidate = path.resolve(staticRootConfig);
const authMode = String(process.env.CHECKLIST_AUTH_MODE || 'disabled').trim().toLowerCase();
const enforceStationScope = process.env.CHECKLIST_ENFORCE_STATION_SCOPE === 'true';
if (['oidc', 'local'].includes(authMode) && !enforceStationScope) {
  throw new Error(`CHECKLIST_ENFORCE_STATION_SCOPE=true is required when CHECKLIST_AUTH_MODE=${authMode}`);
}
if ((String(process.env.NODE_ENV || '').toLowerCase() === 'production' || String(process.env.CHECKLIST_PUBLIC_MODE || '').toLowerCase() === 'true') && !['local', 'oidc'].includes(authMode)) {
  throw new Error('Production/Public mode requires CHECKLIST_AUTH_MODE=local or CHECKLIST_AUTH_MODE=oidc');
}
const vehicleSearchProxyAllowedOrigins = String(process.env.VEHICLE_SEARCH_PROXY_ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => normalizeVehicleSearchBaseUrl(value.trim()))
  .filter(Boolean);
const contentSecurityPolicy = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  `connect-src 'self'${vehicleSearchProxyAllowedOrigins.length ? ` ${vehicleSearchProxyAllowedOrigins.join(' ')}` : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join('; ');
const store = await createConfiguredStore();
const configuredAttachmentRoot = String(process.env.CHECKLIST_ATTACHMENTS_DIR || path.join(root, 'data', 'attachments')).trim();
const attachmentRoot = path.isAbsolute(configuredAttachmentRoot)
  ? configuredAttachmentRoot
  : path.resolve(root, configuredAttachmentRoot);
const attachmentStore = createAttachmentStore({ root: attachmentRoot });
const auth = createAuth({ store });
const api = createApi({
  store,
  auth,
  attachmentStore,
  enforceStationScope,
});

async function resolveVehicleStationTarget(stationId) {
  const current = await store.getState();
  const station = (Array.isArray(current?.state?.stationProfiles) ? current.state.stationProfiles : [])
    .find((entry) => String(entry?.id || '') === String(stationId || ''));
  const vehicleSearchConfig = createVehicleSearchConfig(station?.vehicleSearchConfig, '');
  return vehicleSearchConfig.baseUrl ? vehicleSearchConfig : null;
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.tsx': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function writeSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', contentSecurityPolicy);
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function isWithinDirectory(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

const server = http.createServer(async (request, response) => {
  writeSecurityHeaders(response);
  try {
    if (await api.handle(request, response)) return;
    if (handleVehicleSearchProxyRequest(request, response, {
      auth,
      enforceStationScope,
      enforceStationTarget: ['oidc', 'local'].includes(auth.mode) || process.env.VEHICLE_SEARCH_ENFORCE_STATION_TARGET === 'true',
      resolveStationTarget: resolveVehicleStationTarget,
    })) return;
    const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
    const hasBuild = fs.existsSync(path.join(staticRootCandidate, 'index.html'));
    const publicMode = ['oidc', 'local'].includes(auth.mode) || String(process.env.CHECKLIST_PUBLIC_MODE || '').toLowerCase() === 'true';
    if (!hasBuild && publicMode) {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('Build artifact is not installed');
      return;
    }
    const staticRoot = hasBuild ? staticRootCandidate : root;
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const filePath = path.resolve(staticRoot, relativePath);

    if (!filePath.startsWith(staticRoot + path.sep)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  fs.stat(filePath, async (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    let servedFilePath;
    let realAttachmentRoot;
    try {
      [servedFilePath, realAttachmentRoot] = await Promise.all([
        fs.promises.realpath(filePath),
        fs.promises.realpath(attachmentStore.root),
      ]);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    if (isWithinDirectory(realAttachmentRoot, servedFilePath)) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(servedFilePath).pipe(response);
  });
  } catch (error) {
    console.error(JSON.stringify({ event: 'server.error', message: error?.message || 'unknown', path: request.url, method: request.method }));
    if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ message: 'Internal server error' }));
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ event: 'server.started', host, port, authMode: auth.mode, storageBackend: 'postgres', attachmentBackend: attachmentStore.kind }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ event: 'server.shutdown', signal }));
  server.close(() => {
    Promise.resolve(store.close()).finally(() => process.exit(0));
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
