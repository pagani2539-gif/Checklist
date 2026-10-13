import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { createSnapshotEvidencePdf, SNAPSHOT_PDF_SIZES } from '../src/app/reports/snapshot-evidence-pdf.js';
const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCfAAn/2Q==','base64');
for(const mode of ['standard','presentation']){
  const bytes=await createSnapshotEvidencePdf([jpeg,jpeg],mode);
  const pdf=await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),2);
  assert.deepEqual([pdf.getPage(0).getWidth(),pdf.getPage(0).getHeight()],SNAPSHOT_PDF_SIZES[mode]);
  assert.ok(pdf.getPage(0).node.Resources(),'PDF must include embedded image resources');
}
console.log('PASS evidence PDF creation, A4 and 16:9 dimensions and embedded image resources');
