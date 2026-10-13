import assert from 'node:assert/strict';
import http from 'node:http';
import { createApi } from '../server/api.mjs';
import { createTemporaryWorkspaceStore } from './workspace_temp_store.mjs';
import { buildWorkspaceOperations } from '../src/domain/workspace-operations.js';
if (!process.env.CHECKLIST_POSTGRES_TEST_DATABASE_URL) { console.log('workspace operation HTTP integration skipped: set CHECKLIST_POSTGRES_TEST_DATABASE_URL'); process.exit(0); }
const state={version:18,stationProfiles:[{id:'s',lanes:[],equipment:[],stationSystems:[]}],inspectionRounds:[{id:'r',stationId:'s',status:'draft',snapshot:{stationId:'s'},inspectionItems:{item:{status:'pending'}}}],referenceData:{provinces:[]},contracts:[],workPackages:[],contractStationAssignments:[]};
const temp=await createTemporaryWorkspaceStore(state);
const users={admin:{id:'admin',role:'admin'},inspector:{id:'inspector',role:'inspector'},viewer:{id:'viewer',role:'viewer'}};
const auth={mode:'local',authenticate:async request=>{const user=users[request.headers['x-test-user']];if(!user)throw Object.assign(Error('Authentication required'),{statusCode:401});return user;},requireRole:(user,roles)=>{if(!roles.includes(user.role))throw Object.assign(Error('Forbidden'),{statusCode:403});},isStationAllowed:()=>true};
const api=createApi({store:temp.store,auth,enforceStationScope:true,attachmentStore:{kind:'isolated-test',isReady:async()=>true}});
const server=http.createServer(async(request,response)=>{if(!await api.handle(request,response)){response.writeHead(404);response.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const send=async(body,user='admin',method='PATCH')=>{const response=await fetch(base+'/api/v1/state',{method,headers:{'Content-Type':'application/json','x-test-user':user},body:JSON.stringify(body)});return{status:response.status,body:await response.json()};};
try{
 const next=structuredClone(state);next.inspectionRounds[0].inspectionItems.item.status='normal';
 const command={operationId:'http-review-test',operations:buildWorkspaceOperations(state,next)};
 assert.equal((await send(command,'viewer')).status,403);
 assert.equal((await send(command,'missing')).status,401);
 const saved=await send(command,'inspector');assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.operationId,command.operationId);assert.equal(saved.body.version,2);
 const replay=await send(command,'inspector');assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);
 const changed=structuredClone(state);changed.referenceData.provinces=['invalid inspector edit'];
 assert.equal((await send({operationId:'http-reference-test',operations:buildWorkspaceOperations(state,changed)},'inspector')).status,403);
 const malformed={operationId:'http-malformed-test',operations:[{type:'set',exists:false,path:['__proto__','polluted'],value:true}]};
 assert.equal((await send(malformed)).status,400);
 const read=await fetch(base+'/api/v1/state',{headers:{'x-test-user':'admin'}});const payload=await read.json();assert.equal(payload.workspaceOperationsVersion,1);assert.equal(payload.state.inspectionRounds[0].inspectionItems.item.status,'normal');
 console.log('authenticated compact HTTP saves, protocol discovery, receipt replay, viewer/reference permissions and invalid-path rejection passed');
}finally{await new Promise(resolve=>server.close(resolve));await temp.close();}
