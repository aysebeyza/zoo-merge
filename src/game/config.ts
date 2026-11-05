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

// Altın kazancı dokümandaki tablonun yaklaşık 10'da 1'i: oyuncular bir günde 20 milyona ulaşıyordu.
// Seviyeler arasındaki oran (yaklaşık 2,2 kat) korunur; küçükler sık, büyükler seyrek düşürür.
// prettier-ignore
export const ANIMALS: readonly AnimalConfig[] = [
  { level: 1, name: 'Civciv', emoji: '🐥', dropEverySec: 10, dropAmount: 1, incubationSec: 10, eggColor: '#FFD93D', food: { emoji: '🌾', name: 'Tohum' } },
  { level: 2, name: 'Tavşan', emoji: '🐰', dropEverySec: 8, dropAmount: 2, incubationSec: 30, eggColor: '#FF9EC4', food: { emoji: '🥕', name: 'Havuç' } },
  { level: 3, name: 'Kedi', emoji: '🐱', dropEverySec: 6, dropAmount: 3, incubationSec: 90, eggColor: '#FF9F45', food: { emoji: '🐟', name: 'Balık' } },
  { level: 4, name: 'Köpek', emoji: '🐶', dropEverySec: 6, dropAmount: 7, incubationSec: 4 * 60, eggColor: '#C68B59', food: { emoji: '🦴', name: 'Kemik' } },
  { level: 5, name: 'Panda', emoji: '🐼', dropEverySec: 6, dropAmount: 16, incubationSec: 8 * 60, eggColor: '#E4E4E4', food: { emoji: '🎋', name: 'Bambu' } },
  { level: 6, name: 'Penguen', emoji: '🐧', dropEverySec: 6, dropAmount: 36, incubationSec: 15 * 60, eggColor: '#4D96FF', food: { emoji: '🦐', name: 'Karides' } },
  { level: 7, name: 'Zürafa', emoji: '🦒', dropEverySec: 8, dropAmount: 108, incubationSec: 30 * 60, eggColor: '#6BCB77', food: { emoji: '🍃', name: 'Yaprak' } },
  { level: 8, name: 'Fil', emoji: '🐘', dropEverySec: 8, dropAmount: 240, incubationSec: 60 * 60, eggColor: '#B983FF', food: { emoji: '🍌', name: 'Muz' } },
  { level: 9, name: 'Aslan', emoji: '🦁', dropEverySec: 8, dropAmount: 540, incubationSec: 2 * 60 * 60, eggColor: '#FF6B6B', food: { emoji: '🥩', name: 'Et' } },
  { level: 10, name: 'Ejderha', emoji: '🐉', dropEverySec: 10, dropAmount: 1500, incubationSec: 4 * 60 * 60, eggColor: '#2EC4B6', food: { emoji: '🌶️', name: 'Biber' } },
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
/**
 * İlk oyunda rehber çocuğa ilk bu kadar hayvanı tek tek çıkartır (civciv, tavşan, kedi); rehber
 * sürerken bu hayvanların kuluçkası FIRST_HATCH_SEC kadar kısadır.
 */
export const TUTORIAL_ANIMALS = 3;
/**
 * Yeni bir hayvan bulununca verilen elmas: her hayvan bir öncekinden 1 fazla (civciv 1, ejderha 10;
 * bütün oyunda 55). Elmas az kalsın diye başta çok az; elmaslı yükseltmelerin çoğu parayla alınır.
 */
export function diamondsForNewAnimal(level: number): number {
  return level;
}

// --- Yumurta sepeti ---
// Yumurtalar altınla alınmaz: Tavuk Anne belli aralıklarla sepete yumurta bırakır (oyun kapalıyken de),
// sepet dolunca durur. Böylece ilerleme altına değil zamana bağlıdır; günde 3 x 20 dk oynayan çocuk ejderhayı
// yaklaşık 7. gün çıkarır.
// Sayılar simülasyonla ayarlandı (npm run sim).

/** Tavuk Anne kaç saniyede bir sepete yumurta bırakır. Hızlandıran yükseltme yok; sepet yalnızca büyütülür. */
export const BASKET_EVERY_SEC = 300;
/** Büyük sepet yükseltmesinin seviyesine göre sepet en fazla kaç yumurta alır: 20'den başlar, 10'ar artar. */
export const BASKET_CAP = [20, 30, 40, 50, 60];
/** Yeni oyuna başlarken sepette kaç yumurta var; ilk hayvanlar hızlı çıksın diye sepet dolu başlar. */
export const BASKET_START = 20;

/**
 * Kaldırılan "Otomatik yumurta" yükseltmesinin seviye bedelleri; daha önce alanlara toplamı iade edilir.
 * Eski kayıtlardaki upgrades.autoEgg seviyesi bunun için okunur.
 */
export const AUTO_EGG_REFUND_COSTS = [150, 2_000, 20_000];

/**
 * Kaldırılan "Tavuk Anne" (sepeti hızlandıran) yükseltmesinin seviye bedelleri; eski kayıtlarda alınmışsa
 * toplamı iade edilir. Telefondaki sürümde geçerli olan ilk fiyatlar.
 */
export const FASTER_HEN_REFUND_COSTS = [500, 5_000, 50_000];

/** Doğaya salınan hayvan, yaklaşık 1 dakikalık kazancını verir. */
export const RELEASE_VALUE_SEC = 60;

// --- Yükseltmeler ---
// Dokümanda etkiler var ama fiyatlar ve seviye sayıları yok. Fiyatlar simülasyonla ayarlandı (npm run sim):
// günde 3 x 20 dk oynayan çocuk ilk gün birkaç ucuz yükseltme alabilir, Büyük sepet'i ilk gün alamaz.

export type UpgradeId =
  | 'biggerBasket'
  | 'moreVisitors'
  | 'fasterIncubator'
  | 'incubatorSlot'
  | 'betterEgg'
  | 'biggerPark';

/** Daha iyi yumurta: sepetten alınan yumurtanın 2. seviyeden başlama şansı. */
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

/** Yükseltmenin hangi parayla alındığı. Elmas çok nadir olduğu için yalnızca en güçlü yükseltmeler elmasla alınır. */
export type Currency = 'gold' | 'diamonds';

export const CURRENCY_ICON: Record<Currency, string> = { gold: '🪙', diamonds: '💎' };

export type UpgradeConfig = {
  id: UpgradeId;
  name: string;
  emoji: string;
  currency: Currency;
  /** Her seviyenin bedeli (currency cinsinden). Dizinin uzunluğu en yüksek seviyedir. */
  costs: readonly number[];
  /** Seviyenin etkisini kısaca anlatır; 0, henüz alınmamış demek. */
  effect: (level: number) => string;
};

export const UPGRADES: readonly UpgradeConfig[] = [
  {
    id: 'biggerBasket',
    name: 'Büyük sepet',
    emoji: '🧺',
    // Altınla milyonlar tutuyordu; elmasla alınır, ilk seviyesi 2-3 yeni hayvandan sonra.
    currency: 'diamonds',
    costs: [10, 20, 30, 40],
    effect: (level) => `Sepete ${BASKET_CAP[level]} yumurta sığar`,
  },
  {
    id: 'moreVisitors',
    name: 'Daha çok ziyaretçi',
    emoji: '🎈',
    currency: 'gold',
    costs: [50_000, 300_000, 1_500_000, 6_000_000, 25_000_000],
    effect: (level) => (level === 0 ? 'Normal kazanç' : `+%${level * 10} altın`),
  },
  {
    id: 'fasterIncubator',
    name: 'Kuluçka makinesi',
    emoji: '🔥',
    currency: 'gold',
    costs: [80_000, 400_000, 2_000_000, 8_000_000, 30_000_000],
    effect: (level) => (level === 0 ? 'Normal hız' : `Kuluçka %${level * 10} daha kısa`),
  },
  {
    id: 'incubatorSlot',
    name: 'Yeni kuluçka yuvası',
    emoji: '🐣',
    currency: 'diamonds',
    costs: [20, 40],
    effect: (level) => `${incubatorSlots(level)} yuva`,
  },
  {
    id: 'betterEgg',
    name: 'Daha iyi yumurta',
    emoji: '✨',
    currency: 'diamonds',
    costs: [15, 30, 45],
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
    currency: 'gold',
    costs: [200_000, 1_000_000, 4_000_000, 15_000_000],
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

// --- Ziyaretçiler ---
// Ziyaretçiler yolun bir ucundan girip öbür ucundan çıkar. Arada bir gelen ziyaretçinin başında 💰
// olur; çocuk o geçip gitmeden dokunursa bahşiş toplanır, yetişemezse bahşiş de onunla gider.

/** Bahşişli ziyaretçi bu aralıkla gelir (oyun açıkken). */
export const TIP_EVERY_SEC = 3 * 60;
/** Bahşişli ziyaretçinin yolda kaldığı süre; bu sürede dokunulmazsa gider. */
export const TIP_STAY_SEC = 15;
/** Bahşiş, parkın bu kadar saniyelik kazancı kadardır (en az TIP_MIN). */
export const TIP_INCOME_SEC = 60;
export const TIP_MIN = 10;

/** Ekranda dolaşan ziyaretçi sayısı: hayvan çoğaldıkça ve "Daha çok ziyaretçi" alındıkça artar. */
export function visitorCount(animals: number, moreVisitorsLevel: number): number {
  if (animals === 0) return 0;
  return Math.min(6, 1 + Math.floor(animals / 3) + moreVisitorsLevel);
}

// --- Bahçe seviyesi ---
// Çocuk yaptığı her işle yıldız puanı (⭐) kazanır; puan dolunca bahçe seviye atlar ve hediye gelir.

/** Yıldız puanları: yeni hayvan bulmak, hayvan çıkarmak, beslemek, bahşiş toplamak. */
export function xpForNewAnimal(level: number): number {
  return 10 * level;
}
export function xpForHatch(level: number): number {
  return level;
}
export const XP_FEED = 2;
export const XP_TIP = 1;

/** Bu seviyeye ulaşmak için gereken toplam puan: 2. seviye 20, 3. seviye 60, 5. seviye 200 ... */
export function xpForLevel(level: number): number {
  return 10 * level * (level - 1);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Seviye hediyesi: parkın bu kadar saniyelik kazancı kadar altın (en az LEVEL_GOLD_MIN × seviye). */
export const LEVEL_GOLD_INCOME_SEC = 120;
export const LEVEL_GOLD_MIN = 100;
/** Her LEVEL_DIAMOND_EVERY seviyede bir küçük elmas hediyesi; elmas az kalsın. */
export const LEVEL_DIAMOND_EVERY = 5;
export const LEVEL_DIAMONDS = 2;
