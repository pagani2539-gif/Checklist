import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { completeCloseRound, shouldShowCloseSuccess } from "../src/app/close-round-success.js";

const appSource = readFileSync(new URL("../src/app/App.jsx", import.meta.url), "utf8");
const checklistSource = readFileSync(new URL("../src/app/pages/ChecklistPage.jsx", import.meta.url), "utf8");

assert.ok(/completeCloseRound\(outcome, round\.id, onCloseSuccess, navigate\)/.test(checklistSource), "the checklist should show success and navigate only through the persisted close outcome");
assert.ok(/shouldShowCloseSuccess\(closeSuccessRoundId, route\)/.test(appSource), "success should be limited to the history page for the round just closed");
assert.ok(/shouldShowCloseSuccess\(closeSuccessRoundId, route\) && <CloseSuccessDialog onClose=\{dismissCloseSuccess\} \/>/.test(appSource), "App should render the modal for the matching history route");
assert.ok(/onCloseSuccess: handleCloseSuccess/.test(appSource), "App should own the pending success state across the route change");
assert.ok(/const \[closeSuccessRoundId, setCloseSuccessRoundId\] = useState\(null\)/.test(appSource), "reloading history should not restore an old success dialog");
assert.ok(/const closingRoute = route\.id === closeSuccessRoundId && \["checklist", "historyDetail"\]\.includes\(route\.name\)/.test(appSource), "leaving the round should clear its pending success dialog");
assert.ok(!checklistSource.includes('"ปิดรอบการตรวจแล้ว"'), "successful closure should not also use the short-lived success toast");
const finalizeStart = checklistSource.indexOf("const finalizeCloseRound = async");
const finalizeEnd = checklistSource.indexOf("const navigateToCloseBlocker", finalizeStart);
const finalizeSource = checklistSource.slice(finalizeStart, finalizeEnd);
const successTransition = finalizeSource.indexOf("completeCloseRound(");
assert.ok(finalizeSource.indexOf("catch (error)") < successTransition, "archive failures should return before success");
assert.ok(finalizeSource.indexOf("if (JSON.stringify(latestRoundRef.current?.vehicleSearch)") < successTransition, "stale vehicle data should return before success");
const closeStart = checklistSource.indexOf("const closeRound = async");
assert.ok(/if \(!confirmed\) return;[\s\S]*?await finalizeCloseRound\(\)/.test(checklistSource.slice(closeStart, finalizeStart)), "canceling the close confirmation should not announce success");
const dialogSource = readFileSync(new URL("../src/app/dialogs/CloseSuccessDialog.jsx", import.meta.url), "utf8");
assert.match(dialogSource, /role="dialog"[\s\S]*aria-modal="true"/, "close success should be announced as a modal dialog");
assert.match(dialogSource, /ปิดรอบการตรวจสำเร็จ[\s\S]*รับทราบ/, "the dialog should clearly confirm closure and offer acknowledgement");
assert.match(dialogSource, /event\.key === "Escape"[\s\S]*onClose\(\)/, "Escape should dismiss the success dialog");
assert.match(dialogSource, /acknowledgeRef\.current\?\.focus\(\)/, "the acknowledgement action should receive initial focus");

const events = [];
const success = await completeCloseRound(
  await Promise.resolve({ version: 42 }),
  "round / 42",
  (roundId) => events.push(["success", roundId]),
  (href) => events.push(["navigate", href]),
);
assert.equal(success, true);
assert.deepEqual(events, [
  ["success", "round / 42"],
  ["navigate", "#/history/round%20%2F%2042"],
]);

const failedEvents = [];
const failed = await completeCloseRound(null, "round-failed", (roundId) => failedEvents.push(roundId), (href) => failedEvents.push(href));
assert.equal(failed, false);
assert.deepEqual(failedEvents, [], "failed persistence must not announce success or navigate");

assert.equal(shouldShowCloseSuccess("round-1", { name: "checklist", id: "round-1" }), false);
assert.equal(shouldShowCloseSuccess("round-1", { name: "historyDetail", id: "round-2" }), false);
assert.equal(shouldShowCloseSuccess("round-1", { name: "historyDetail", id: "round-1" }), true);
assert.equal(shouldShowCloseSuccess(null, { name: "historyDetail", id: "round-1" }), false);

console.log("test_close_success_dialog: pass");
