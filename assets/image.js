/**
 * 붙여넣거나 고른 이미지를 정해진 용량 안으로 줄인다.
 * 캔버스로 다시 그려 내보내므로 원본 메타데이터와 이상한 페이로드가 함께 사라진다.
 */

export const MAX_BYTES = 1024 * 1024;   // 저장되는 한 장의 최대 용량
export const MAX_DIM = 1600;            // 긴 변 기준 최대 픽셀
const MIN_DIM = 480;                    // 이 아래로는 더 줄이지 않는다

const canvasToBlob = (canvas, quality) =>
  new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));

function draw(bitmap, scale) {
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';        // 투명 PNG 가 검게 나오지 않도록
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

/**
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 * @throws 이미지로 읽을 수 없을 때
 */
export async function prepareImage(file, { maxBytes = MAX_BYTES, maxDim = MAX_DIM } = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('이미지를 읽을 수 없습니다. JPG 또는 PNG 로 다시 시도해주세요.');
  }

  let scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  let quality = 0.82;
  let best = null;

  // 품질을 먼저 낮추고, 그래도 크면 크기를 줄인다.
  for (let i = 0; i < 10; i++) {
    const canvas = draw(bitmap, scale);
    const blob = await canvasToBlob(canvas, quality);
    if (!blob) break;
    best = { blob, width: canvas.width, height: canvas.height };
    if (blob.size <= maxBytes) break;
    if (quality > 0.5) quality -= 0.1;
    else if (Math.max(canvas.width, canvas.height) > MIN_DIM) { scale *= 0.8; quality = 0.75; }
    else break;
  }

  bitmap.close?.();
  if (!best) throw new Error('이미지 변환에 실패했습니다.');
  if (best.blob.size > maxBytes) {
    throw new Error(`이미지가 너무 큽니다. ${Math.round(maxBytes / 1024)}KB 이하로 줄일 수 없었습니다.`);
  }
  return best;
}

/** 붙여넣기·드롭 이벤트에서 이미지 파일만 골라낸다. */
export function imagesFrom(dataTransfer) {
  if (!dataTransfer) return [];
  const out = [];
  for (const item of dataTransfer.items || []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  if (!out.length) {
    for (const f of dataTransfer.files || []) if (f.type.startsWith('image/')) out.push(f);
  }
  return out;
}
