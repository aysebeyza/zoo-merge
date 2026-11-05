import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { levelForXp, TIP_EVERY_SEC, TIP_MIN, TIP_STAY_SEC, xpForLevel, XP_TIP } from './config.ts';
import { parseSave, serializeSave } from './save.ts';
import { createInitialState, gainXp, gameReducer, type GameState, type ParkAnimal } from './state.ts';

const T0 = 1_000_000;

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
    washedAt: T0,
  };
}

/** Rehberi bitmiş, parkında bir civcivi olan oyun. */
function playing(): GameState {
  return { ...createInitialState(T0), tutorialStep: null, park: [animal(1, 1)], discovered: [1] };
}

describe('bahçe seviyesi', () => {
  it('seviyeler artan puanla açılır', () => {
    assert.equal(levelForXp(0), 1);
    assert.equal(levelForXp(xpForLevel(2) - 1), 1);
    assert.equal(levelForXp(xpForLevel(2)), 2);
    assert.equal(levelForXp(xpForLevel(5)), 5);
    assert.ok(xpForLevel(6) - xpForLevel(5) > xpForLevel(3) - xpForLevel(2));
  });

  it('seviye atlayınca altın ve bulunan her hayvana bir yem verilir, kutlama sıraya girer', () => {
    const state = gainXp(playing(), xpForLevel(2));
    assert.equal(state.level, 2);
    assert.equal(state.levelUps.length, 1);
    assert.ok(state.gold > playing().gold);
    assert.deepEqual(state.food, { seed: 1 });
    assert.equal(gameReducer(state, { type: 'dismissLevelUp' }).levelUps.length, 0);
  });

  it('elmas yalnızca birkaç seviyede bir gelir', () => {
    const state = gainXp(playing(), xpForLevel(10));
    assert.equal(state.level, 10);
    const withDiamonds = state.levelUps.filter((l) => l.diamonds > 0).map((l) => l.level);
    assert.deepEqual(withDiamonds, [5, 10]);
  });

  it('rehber sürerken seviye hediyesi bekler, rehber bitince verilir', () => {
    let state: GameState = { ...playing(), tutorialStep: 4 };
    state = gainXp(state, xpForLevel(3));
    assert.equal(state.level, 1);
    assert.equal(state.levelUps.length, 0);
    state = gameReducer(state, { type: 'finishTutorial' });
    assert.equal(state.level, 3);
    assert.equal(state.levelUps.length, 2);
  });

  it('yeni hayvan çıkınca puan kazanılır', () => {
    let state: GameState = { ...playing(), park: [], discovered: [], firstHatchDone: true };
    state = {
      ...state,
      incubator: [{ egg: { id: 9, level: 1, variant: { shiny: false } }, startedAt: T0, durationMs: 1000 }, null],
    };
    state = gameReducer(state, { type: 'tick', now: T0 + 1000 });
    assert.ok(state.xp > 0);
  });

  it('seviyeden önceki kayıtlar bulunan hayvanların puanıyla başlar, hediye verilmez', () => {
    const old = { ...playing(), discovered: [1, 2, 3, 4] } as Partial<GameState>;
    delete old.xp;
    delete old.level;
    const loaded = parseSave(serializeSave(old as GameState))!;
    assert.ok(loaded.xp > 0);
    assert.equal(loaded.level, levelForXp(loaded.xp));
    assert.equal(loaded.levelUps.length, 0);
  });
});

describe('ziyaretçi bahşişleri', () => {
  const EVERY = TIP_EVERY_SEC * 1000;
  const STAY = TIP_STAY_SEC * 1000;

  it('bahşişli ziyaretçi aralıkla gelir', () => {
    let state = playing();
    state = gameReducer(state, { type: 'tick', now: T0 + EVERY - 1 });
    assert.equal(state.tipUntil, null);
    state = gameReducer(state, { type: 'tick', now: T0 + EVERY });
    assert.equal(state.tipUntil, T0 + EVERY + STAY);
  });

  it('ziyaretçi gitmeden dokunulursa altın ve puan gelir', () => {
    const state = gameReducer(playing(), { type: 'tick', now: T0 + EVERY });
    const next = gameReducer(state, { type: 'collectTip' });
    assert.equal(next.tipUntil, null);
    assert.equal(next.gold, state.gold + TIP_MIN);
    assert.equal(next.xp, state.xp + XP_TIP);
    // İkinci dokunuş bir şey vermez.
    assert.equal(gameReducer(next, { type: 'collectTip' }).gold, next.gold);
  });

  it('toplanmayan bahşiş ziyaretçiyle gider, sıradaki ziyaretçi aralık dolunca gelir', () => {
    let state = gameReducer(playing(), { type: 'tick', now: T0 + EVERY });
    state = gameReducer(state, { type: 'tick', now: T0 + EVERY + STAY });
    assert.equal(state.tipUntil, null);
    assert.equal(gameReducer(state, { type: 'collectTip' }).gold, state.gold);
    state = gameReducer(state, { type: 'tick', now: T0 + 2 * EVERY - 1 });
    assert.equal(state.tipUntil, null);
    state = gameReducer(state, { type: 'tick', now: T0 + 2 * EVERY });
    assert.notEqual(state.tipUntil, null);
  });

  it('oyun uzun süre kapalı kalınca bahşişler birikmez', () => {
    const state = gameReducer(playing(), { type: 'tick', now: T0 + 100 * EVERY });
    assert.equal(state.tipUntil, T0 + 100 * EVERY + STAY);
  });

  it('rehber sürerken ya da parkta hayvan yokken bahşiş gelmez', () => {
    const inTutorial = { ...playing(), tutorialStep: 2 };
    assert.equal(gameReducer(inTutorial, { type: 'tick', now: T0 + 10 * EVERY }).tipUntil, null);
    const empty = { ...playing(), park: [] };
    assert.equal(gameReducer(empty, { type: 'tick', now: T0 + 10 * EVERY }).tipUntil, null);
  });
});
