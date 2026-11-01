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
  /** Yumurtanın rengi: her hayvanın yumurtası hep aynı renktir, çocuk rengine bakıp eşleşeni bulur. */
  eggColor: string;
  /** Hayvanın kendi yemi; yem dükkanından alınır, bir tanesi hayvanı tamamen doyurur. */
  food: { emoji: string; name: string };
};

// prettier-ignore
export const ANIMALS: readonly AnimalConfig[] = [
  { level: 1, name: 'Civciv', emoji: '🐥', dropEverySec: 2, dropAmount: 2, incubationSec: 10, eggColor: '#FFD93D', food: { emoji: '🌾', name: 'Tohum' } },
  { level: 2, name: 'Tavşan', emoji: '🐰', dropEverySec: 2, dropAmount: 5, incubationSec: 30, eggColor: '#FF9EC4', food: { emoji: '🥕', name: 'Havuç' } },
  { level: 3, name: 'Kedi', emoji: '🐱', dropEverySec: 2, dropAmount: 11, incubationSec: 90, eggColor: '#FF9F45', food: { emoji: '🐟', name: 'Balık' } },
  { level: 4, name: 'Köpek', emoji: '🐶', dropEverySec: 3, dropAmount: 36, incubationSec: 4 * 60, eggColor: '#C68B59', food: { emoji: '🦴', name: 'Kemik' } },
  { level: 5, name: 'Panda', emoji: '🐼', dropEverySec: 3, dropAmount: 80, incubationSec: 8 * 60, eggColor: '#E4E4E4', food: { emoji: '🎋', name: 'Bambu' } },
  { level: 6, name: 'Penguen', emoji: '🐧', dropEverySec: 3, dropAmount: 180, incubationSec: 15 * 60, eggColor: '#4D96FF', food: { emoji: '🦐', name: 'Karides' } },
  { level: 7, name: 'Zürafa', emoji: '🦒', dropEverySec: 4, dropAmount: 540, incubationSec: 30 * 60, eggColor: '#6BCB77', food: { emoji: '🍃', name: 'Yaprak' } },
  { level: 8, name: 'Fil', emoji: '🐘', dropEverySec: 4, dropAmount: 1200, incubationSec: 60 * 60, eggColor: '#B983FF', food: { emoji: '🍌', name: 'Muz' } },
  { level: 9, name: 'Aslan', emoji: '🦁', dropEverySec: 4, dropAmount: 2700, incubationSec: 2 * 60 * 60, eggColor: '#FF6B6B', food: { emoji: '🥩', name: 'Et' } },
  { level: 10, name: 'Ejderha', emoji: '🐉', dropEverySec: 5, dropAmount: 7500, incubationSec: 4 * 60 * 60, eggColor: '#2EC4B6', food: { emoji: '🌶️', name: 'Biber' } },
];

/** Alınan ya da bedava gelen yumurtanın nadir parlak (✨) olma şansı. Öneri; testlerde ayarlanacak. */
export const SHINY_CHANCE = 0.05;
/** Parlak hayvan bu oranda fazla altın kazandırır. */
export const SHINY_BONUS = 0.5;
/** Parlak yumurtanın ve hayvanın altın sarısı çerçevesi. */
export const SHINY_COLOR = '#FFC400';

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

// --- Hayvan yetenekleri (dokümandaki tablo) ---

export type SkillConfig = {
  name: string;
  description: string;
  /** 1., 2. ve 3. seviyenin altın kazancına eklediği oran. Büyük hayvanlarda küçük, ejderha aşırı güçlenmesin. */
  bonuses: readonly [number, number, number];
};

const SKILLS: readonly SkillConfig[] = [
  { name: 'Sevimlilik', description: 'Ziyaretçi daha çok altın bırakır', bonuses: [0.3, 0.6, 1] },
  { name: 'Gösteri', description: 'Daha çok ziyaretçi gelir', bonuses: [0.25, 0.5, 0.75] },
  { name: 'Görkem', description: 'Ziyaretçiler daha uzun kalır', bonuses: [0.2, 0.4, 0.6] },
  { name: 'Kral', description: 'Herkes onu görmeye gelir', bonuses: [0.15, 0.3, 0.45] },
];

export const MAX_SKILL = 3;
/** Bir sonraki yetenek seviyesinin açılması için hayvanın parkta kalması gereken süre. */
export const SKILL_UNLOCK_SEC = [5 * 60, 30 * 60, 2 * 60 * 60] as const;
/** Yetenek seviyesinin bedeli: hayvanın bu kadar saniyelik kazancı. */
export const SKILL_COST_SEC = [2 * 60, 10 * 60, 30 * 60] as const;

/** Civciv-kedi, köpek-penguen, zürafa-aslan ve ejderha ayrı yetenek kullanır. */
export function skillFor(level: number): SkillConfig {
  if (level <= 3) return SKILLS[0];
  if (level <= 6) return SKILLS[1];
  if (level <= 9) return SKILLS[2];
  return SKILLS[3];
}

/** Yetenek seviyesine göre kazanç çarpanı; 0. seviye 1. */
export function skillMultiplier(level: number, skill: number): number {
  return skill === 0 ? 1 : 1 + skillFor(level).bonuses[skill - 1];
}

// --- Besleme ---
// Dokümanda tokluk aralıkları var ama süreler ve fiyat yok. Aşağıdakiler öneri; testlerde ayarlanacak.

/**
 * Beslemeyi hızlı denemek için: proje klasöründeki .env.local dosyasına EXPO_PUBLIC_FAST_HUNGER=1
 * yazılır ve Expo sunucusu yeniden başlatılır. O zaman hayvan 5 dk'da acıkır, 10 dk'da üzülür,
 * 15 dk'da tokluğu biter ve 5 dk sonra kaçar. .env.local Git'e girmediği için testlerde ve
 * telefona kurulan APK'da her zaman gerçek süreler geçerlidir.
 */
const FAST_HUNGER = process.env.EXPO_PUBLIC_FAST_HUNGER === '1';

/** Tokluğun %100'den %0'a inmesi. Bütün hayvanlar aynı hızda acıkır. */
export const HUNGER_SEC = FAST_HUNGER ? 15 * 60 : 4 * 60 * 60;
/** Tokluk %0'a indikten sonra hayvanın kaçması. Bütün hayvanlar için aynı. */
export const ESCAPE_AFTER_EMPTY_SEC = FAST_HUNGER ? 5 * 60 : 8 * 60 * 60;
/** Dokümandaki tokluk sınırları: %50'nin altında acıkmış, %20'nin altında üzgün. */
export const HUNGRY_BELOW = FAST_HUNGER ? 2 / 3 : 0.5;
const SAD_BELOW = FAST_HUNGER ? 1 / 3 : 0.2;
/**
 * Bir yemin fiyatı: o hayvanın (yetenek ve bonuslar hariç) bu kadar saniyelik kazancı. Bir yem hayvanı
 * tamamen doyurur. Öneri; testlerde ayarlanacak.
 */
export const FOOD_COST_SEC = 5 * 60;
/** Tokluğu bunun üstünde olan hayvan beslenmez; yem boşa gitmesin. */
export const FEED_BELOW = 0.95;
/**
 * Otomatik yemlik kaldırıldı (hayvanlar tek tek beslenir). Daha önce alanlara bu kadar altın iade edilir.
 * Eski kayıtlardaki upgrades.autoFeeder seviyesi bunun için okunur.
 */
export const AUTO_FEEDER_REFUND = 250;

/** Hayvanın yeminin fiyatı. */
export function foodPrice(level: number): number {
  const animal = animalFor(level);
  return Math.ceil((animal.dropAmount / animal.dropEverySec) * FOOD_COST_SEC);
}

export type Mood = 'happy' | 'hungry' | 'sad' | 'leaving';

/** Tokluk çubuğunun rengi: yeşil tok, sarı acıkmış, turuncu üzgün, kırmızı kaçmak üzere. */
export const FULLNESS_COLOR: Record<Mood, string> = {
  happy: '#5CC85C',
  hungry: '#FFB020',
  sad: '#FF7A45',
  leaving: '#FF4D4D',
};

/** Dokümandaki tokluk tablosu. */
export function moodFor(fullness: number): Mood {
  if (fullness >= HUNGRY_BELOW) return 'happy';
  if (fullness >= SAD_BELOW) return 'hungry';
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
