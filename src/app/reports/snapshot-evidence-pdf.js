import { PDFDocument } from 'pdf-lib';
import { prepareSnapshotPdfImages } from './snapshot-pdf-images.js';
import { waitForVehicleReportReady } from './vehicle-analytics-ready.js';

export const SNAPSHOT_PDF_SIZES = Object.freeze({ standard: [595.276,841.89], presentation: [960,540] });

export async function createSnapshotEvidencePdf(images, mode='standard', { draft=false }={}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Checklist Snapshot vehicle evidence');
  pdf.setProducer('Checklist Operations Hub');
  const [width,height] = SNAPSHOT_PDF_SIZES[mode] || SNAPSHOT_PDF_SIZES.standard;
  for (const bytes of images) {
    const image = await pdf.embedJpg(typeof bytes === 'string' ? bytes : Uint8Array.from(bytes));
    const page = pdf.addPage([width,height]);
    const margin = mode === 'presentation' ? 0 : 22;
    const scale = Math.min((width-margin*2)/image.width,(height-margin*2)/image.height);
    const w=image.width*scale,h=image.height*scale;
    page.drawImage(image,{x:(width-w)/2,y:height-margin-h,width:w,height:h});
    if (draft) page.drawText('DRAFT',{x:width-68,y:height-16,size:10,opacity:.65});
  }
  return pdf.save();
}

export async function downloadSnapshotEvidencePdf(report, {fileName='snapshot-evidence.pdf',onProgress=()=>{}}={}) {
  if (!report) throw new Error('ยังไม่มีตัวอย่างรายงาน');
  await waitForVehicleReportReady(report, onProgress);
  const pages = [...report.querySelectorAll('.snapshot-vehicle-page')].filter(page => !page.closest('.vehicle-analytics-measure'));
  const mode=report.dataset.reportMode;
  const draft=report.dataset.reportDraft==='true';
  if (!pages.length) throw new Error('ยังไม่มีหลักฐานรถใน Snapshot');
  const {toJpeg,getFontEmbedCSS} = await import('html-to-image');
  const fontEmbedCSS = await getFontEmbedCSS(pages[0]);
  const images=[];
  for (let index=0;index<pages.length;index++) {
    if(!report.isConnected||!pages[index].isConnected||report.dataset.reportMode!==mode)throw new Error('รูปแบบรายงานเปลี่ยน กรุณาสร้าง PDF ใหม่');
    onProgress(`กำลังสร้าง PDF หลักฐาน ${index+1}/${pages.length} หน้า`);
    let restoreImages = async () => {};
    try {
      restoreImages = await prepareSnapshotPdfImages(pages[index]);
      // Computed table height includes its caption. Reapplying that pixel height
      // to the SVG clone stretches rows and covers the last row with the footer.
      const tableCSS = pages[index].classList.contains('is-analytics') ? '.is-analytics .vehicle-analytics-table, .is-analytics .vehicle-analytics-table-wrap, .is-analytics .vehicle-analytics-table caption, .is-analytics .vehicle-analytics-table thead, .is-analytics .vehicle-analytics-table tbody, .is-analytics .vehicle-analytics-table tr {height:auto!important;}' : '';
      images.push(await toJpeg(pages[index],{quality:.90,pixelRatio:2,backgroundColor:'#fff',fontEmbedCSS: `${fontEmbedCSS}\n${tableCSS}`,cacheBust:false,style:{margin:'0',boxShadow:'none'}}));
    } catch(error) { throw new Error(`สร้าง PDF หน้า ${index+1} ไม่สำเร็จ: ${error?.message || 'แปลงภาพหลักฐานไม่ได้'}`); }
    finally { await restoreImages(); }
  }
  const bytes=await createSnapshotEvidencePdf(images,mode,{draft});
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const link=document.createElement('a');
  link.href=url;link.download=fileName;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60_000);
  return pages.length;
}
