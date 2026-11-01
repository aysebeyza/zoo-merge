// Oyunun durumu ve kuralları. Arayüzden bağımsızdır, bu yüzden testlerle denenebilir.
// Rastgelelik ve saat dışarıdan verilir (action içinde), böylece reducer saf kalır.

import { goldMultiplier, mixVariants, plainVariant, type ColorId, type Variant } from './colors.ts';
import {
  animalFor,
  AUTO_EGG_EVERY_SEC,
  AWAY_REPORT_SEC,
  BETTER_EGG_CHANCE,
  DIAMONDS_PER_NEW_ANIMAL,
  eggPrice,
  FIRST_HATCH_SEC,
  GRID_SIZE,
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
};

export type GameAction =
  | { type: 'load'; state: GameState }
  /** eggColor: bu tick'te otomatik yumurta düşerse rengi. */
  | { type: 'tick'; now: number; eggColor?: ColorId }
  /** roll: 0 ile 1 arası rastgele sayı; "Daha iyi yumurta" şansı için. */
  | { type: 'buyEgg'; nextColor: ColorId; roll?: number }
  | { type: 'buyUpgrade'; id: UpgradeId }
  | { type: 'moveEgg'; from: number; to: number }
  | { type: 'incubate'; from: number; slot: number }
  | { type: 'releaseAnimal'; id: number }
  | { type: 'dismissNewAnimal' }
  | { type: 'dismissAwayGold' };

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
  };
}

/** bonus: "Daha çok ziyaretçi" yükseltmesinin çarpanı (incomeBonus). */
export function dropAmount(animal: { level: number; variant: Variant }, bonus = 1): number {
  return Math.round(animalFor(animal.level).dropAmount * goldMultiplier(animal.variant) * bonus);
}

export function goldPerSecond(animal: { level: number; variant: Variant }, bonus = 1): number {
  return dropAmount(animal, bonus) / animalFor(animal.level).dropEverySec;
}

export function parkIncomePerSecond(park: ParkAnimal[], bonus = 1): number {
  return park.reduce((sum, animal) => sum + goldPerSecond(animal, bonus), 0);
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

export function canMerge(a: Egg, b: Egg): boolean {
  return a.level === b.level && a.level < MAX_LEVEL;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'load':
      return action.state;

    case 'tick':
      return tick(state, action.now, action.eggColor ?? state.nextEggColor);

    case 'buyEgg': {
      const price = eggPrice(state.eggsBought);
      const cell = state.grid.indexOf(null);
      if (state.gold < price || cell === -1) return state;
      const better = (action.roll ?? 1) < BETTER_EGG_CHANCE[state.upgrades.betterEgg];
      const grid = [...state.grid];
      grid[cell] = { id: state.nextId, level: better ? 2 : 1, variant: plainVariant(state.nextEggColor) };
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

    case 'dismissAwayGold':
      return { ...state, awayGold: 0 };
  }
}

function tick(state: GameState, now: number, eggColor: ColorId): GameState {
  let { gold, diamonds, discovered, newAnimalQueue, nextId, awayGold, grid, nextAutoEggAt } = state;
  const bonus = stateIncomeBonus(state);
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
      grid[cell] = { id: nextId++, level: 1, variant: plainVariant(eggColor) };
      nextAutoEggAt += everyMs;
    }
  }

  // Her hayvan kendi aralığında altın düşürür. Uygulama kapalı ya da arka planda kaldıysa aradaki
  // düşürmeler birlikte sayılır, ama en fazla OFFLINE_EARNING_CAP_SEC kadarı. Sınırı aşan süre atlanır.
  const earnUntil = Math.min(now, state.now + OFFLINE_EARNING_CAP_SEC * 1000);
  const skippedMs = Math.max(0, now - earnUntil);
  const goldBefore = gold;
  let park = state.park.map((animal) => {
    if (earnUntil < animal.nextDropAt) {
      return skippedMs > 0 ? { ...animal, nextDropAt: animal.nextDropAt + skippedMs } : animal;
    }
    const intervalMs = animalFor(animal.level).dropEverySec * 1000;
    const drops = Math.floor((earnUntil - animal.nextDropAt) / intervalMs) + 1;
    const amount = dropAmount(animal, bonus);
    gold += drops * amount;
    return {
      ...animal,
      nextDropAt: animal.nextDropAt + drops * intervalMs + skippedMs,
      lastDropAt: now,
      lastDropAmount: amount,
    };
  });
  if (now - state.now >= AWAY_REPORT_SEC * 1000) awayGold += gold - goldBefore;

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
  };
}
