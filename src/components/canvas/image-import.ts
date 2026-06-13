/**
 * Client-side image import for canvas image nodes: downscale oversized images
 * before they reach the asset store, so a 12-megapixel phone photo doesn't sit
 * in IndexedDB at full resolution. Returns the (possibly re-encoded) blob plus
 * its natural dimensions for the node's initial footprint.
 */

/** Longest edge an imported canvas image is downscaled to. */
export const MAX_IMAGE_DIMENSION = 1600;
/** Initial on-canvas footprint for the longest edge of a new image. */
export const DEFAULT_IMAGE_DISPLAY = 320;

export interface PreparedImage {
  blob: Blob;
  naturalWidth: number;
  naturalHeight: number;
}

export function isImageFile(file: File | Blob): boolean {
  return file.type.startsWith('image/');
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Downscale if the longest edge exceeds MAX_IMAGE_DIMENSION; otherwise return
 * the original blob untouched (lossless for already-small graphics).
 */
export async function prepareImageForCanvas(file: File | Blob): Promise<PreparedImage> {
  const img = await blobToImage(file);
  const { naturalWidth, naturalHeight } = img;
  const longest = Math.max(naturalWidth, naturalHeight);

  if (longest <= MAX_IMAGE_DIMENSION) {
    return { blob: file, naturalWidth, naturalHeight };
  }

  const scale = MAX_IMAGE_DIMENSION / longest;
  const w = Math.round(naturalWidth * scale);
  const h = Math.round(naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: file, naturalWidth, naturalHeight };
  ctx.drawImage(img, 0, 0, w, h);

  // Keep PNG for graphics with transparency; JPEG for photos to save space.
  const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outType, 0.9)
  );
  if (!blob) return { blob: file, naturalWidth, naturalHeight };
  return { blob, naturalWidth: w, naturalHeight: h };
}

/** Initial display size for a new image node, capped to DEFAULT_IMAGE_DISPLAY. */
export function initialImageDisplaySize(
  naturalWidth: number,
  naturalHeight: number
): { width: number; height: number } {
  // Guard against images that report no intrinsic size (some SVGs, decode edge
  // cases) so we never create an invisible 0x0 node.
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) {
    return { width: DEFAULT_IMAGE_DISPLAY, height: DEFAULT_IMAGE_DISPLAY };
  }
  const longest = Math.max(naturalWidth, naturalHeight);
  const scale = longest > DEFAULT_IMAGE_DISPLAY ? DEFAULT_IMAGE_DISPLAY / longest : 1;
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  };
}
