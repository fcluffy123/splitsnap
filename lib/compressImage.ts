// lib/compressImage.ts
// Browser-only: shrink a receipt photo to under 1 MB before uploading,
// so scanning is fast on mobile data. Not imported by the server.

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB — Gemini handles this fine, and small text stays sharp
const MAX_DIM = 2400; // tilted/curved receipts need resolution for OCR; 1600 was losing small lines

export async function compressImageToBlob(file: File): Promise<Blob> {
  // imageOrientation: "from-image" makes canvas draw respect EXIF rotation,
  // so phone photos taken sideways come out upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  let width = bitmap.width;
  let height = bitmap.height;
  const fitToMaxDim = () => {
    const scale = Math.min(1, MAX_DIM / Math.max(width, height));
    width = Math.max(1, Math.round(bitmap.width * scale));
    height = Math.max(1, Math.round(bitmap.height * scale));
  };
  fitToMaxDim();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // extremely old browser — send original

  const draw = () => {
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(bitmap, 0, 0, width, height);
  };

  const toBlob = (quality: number) =>
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

  // First try: full-ish quality. If still too big, lower quality, then shrink.
  draw();
  let quality = 0.85;
  let blob = await toBlob(quality);
  while (blob && blob.size > MAX_BYTES && quality > 0.4) {
    quality -= 0.15;
    blob = await toBlob(quality);
  }
  while (blob && blob.size > MAX_BYTES) {
    width = Math.max(1, Math.round(width / 2));
    height = Math.max(1, Math.round(height / 2));
    draw();
    blob = await toBlob(0.7);
  }

  return blob && blob.size <= MAX_BYTES ? blob : file;
}
