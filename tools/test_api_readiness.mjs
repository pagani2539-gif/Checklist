import assert from "node:assert/strict";
import http from "node:http";
import { createApi } from "../server/api.mjs";

const previousVehicleRequirement = process.env.REQUIRE_VEHICLE_API_READY;
const server = http.createServer(async (request, response) => {
  const handled = await api.handle(request, response);
  if (!handled) {
    response.writeHead(404);
    response.end();
  }
});

let api;
const store = { isReady: async () => true };
const attachmentStore = { isReady: async () => true, kind: "filesystem" };

function setApi(options = {}) {
  api = createApi({ store, attachmentStore, ...options });
}

async function readReady() {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/ready`);
  return { status: response.status, body: await response.json() };
}

try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  delete process.env.REQUIRE_VEHICLE_API_READY;

  setApi();
  const unchecked = await readReady();
  assert.equal(unchecked.status, 200);
  assert.equal(unchecked.body.vehicleApi, null);

  setApi({ vehicleReady: true });
  const confirmed = await readReady();
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.vehicleApi, true);

  setApi({ vehicleReady: false });
  const unavailableOptional = await readReady();
  assert.equal(unavailableOptional.status, 200);
  assert.equal(unavailableOptional.body.vehicleApi, false);

  process.env.REQUIRE_VEHICLE_API_READY = "true";
  setApi();
  const requiredButUnchecked = await readReady();
  assert.equal(requiredButUnchecked.status, 503);
  assert.equal(requiredButUnchecked.body.vehicleApi, null);

  setApi({ vehicleReady: true });
  const requiredAndConfirmed = await readReady();
  assert.equal(requiredAndConfirmed.status, 200);

  setApi({ vehicleReady: false });
  const requiredAndUnavailable = await readReady();
  assert.equal(requiredAndUnavailable.status, 503);

  console.log("test_api_readiness: pass");
} finally {
  if (previousVehicleRequirement === undefined) delete process.env.REQUIRE_VEHICLE_API_READY;
  else process.env.REQUIRE_VEHICLE_API_READY = previousVehicleRequirement;
  await new Promise((resolve) => server.close(resolve));
}
