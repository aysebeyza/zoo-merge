// Oyunun durumu ve kuralları. Arayüzden bağımsızdır, bu yüzden testlerle denenebilir.
// Rastgelelik ve saat dışarıdan verilir (action içinde), böylece reducer saf kalır.

import { tutorialAllows } from './tutorial.ts';
import { goldMultiplier, mixVariants, newVariant, type Variant } from './variant.ts';
import {
  animalFor,
  AWAY_REPORT_SEC,
  BASKET_CAP,
  BASKET_EVERY_SEC,
  BASKET_START,
  BETTER_EGG_CHANCE,
  diamondsForNewAnimal,
  ESCAPE_AFTER_EMPTY_SEC,
  FEED_BELOW,
  FIRST_HATCH_SEC,
  DIRTY_AFTER_SEC,
  DIRTY_INCOME,
  FOOD_COST_SEC,
  FOOD_MIN_PRICE,
  mainFood,
  MAX_POOP,
  POOP_EVERY_SEC,
  POOP_GOLD_MIN,
  POOP_GOLD_SEC,
  WASH_HAPPINESS,
  wishFor,
  XP_POOP,
  XP_WASH,
  type FoodId,
  TUTORIAL_ANIMALS,
  GRID_SIZE,
  HUNGER_SEC,
  hungerMultiplier,
  HUNGRY_BELOW,
  incomeBonus,
  incubationFactor,
  INCUBATOR_SLOTS,
  MAX_LEVEL,
  MAX_SKILL,
  moodFor,
  OFFLINE_EARNING_CAP_SEC,
  parkLimit,
  RELEASE_VALUE_SEC,
  SKILL_COST_SEC,
  SKILL_UNLOCK_SEC,
  skillMultiplier,
  START_GOLD,
  upgradeCost,
  upgradeFor,
  UPGRADES,
  type UpgradeId,
  LEVEL_DIAMOND_EVERY,
  LEVEL_DIAMONDS,
  LEVEL_GOLD_INCOME_SEC,
  LEVEL_GOLD_MIN,
  levelForXp,
  TIP_EVERY_SEC,
  TIP_INCOME_SEC,
  TIP_MIN,
  TIP_STAY_SEC,
  XP_FEED,
  xpForHatch,
  xpForNewAnimal,
  XP_TIP,
  dayNumber,
  HAPPY_MAX,
  PET_COOLDOWN_SEC,
  PET_HAPPINESS,
  TASTE_HAPPINESS,
  tasteOf,
  xpForHappy,
  xpForWish,
  type Taste,
} from './config.ts';

export type Egg = {
  id: number;
  level: number;
  variant: Variant;
  /** Kaçıp yumurtasına dönen hayvanın yetenek seviyesi; yumurtadan çıkınca korunur. */
  skill?: number;
};

export type IncubatorSlot = {
  egg: Egg;
  startedAt: number;
  durationMs: number;
  /** Bu yumurta için mini oyun oynandı mı? Her yumurta yalnızca bir kez hızlandırılabilir. */
  boosted?: boolean;
};

export type ParkAnimal = {
  id: number;
  level: number;
  variant: Variant;
  nextDropAt: number;
  /** Son altın düşürme anı; ekrandaki "+altın" baloncuğu için. */
  lastDropAt: number | null;
  lastDropAmount: number;
  /** Son doyurulduğu an. Tokluk o anda %100'dür ve HUNGER_SEC içinde %0'a iner. */
  fedAt: number;
  /** Yetenek seviyesi, 0-3. */
  skill: number;
  /** Parka çıktığı an; yetenek seviyeleri parkta kalma süresine göre açılır. */
  parkedAt: number;
  /** Mutluluk çubuğu, 0-HAPPY_MAX; ikram ve sevgiyle dolar, dolunca yıldız puanı verir. */
  happiness: number;
  /** En son mutluluk kazandıran sevgi anı (sevgi PET_COOLDOWN_SEC'te bir sayılır). */
  petAt: number;
  /** Günün isteğinin yerine getirildiği gün (dayNumber); bugün yerine geldiyse istek görünmez. */
  wishDoneDay: number | null;
  /** En son yıkandığı an; DIRTY_AFTER_SEC sonra kirlenir. */
  washedAt: number;
};

/** Bahçenin seviye atlaması ve verilen hediye; ekranda kutlamayla gösterilir. */
export type LevelUp = {
  level: number;
  gold: number;
  diamonds: number;
  /** Birer tane hediye edilen yiyecekler (bulunan hayvanların en bilinen yiyecekleri). */
  food: FoodId[];
};

export type GameState = {
  now: number;
  gold: number;
  diamonds: number;
  nextId: number;
  grid: (Egg | null)[];
  incubator: (IncubatorSlot | null)[];
  park: ParkAnimal[];
  discovered: number[];
  firstHatchDone: boolean;
  /** Ekranda gösterilecek "Yeni hayvan!" kutlamaları (seviye numaraları). */
  newAnimalQueue: number[];
  /** Oyuncu yokken biriken altın; 0 değilse "Sen yokken ... kazandın!" ekranı gösterilir. */
  awayGold: number;
  /** Her yükseltmenin seviyesi; 0, henüz alınmamış demek. */
  upgrades: Record<UpgradeId, number>;
  /** Yumurta sepetinde kaç yumurta var. */
  basket: number;
  /** Sepete en son yumurta düştüğü an; bir sonraki yumurta bundan BASKET_EVERY_SEC sonra gelir. */
  basketFilledAt: number;
  /** Kaçan hayvanların yumurtaları; birleştirme alanı doluyken burada ("Hediye" kutusu) bekler. */
  giftBox: Egg[];
  /** Ekranda gösterilecek "... yumurtasına döndü" uyarıları (seviye numaraları). */
  escapedQueue: number[];
  /** Yem stoğu: hayvan seviyesine göre kaç yem var (1 = tohum, 2 = havuç ...). */
  food: Partial<Record<FoodId, number>>;
  /**
   * İlk oyun rehberinin adımı: 1-3 o seviyedeki hayvanı çıkarmak (civciv, tavşan, kedi),
   * TUTORIAL_ANIMALS + 1 Hayvanlarım ekranını açmak; rehber bittiyse null.
   */
  tutorialStep: number | null;
  /** Her hayvanın denenmiş yiyecekleri; çocuk denedikçe sevdiği ve sevmediği yiyecekler görünür olur. */
  triedFoods: Record<number, FoodId[]>;
  /** Her alandaki (hayvan seviyesine göre) kaka sayısı. */
  poops: Record<number, number>;
  /** Her alanın kaka sayacının başladığı an; sıradaki kaka bundan POOP_EVERY_SEC sonra düşer. */
  poopTimers: Record<number, number>;
  /** Bahçenin yıldız puanı; seviye bundan hesaplanır (levelForXp). */
  xp: number;
  /** Hediyesi verilmiş en son seviye; rehber sürerken kazanılan seviyeler rehber bitince verilir. */
  level: number;
  /** Ekranda gösterilecek seviye atlama kutlamaları; hediyeler verilmiş olarak bekler. */
  levelUps: LevelUp[];
  /** Bahşişli ziyaretçi yoldaysa yoldan çıkacağı an; yoksa null. */
  tipUntil: number | null;
  /** Son bahşişli ziyaretçinin geldiği an; sıradaki bundan TIP_EVERY_SEC sonra gelir. */
  tipTimerAt: number;
};

export type GameAction =
  | { type: 'load'; state: GameState }
  | { type: 'tick'; now: number }
  /**
   * Sepetten bir yumurta alıp birleştirme alanına koyar. roll: "Daha iyi yumurta" şansı,
   * shinyRoll: parlak olma şansı; ikisi de 0 ile 1 arası rastgele sayı.
   */
  | { type: 'takeEgg'; roll?: number; shinyRoll?: number }
  | { type: 'buyUpgrade'; id: UpgradeId }
  | { type: 'moveEgg'; from: number; to: number }
  | { type: 'incubate'; from: number; slot: number }
  | { type: 'releaseAnimal'; id: number }
  /** Mini oyun sonrası: kuluçkadaki yumurtanın kalan süresini fraction oranında kısaltır, yumurta başına bir kez. */
  | { type: 'boostIncubation'; slot: number; fraction: number }
  /** Hayvanın yeteneğini bir seviye geliştirir; süre dolduysa ve altın yetiyorsa. */
  | { type: 'upgradeSkill'; id: number }
  /** Dükkândan bir yiyecek alır. */
  | { type: 'buyFood'; food: FoodId }
  /**
   * Hayvanı stoktaki bir yiyecekle tamamen doyurur. Sevmediği yiyeceği yemez (yalnızca denenmiş sayılır);
   * günün isteğiyse ayrıca yıldız puanı kazanılır.
   */
  | { type: 'feedAnimal'; id: number; food: FoodId }
  /** Kirli hayvanı yıkar. */
  | { type: 'washAnimal'; id: number }
  /** O hayvanın alanından bir kaka temizler. */
  | { type: 'cleanPoop'; level: number }
  /** Yem dükkanı "Eksikleri al": parktaki her hayvana birer yem olacak kadar eksik yemleri alır. */
  | { type: 'buyMissingFood' }
  /** Hediye kutusundaki ilk yumurtayı birleştirme alanına alır. */
  | { type: 'takeGift' }
  /** Rehberin son adımı (Hayvanlarım ekranı açıldı) bitti. */
  | { type: 'finishTutorial' }
  /** Oyunu baştan başlatır (ebeveyn onayından sonra); rehber de yeniden gösterilir. */
  | { type: 'reset'; now: number }
  /** Hayvanı sever; mutluluk PET_COOLDOWN_SEC'te bir artar. */
  | { type: 'petAnimal'; id: number }
  /** Bahşişli ziyaretçiye, o gitmeden dokunuldu: bahşiş toplanır. */
  | { type: 'collectTip' }
  | { type: 'dismissLevelUp' }
  | { type: 'dismissNewAnimal' }
  | { type: 'dismissAwayGold' }
  | { type: 'dismissEscaped' };

export function createInitialState(now: number): GameState {
  return {
    now,
    gold: START_GOLD,
    diamonds: 0,
    nextId: 1,
    grid: Array.from({ length: GRID_SIZE }, () => null),
    incubator: Array.from({ length: INCUBATOR_SLOTS }, () => null),
    park: [],
    discovered: [],
    firstHatchDone: false,
    newAnimalQueue: [],
    awayGold: 0,
    upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) as Record<UpgradeId, number>,
    basket: BASKET_START,
    basketFilledAt: now,
    giftBox: [],
    escapedQueue: [],
    food: {},
    tutorialStep: 1,
    triedFoods: {},
    poops: {},
    poopTimers: {},
    xp: 0,
    level: 1,
    levelUps: [],
    tipUntil: null,
    tipTimerAt: now,
  };
}

/** Bir yiyeceğin fiyatı: parkın FOOD_COST_SEC saniyelik kazancı, en az FOOD_MIN_PRICE. */
export function foodPrice(state: GameState): number {
  const income = parkIncomePerSecond(state.park, stateIncomeBonus(state), state.now);
  return Math.max(FOOD_MIN_PRICE, Math.round((income * FOOD_COST_SEC) / 10) * 10);
}

/** Hayvan bu yiyeceği yerse ne der: bugünkü isteği mi (bugün henüz yerine gelmediyse), sever mi, sevmez mi. */
export function foodTaste(animal: ParkAnimal, food: FoodId, now: number): Taste {
  const day = dayNumber(now);
  const taste = tasteOf(animal.level, food, day);
  return taste === 'wish' && animal.wishDoneDay === day ? 'like' : taste;
}

/** Hayvanın şu an istediği yiyecek: bugünkü isteği bekliyorsa o, yoksa en bilinen yiyeceği. */
export function wantedFood(animal: ParkAnimal, now: number): FoodId {
  return wishPending(animal, now) ? wishFor(animal.level, dayNumber(now)) : mainFood(animal.level).id;
}

/** "Besle" düğmesinin vereceği yiyecek: stokta olanlardan istek, sonra sevdiği, sonra fena değil; yoksa null. */
export function bestFood(state: GameState, animal: ParkAnimal): FoodId | null {
  const order: Taste[] = ['wish', 'like', 'okay'];
  let best: FoodId | null = null;
  for (const [food, n] of Object.entries(state.food) as [FoodId, number][]) {
    if (n <= 0) continue;
    const taste = foodTaste(animal, food, state.now);
    if (taste === 'dislike') continue;
    if (best === null || order.indexOf(taste) < order.indexOf(foodTaste(animal, best, state.now))) best = food;
  }
  return best;
}

/** Hayvan kirli mi (t anında). */
export function isDirty(animal: { washedAt: number }, t: number): boolean {
  return t - animal.washedAt >= DIRTY_AFTER_SEC * 1000;
}

/** Kaka temizleyince gelen altın. */
export function poopGold(state: GameState): number {
  const income = parkIncomePerSecond(state.park, stateIncomeBonus(state), state.now);
  return Math.max(POOP_GOLD_MIN, Math.round(income * POOP_GOLD_SEC));
}

/** Hayvanın bugünkü isteği hâlâ bekliyor mu. */
export function wishPending(animal: ParkAnimal, now: number): boolean {
  return animal.wishDoneDay !== dayNumber(now);
}

/** Mutluluğu artırır; çubuk dolarsa yıldız puanı verilir ve çubuk baştan dolmaya başlar. */
function addHappiness(
  state: GameState,
  animal: ParkAnimal,
  amount: number,
  extraXp: number,
  patch: Partial<ParkAnimal>,
) {
  let happiness = Math.max(0, animal.happiness + amount);
  let xp = extraXp;
  if (happiness >= HAPPY_MAX) {
    happiness -= HAPPY_MAX;
    xp += xpForHappy(animal.level);
  }
  const park = state.park.map((a) => (a.id === animal.id ? { ...a, ...patch, happiness } : a));
  return gainXp({ ...state, park }, xp);
}

/** Bahçenin seviyesi. */
export function zooLevel(state: Pick<GameState, 'level'>): number {
  return state.level;
}

/** Bir bahşiş kaç altın: parkın TIP_INCOME_SEC saniyelik kazancı, en az TIP_MIN. */
export function tipAmount(state: GameState): number {
  return Math.max(
    TIP_MIN,
    Math.round(parkIncomePerSecond(state.park, stateIncomeBonus(state), state.now) * TIP_INCOME_SEC),
  );
}

/**
 * Yıldız puanı ekler. Seviye atlanırsa hediyeler hemen verilir (altın, bulunan her hayvana birer yem,
 * birkaç seviyede bir elmas) ve kutlama sıraya girer.
 */
export function gainXp(state: GameState, amount: number): GameState {
  return amount > 0 ? settleLevels({ ...state, xp: state.xp + amount }) : state;
}

/** Puanın ulaştığı ama hediyesi verilmemiş seviyeleri verir; rehber sürerken bekletir. */
function settleLevels(state: GameState): GameState {
  const from = state.level;
  const to = levelForXp(state.xp);
  if (to <= from || state.tutorialStep !== null) return state;
  let { gold, diamonds } = state;
  const food = { ...state.food };
  const levelUps = [...state.levelUps];
  const income = parkIncomePerSecond(state.park, stateIncomeBonus(state), state.now);
  for (let level = from + 1; level <= to; level++) {
    const reward: LevelUp = {
      level,
      gold: Math.max(LEVEL_GOLD_MIN * level, Math.round(income * LEVEL_GOLD_INCOME_SEC)),
      diamonds: level % LEVEL_DIAMOND_EVERY === 0 ? LEVEL_DIAMONDS : 0,
      food: [...new Set([...state.discovered].sort((a, b) => a - b).map((l) => mainFood(l).id))],
    };
    gold += reward.gold;
    diamonds += reward.diamonds;
    for (const f of reward.food) food[f] = (food[f] ?? 0) + 1;
    levelUps.push(reward);
  }
  return { ...state, level: to, gold, diamonds, food, levelUps };
}

/** Yükseltmenin bir sonraki seviyesine yetecek altın ya da elmas var mı. */
export function canAffordUpgrade(state: Pick<GameState, 'gold' | 'diamonds' | 'upgrades'>, id: UpgradeId): boolean {
  const cost = upgradeCost(id, state.upgrades[id]);
  if (cost === null) return false;
  return (upgradeFor(id).currency === 'diamonds' ? state.diamonds : state.gold) >= cost;
}

export function basketCap(state: GameState): number {
  return BASKET_CAP[state.upgrades.biggerBasket];
}

export function basketEveryMs(state: GameState): number {
  return BASKET_EVERY_SEC * 1000;
}

/** Sepete bir sonraki yumurtanın düşeceği an; sepet doluysa null (Tavuk Anne dinleniyor). */
export function nextBasketEggAt(state: GameState): number | null {
  return state.basket >= basketCap(state) ? null : state.basketFilledAt + basketEveryMs(state);
}

/** Hayvanın t anındaki tokluğu, 0 ile 1 arası. */
export function fullnessAt(animal: { fedAt: number }, t: number): number {
  return Math.min(1, Math.max(0, 1 - (t - animal.fedAt) / (HUNGER_SEC * 1000)));
}

/** Stokta bu yiyecekten kaç tane var. */
export function foodStock(state: GameState, food: FoodId): number {
  return state.food[food] ?? 0;
}

/** Hayvanın acıkacağı an: tokluğu "acıkmış" sınırına iner. Çocuğa "ne zaman beslemeliyim?" diye gösterilir. */
export function hungryAt(animal: { fedAt: number }): number {
  return animal.fedAt + (1 - HUNGRY_BELOW) * HUNGER_SEC * 1000;
}

/** Parkta bu türden kaç hayvan var. */
export function animalCount(state: GameState, level: number): number {
  return state.park.filter((a) => a.level === level).length;
}

/**
 * Parktaki her hayvana istediği yiyecekten birer tane düşecek kadar eksikler ve toplam fiyatı. Bugünkü
 * isteği bekleyen hayvan için o, diğerleri için en bilinen yiyeceği sayılır.
 */
export function missingFood(state: GameState): { items: Partial<Record<FoodId, number>>; cost: number } {
  const needed: Partial<Record<FoodId, number>> = {};
  for (const animal of state.park) {
    const food = wantedFood(animal, state.now);
    needed[food] = (needed[food] ?? 0) + 1;
  }
  const items: Partial<Record<FoodId, number>> = {};
  let count = 0;
  for (const [food, n] of Object.entries(needed) as [FoodId, number][]) {
    const missing = n - foodStock(state, food);
    if (missing <= 0) continue;
    items[food] = missing;
    count += missing;
  }
  return { items, cost: count * foodPrice(state) };
}

/** Hayvan beslenebilir mi: tokluğu dolu değil (FEED_BELOW altında). */
export function canFeed(state: GameState, animal: ParkAnimal): boolean {
  return fullnessAt(animal, state.now) < FEED_BELOW;
}

type Earner = { level: number; variant: Variant; skill?: number };

/** bonus: "Daha çok ziyaretçi" yükseltmesinin çarpanı (incomeBonus). Hayvanın yeteneği de hesaba katılır. */
export function dropAmount(animal: Earner, bonus = 1): number {
  return Math.round(
    animalFor(animal.level).dropAmount *
      goldMultiplier(animal.variant) *
      skillMultiplier(animal.level, animal.skill ?? 0) *
      bonus,
  );
}

export function goldPerSecond(animal: Earner, bonus = 1): number {
  return dropAmount(animal, bonus) / animalFor(animal.level).dropEverySec;
}

/** Hayvanın t anındaki kazanç çarpanı tokluğa göre; üzgün hayvanın yeteneği çalışmaz (doküman). */
function earningPerSecondAt(animal: ParkAnimal, bonus: number, t: number): number {
  const fullness = fullnessAt(animal, t);
  const skillWorks = moodFor(fullness) === 'happy' || moodFor(fullness) === 'hungry';
  const dirty = isDirty(animal, t) ? DIRTY_INCOME : 1;
  return goldPerSecond(skillWorks ? animal : { ...animal, skill: 0 }, bonus) * hungerMultiplier(fullness) * dirty;
}

/** now verilirse hayvanların o anki tokluğu da hesaba katılır. */
export function parkIncomePerSecond(park: ParkAnimal[], bonus = 1, now?: number): number {
  return park.reduce(
    (sum, animal) => sum + (now === undefined ? goldPerSecond(animal, bonus) : earningPerSecondAt(animal, bonus, now)),
    0,
  );
}

/** Seçili hayvanın panelde gösterilen o anki kazancı. */
export function animalIncomePerSecond(animal: ParkAnimal, bonus: number, now: number): number {
  return earningPerSecondAt(animal, bonus, now);
}

export function releaseValue(animal: Earner, bonus = 1): number {
  return Math.round(goldPerSecond(animal, bonus) * RELEASE_VALUE_SEC);
}

/** Yeteneğin bir sonraki seviyesi ne zaman açılır; en üst seviyedeyse null. */
export function skillUnlockAt(animal: ParkAnimal): number | null {
  if (animal.skill >= MAX_SKILL) return null;
  return animal.parkedAt + SKILL_UNLOCK_SEC[animal.skill] * 1000;
}

/** Yeteneğin bir sonraki seviyesinin bedeli: hayvanın kendi kazancına göre; en üst seviyedeyse null. */
export function skillCost(animal: ParkAnimal, bonus = 1): number | null {
  if (animal.skill >= MAX_SKILL) return null;
  return Math.ceil(goldPerSecond(animal, bonus) * SKILL_COST_SEC[animal.skill]);
}

export function stateIncomeBonus(state: GameState): number {
  return incomeBonus(state.upgrades.moreVisitors);
}

export function stateParkLimit(state: GameState): number {
  return parkLimit(state.upgrades.biggerPark);
}

/** Yeni yumurtanın seviyesi: "Daha iyi yumurta" şansı tutarsa 2, yoksa 1. Satın alınan ve bedava yumurtalar için aynı. */
function newEggLevel(state: GameState, roll = 1): number {
  return roll < BETTER_EGG_CHANCE[state.upgrades.betterEgg] ? 2 : 1;
}

/** Kuluçkadaki yumurta mini oyunla hızlandırılabilir mi: süresi bitmemiş ve daha önce hızlandırılmamış. */
export function canBoost(slot: IncubatorSlot, now: number): boolean {
  return !slot.boosted && now < slot.startedAt + slot.durationMs;
}

/**
 * İki yumurta birleşebilir mi. Hayvanlar sırayla bulunur: birleşince çıkacak yumurta en fazla bir sonraki
 * bulunmamış hayvanın yumurtası olabilir (köpek çıkmadan panda yumurtası yapılamaz).
 */
export function canMerge(a: Egg, b: Egg, discovered: readonly number[]): boolean {
  return a.level === b.level && a.level < MAX_LEVEL && !mergeLocked(a, discovered);
}

/** Aynı seviyedeki iki yumurta yalnızca bir sonraki hayvan bulunmadığı için mi birleşemiyor. */
export function mergeLocked(egg: Egg, discovered: readonly number[]): boolean {
  return egg.level > Math.max(0, ...discovered);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  // Rehberde elin göstermediği hamle hiçbir şey yapmaz (yumurta yerine geri döner).
  if (!tutorialAllows(state, action)) return state;
  return applyAction(state, action);
}

function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'load':
      return action.state;

    case 'tick':
      return tick(state, action.now);

    case 'takeEgg': {
      const cell = state.grid.indexOf(null);
      if (state.basket === 0 || cell === -1) return state;
      const grid = [...state.grid];
      grid[cell] = { id: state.nextId, level: newEggLevel(state, action.roll), variant: newVariant(action.shinyRoll) };
      return {
        ...state,
        grid,
        basket: state.basket - 1,
        // Sepet doluyken Tavuk Anne dinleniyordu; yer açılınca sayaç şimdi başlar.
        basketFilledAt: state.basket >= basketCap(state) ? state.now : state.basketFilledAt,
        nextId: state.nextId + 1,
      };
    }

    case 'buyUpgrade': {
      const level = state.upgrades[action.id];
      const cost = upgradeCost(action.id, level);
      if (cost === null || !canAffordUpgrade(state, action.id)) return state;
      const upgrades = { ...state.upgrades, [action.id]: level + 1 };
      let { incubator, basketFilledAt } = state;
      if (action.id === 'incubatorSlot') incubator = [...incubator, null];
      // Sepet doluyken büyütülürse Tavuk Anne hemen yeniden yumurtlamaya başlar.
      if (action.id === 'biggerBasket' && state.basket >= basketCap(state)) basketFilledAt = state.now;
      if (action.id === 'fasterIncubator') {
        // Kuluçkada bekleyen yumurtaların kalan süresi de hemen kısalır, çocuk etkiyi o anda görsün.
        const ratio = incubationFactor(level + 1) / incubationFactor(level);
        incubator = incubator.map((slot) => {
          if (!slot) return slot;
          const elapsed = state.now - slot.startedAt;
          const remaining = slot.durationMs - elapsed;
          if (remaining <= 0) return slot;
          return { ...slot, durationMs: Math.round(elapsed + remaining * ratio) };
        });
      }
      const paid =
        upgradeFor(action.id).currency === 'diamonds'
          ? { diamonds: state.diamonds - cost }
          : { gold: state.gold - cost };
      return { ...state, ...paid, upgrades, incubator, basketFilledAt };
    }

    case 'moveEgg': {
      const { from, to } = action;
      const moving = state.grid[from];
      if (!moving || from === to) return state;
      const target = state.grid[to];
      const grid = [...state.grid];
      if (target && canMerge(moving, target, state.discovered)) {
        grid[to] = {
          id: state.nextId,
          level: moving.level + 1,
          variant: mixVariants(target.variant, moving.variant),
        };
        grid[from] = null;
        return { ...state, grid, nextId: state.nextId + 1 };
      }
      // Kilitli birleştirmede yer değiştirmek anlamsız: yumurta yerine döner (arayüz uyarı gösterir).
      if (target && target.level === moving.level && mergeLocked(moving, state.discovered)) return state;
      // Boş kutuya taşı ya da yer değiştir.
      grid[to] = moving;
      grid[from] = target;
      return { ...state, grid };
    }

    case 'incubate': {
      const egg = state.grid[action.from];
      if (!egg || state.incubator[action.slot] !== null) return state;
      // İlk civciv ve rehber sürerken rehberin hayvanları (civciv, tavşan, kedi) hemen çıkar.
      const firstHatch = !state.firstHatchDone && egg.level === 1;
      const tutorialHatch =
        state.tutorialStep !== null && state.tutorialStep <= TUTORIAL_ANIMALS && egg.level <= TUTORIAL_ANIMALS;
      const seconds =
        firstHatch || tutorialHatch
          ? FIRST_HATCH_SEC
          : animalFor(egg.level).incubationSec * incubationFactor(state.upgrades.fasterIncubator);
      const grid = [...state.grid];
      grid[action.from] = null;
      const incubator = [...state.incubator];
      incubator[action.slot] = { egg, startedAt: state.now, durationMs: Math.round(seconds * 1000) };
      return { ...state, grid, incubator, firstHatchDone: true };
    }

    case 'releaseAnimal': {
      const animal = state.park.find((a) => a.id === action.id);
      if (!animal) return state;
      return {
        ...state,
        park: state.park.filter((a) => a.id !== action.id),
        gold: state.gold + releaseValue(animal, stateIncomeBonus(state)),
      };
    }

    case 'petAnimal': {
      const animal = state.park.find((a) => a.id === action.id);
      if (!animal || state.now - animal.petAt < PET_COOLDOWN_SEC * 1000) return state;
      return addHappiness(state, animal, PET_HAPPINESS, 0, { petAt: state.now });
    }

    case 'collectTip': {
      if (state.tipUntil === null || state.now >= state.tipUntil) return state;
      return gainXp({ ...state, gold: state.gold + tipAmount(state), tipUntil: null }, XP_TIP);
    }

    case 'dismissLevelUp':
      return { ...state, levelUps: state.levelUps.slice(1) };

    case 'dismissNewAnimal':
      return advanceTutorial({ ...state, newAnimalQueue: state.newAnimalQueue.slice(1) });

    case 'finishTutorial':
      return state.tutorialStep === null ? state : settleLevels({ ...state, tutorialStep: null });

    case 'reset':
      return createInitialState(action.now);

    case 'boostIncubation': {
      const slot = state.incubator[action.slot];
      if (!slot || !canBoost(slot, state.now)) return state;
      const elapsed = state.now - slot.startedAt;
      const remaining = slot.durationMs - elapsed;
      const fraction = Math.min(1, Math.max(0, action.fraction));
      const incubator = [...state.incubator];
      incubator[action.slot] = {
        ...slot,
        durationMs: Math.round(elapsed + remaining * (1 - fraction)),
        boosted: true,
      };
      return { ...state, incubator };
    }

    case 'upgradeSkill': {
      const animal = state.park.find((a) => a.id === action.id);
      if (!animal) return state;
      const unlockAt = skillUnlockAt(animal);
      const cost = skillCost(animal, stateIncomeBonus(state));
      if (unlockAt === null || cost === null || state.now < unlockAt || state.gold < cost) return state;
      return {
        ...state,
        gold: state.gold - cost,
        park: state.park.map((a) => (a.id === animal.id ? { ...a, skill: a.skill + 1 } : a)),
      };
    }

    case 'buyFood': {
      const price = foodPrice(state);
      if (state.gold < price) return state;
      return {
        ...state,
        gold: state.gold - price,
        food: { ...state.food, [action.food]: foodStock(state, action.food) + 1 },
      };
    }

    case 'buyMissingFood': {
      const { items, cost } = missingFood(state);
      if (cost === 0 || state.gold < cost) return state;
      const food = { ...state.food };
      for (const [f, n] of Object.entries(items) as [FoodId, number][]) food[f] = foodStock(state, f) + n;
      return { ...state, gold: state.gold - cost, food };
    }

    case 'feedAnimal': {
      const animal = state.park.find((a) => a.id === action.id);
      if (!animal || !canFeed(state, animal) || foodStock(state, action.food) <= 0) return state;
      const tried = state.triedFoods[animal.level] ?? [];
      const triedFoods = tried.includes(action.food)
        ? state.triedFoods
        : { ...state.triedFoods, [animal.level]: [...tried, action.food] };
      const taste = foodTaste(animal, action.food, state.now);
      // Sevmediğini yemez: yiyecek stokta kalır, yalnızca sevmediği öğrenilir.
      if (taste === 'dislike') return { ...state, triedFoods };
      const wish = taste === 'wish';
      return addHappiness(
        { ...state, triedFoods, food: { ...state.food, [action.food]: foodStock(state, action.food) - 1 } },
        animal,
        TASTE_HAPPINESS[taste],
        XP_FEED + (wish ? xpForWish(animal.level) : 0),
        { fedAt: state.now, ...(wish ? { wishDoneDay: dayNumber(state.now) } : {}) },
      );
    }

    case 'washAnimal': {
      const animal = state.park.find((a) => a.id === action.id);
      if (!animal || !isDirty(animal, state.now)) return state;
      return addHappiness(state, animal, WASH_HAPPINESS, XP_WASH, { washedAt: state.now });
    }

    case 'cleanPoop': {
      const count = state.poops[action.level] ?? 0;
      if (count <= 0) return state;
      // Kakalar doluyken sayaç durur; yer açılınca baştan başlar.
      const poopTimers = count >= MAX_POOP ? { ...state.poopTimers, [action.level]: state.now } : state.poopTimers;
      return gainXp(
        {
          ...state,
          gold: state.gold + poopGold(state),
          poops: { ...state.poops, [action.level]: count - 1 },
          poopTimers,
        },
        XP_POOP,
      );
    }

    case 'takeGift': {
      const cell = state.grid.indexOf(null);
      if (state.giftBox.length === 0 || cell === -1) return state;
      const grid = [...state.grid];
      grid[cell] = state.giftBox[0];
      return { ...state, grid, giftBox: state.giftBox.slice(1) };
    }

    case 'dismissAwayGold':
      return { ...state, awayGold: 0 };

    case 'dismissEscaped':
      return { ...state, escapedQueue: state.escapedQueue.slice(1) };
  }
}

function tick(state: GameState, now: number): GameState {
  let { gold, diamonds, discovered, newAnimalQueue, nextId, awayGold, grid, giftBox, escapedQueue } = state;
  const bonus = stateIncomeBonus(state);
  const hungerMs = HUNGER_SEC * 1000;
  const maxPark = stateParkLimit(state);

  // Yumurta sepeti: Tavuk Anne aralıklarla yumurta bırakır, oyun kapalıyken de. Sepet doluyken dinlenir;
  // o sırada geçen süre sayılmaz, yer açılınca sayaç baştan başlar.
  let { basket, basketFilledAt } = state;
  const cap = basketCap(state);
  if (basket >= cap) {
    basketFilledAt = now;
  } else {
    const everyMs = basketEveryMs(state);
    const laid = Math.floor((now - basketFilledAt) / everyMs);
    if (laid > 0) {
      basket = Math.min(cap, basket + laid);
      basketFilledAt = basket >= cap ? now : basketFilledAt + laid * everyMs;
    }
  }

  // Her hayvan kendi aralığında altın düşürür. Uygulama kapalı ya da arka planda kaldıysa aradaki
  // düşürmeler birlikte sayılır, ama en fazla OFFLINE_EARNING_CAP_SEC kadarı. Sınırı aşan süre atlanır.
  const earnUntil = Math.min(now, state.now + OFFLINE_EARNING_CAP_SEC * 1000);
  const skippedMs = Math.max(0, now - earnUntil);
  let earned = 0;
  let park = state.park.map((animal) => {
    if (earnUntil < animal.nextDropAt) {
      return skippedMs > 0 ? { ...animal, nextDropAt: animal.nextDropAt + skippedMs } : animal;
    }
    // Her düşürme, hayvanın o anki tokluğuna göre altın verir.
    const intervalMs = animalFor(animal.level).dropEverySec * 1000;
    // Üzgün ve tokluğu bitmiş hayvanın yeteneği çalışmaz.
    const withSkill = dropAmount(animal, bonus);
    const withoutSkill = dropAmount({ ...animal, skill: 0 }, bonus);
    let t = animal.nextDropAt;
    let lastAmount = 0;
    while (t <= earnUntil) {
      const fullness = fullnessAt(animal, t);
      const mood = moodFor(fullness);
      const amount = mood === 'happy' || mood === 'hungry' ? withSkill : withoutSkill;
      lastAmount = Math.round(amount * hungerMultiplier(fullness) * (isDirty(animal, t) ? DIRTY_INCOME : 1));
      earned += lastAmount;
      t += intervalMs;
    }
    return {
      ...animal,
      nextDropAt: t + skippedMs,
      lastDropAt: lastAmount > 0 ? now : animal.lastDropAt,
      lastDropAmount: lastAmount > 0 ? lastAmount : animal.lastDropAmount,
    };
  });
  gold += earned;
  if (now - state.now >= AWAY_REPORT_SEC * 1000) awayGold += earned;

  // Tokluğu %0'da ESCAPE_AFTER_EMPTY_SEC kalan hayvan kaçar ve rengini, desenini koruyarak kendi
  // yumurtasına döner. Yumurta boş kutuya düşer; alan doluysa hediye kutusunda bekler.
  const escapeAfterMs = hungerMs + ESCAPE_AFTER_EMPTY_SEC * 1000;
  const escaped = park.filter((a) => now >= a.fedAt + escapeAfterMs);
  if (escaped.length > 0) {
    park = park.filter((a) => now < a.fedAt + escapeAfterMs);
    for (const animal of escaped) {
      const egg: Egg = { id: nextId++, level: animal.level, variant: animal.variant, skill: animal.skill };
      const cell = grid.indexOf(null);
      if (cell === -1) {
        giftBox = [...giftBox, egg];
      } else {
        grid = [...grid];
        grid[cell] = egg;
      }
      escapedQueue = [...escapedQueue, animal.level];
    }
  }

  // Kuluçkası biten yumurtalar, parkta yer varsa hayvan olarak parka çıkar.
  let xpGained = 0;
  const incubator = state.incubator.map((slot) => {
    if (!slot || now < slot.startedAt + slot.durationMs || park.length >= maxPark) return slot;
    const { level, variant, skill = 0 } = slot.egg;
    park = [
      ...park,
      {
        id: nextId++,
        level,
        variant,
        nextDropAt: now + animalFor(level).dropEverySec * 1000,
        lastDropAt: null,
        lastDropAmount: 0,
        fedAt: now,
        skill,
        parkedAt: now,
        happiness: 0,
        petAt: 0,
        wishDoneDay: null,
        washedAt: now,
      },
    ];
    xpGained += xpForHatch(level);
    if (!discovered.includes(level)) {
      xpGained += xpForNewAnimal(level);
      discovered = [...discovered, level];
      newAnimalQueue = [...newAnimalQueue, level];
      diamonds += diamondsForNewAnimal(level);
    }
    return null;
  });

  // Bahşişli ziyaretçi: rehber bitince ve parkta hayvan varken arada bir gelir, TIP_STAY_SEC sonra
  // gider; toplanmayan bahşiş de onunla gider. Oyun kapalıyken gelen ziyaretçi beklemez.
  let { tipUntil, tipTimerAt } = state;
  if (tipUntil !== null && now >= tipUntil) tipUntil = null;
  if (state.tutorialStep !== null || park.length === 0) {
    tipTimerAt = now;
  } else if (tipUntil === null && now >= tipTimerAt + TIP_EVERY_SEC * 1000) {
    tipUntil = now + TIP_STAY_SEC * 1000;
    tipTimerAt = now;
  }

  // Kaka: parkta hayvanı olan her alana aralıkla bir kaka düşer, en fazla MAX_POOP (oyun kapalıyken de).
  // Rehber sürerken düşmez.
  const poops = { ...state.poops };
  const poopTimers = { ...state.poopTimers };
  const poopEveryMs = POOP_EVERY_SEC * 1000;
  const levelsInPark = new Set(park.map((a) => a.level));
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const count = poops[level] ?? 0;
    const timer = poopTimers[level] ?? state.now;
    if (state.tutorialStep !== null || !levelsInPark.has(level) || count >= MAX_POOP) {
      poopTimers[level] = now;
      continue;
    }
    const dropped = Math.floor((now - timer) / poopEveryMs);
    poops[level] = Math.min(MAX_POOP, count + dropped);
    poopTimers[level] = poops[level] >= MAX_POOP ? now : timer + dropped * poopEveryMs;
  }

  const next = advanceTutorial({
    ...state,
    now,
    tipUntil,
    tipTimerAt,
    poops,
    poopTimers,
    gold,
    diamonds,
    discovered,
    newAnimalQueue,
    nextId,
    grid,
    basket,
    basketFilledAt,
    incubator,
    park,
    awayGold,
    giftBox,
    escapedQueue,
  });
  return gainXp(next, xpGained);
}

/**
 * Rehber: bu adımın hayvanı çıktı ve kutlaması kapandıysa bir sonraki adıma geçilir. Kutlama kapanır
 * kapanmaz da çağrılır; yoksa arada el aynı hayvanı ikinci kez çıkarttırır.
 */
function advanceTutorial(state: GameState): GameState {
  const step = state.tutorialStep;
  if (
    step !== null &&
    step <= TUTORIAL_ANIMALS &&
    state.discovered.includes(step) &&
    state.newAnimalQueue.length === 0
  ) {
    if (step < TUTORIAL_ANIMALS) return { ...state, tutorialStep: step + 1 };
    // Üç hayvan da çıktı: son adımda çocuk onları besleyecek. Tok hayvan beslenemez, o yüzden biraz
    // acıkırlar; her birine birer yem hediye.
    const food = { ...state.food };
    for (let level = 1; level <= TUTORIAL_ANIMALS; level++) {
      const id = mainFood(level).id;
      food[id] = foodStock(state, id) + 1;
    }
    const hungryFedAt = state.now - (1 - HUNGRY_BELOW + 0.05) * HUNGER_SEC * 1000;
    return {
      ...state,
      tutorialStep: step + 1,
      food,
      park: state.park.map((a) => (a.level <= TUTORIAL_ANIMALS ? { ...a, fedAt: Math.min(a.fedAt, hungryFedAt) } : a)),
    };
  }
  return state;
}
