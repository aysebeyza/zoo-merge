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

// --- Yükseltmeler ---
// Dokümanda etkiler var ama fiyatlar ve seviye sayıları yok. Aşağıdakiler öneri; testlerde ayarlanacak.

export type UpgradeId =
  | 'autoEgg'
  | 'autoFeeder'
  | 'moreVisitors'
  | 'fasterIncubator'
  | 'incubatorSlot'
  | 'betterEgg'
  | 'biggerPark';

/** Otomatik yumurta: seviyeye göre kaç saniyede bir bedava yumurta düşer (0. seviye kapalı). */
export const AUTO_EGG_EVERY_SEC = [0, 30, 20, 10];
/**
 * Daha iyi yumurta: yeni yumurtanın 2. seviyeden başlama şansı. Dokümanda yalnızca satın alınan
 * yumurtalar için yazıyordu; çocuğun kafası karışmasın diye otomatik yumurtalara da uygulanıyor.
 */
export const BETTER_EGG_CHANCE = [0, 0.25, 0.5, 1];

export function parkLimit(biggerParkLevel: number): number {
  return PARK_LIMIT + biggerParkLevel;
}

/** Daha çok ziyaretçi: her seviye altın kazancını %10 artırır. */
export function incomeBonus(moreVisitorsLevel: number): number {
  return 1 + 0.1 * moreVisitorsLevel;
}

export function incubatorSlots(incubatorSlotLevel: number): number {
  return INCUBATOR_SLOTS + incubatorSlotLevel;
}

/** Kuluçka makinesi: her seviye kuluçka süresini %10 kısaltır (en fazla %50). */
export function incubationFactor(fasterIncubatorLevel: number): number {
  return 1 - 0.1 * fasterIncubatorLevel;
}

export type UpgradeConfig = {
  id: UpgradeId;
  name: string;
  emoji: string;
  /** Her seviyenin altın bedeli. Dizinin uzunluğu en yüksek seviyedir. */
  costs: readonly number[];
  /** Seviyenin etkisini kısaca anlatır; 0, henüz alınmamış demek. */
  effect: (level: number) => string;
};

export const UPGRADES: readonly UpgradeConfig[] = [
  {
    id: 'autoEgg',
    name: 'Otomatik yumurta',
    emoji: '🥚',
    costs: [150, 2_000, 20_000],
    effect: (level) => (level === 0 ? 'Kapalı' : `${AUTO_EGG_EVERY_SEC[level]} sn'de 1 bedava yumurta`),
  },
  {
    id: 'autoFeeder',
    name: 'Otomatik yemlik',
    emoji: '🥣',
    // Doküman: çocuk okuldayken ya da uyurken hayvanı kaçmasın diye erken ve ucuz açılmalı.
    costs: [250],
    effect: (level) => (level === 0 ? 'Kapalı' : 'Acıkan hayvanları kendisi besler'),
  },
  {
    id: 'moreVisitors',
    name: 'Daha çok ziyaretçi',
    emoji: '🎈',
    costs: [300, 1_500, 7_500, 40_000, 200_000],
    effect: (level) => (level === 0 ? 'Normal kazanç' : `+%${level * 10} altın`),
  },
  {
    id: 'fasterIncubator',
    name: 'Kuluçka makinesi',
    emoji: '🔥',
    costs: [400, 2_500, 12_000, 60_000, 300_000],
    effect: (level) => (level === 0 ? 'Normal hız' : `Kuluçka %${level * 10} daha kısa`),
  },
  {
    id: 'incubatorSlot',
    name: 'Yeni kuluçka yuvası',
    emoji: '🐣',
    costs: [500, 30_000],
    effect: (level) => `${incubatorSlots(level)} yuva`,
  },
  {
    id: 'betterEgg',
    name: 'Daha iyi yumurta',
    emoji: '✨',
    costs: [800, 8_000, 80_000],
    effect: (level) =>
      level === 0
        ? 'Yumurtalar 1. seviye'
        : BETTER_EGG_CHANCE[level] >= 1
          ? 'Yumurtalar hep 2. seviye'
          : `%${BETTER_EGG_CHANCE[level] * 100} şansla 2. seviye`,
  },
  {
    id: 'biggerPark',
    name: 'Daha büyük park',
    emoji: '🏞️',
    costs: [1_000, 5_000, 25_000, 100_000],
    effect: (level) => `${parkLimit(level)} hayvan`,
  },
];

export function upgradeFor(id: UpgradeId): UpgradeConfig {
  const upgrade = UPGRADES.find((u) => u.id === id);
  if (!upgrade) throw new Error(`Bilinmeyen yükseltme: ${id}`);
  return upgrade;
}

/** Bir sonraki seviyenin bedeli; en üst seviyedeyse null. */
export function upgradeCost(id: UpgradeId, currentLevel: number): number | null {
  return upgradeFor(id).costs[currentLevel] ?? null;
}

// --- Besleme ---
// Dokümanda tokluk aralıkları var ama süreler ve fiyat yok. Aşağıdakiler öneri; testlerde ayarlanacak.

/** Tokluğun %100'den %0'a inmesi. Bütün hayvanlar aynı hızda acıkır. */
export const HUNGER_SEC = 4 * 60 * 60;
/** Tokluk %0'a indikten sonra hayvanın kaçması. Bütün hayvanlar için aynı. */
export const ESCAPE_AFTER_EMPTY_SEC = 8 * 60 * 60;
/** Bir hayvanı %0'dan %100'e doyurmanın bedeli: hayvanın bu kadar saniyelik kazancı. */
export const FEED_FULL_COST_SEC = 10 * 60;
/** Otomatik yemlik, tokluk bu orana inince hayvanı besler. */
export const AUTO_FEED_AT = 0.5;

export type Mood = 'happy' | 'hungry' | 'sad' | 'leaving';

/** Dokümandaki tokluk tablosu. */
export function moodFor(fullness: number): Mood {
  if (fullness >= 0.5) return 'happy';
  if (fullness >= 0.2) return 'hungry';
  if (fullness > 0) return 'sad';
  return 'leaving';
}

/** Tokluğa göre kazanç: tam, yarı yarıya, çok az, hiç. */
export function hungerMultiplier(fullness: number): number {
  const mood = moodFor(fullness);
  if (mood === 'happy') return 1;
  if (mood === 'hungry') return 0.5;
  if (mood === 'sad') return 0.1;
  return 0;
}

/** Oyun kapalıyken en fazla 2 saat boyunca altın birikir. */
export const OFFLINE_EARNING_CAP_SEC = 2 * 60 * 60;
/** Oyuncu en az bu kadar uzak kaldıysa "Sen yokken ... kazandın!" ekranı çıkar. */
export const AWAY_REPORT_SEC = 60;
