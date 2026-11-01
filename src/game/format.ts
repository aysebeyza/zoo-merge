/** 1250 → "1.250", 2_500_000 → "2,5 Mn". */
export function formatNumber(value: number): string {
  const n = Math.floor(value);
  if (n >= 1_000_000_000) return `${shortDecimal(n / 1_000_000_000)} Mr`;
  if (n >= 1_000_000) return `${shortDecimal(n / 1_000_000)} Mn`;
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function shortDecimal(value: number): string {
  return (Math.floor(value * 10) / 10).toString().replace('.', ',');
}

/** Çocuğun okuyacağı kaba süre, yukarı yuvarlanır: 95 → "2 dk", 5400 → "1 sa 30 dk", 7200 → "2 sa". */
export function formatWait(totalSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(totalSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} dk`;
  return rest === 0 ? `${hours} sa` : `${hours} sa ${rest} dk`;
}

/** 95 → "1:35", 3725 → "1:02:05". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = String(s % 60).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`;
  return `${minutes}:${seconds}`;
}
