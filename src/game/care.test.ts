import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ANIMALS,
  dayNumber,
  DIRTY_AFTER_SEC,
  DIRTY_INCOME,
  FOODS,
  HAPPY_MAX,
  MAX_POOP,
  PET_COOLDOWN_SEC,
  PET_HAPPINESS,
  POOP_EVERY_SEC,
  POOP_GOLD_MIN,
  TASTE_HAPPINESS,
  TASTES,
  WASH_HAPPINESS,
  wishFor,
  XP_FEED,
  XP_POOP,
  XP_WASH,
  xpForHappy,
  xpForWish,
  type FoodId,
} from './config.ts';
import { parseSave, SAVE_VERSION } from './save.ts';
import {
  animalIncomePerSecond,
  createInitialState,
  foodTaste,
  gameReducer,
  isDirty,
  wishPending,
  type GameState,
  type ParkAnimal,
} from './state.ts';

const T0 = new Date(2026, 10, 5, 12).getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function animal(id: number, level: number): ParkAnimal {
  return {
    id,
    level,
    variant: { shiny: false },
    nextDropAt: T0 + 10 ** 9,
    lastDropAt: null,
    lastDropAmount: 0,
    // Biraz acıkmış: beslenebilir.
    fedAt: T0 - 2 * HOUR,
    skill: 0,
    parkedAt: T0,
    happiness: 0,
    petAt: 0,
    wishDoneDay: null,
    washedAt: T0,
  };
}

/** Rehberi bitmiş, parkında bir kedisi olan oyun. */
function playing(): GameState {
  return { ...createInitialState(T0), tutorialStep: null, park: [animal(1, 3)], discovered: [1, 2, 3], gold: 1000 };
}

const day = dayNumber(T0);
const wish = wishFor(3, day);
const otherLike = TASTES[3].likes.find((t) => t !== wish)!;
const dislike = TASTES[3].dislikes[0];
const okay = FOODS.map((f) => f.id).find((id) => !TASTES[3].likes.includes(id) && !TASTES[3].dislikes.includes(id))!;

function feed(state: GameState, food: FoodId): GameState {
  const stocked = { ...state, food: { ...state.food, [food]: (state.food[food] ?? 0) + 1 } };
  return gameReducer(stocked, { type: 'feedAnimal', id: 1, food });
}

describe('yiyecekler ve günün isteği', () => {
  it('her hayvanın sevdiği 3 yiyecek var, hepsi listede, sevdiği ile sevmediği çakışmaz', () => {
    const ids = new Set(FOODS.map((f) => f.id));
    for (const a of ANIMALS) {
      const { likes, dislikes } = TASTES[a.level];
      assert.equal(likes.length, 3, a.name);
      assert.ok(dislikes.length >= 1, a.name);
      assert.ok([...likes, ...dislikes].every((f) => ids.has(f)), a.name);
      assert.ok(!likes.some((t) => dislikes.includes(t)), a.name);
    }
  });

  it('günün isteği sevdiklerinden biridir ve her gün değişir', () => {
    assert.ok(TASTES[3].likes.includes(wish));
    assert.notEqual(wishFor(3, day + 1), wish);
  });

  it('acıkınca istediği verilirse çok mutlu olur ve ayrıca yıldız puanı gelir; o gün istek biter', () => {
    const state = feed(playing(), wish);
    assert.equal(state.park[0].fedAt, T0);
    assert.equal(state.park[0].happiness, TASTE_HAPPINESS.wish);
    assert.equal(state.xp, XP_FEED + xpForWish(3));
    assert.equal(wishPending(state.park[0], T0), false);
    assert.equal(foodTaste(state.park[0], wish, T0), 'like');
    assert.equal(wishPending(state.park[0], T0 + DAY), true);
  });

  it('sevdiği daha çok, fena değil dediği daha az mutlu eder; denenenler hatırlanır', () => {
    assert.equal(feed(playing(), otherLike).park[0].happiness, TASTE_HAPPINESS.like);
    const state = feed(playing(), okay);
    assert.equal(state.park[0].happiness, TASTE_HAPPINESS.okay);
    assert.equal(state.xp, XP_FEED);
    assert.deepEqual(state.triedFoods[3], [okay]);
  });

  it('sevmediğini yemez: tokluk ve mutluluk değişmez, yiyecek stokta kalır', () => {
    const state = feed(playing(), dislike);
    assert.equal(state.park[0].fedAt, T0 - 2 * HOUR);
    assert.equal(state.food[dislike], 1);
    assert.equal(state.park[0].happiness, 0);
    assert.deepEqual(state.triedFoods[3], [dislike]);
  });

  it('mutluluk çubuğu dolunca yıldız puanı gelir ve çubuk baştan dolar', () => {
    let state = { ...playing(), park: [{ ...animal(1, 3), happiness: HAPPY_MAX - 5 }] };
    state = feed(state, otherLike);
    assert.equal(state.park[0].happiness, HAPPY_MAX - 5 + TASTE_HAPPINESS.like - HAPPY_MAX);
    assert.equal(state.xp, XP_FEED + xpForHappy(3));
  });

  it('sevmek mutluluğu artırır ama dakikada bir sayılır', () => {
    let state = gameReducer(playing(), { type: 'petAnimal', id: 1 });
    assert.equal(state.park[0].happiness, PET_HAPPINESS);
    state = gameReducer(state, { type: 'petAnimal', id: 1 });
    assert.equal(state.park[0].happiness, PET_HAPPINESS);
    state = gameReducer({ ...state, now: T0 + PET_COOLDOWN_SEC * 1000 }, { type: 'petAnimal', id: 1 });
    assert.equal(state.park[0].happiness, 2 * PET_HAPPINESS);
  });
});

describe('yıkama', () => {
  it('hayvan zamanla kirlenir ve kirliyken daha az kazanır', () => {
    const cat = animal(1, 3);
    const later = T0 + DIRTY_AFTER_SEC * 1000;
    assert.equal(isDirty(cat, later - 1), false);
    assert.equal(isDirty(cat, later), true);
    const clean = animalIncomePerSecond({ ...cat, fedAt: later, washedAt: later }, 1, later);
    const dirty = animalIncomePerSecond({ ...cat, fedAt: later }, 1, later);
    assert.equal(dirty, clean * DIRTY_INCOME);
  });

  it('kirli hayvan yıkanınca temizlenir, mutlu olur, yıldız puanı gelir; temiz hayvan yıkanmaz', () => {
    const later = T0 + DIRTY_AFTER_SEC * 1000;
    const dirty = { ...playing(), now: later };
    const washed = gameReducer(dirty, { type: 'washAnimal', id: 1 });
    assert.equal(washed.park[0].washedAt, later);
    assert.equal(washed.park[0].happiness, WASH_HAPPINESS);
    assert.equal(washed.xp, XP_WASH);
    assert.equal(gameReducer(washed, { type: 'washAnimal', id: 1 }), washed);
  });
});

describe('kaka ve alan temizliği', () => {
  const EVERY = POOP_EVERY_SEC * 1000;

  it('hayvanı olan alana aralıkla kaka düşer, en fazla MAX_POOP birikir', () => {
    let state = gameReducer(playing(), { type: 'tick', now: T0 + EVERY - 1 });
    assert.equal(state.poops[3] ?? 0, 0);
    state = gameReducer(state, { type: 'tick', now: T0 + EVERY });
    assert.equal(state.poops[3], 1);
    state = gameReducer(state, { type: 'tick', now: T0 + 5 * EVERY });
    assert.equal(state.poops[3], MAX_POOP);
    // Hayvanı olmayan alana düşmez.
    assert.equal(state.poops[1] ?? 0, 0);
  });

  it('kakaya dokununca temizlenir, altın ve yıldız puanı gelir', () => {
    const state = { ...playing(), poops: { 3: 2 } };
    const next = gameReducer(state, { type: 'cleanPoop', level: 3 });
    assert.equal(next.poops[3], 1);
    assert.equal(next.gold, state.gold + POOP_GOLD_MIN);
    assert.equal(next.xp, XP_POOP);
    const empty = { ...state, poops: {} };
    assert.equal(gameReducer(empty, { type: 'cleanPoop', level: 3 }), empty);
  });

  it('rehber sürerken kaka düşmez', () => {
    const state = gameReducer({ ...playing(), tutorialStep: 2 }, { type: 'tick', now: T0 + 10 * EVERY });
    assert.equal(state.poops[3] ?? 0, 0);
  });
});

describe('eski kayıtların yiyecekleri', () => {
  it('hayvana göre saklanan eski yemler o hayvanın en bilinen yiyeceği olur, ikramlar eklenir', () => {
    const old = {
      ...playing(),
      food: { 1: 2, 3: 1 },
      treats: { apple: 1, lemon: 4 },
      triedTreats: { 3: ['cheese', 'lemon'] },
    } as unknown as Partial<GameState>;
    delete old.triedFoods;
    const loaded = parseSave(JSON.stringify({ version: SAVE_VERSION, state: old }))!;
    assert.deepEqual(loaded.food, { seed: 2, fish: 1, apple: 1 });
    assert.deepEqual(loaded.triedFoods, { 3: ['cheese'] });
    assert.equal(loaded.park[0].washedAt, T0);
    assert.equal('treats' in loaded, false);
  });
});
