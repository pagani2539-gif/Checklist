import assert from 'node:assert/strict';
import {createDefaultStationProfile,createInspectionRound,getPendingChecklistItems,getRoundSummary} from '../src/domain/master-checklist.js';
import {parseHash} from '../src/app/router.js';
const round=createInspectionRound(createDefaultStationProfile());
const pending=getPendingChecklistItems(round);
assert.equal(pending.length,getRoundSummary(round).pending);
const target=pending[0];
assert.equal(parseHash(`#/inspections/${round.id}?itemId=${encodeURIComponent(target.id)}`).query.itemId,target.id);
for(const item of pending)round.inspectionItems[item.id]={...round.inspectionItems[item.id],status:'normal'};
assert.equal(getPendingChecklistItems(round).length,0);
assert.equal(getRoundSummary(round).progress,100);
round.inspectionItems[target.id].status='pending';
assert.deepEqual(getPendingChecklistItems(round).map(item=>item.id),[target.id]);
for(const status of ['damaged','waiting','na','not-installed']){round.inspectionItems[target.id].status=status;assert.equal(getPendingChecklistItems(round).length,0);}
console.log('Pending result count, target route, completion and bypass checks passed');
