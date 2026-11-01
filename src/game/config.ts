// Oyunun tüm sayıları burada. Değerler tasarım dokümanından alındı ve testlerde ayarlanacak.

export type AnimalConfig = {
  level: number;
  name: string;
  emoji: string;
  /** Hayvan kaç saniyede bir altın düşürür. */
  dropEverySec: number;
  /** Her düşürmede kaç altın verir (renk bonusu hariç). */
  dropAmount: number;
  /** Kuluçka süresi, saniye. */
  incubationSec: number;
};

export const ANIMALS: readonly AnimalConfig[] = [
  { level: 1, name: 'Civciv', emoji: '🐥', dropEverySec: 2, dropAmount: 2, incubationSec: 10 },
  { level: 2, name: 'Tavşan', emoji: '🐰', dropEverySec: 2, dropAmount: 5, incubationSec: 30 },
  { level: 3, name: 'Kedi', emoji: '🐱', dropEverySec: 2, dropAmount: 11, incubationSec: 90 },
  { level: 4, name: 'Köpek', emoji: '🐶', dropEverySec: 3, dropAmount: 36, incubationSec: 4 * 60 },
  { level: 5, name: 'Panda', emoji: '🐼', dropEverySec: 3, dropAmount: 80, incubationSec: 8 * 60 },
  { level: 6, name: 'Penguen', emoji: '🐧', dropEverySec: 3, dropAmount: 180, incubationSec: 15 * 60 },
  { level: 7, name: 'Zürafa', emoji: '🦒', dropEverySec: 4, dropAmount: 540, incubationSec: 30 * 60 },
  { level: 8, name: 'Fil', emoji: '🐘', dropEverySec: 4, dropAmount: 1200, incubationSec: 60 * 60 },
  { level: 9, name: 'Aslan', emoji: '🦁', dropEverySec: 4, dropAmount: 2700, incubationSec: 2 * 60 * 60 },
  { level: 10, name: 'Ejderha', emoji: '🐉', dropEverySec: 5, dropAmount: 7500, incubationSec: 4 * 60 * 60 },
];

export const MAX_LEVEL = ANIMALS.length;

export function animalFor(level: number): AnimalConfig {
  const animal = ANIMALS[level - 1];
  if (!animal) throw new Error(`Bilinmeyen seviye: ${level}`);
  return animal;
}

export const GRID_COLUMNS = 4;
export const GRID_ROWS = 3;
export const GRID_SIZE = GRID_COLUMNS * GRID_ROWS;

export const PARK_LIMIT = 8;
export const INCUBATOR_SLOTS = 2;

export const START_GOLD = 100;
/** Çocuk ilk hayvanını hemen görsün diye ilk kuluçka kısa. */
export const FIRST_HATCH_SEC = 3;
export const DIAMONDS_PER_NEW_ANIMAL = 5;

/** Yumurta fiyatı her alımda biraz artar. */
export function eggPrice(eggsBought: number): number {
  return 25 + 2 * eggsBought;
}

/** Doğaya salınan hayvan, yaklaşık 1 dakikalık kazancını verir. */
export const RELEASE_VALUE_SEC = 60;
