import assert from 'node:assert/strict';
import http from 'node:http';
import { createApi } from '../server/api.mjs';
import { attachmentKey } from '../server/attachment-key.mjs';

const files = new Map(), records = new Map();
const user = { id:'test-admin', role:'admin' };
const api = createApi({
  auth: { authenticate:async()=>user, requireRole:()=>{} },
  store: {
    getState:async()=>({state:{inspectionRounds:[{id:'round-test',stationId:'station-test'}]}}),
    addAttachment:async metadata=>{records.set(metadata.id,metadata);return metadata;},
    getAttachment:async id=>records.get(id), audit:async()=>{},
  },
  attachmentStore: {
    put:async(key,body)=>{files.set(key,body);}, get:async key=>files.get(key), delete:async key=>files.delete(key),
  },
});
const server = http.createServer((request,response)=>{void api.handle(request,response);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGkAAAAAASUVORK5CYII=','base64');
try {
  for (const kind of ['inspection/originals','inspection/annotated']) {
    const id=kind.endsWith('annotated')?'attachment-copy-test':'attachment-original-test';
    const response=await fetch(`${base}/api/v1/attachments/${id}`,{method:'PUT',headers:{'Content-Type':'image/png','X-Station-Id':'station-test','X-Round-Id':'round-test','X-Attachment-Kind':kind},body:png});
    const payload=await response.json();
    assert.equal(response.status,201,JSON.stringify(payload));
    assert.ok(payload.attachment.storageName.includes(`/rounds/round-test/${kind}/`));
    const download=await fetch(`${base}/api/v1/attachments/${id}`);
    assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),png);
  }
  assert.equal(files.size,2,'original and annotated copy must be distinct files');
  const rejected=await fetch(`${base}/api/v1/attachments/attachment-invalid-test`,{method:'PUT',headers:{'Content-Type':'image/png','X-Station-Id':'station-test','X-Round-Id':'round-test','X-Attachment-Kind':'inspection/arbitrary'},body:png});
  assert.equal(rejected.status,400);assert.match((await rejected.json()).message,/Invalid attachment kind/);
  assert.equal(files.size,2,'unsupported kinds must not create files');
  assert.throws(()=>attachmentKey({stationId:'../escape',kind:'inspection/annotated',filename:'copy.png'}));
  console.log('annotated attachment API: upload/download, original separation and invalid-kind rejection passed');
} finally { await new Promise(resolve=>server.close(resolve)); }
