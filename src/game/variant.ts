// Yumurta ve hayvan çeşidi: normal ya da nadir parlak (✨). Yumurtanın rengi hayvana göre sabittir (config.ts).

import { SHINY_BONUS, SHINY_CHANCE } from './config.ts';

export type Variant = {
  /** Parlak yumurtadan çıkan hayvan daha çok altın kazandırır. */
  shiny: boolean;
};

export const NORMAL: Variant = { shiny: false };

/** Yeni yumurtanın çeşidi. shinyRoll: 0 ile 1 arası rastgele sayı; verilmezse yumurta normal olur. */
export function newVariant(shinyRoll = 1): Variant {
  return { shiny: shinyRoll < SHINY_CHANCE };
}

/** İki yumurta birleşince parlaklık korunur: biri parlaksa yenisi de parlak olur. */
export function mixVariants(a: Variant, b: Variant): Variant {
  return { shiny: a.shiny || b.shiny };
}

export function goldMultiplier(variant: Variant): number {
  return variant.shiny ? 1 + SHINY_BONUS : 1;
}
