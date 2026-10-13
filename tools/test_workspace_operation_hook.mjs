import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareWorkspaceViewUpdate,applyWorkspaceOperations} from '../src/domain/workspace-operations.js';
import {describeWorkspaceSaveError} from '../src/domain/workspace-save-error.js';
const source=fs.readFileSync(new URL('../src/app/useServerWorkspaceSync.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export function','function');
let central={version:18,stationProfiles:[{id:'s',stationName:'initial'}],inspectionRounds:[{id:'r',vehicleSearch:{rows:Array.from({length:102},(_,i)=>({id:`row-${i}`})),sourceRows:Array.from({length:102},(_,i)=>({id:`row-${i}`}))}}]};
const originalRows=structuredClone(central.inspectionRounds);
const normalize=value=>{const normalized=structuredClone(value);for(const key of ['rows','sourceRows'])for(const row of normalized.inspectionRounds[0].vehicleSearch[key])for(let i=0;i<55;i++)row[`viewDefault${i}`]='';return normalized;};
let version=1,fail=false,view,calls=[];const effects=[],hookState=[];
const factory=new Function('useCallback','useEffect','useRef','useState','CURRENT_STATE_VERSION','normalizeServerChecklistState','clearPendingServerState','loadServerState','saveServerState','saveServerOperations','prepareWorkspaceViewUpdate','describeWorkspaceSaveError',source+'; return useServerWorkspaceSync;');
let stateIndex=0;
const useState=initial=>{const index=stateIndex++;hookState[index]=typeof initial==='function'?initial():initial;return [hookState[index],next=>{hookState[index]=typeof next==='function'?next(hookState[index]):next;}];};
const hook=factory(fn=>fn,fn=>effects.push(fn),value=>({current:value}),useState,18,normalize,async()=>{},async()=>({version,state:structuredClone(central),workspaceOperationsVersion:1}),async()=>{throw Error('legacy save unexpected');},async(operations,operationId)=>{calls.push({operations,operationId});if(fail)throw Object.assign(Error('failed'),{status:409,payload:{requestId:'req-test'}});central=applyWorkspaceOperations(central,operations);return {version:++version,operationId};},prepareWorkspaceViewUpdate,describeWorkspaceSaveError);
const oldFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({user:{role:'admin'}})});
try{
 const api=hook({serverStorage:true,setState:value=>view=value,notify:()=>{}});const cleanup=effects[0]();await new Promise(resolve=>setImmediate(resolve));
 const a=structuredClone(view);a.stationProfiles[0].stationName='first';const b=structuredClone(a);b.stationProfiles[0].stationName='second';
 await Promise.all([api.persistServerState(a),api.persistServerState(b)]);
 assert.equal(central.stationProfiles[0].stationName,'second');assert.notEqual(calls[0].operationId,calls[1].operationId);
 const c=structuredClone(b);c.stationProfiles[0].stationName='failed';const d=structuredClone(c);d.stationProfiles[0].stationName='queued';fail=true;
 const count=calls.length;assert.deepEqual(await Promise.all([api.persistServerState(c),api.persistServerState(d)]),[null,null]);assert.equal(calls.length,count+1);assert.deepEqual(view,normalize(central));assert.deepEqual(hookState[5],{message:'ข้อมูลส่วนกลางเปลี่ยนระหว่างบันทึก กรุณาโหลดข้อมูลล่าสุดก่อนลองใหม่ (409)',status:409,requestId:'req-test',detail:''});
 fail=false;const next=structuredClone(view);next.stationProfiles[0].stationName='retry manually';assert.ok(await api.persistServerState(next));assert.equal(central.stationProfiles[0].stationName,'retry manually');
 assert.equal(hookState[5],null,'a successful save should clear the previous failure details');
 const invalid={...view,unexpectedRoot:true};const beforeInvalid=calls.length;assert.equal(await api.persistServerState(invalid),null);assert.equal(calls.length,beforeInvalid);assert.deepEqual(view,normalize(central),'preparation failure must restore acknowledged central state');
 assert.deepEqual(central.inspectionRounds,originalRows);
 cleanup();console.log('compact hook ordered saves, separate identities, failed queue cancellation and central reload passed');
}finally{globalThis.fetch=oldFetch;}
