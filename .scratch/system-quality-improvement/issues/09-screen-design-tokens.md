# 09: Adopt screen typography and palette tokens

Type: ui
Status: resolved
Blocked by: none

## Problem

Shared screen styles contain repeated literal font sizes and palette colors even though the app has a central design-token file.

## Plan

- Add semantic aliases for repeated sizes while preserving every current pixel value.
- Replace only exact, existing palette values in shared screen styles with matching semantic tokens.
- Keep container-based report typography and unaliased workflow colors under their existing styles.
- Assert token values and the absence of migrated raw values in the shared screen styles.

## Verification

- Run the design-token contract and full regression suite.
- Run the production build and inspect an authenticated screen read-only after HMR.

## Answer

- Added five semantic typography aliases without changing pixel values, then migrated 936 exact font-size declarations across `foundation.css`, `redesign.css`, and `workspace-layout.css`.
- Added matching semantic aliases for three existing palette values and migrated 331 exact color declarations in those shared screen styles. Report-container typography and workflow-specific unaliased colors remain local as planned.
- Extended the token contract to assert preserved token values and absence of migrated literal values. `node tools/run_all_tests.mjs`: 65 scripts total, 0 failed; 5 PostgreSQL-dependent integrations were skipped because no isolated test database was configured. `npm.cmd run build` passed. Authenticated desktop UI review confirmed unchanged presentation. Build reports the existing `.env NODE_ENV` and large JavaScript chunk warnings.
