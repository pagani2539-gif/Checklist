# 01: Restore Vehicle API images through Proxy mode

Type: bug
Status: resolved
Blocked by: none

## Problem

Vehicle search through a Station Profile configured with Proxy mode returns vehicle records, but the LPR and registration crop images are blank. The same station API can return images in Direct mode. The Proxy flow had previously worked in development, while the deployed application still showed the records without images.

Station-specific API targets must remain in Station Profiles; configuring every station through environment variables is not viable for a multi-station deployment.

## Evidence

- Production server logs showed the image request through the configured Proxy receiving HTTP `403`, `application/octet-stream`, with a 29-byte response instead of image data.
- The server's Direct fallback then timed out connecting to the station's private address (`UND_ERR_CONNECT_TIMEOUT`).
- These logs establish the failed Proxy response and unavailable Direct fallback. They do not by themselves prove why the Proxy rejected the request.

## Implementation

- Keep image requests on the same-origin `/api/vehicle/image` route and resolve the target from the selected Station Profile, so station configuration remains data-driven and does not require per-station environment variables.
- Resolve the saved Station Profile by its ID for image requests; when an operator updates a station's IP/Port and saves its Vehicle API URL, subsequent requests use that profile configuration. IP changes are entered in the profile and are not auto-discovered.
- Adjust the server's nested `target` URL serialization to match the legacy development request format that had worked. Preserve escaping for reserved characters in image paths.
- Keep Direct fallback when the Proxy response is not an image, and log sanitized response details for diagnosis.

The production/dev serialization mismatch was the working root-cause hypothesis based on the 403 and the previous development behavior. The latest code was built and the `checklist` PM2 service restarted. The user has now confirmed that images load through Proxy mode.

## Acceptance

- In Proxy mode, vehicle records and both LPR and registration crop images display for a station configured in its Station Profile.
- The request continues to work through the same-origin image route without adding each station to environment variables.
- A newly created station or a station with a changed IP/Port uses the URL saved in its own Station Profile on subsequent requests; no application rebuild or per-station environment edit is needed.
- A failed image request remains diagnosable from sanitized server logs without recording plate numbers or full target URLs.

## Verification

- `node --check server/vehicle-search-proxy.mjs` passed.
- `npm run build` passed.
- PM2 reported the `checklist` service online after restart.
- User confirmed that images can now be fetched through Proxy mode.
- No automated test suite was run.

## Answer

Updated the Proxy image URL construction to preserve the nested target format used by the previously working development flow. The same-origin image route still uses the selected Station Profile for target resolution, so multi-station configuration does not depend on station-specific environment variables. The user confirmed that image retrieval through Proxy mode now works.
