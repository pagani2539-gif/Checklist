import assert from "node:assert/strict";
import { createAuth } from "../server/auth.mjs";

const auth = createAuth({ store: {}, env: { CHECKLIST_AUTH_MODE: "disabled" } });
const user = await auth.authenticate({ headers: {} });

assert.deepEqual(user, {
  id: "local-admin",
  displayName: "Local development",
  role: "admin",
  stationIds: [],
});
assert.equal(auth.oidcConfig().mode, "disabled");
assert.equal(auth.isStationAllowed(user, "station-a"), true);
auth.requireRole(user, ["admin", "inspector"]);

console.log("test_no_login_auth: pass");
