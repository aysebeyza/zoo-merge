// Renk karışımı kuralları (tasarım dokümanı, "Renk karışımı" bölümü).

export type PrimaryColor = 'red' | 'blue' | 'yellow';
export type MixedColor = 'purple' | 'green' | 'orange';
export type ColorId = PrimaryColor | MixedColor;

export type Variant = {
  color: ColorId;
  /** Aynı renkten iki yumurta birleşince çıkan parlak "saf" hal. */
  pure: boolean;
  /** İki farklı karışık renk birleşince çıkan nadir desenli hal. */
  patterned: boolean;
};

export const PRIMARY_COLORS: readonly PrimaryColor[] = ['red', 'blue', 'yellow'];

export const COLOR_HEX: Record<ColorId, string> = {
  red: '#FF6B6B',
  blue: '#4D96FF',
  yellow: '#FFD93D',
  purple: '#B983FF',
  green: '#6BCB77',
  orange: '#FF9F45',
};

export const COLOR_NAME: Record<ColorId, string> = {
  red: 'Kırmızı',
  blue: 'Mavi',
  yellow: 'Sarı',
  purple: 'Mor',
  green: 'Yeşil',
  orange: 'Turuncu',
};

const MIXES: Record<string, MixedColor> = {
  'blue+red': 'purple',
  'blue+yellow': 'green',
  'red+yellow': 'orange',
};

export function isPrimary(color: ColorId): color is PrimaryColor {
  return (PRIMARY_COLORS as readonly ColorId[]).includes(color);
}

export function plainVariant(color: ColorId): Variant {
  return { color, pure: false, patterned: false };
}

export function mixVariants(a: Variant, b: Variant): Variant {
  // Desen korunur (dokümanda açık soru; şimdilik "korunur" kabul edildi).
  if (a.patterned || b.patterned) {
    return { color: a.patterned ? a.color : b.color, pure: false, patterned: true };
  }
  if (a.color === b.color) {
    return { color: a.color, pure: true, patterned: false };
  }
  const aPrimary = isPrimary(a.color);
  const bPrimary = isPrimary(b.color);
  if (aPrimary && bPrimary) {
    const key = [a.color, b.color].sort().join('+');
    return plainVariant(MIXES[key]);
  }
  if (aPrimary !== bPrimary) {
    // Ana renk + karışık renk: karışık renk korunur.
    return plainVariant(aPrimary ? b.color : a.color);
  }
  // İki farklı karışık renk: desenli.
  return { color: a.color, pure: false, patterned: true };
}

/** Saf hal +%20, desenli hal +%50 altın kazandırır. */
export function goldMultiplier(variant: Variant): number {
  if (variant.patterned) return 1.5;
  if (variant.pure) return 1.2;
  return 1;
}
