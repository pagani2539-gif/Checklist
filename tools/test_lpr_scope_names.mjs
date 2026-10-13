import assert from 'node:assert/strict';
import { createDefaultStationProfile, createSnapshot, makeEquipment, getItemsForSnapshot } from '../src/domain/master-checklist.js';
import { normalizeServerChecklistState } from '../src/domain/storage.js';
import { buildReportTemplateModel } from '../src/domain/report-template.js';
const profile = createDefaultStationProfile();
profile.stationSystems = profile.stationSystems.filter(system => system.canonicalItemId !== 'lpr-control');
profile.equipment = profile.equipment.filter(asset => asset.type !== 'LPR_CAMERA');
for (const [index, scope] of ['High Speed','Low Speed','3D','ImPS','Image Processing'].entries()) {
 const laneId = `scope-lane-${index}`;
 const ownerId = `scope-lpr-${index}`;
 profile.lanes.push({id:laneId,laneNo:1,scope,active:true});
 profile.stationSystems.push({id:ownerId,canonicalItemId:'lpr-control',scope,laneId,quantity:1,active:true});
 profile.equipment.push(makeEquipment('LPR_CAMERA',index+1,{id:`scope-camera-${index}`,scope,laneId,parentSystemId:ownerId}));
}
const snapshot = createSnapshot(profile);
const round = {id:'scope-round',stationId:profile.id,status:'draft',snapshot,inspectionItems:{},meta:{}};
const raw = {stationProfiles:[profile],inspectionRounds:[round]};
const before = JSON.stringify(raw);
const loaded = normalizeServerChecklistState(raw).inspectionRounds.find(entry=>entry.id===round.id);
const items = getItemsForSnapshot(loaded.snapshot);
for (const [index,scope] of ['High Speed','Low Speed','3D','ImPS','Image Processing'].entries()) {
 const targets = items.filter(item=>item.laneId===`scope-lane-${index}` || item.assetId===`scope-camera-${index}` || item.systemRecordId===`scope-lpr-${index}`);
 assert.ok(targets.length>=3,scope);
 const names = targets.flatMap(item=>[item.label,...item.evidenceSlots.map(slot=>slot.displayLabel)]).join('|');
 if (['High Speed','Low Speed'].includes(scope)) assert.ok(names.includes('ร่วมกับ WIM'),scope);
 else {
   assert.ok(!names.includes('ร่วมกับ WIM'),scope);
   assert.ok(names.includes(`สำหรับระบบ ${scope==='ImPS'?'IMPS':scope}`),scope);
 }
 assert.ok(targets.filter(item=>item.sectionCode==='3.1').every(item=>item.label.includes('License Plate Recognition Control System')));
}
const model = buildReportTemplateModel(loaded);
assert.ok(model.sections.flatMap(section=>section.items).filter(item=>item.id.includes('scope-lane-2')).every(item=>!item.label.includes('ร่วมกับ WIM')));
assert.equal(JSON.stringify(raw),before,'stored source, IDs, results and evidence must remain unchanged');
console.log('LPR scope names: PASS (HS/LS, 3D, IMPS, Image Processing, load and report)');
