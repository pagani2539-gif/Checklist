import assert from 'node:assert/strict';
import {normalizeVehicleSearchState,updateVehicleSearchDimensionReview,getNextPendingVehicleId,getNextPendingVehicleAfterDecision,getVehicleReviewDetail,getVehicleSearchReviewSummary} from '../src/domain/vehicle-search.js';
for (const context of ['plate','classification']) {
 const statusKey=context==='plate'?'reviewStatus':'classificationReviewStatus';
 let state=normalizeVehicleSearchState({rows:[{id:'one',plateNumber:'82266'},{id:'two',plateNumber:'884'}]});
 state=updateVehicleSearchDimensionReview(state,'one',context,'unable-to-verify',{verificationScope:'both-unverified',reasonCode:'blurred-image',note:'saved'});
 state=normalizeVehicleSearchState(JSON.parse(JSON.stringify(state)));
 assert.equal(state.rows[0][statusKey],'unable-to-verify');
 assert.equal(getVehicleReviewDetail(state.rows[0],context).note,'saved');
 assert.ok(getVehicleReviewDetail(state.rows[0],context).reviewedAt);
 assert.equal(getNextPendingVehicleId(state,{context}),'two');
 assert.equal(getNextPendingVehicleAfterDecision(state,{context,rowId:'two',dimension:context,reviewStatus:'unable-to-verify'}),null,'all recorded: never return to unable rows');
 const ordered=normalizeVehicleSearchState({rows:[{id:'one'},{id:'two',[statusKey]:'unable-to-verify'},{id:'three'}]});
 assert.equal(getNextPendingVehicleAfterDecision(ordered,{context,rowId:'one',dimension:context,reviewStatus:'unable-to-verify'}),'three','skip recorded unable rows');
 assert.equal(getNextPendingVehicleAfterDecision(ordered,{context,rowId:'three',dimension:context,reviewStatus:'unable-to-verify'}),'one','wrap to actual pending work');
 state=updateVehicleSearchDimensionReview(state,'one',context,'incorrect',{correctedValue:'verified',reasonCode:'other'});
 assert.equal(getVehicleSearchReviewSummary(state,{context}).unableToVerifyChecks,0);
}
console.log('PASS saved unable results survive serialization, stay separate from pending, and leave unable list after correction');
