import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ANIMALS,
  dayNumber,
  HAPPY_MAX,
  PET_COOLDOWN_SEC,
  PET_HAPPINESS,
  TASTE_HAPPINESS,
  TASTES,
  TREAT_MIN_PRICE,
  TREATS,
  wishFor,
  xpForHappy,
  xpForWish,
} from './config.ts';
import { createInitialState, gameReducer, treatTaste, wishPending, type GameState, type ParkAnimal } from './state.ts';

const T0 = new Date(2026, 10, 5, 12).getTime();
const DAY = 86_400_000;

function animal(id: number, level: number): ParkAnimal {
  return {
    id,
    level,
    variant: { shiny: false },
    nextDropAt: T0 + 10 ** 9,
    lastDropAt: null,
    lastDropAmount: 0,
    fedAt: T0,
    skill: 0,
    parkedAt: T0,
    happiness: 0,
    petAt: 0,
    wishDoneDay: null,
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

function give(state: GameState, treat: (typeof TREATS)[number]['id']): GameState {
  const stocked = { ...state, treats: { ...state.treats, [treat]: (state.treats[treat] ?? 0) + 1 } };
  return gameReducer(stocked, { type: 'giveTreat', id: 1, treat });
}

describe('ikramlar', () => {
  it('her hayvanın sevdiği 3 ikram var ve sevdiği ile sevmediği çakışmaz', () => {
    for (const a of ANIMALS) {
      const { likes, dislikes } = TASTES[a.level];
      assert.equal(likes.length, 3, a.name);
      assert.ok(dislikes.length >= 1, a.name);
      assert.ok(!likes.some((t) => dislikes.includes(t)), a.name);
    }
  });

  it('günün isteği sevdiklerinden biridir ve her gün değişir', () => {
    assert.ok(TASTES[3].likes.includes(wish));
    assert.notEqual(wishFor(3, day + 1), wish);
  });

  it('ikram alınır, stoktan verilir; stok yoksa bir şey olmaz', () => {
    const bought = gameReducer(playing(), { type: 'buyTreat', treat: 'apple' });
    assert.equal(bought.treats.apple, 1);
    assert.equal(bought.gold, 1000 - TREAT_MIN_PRICE);
    const none = gameReducer(playing(), { type: 'giveTreat', id: 1, treat: 'apple' });
    assert.equal(none.park[0].happiness, 0);
  });

  it('günün isteği çok mutlu eder ve yıldız puanı verir; aynı gün ikinci kez istek sayılmaz', () => {
    const state = give(playing(), wish);
    assert.equal(state.park[0].happiness, TASTE_HAPPINESS.wish);
    assert.equal(state.xp, xpForWish(3));
    assert.equal(wishPending(state.park[0], T0), false);
    assert.equal(treatTaste(state.park[0], wish, T0), 'like');
    // Ertesi gün yeni bir istek olur.
    assert.equal(wishPending(state.park[0], T0 + DAY), true);
  });

  it('sevdiği ikram mutlu eder, sevmediği biraz üzer; denenenler hatırlanır', () => {
    let state = give(playing(), otherLike);
    assert.equal(state.park[0].happiness, TASTE_HAPPINESS.like);
    state = give(state, dislike);
    assert.equal(state.park[0].happiness, TASTE_HAPPINESS.like + TASTE_HAPPINESS.dislike);
    assert.deepEqual(state.triedTreats[3], [otherLike, dislike]);
    assert.equal(state.xp, 0);
  });

  it('mutluluk çubuğu dolunca yıldız puanı gelir ve çubuk baştan dolar', () => {
    let state = { ...playing(), park: [{ ...animal(1, 3), happiness: HAPPY_MAX - 5 }] };
    state = give(state, otherLike);
    assert.equal(state.park[0].happiness, HAPPY_MAX - 5 + TASTE_HAPPINESS.like - HAPPY_MAX);
    assert.equal(state.xp, xpForHappy(3));
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
