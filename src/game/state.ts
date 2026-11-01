// Oyunun durumu ve kuralları. Arayüzden bağımsızdır, bu yüzden testlerle denenebilir.
// Rastgelelik ve saat dışarıdan verilir (action içinde), böylece reducer saf kalır.

import { goldMultiplier, mixVariants, newVariant, type Variant } from './variant.ts';
import {
  animalFor,
  AUTO_EGG_EVERY_SEC,
  AWAY_REPORT_SEC,
  BETTER_EGG_CHANCE,
  DIAMONDS_PER_NEW_ANIMAL,
  eggPrice,
  ESCAPE_AFTER_EMPTY_SEC,
  FEED_BELOW,
  FIRST_HATCH_SEC,
  foodPrice,
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
  UPGRADES,
  type UpgradeId,
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
};

export type GameState = {
  now: number;
  gold: number;
  diamonds: number;
  eggsBought: number;
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
  /** Otomatik yumurtanın bir sonraki düşeceği an; yükseltme alınmadıysa null. */
  nextAutoEggAt: number | null;
  /** Kaçan hayvanların yumurtaları; birleştirme alanı doluyken burada ("Hediye" kutusu) bekler. */
  giftBox: Egg[];
  /** Ekranda gösterilecek "... yumurtasına döndü" uyarıları (seviye numaraları). */
  escapedQueue: number[];
  /** Yem stoğu: hayvan seviyesine göre kaç yem var (1 = tohum, 2 = havuç ...). */
  food: Record<number, number>;
};

export type GameAction =
  | { type: 'load'; state: GameState }
  /** roll ve shinyRoll: bu tick'te otomatik yumurta düşerse "Daha iyi yumurta" ve parlak olma şansı. */
  | { type: 'tick'; now: number; roll?: number; shinyRoll?: number }
  /** roll: "Daha iyi yumurta" şansı, shinyRoll: parlak olma şansı; ikisi de 0 ile 1 arası rastgele sayı. */
  | { type: 'buyEgg'; roll?: number; shinyRoll?: number }
  | { type: 'buyUpgrade'; id: UpgradeId }
  | { type: 'moveEgg'; from: number; to: number }
  | { type: 'incubate'; from: number; slot: number }
  | { type: 'releaseAnimal'; id: number }
  /** Mini oyun sonrası: kuluçkadaki yumurtanın kalan süresini fraction oranında kısaltır, yumurta başına bir kez. */
  | { type: 'boostIncubation'; slot: number; fraction: number }
  /** Hayvanın yeteneğini bir seviye geliştirir; süre dolduysa ve altın yetiyorsa. */
  | { type: 'upgradeSkill'; id: number }
  /** Yem dükkanı: o hayvanın yeminden bir tane alır. */
  | { type: 'buyFood'; level: number }
  /** Hayvanı kendi yemiyle tamamen doyurur; stoktan bir yem gider. */
  | { type: 'feedAnimal'; id: number }
  /** Yem dükkanı "Eksikleri al": parktaki her hayvana birer yem olacak kadar eksik yemleri alır. */
  | { type: 'buyMissingFood' }
  /** Hediye kutusundaki ilk yumurtayı birleştirme alanına alır. */
  | { type: 'takeGift' }
  | { type: 'dismissNewAnimal' }
  | { type: 'dismissAwayGold' }
  | { type: 'dismissEscaped' };

export function createInitialState(now: number): GameState {
  return {
    now,
    gold: START_GOLD,
    diamonds: 0,
    eggsBought: 0,
    nextId: 1,
    grid: Array.from({ length: GRID_SIZE }, () => null),
    incubator: Array.from({ length: INCUBATOR_SLOTS }, () => null),
    park: [],
    discovered: [],
    firstHatchDone: false,
    newAnimalQueue: [],
    awayGold: 0,
    upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) as Record<UpgradeId, number>,
    nextAutoEggAt: null,
    giftBox: [],
    escapedQueue: [],
    food: {},
  };
}

/** Hayvanın t anındaki tokluğu, 0 ile 1 arası. */
export function fullnessAt(animal: { fedAt: number }, t: number): number {
  return Math.min(1, Math.max(0, 1 - (t - animal.fedAt) / (HUNGER_SEC * 1000)));
}

/** Stokta bu hayvanın kaç yemi var. */
export function foodStock(state: GameState, level: number): number {
  return state.food[level] ?? 0;
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
 * Parktaki her hayvana birer yem düşecek kadar eksik yemler ve toplam fiyatı.
 * Örneğin 3 kedi ve 1 balık varsa 2 balık eksiktir.
 */
export function missingFood(state: GameState): { items: Record<number, number>; cost: number } {
  const items: Record<number, number> = {};
  let cost = 0;
  for (const level of new Set(state.park.map((a) => a.level))) {
    const missing = animalCount(state, level) - foodStock(state, level);
    if (missing <= 0) continue;
    items[level] = missing;
    cost += missing * foodPrice(level);
  }
  return { items, cost };
}

/** Hayvan beslenebilir mi: acıkmaya başlamış ve kendi yemi stokta var. */
export function canFeed(state: GameState, animal: ParkAnimal): boolean {
  return fullnessAt(animal, state.now) < FEED_BELOW && foodStock(state, animal.level) > 0;
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
  return goldPerSecond(skillWorks ? animal : { ...animal, skill: 0 }, bonus) * hungerMultiplier(fullness);
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

export function canMerge(a: Egg, b: Egg): boolean {
  return a.level === b.level && a.level < MAX_LEVEL;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'load':
      return action.state;

    case 'tick':
      return tick(state, action.now, action.roll, action.shinyRoll);

    case 'buyEgg': {
      const price = eggPrice(state.eggsBought);
      const cell = state.grid.indexOf(null);
      if (state.gold < price || cell === -1) return state;
      const grid = [...state.grid];
      grid[cell] = { id: state.nextId, level: newEggLevel(state, action.roll), variant: newVariant(action.shinyRoll) };
      return {
        ...state,
        grid,
        gold: state.gold - price,
        eggsBought: state.eggsBought + 1,
        nextId: state.nextId + 1,
      };
    }

    case 'buyUpgrade': {
      const level = state.upgrades[action.id];
      const cost = upgradeCost(action.id, level);
      if (cost === null || state.gold < cost) return state;
      const upgrades = { ...state.upgrades, [action.id]: level + 1 };
      let { incubator, nextAutoEggAt } = state;
      if (action.id === 'incubatorSlot') incubator = [...incubator, null];
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
      if (action.id === 'autoEgg' && nextAutoEggAt === null) {
        nextAutoEggAt = state.now + AUTO_EGG_EVERY_SEC[1] * 1000;
      }
      return { ...state, gold: state.gold - cost, upgrades, incubator, nextAutoEggAt };
    }

    case 'moveEgg': {
      const { from, to } = action;
      const moving = state.grid[from];
      if (!moving || from === to) return state;
      const target = state.grid[to];
      const grid = [...state.grid];
      if (target && canMerge(moving, target)) {
        grid[to] = {
          id: state.nextId,
          level: moving.level + 1,
          variant: mixVariants(target.variant, moving.variant),
        };
        grid[from] = null;
        return { ...state, grid, nextId: state.nextId + 1 };
      }
      // Boş kutuya taşı ya da yer değiştir.
      grid[to] = moving;
      grid[from] = target;
      return { ...state, grid };
    }

    case 'incubate': {
      const egg = state.grid[action.from];
      if (!egg || state.incubator[action.slot] !== null) return state;
      const firstHatch = !state.firstHatchDone && egg.level === 1;
      const seconds = firstHatch
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

    case 'dismissNewAnimal':
      return { ...state, newAnimalQueue: state.newAnimalQueue.slice(1) };

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
      const price = foodPrice(action.level);
      if (state.gold < price || !state.discovered.includes(action.level)) return state;
      return {
        ...state,
        gold: state.gold - price,
        food: { ...state.food, [action.level]: foodStock(state, action.level) + 1 },
      };
    }

    case 'buyMissingFood': {
      const { items, cost } = missingFood(state);
      if (cost === 0 || state.gold < cost) return state;
      const food = { ...state.food };
      for (const [level, n] of Object.entries(items)) food[Number(level)] = foodStock(state, Number(level)) + n;
      return { ...state, gold: state.gold - cost, food };
    }

    case 'feedAnimal': {
      const animal = state.park.find((a) => a.id === action.id);
      if (!animal || !canFeed(state, animal)) return state;
      return {
        ...state,
        food: { ...state.food, [animal.level]: foodStock(state, animal.level) - 1 },
        park: state.park.map((a) => (a.id === animal.id ? { ...a, fedAt: state.now } : a)),
      };
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

function tick(state: GameState, now: number, roll?: number, shinyRoll?: number): GameState {
  let { gold, diamonds, discovered, newAnimalQueue, nextId, awayGold, grid, nextAutoEggAt, giftBox, escapedQueue } =
    state;
  const bonus = stateIncomeBonus(state);
  const hungerMs = HUNGER_SEC * 1000;
  const maxPark = stateParkLimit(state);

  // Otomatik yumurta: her tick'te en fazla bir tane. Uzun süre uzak kalındıysa alan dolana kadar
  // art arda düşer. Alan doluysa sayaç baştan başlar, böylece birikip birden gelmez.
  if (nextAutoEggAt !== null && now >= nextAutoEggAt) {
    const everyMs = AUTO_EGG_EVERY_SEC[state.upgrades.autoEgg] * 1000;
    const cell = grid.indexOf(null);
    if (cell === -1) {
      nextAutoEggAt = now + everyMs;
    } else {
      grid = [...grid];
      grid[cell] = { id: nextId++, level: newEggLevel(state, roll), variant: newVariant(shinyRoll) };
      nextAutoEggAt += everyMs;
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
      lastAmount = Math.round(amount * hungerMultiplier(fullness));
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
      },
    ];
    if (!discovered.includes(level)) {
      discovered = [...discovered, level];
      newAnimalQueue = [...newAnimalQueue, level];
      diamonds += DIAMONDS_PER_NEW_ANIMAL;
    }
    return null;
  });

  return {
    ...state,
    now,
    gold,
    diamonds,
    discovered,
    newAnimalQueue,
    nextId,
    grid,
    nextAutoEggAt,
    incubator,
    park,
    awayGold,
    giftBox,
    escapedQueue,
  };
}
