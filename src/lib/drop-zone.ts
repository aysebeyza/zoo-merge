// Sürüklenen yumurtanın hangi bırakma alanına (kutu ya da kuluçka yuvası) düştüğünü bulur.

export type Rect = { x: number; y: number; width: number; height: number };

/** Yumurtanın ortası hiçbir alanın içinde değilse, alanın kısa kenarının bu oranı kadar uzaktaki alan da kabul edilir. */
const TOLERANCE = 0.5;

/**
 * (x, y) yumurtanın ortasıdır. Ortası bir alanın içindeyse o alan seçilir; değilse en yakın alan,
 * yeterince yakınsa seçilir. Kutular arasındaki boşluğa ya da kenara bırakılan yumurta böylece geri gitmez.
 */
export function findDropZone(zones: Map<string, Rect>, x: number, y: number): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const [id, r] of zones) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.width));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.height));
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return id;
    if (distance <= Math.min(r.width, r.height) * TOLERANCE && distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}
