export const annotationDefaults = { color: '#ff0000', width: 3, outline: true };
export function normalizeImageAnnotation(value) {
  if (value?.version !== 1 || !Array.isArray(value.marks) || !value.renderedAttachment?.id || !(value.originalWidth > 0) || !(value.originalHeight > 0)) return null;
  const marks = value.marks.filter(m => ['rect','arrow'].includes(m.type) && [m.x,m.y,m.endX,m.endY].every(n => Number.isFinite(n) && n >= 0 && n <= 1) && /^#[0-9a-f]{6}$/i.test(m.color) && Number.isFinite(m.width) && m.width >= 1 && m.width <= 12).map(m => ({ id: String(m.id), type:m.type, x:m.x, y:m.y, endX:m.endX, endY:m.endY, color:m.color, width:m.width, outline:Boolean(m.outline) }));
  if (marks.length !== value.marks.length) return null;
  return { version:1, originalWidth:Number(value.originalWidth), originalHeight:Number(value.originalHeight), marks, renderedAttachment: { id:String(value.renderedAttachment.id), name:String(value.renderedAttachment.name || 'หลักฐานมีเครื่องหมาย.png'), type:String(value.renderedAttachment.type || 'image/png'), size:Number(value.renderedAttachment.size) || 0, addedAt:value.renderedAttachment.addedAt } };
}
export function annotationAttachmentIds(attachment) {
  return [attachment?.id, attachment?.imageAnnotation?.renderedAttachment?.id].filter(Boolean);
}
export function displayedImageAttachment(attachment) {
  return attachment?.imageAnnotation?.renderedAttachment || attachment;
}
export function collectAnnotationAttachmentIds(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(collectAnnotationAttachmentIds);
  const own = value.imageAnnotation?.renderedAttachment?.id;
  return [...(own ? [own] : []), ...Object.values(value).flatMap(collectAnnotationAttachmentIds)];
}
export function annotationPath(mark, width, height) {
  const x = mark.x * width, y = mark.y * height;
  const endX = mark.endX * width, endY = mark.endY * height;
  if (mark.type === 'rect') return { x: Math.min(x, endX), y: Math.min(y, endY), width: Math.abs(endX-x), height: Math.abs(endY-y) };
  const angle = Math.atan2(endY-y, endX-x);
  const size = Math.max(12, mark.width * 4) * width / 1000;
  return { x, y, endX, endY, head: [endX-size*Math.cos(angle-.5), endY-size*Math.sin(angle-.5), endX-size*Math.cos(angle+.5), endY-size*Math.sin(angle+.5)] };
}
export function drawImageAnnotations(context, marks, width, height) {
  for (const mark of marks) {
    const p = annotationPath(mark, width, height);
    const stroke = (color, lineWidth) => {
      context.beginPath(); context.strokeStyle=color; context.lineWidth=lineWidth; context.lineJoin='round'; context.lineCap='round';
      if (mark.type === 'rect') context.rect(p.x,p.y,p.width,p.height);
      else { context.moveTo(p.x,p.y); context.lineTo(p.endX,p.endY); context.moveTo(p.head[0],p.head[1]); context.lineTo(p.endX,p.endY); context.lineTo(p.head[2],p.head[3]); }
      context.stroke();
    };
    if (mark.outline) stroke('#ffffff', (mark.width+2)*width/1000);
    stroke(mark.color, mark.width*width/1000);
  }
}
export async function renderAnnotatedImage(blob, marks) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    const canvas = document.createElement('canvas'); canvas.width=bitmap.width; canvas.height=bitmap.height;
    const context=canvas.getContext('2d'); context.drawImage(bitmap,0,0);
    drawImageAnnotations(context,marks,canvas.width,canvas.height);
    let rendered = await new Promise((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('สร้างภาพมีเครื่องหมายไม่สำเร็จ')), 'image/png'));
    if (rendered.size > 19 * 1024 * 1024) rendered = await new Promise((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('สร้างภาพมีเครื่องหมายไม่สำเร็จ')), 'image/webp', .95));
    if (rendered.size > 20 * 1024 * 1024) throw new Error('ภาพมีเครื่องหมายใหญ่เกินขนาดที่ระบบรองรับ');
    return { blob: rendered, width: bitmap.width, height: bitmap.height };
  } finally { bitmap.close(); }
}
