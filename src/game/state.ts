// Oyunun durumu ve kuralları. Arayüzden bağımsızdır, bu yüzden testlerle denenebilir.
// Rastgelelik ve saat dışarıdan verilir (action içinde), böylece reducer saf kalır.

import { goldMultiplier, mixVariants, plainVariant, type ColorId, type Variant } from './colors.ts';
import {
  animalFor,
  DIAMONDS_PER_NEW_ANIMAL,
  eggPrice,
  FIRST_HATCH_SEC,
  GRID_SIZE,
  INCUBATOR_SLOTS,
  MAX_LEVEL,
  PARK_LIMIT,
  RELEASE_VALUE_SEC,
  START_GOLD,
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
};

export type GameAction =
  | { type: 'tick'; now: number }
  | { type: 'buyEgg'; nextColor: ColorId }
  | { type: 'moveEgg'; from: number; to: number }
  | { type: 'incubate'; from: number; slot: number }
  | { type: 'releaseAnimal'; id: number }
  | { type: 'dismissNewAnimal' };

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
  };
}

export function dropAmount(animal: { level: number; variant: Variant }): number {
  return Math.round(animalFor(animal.level).dropAmount * goldMultiplier(animal.variant));
}

export function goldPerSecond(animal: { level: number; variant: Variant }): number {
  return dropAmount(animal) / animalFor(animal.level).dropEverySec;
}

export function parkIncomePerSecond(park: ParkAnimal[]): number {
  return park.reduce((sum, animal) => sum + goldPerSecond(animal), 0);
}

export function releaseValue(animal: { level: number; variant: Variant }): number {
  return Math.round(goldPerSecond(animal) * RELEASE_VALUE_SEC);
}

export function canMerge(a: Egg, b: Egg): boolean {
  return a.level === b.level && a.level < MAX_LEVEL;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'tick':
      return tick(state, action.now);

    case 'buyEgg': {
      const price = eggPrice(state.eggsBought);
      const cell = state.grid.indexOf(null);
      if (state.gold < price || cell === -1) return state;
      const grid = [...state.grid];
      grid[cell] = { id: state.nextId, level: 1, variant: plainVariant(state.nextEggColor) };
      return {
        ...state,
        grid,
        gold: state.gold - price,
        eggsBought: state.eggsBought + 1,
        nextEggColor: action.nextColor,
        nextId: state.nextId + 1,
      };
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
      const seconds = firstHatch ? FIRST_HATCH_SEC : animalFor(egg.level).incubationSec;
      const grid = [...state.grid];
      grid[action.from] = null;
      const incubator = [...state.incubator];
      incubator[action.slot] = { egg, startedAt: state.now, durationMs: seconds * 1000 };
      return { ...state, grid, incubator, firstHatchDone: true };
    }

    case 'releaseAnimal': {
      const animal = state.park.find((a) => a.id === action.id);
      if (!animal) return state;
      return {
        ...state,
        park: state.park.filter((a) => a.id !== action.id),
        gold: state.gold + releaseValue(animal),
      };
    }

    case 'dismissNewAnimal':
      return { ...state, newAnimalQueue: state.newAnimalQueue.slice(1) };
  }
}

function tick(state: GameState, now: number): GameState {
  let { gold, diamonds, discovered, newAnimalQueue, nextId } = state;
  let park = state.park;

  // Kuluçkası biten yumurtalar, parkta yer varsa hayvan olarak parka çıkar.
  const incubator = state.incubator.map((slot) => {
    if (!slot || now < slot.startedAt + slot.durationMs || park.length >= PARK_LIMIT) return slot;
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

  // Her hayvan kendi aralığında altın düşürür. Uygulama arka planda kaldıysa aradaki düşürmeler birlikte sayılır.
  park = park.map((animal) => {
    if (now < animal.nextDropAt) return animal;
    const intervalMs = animalFor(animal.level).dropEverySec * 1000;
    const drops = Math.floor((now - animal.nextDropAt) / intervalMs) + 1;
    const amount = dropAmount(animal);
    gold += drops * amount;
    return {
      ...animal,
      nextDropAt: animal.nextDropAt + drops * intervalMs,
      lastDropAt: now,
      lastDropAmount: amount,
    };
  });

  return { ...state, now, gold, diamonds, discovered, newAnimalQueue, nextId, incubator, park };
}
