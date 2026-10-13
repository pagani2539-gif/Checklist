import { getPrintableImageSource } from "./print-image-optimizer.js";

// Embed images as data URLs. Both the optimiser and html-to-image otherwise fetch
// blob URLs, which production connect-src deliberately does not permit.
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("อ่านสำเนาภาพไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}

export async function prepareSnapshotPdfImages(page) {
  const originals = [];
  const restore = async () => {
    for (const { image, src, srcset } of originals) {
      if (src === null) image.removeAttribute('src');
      else image.setAttribute('src', src);
      if (srcset === null) image.removeAttribute('srcset');
      else image.setAttribute('srcset', srcset);
    }
    await Promise.allSettled(originals.map(({ image }) => image.decode()));
  };
  try {
    for (const image of page.querySelectorAll('img')) {
      if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
        throw new Error('ภาพหลักฐานยังไม่พร้อม กรุณารอภาพโหลดครบแล้วลองใหม่');
      }
      let dataUrl;
      const preparedBlob = image.dataset?.printPrepared === 'true'
        ? getPrintableImageSource(image.currentSrc || image.src)
        : null;
      if (preparedBlob) {
        dataUrl = await blobToDataUrl(preparedBlob);
      } else {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1200 / image.naturalWidth, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        try {
          const context = canvas.getContext('2d');
          if (!context) throw new Error('เบราว์เซอร์สร้างภาพสำหรับ PDF ไม่ได้');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/png');
          if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('เบราว์เซอร์แปลงภาพสำหรับ PDF ไม่ได้');
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      }
      originals.push({ image, src: image.getAttribute('src'), srcset: image.getAttribute('srcset') });
      image.removeAttribute('srcset');
      image.setAttribute('src', dataUrl);
      await image.decode();
    }
    return restore;
  } catch (error) {
    await restore();
    if (error?.name === 'SecurityError') throw new Error('ภาพหลักฐานไม่อนุญาตให้แปลงเป็น PDF กรุณาโหลดภาพผ่านระบบแล้วลองใหม่');
    throw error;
  }
}
