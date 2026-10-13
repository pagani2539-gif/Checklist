export const PRINT_IMAGE_MAX_LONG_EDGE = 1800;
export const PRINT_IMAGE_JPEG_QUALITY = 0.86;
export const PRINT_IMAGE_SMALL_JPEG_BYTES = 128 * 1024;

const printableImageSources = new Map();

export function registerPrintableImageSource(url, blob) {
  if (!url || !blob) return () => {};
  printableImageSources.set(url, blob);
  return () => {
    if (printableImageSources.get(url) === blob) printableImageSources.delete(url);
  };
}

export function getPrintableImageSource(url) {
  return printableImageSources.get(url) || null;
}

function blobFromDataUrl(url) {
  if (!url.startsWith("data:")) return null;
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  const metadata = url.slice(5, comma);
  const mimeType = metadata.split(";")[0] || "text/plain";
  const payload = url.slice(comma + 1);
  if (/;base64/i.test(metadata)) {
    const binary = atob(payload.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mimeType });
  }
  return new Blob([decodeURIComponent(payload)], { type: mimeType });
}

async function sourceBlobForPrintImage(url, { signal } = {}) {
  const registeredBlob = printableImageSources.get(url);
  if (registeredBlob) return registeredBlob;
  if (url.startsWith("data:")) return blobFromDataUrl(url);
  // The production CSP intentionally blocks fetch(blob:). Components that create
  // object URLs register their source Blob instead of fetching that URL again.
  if (url.startsWith("blob:")) return null;
  const response = await fetch(url, { signal });
  return response.ok ? response.blob() : null;
}

function dimensionsForPrint(width, height, { maxLongEdge, maxWidth }) {
  const scale = Math.min(
    1,
    maxLongEdge / Math.max(width, height),
    maxWidth / width,
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function containsTransparency(context, width, height) {
  const { data } = context.getImageData(0, 0, width, height);
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] !== 255) return true;
  }
  return false;
}

export async function createPrintImageCopy(image, {
  sourceBlob,
  signal,
  maxLongEdge = PRINT_IMAGE_MAX_LONG_EDGE,
  maxWidth = Number.POSITIVE_INFINITY,
  quality = PRINT_IMAGE_JPEG_QUALITY,
  outputFormat = "auto",
} = {}) {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return null;
  if (!sourceBlob) {
    const sourceUrl = image.currentSrc || image.src;
    if (!sourceUrl) return null;
    sourceBlob = await sourceBlobForPrintImage(sourceUrl, { signal });
    if (!sourceBlob) return null;
  }

  const sourceType = String(sourceBlob.type || "").toLowerCase();
  if (!sourceType.startsWith("image/") || ["image/gif", "image/svg+xml"].includes(sourceType)) return null;

  const dimensions = dimensionsForPrint(image.naturalWidth, image.naturalHeight, { maxLongEdge, maxWidth });
  // Already compact JPEGs with no resizing needed do not benefit enough from
  // another canvas encode to justify delaying a report with hundreds of crops.
  if (sourceType === "image/jpeg" && sourceBlob.size <= PRINT_IMAGE_SMALL_JPEG_BYTES
      && dimensions.width === image.naturalWidth && dimensions.height === image.naturalHeight
      && outputFormat !== "png") return null;
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  try {
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

    const transparent = sourceType !== "image/jpeg" && containsTransparency(context, dimensions.width, dimensions.height);
    const outputType = outputFormat === "png" || transparent ? "image/png" : "image/jpeg";
    const copy = await canvasToBlob(canvas, outputType, outputType === "image/jpeg" ? quality : undefined);
    if (!copy || !copy.size) return null;
    // Chromium embeds JPEG compression in PDF, but expands WebP into a much
    // larger lossless image. Compare bytes only when keeping the same format.
    if (copy.type === sourceType && copy.size >= sourceBlob.size) return null;
    return copy;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function preparePrintableImageCopies(container, options = {}) {
  const { maxConcurrency = 3, onProgress, signal, ...imageOptions } = options;
  const images = [...(container?.querySelectorAll?.('img[data-print-image="true"]') || [])];
  const replacements = [];
  // One source Blob can appear in several evidence positions. Share conversion
  // within this print run, while each position retains its own restore URL.
  const preparedSources = new Map();
  let failedCount = 0;
  let completedCount = 0;
  let nextImageIndex = 0;

  const prepareImage = async (image) => {
    const originalSrc = image.getAttribute("src");
    const originalUrl = image.currentSrc || image.src;
    if (!originalSrc || !originalUrl) return;
    // A prepared WebP is ready for display, not for Chromium's PDF encoder.

    try {
      const sourceBlob = await sourceBlobForPrintImage(originalUrl, { signal });
      if (!sourceBlob) {
        failedCount += 1;
        return;
      }
      let preparation = preparedSources.get(sourceBlob);
      if (!preparation) {
        preparation = createPrintImageCopy(image, { ...imageOptions, sourceBlob });
        preparedSources.set(sourceBlob, preparation);
      }
      const printCopy = await preparation;
      if (!printCopy) return;

      const printUrl = URL.createObjectURL(printCopy);
      image.setAttribute("src", printUrl);
      try {
        await image.decode();
        replacements.push({ image, originalSrc, printUrl });
      } catch {
        image.setAttribute("src", originalSrc);
        URL.revokeObjectURL(printUrl);
        failedCount += 1;
      }
    } catch {
      // Keep the original evidence when the browser cannot create a print copy.
      failedCount += 1;
    }
  };

  const concurrency = Math.min(images.length, Math.max(1, Math.floor(Number(maxConcurrency) || 1)));
  const worker = async () => {
    while (!signal?.aborted) {
      const imageIndex = nextImageIndex++;
      if (imageIndex >= images.length) return;
      await prepareImage(images[imageIndex]);
      completedCount += 1;
      try {
        onProgress?.({ completed: completedCount, total: images.length, optimizedCount: replacements.length, failedCount });
      } catch {
        // Progress reporting must not interrupt preparation of printable copies.
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (images.length === 0) {
    try {
      onProgress?.({ completed: 0, total: 0, optimizedCount: 0, failedCount: 0 });
    } catch {
      // Progress reporting must not interrupt preparation of printable copies.
    }
  }

  let restored = false;
  const result = {
    optimizedCount: replacements.length,
    failedCount,
    cancelled: Boolean(signal?.aborted),
    restore() {
      if (restored) return;
      restored = true;
      for (const { image, originalSrc, printUrl } of replacements) {
        if (image.getAttribute("src") === printUrl) image.setAttribute("src", originalSrc);
        URL.revokeObjectURL(printUrl);
      }
    },
  };
  if (result.cancelled) result.restore();
  return result;
}
