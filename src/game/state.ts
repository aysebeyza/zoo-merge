// Oyunun durumu ve kuralları. Arayüzden bağımsızdır, bu yüzden testlerle denenebilir.
// Rastgelelik ve saat dışarıdan verilir (action içinde), böylece reducer saf kalır.

import { goldMultiplier, mixVariants, plainVariant, type ColorId, type Variant } from './colors.ts';
import {
  animalFor,
  AUTO_EGG_EVERY_SEC,
  AUTO_FEED_AT,
  AWAY_REPORT_SEC,
  BETTER_EGG_CHANCE,
  DIAMONDS_PER_NEW_ANIMAL,
  eggPrice,
  ESCAPE_AFTER_EMPTY_SEC,
  FEED_FULL_COST_SEC,
  FIRST_HATCH_SEC,
  GRID_SIZE,
  HUNGER_SEC,
  hungerMultiplier,
  incomeBonus,
  incubationFactor,
  INCUBATOR_SLOTS,
  MAX_LEVEL,
  OFFLINE_EARNING_CAP_SEC,
  parkLimit,
  RELEASE_VALUE_SEC,
  START_GOLD,
  upgradeCost,
  UPGRADES,
  type UpgradeId,
} from './config.ts';

export type Egg = {
  id: number;
  level: number;
  variant: Variant;
};

export type IncubatorSlot = {
  egg: Egg;
  startedAt: number;
  durationMs: number;
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
};

export type GameState = {
  now: number;
  gold: number;
  diamonds: number;
  eggsBought: number;
  nextEggColor: ColorId;
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
};

export type GameAction =
  | { type: 'load'; state: GameState }
  /** eggColor ve roll: bu tick'te otomatik yumurta düşerse rengi ve "Daha iyi yumurta" şansı. */
  | { type: 'tick'; now: number; eggColor?: ColorId; roll?: number }
  /** roll: 0 ile 1 arası rastgele sayı; "Daha iyi yumurta" şansı için. */
  | { type: 'buyEgg'; nextColor: ColorId; roll?: number }
  | { type: 'buyUpgrade'; id: UpgradeId }
  | { type: 'moveEgg'; from: number; to: number }
  | { type: 'incubate'; from: number; slot: number }
  | { type: 'releaseAnimal'; id: number }
  /** Mama kabı: aç hayvanları, en açtan başlayarak altın yettiği kadar doyurur. */
  | { type: 'feedAll' }
  /** Hediye kutusundaki ilk yumurtayı birleştirme alanına alır. */
  | { type: 'takeGift' }
  | { type: 'dismissNewAnimal' }
  | { type: 'dismissAwayGold' }
  | { type: 'dismissEscaped' };

export function createInitialState(now: number, firstColor: ColorId): GameState {
  return {
    now,
    gold: START_GOLD,
    diamonds: 0,
    eggsBought: 0,
    nextEggColor: firstColor,
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
  };
}

/** Hayvanın t anındaki tokluğu, 0 ile 1 arası. */
export function fullnessAt(animal: { fedAt: number }, t: number): number {
  return Math.min(1, Math.max(0, 1 - (t - animal.fedAt) / (HUNGER_SEC * 1000)));
}

/** Hayvanı t anındaki tokluğundan %100'e doyurmanın bedeli. Tok hayvan için 0. */
export function feedCost(animal: ParkAnimal, t: number, bonus = 1): number {
  const missing = 1 - fullnessAt(animal, t);
  if (missing <= 0) return 0;
  return Math.max(1, Math.ceil(missing * goldPerSecond(animal, bonus) * FEED_FULL_COST_SEC));
}

/**
 * Mama kabına dokununca hangi hayvanların doyacağı ve toplam bedel: en açtan başlayarak altın yettiği kadar.
 * Altının yetmediği hayvan atlanır, daha ucuz olan sıradakiler yine doyurulur.
 */
export function feedPlan(state: GameState): { ids: number[]; cost: number } {
  const bonus = stateIncomeBonus(state);
  const hungry = state.park
    .filter((a) => fullnessAt(a, state.now) < 1)
    .sort((a, b) => fullnessAt(a, state.now) - fullnessAt(b, state.now));
  const ids: number[] = [];
  let cost = 0;
  for (const animal of hungry) {
    const c = feedCost(animal, state.now, bonus);
    if (cost + c > state.gold) continue;
    ids.push(animal.id);
    cost += c;
  }
  return { ids, cost };
}

/** Bütün aç hayvanları doyurmanın bedeli (altın yetmese de). Mama kabında gösterilir. */
export function feedAllCost(state: GameState): number {
  const bonus = stateIncomeBonus(state);
  return state.park.reduce((sum, a) => sum + feedCost(a, state.now, bonus), 0);
}

/** bonus: "Daha çok ziyaretçi" yükseltmesinin çarpanı (incomeBonus). */
export function dropAmount(animal: { level: number; variant: Variant }, bonus = 1): number {
  return Math.round(animalFor(animal.level).dropAmount * goldMultiplier(animal.variant) * bonus);
}

export function goldPerSecond(animal: { level: number; variant: Variant }, bonus = 1): number {
  return dropAmount(animal, bonus) / animalFor(animal.level).dropEverySec;
}

/** now verilirse hayvanların o anki tokluğu da hesaba katılır. */
export function parkIncomePerSecond(park: ParkAnimal[], bonus = 1, now?: number): number {
  return park.reduce(
    (sum, animal) =>
      sum + goldPerSecond(animal, bonus) * (now === undefined ? 1 : hungerMultiplier(fullnessAt(animal, now))),
    0,
  );
}

export function releaseValue(animal: { level: number; variant: Variant }, bonus = 1): number {
  return Math.round(goldPerSecond(animal, bonus) * RELEASE_VALUE_SEC);
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

export function canMerge(a: Egg, b: Egg): boolean {
  return a.level === b.level && a.level < MAX_LEVEL;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'load':
      return action.state;

    case 'tick':
      return tick(state, action.now, action.eggColor ?? state.nextEggColor, action.roll);

    case 'buyEgg': {
      const price = eggPrice(state.eggsBought);
      const cell = state.grid.indexOf(null);
      if (state.gold < price || cell === -1) return state;
      const grid = [...state.grid];
      grid[cell] = { id: state.nextId, level: newEggLevel(state, action.roll), variant: plainVariant(state.nextEggColor) };
      return {
        ...state,
        grid,
        gold: state.gold - price,
        eggsBought: state.eggsBought + 1,
        nextEggColor: action.nextColor,
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

    case 'feedAll': {
      const { ids, cost } = feedPlan(state);
      if (ids.length === 0) return state;
      return {
        ...state,
        gold: state.gold - cost,
        park: state.park.map((a) => (ids.includes(a.id) ? { ...a, fedAt: state.now } : a)),
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

function tick(state: GameState, now: number, eggColor: ColorId, roll?: number): GameState {
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
      grid[cell] = { id: nextId++, level: newEggLevel(state, roll), variant: plainVariant(eggColor) };
      nextAutoEggAt += everyMs;
    }
  }

  // Her hayvan kendi aralığında altın düşürür. Uygulama kapalı ya da arka planda kaldıysa aradaki
  // düşürmeler birlikte sayılır, ama en fazla OFFLINE_EARNING_CAP_SEC kadarı. Sınırı aşan süre atlanır.
  const earnUntil = Math.min(now, state.now + OFFLINE_EARNING_CAP_SEC * 1000);
  const skippedMs = Math.max(0, now - earnUntil);
  let earned = 0;
  let park = state.park.map((animal) => {
    // Otomatik yemlik: tokluk AUTO_FEED_AT'e indiği anda, altın yetiyorsa hayvanı doyurur.
    // Oyun uzun süre kapalı kaldıysa aradaki beslemeler sırayla yapılır.
    if (state.upgrades.autoFeeder > 0) {
      let feedAt = animal.fedAt + hungerMs * (1 - AUTO_FEED_AT);
      while (feedAt <= now) {
        const cost = feedCost(animal, feedAt, bonus);
        if (gold < cost) break;
        gold -= cost;
        animal = { ...animal, fedAt: feedAt };
        feedAt += hungerMs * (1 - AUTO_FEED_AT);
      }
    }

    if (earnUntil < animal.nextDropAt) {
      return skippedMs > 0 ? { ...animal, nextDropAt: animal.nextDropAt + skippedMs } : animal;
    }
    // Her düşürme, hayvanın o anki tokluğuna göre altın verir.
    const intervalMs = animalFor(animal.level).dropEverySec * 1000;
    const amount = dropAmount(animal, bonus);
    let t = animal.nextDropAt;
    let lastAmount = 0;
    while (t <= earnUntil) {
      lastAmount = Math.round(amount * hungerMultiplier(fullnessAt(animal, t)));
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
      const egg: Egg = { id: nextId++, level: animal.level, variant: animal.variant };
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
    const { level, variant } = slot.egg;
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
