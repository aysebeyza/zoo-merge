import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FIRST_HATCH_SEC, TUTORIAL_ANIMALS } from './config.ts';
import { parseSave, SAVE_VERSION } from './save.ts';
import { bestFood, createInitialState, gameReducer, type GameState } from './state.ts';
import { tutorialHint } from './tutorial.ts';

const T0 = 1_000_000;

/**
 * Rehberin elinin gösterdiğini yapar, bir çocuk gibi. Kutlama açıksa kapatır, bekleme varsa zamanı ilerletir.
 * ui: arayüzde Hayvanlarım panelinin açık olup olmadığı (oyun durumunda tutulmaz).
 */
function follow(state: GameState, ui = { animalsOpen: false }): GameState {
  const hint = tutorialHint(state, ui.animalsOpen);
  if (state.newAnimalQueue.length > 0) return gameReducer(state, { type: 'dismissNewAnimal' });
  if (!hint) return gameReducer(state, { type: 'tick', now: state.now + 250 });
  if (hint.kind === 'wait')
    return gameReducer(state, {
      type: 'tick',
      now: state.now + FIRST_HATCH_SEC * 1000,
    });
  if (hint.kind === 'tap') {
    if (hint.target === 'basket') return gameReducer(state, { type: 'takeEgg' });
    if (hint.target === 'animals') {
      ui.animalsOpen = true;
      return state;
    }
    if (hint.target.startsWith('feed-')) {
      const id = Number(hint.target.slice(5));
      const animal = state.park.find((a) => a.id === id)!;
      return gameReducer(state, { type: 'feedAnimal', id, food: bestFood(state, animal)! });
    }
    // Paneli kapatınca rehber biter (arayüz finishTutorial gönderir).
    ui.animalsOpen = false;
    return gameReducer(state, { type: 'finishTutorial' });
  }
  const from = Number(hint.from.split('-')[1]);
  const to = Number(hint.to.split('-')[1]);
  return hint.to.startsWith('slot')
    ? gameReducer(state, { type: 'incubate', from, slot: to })
    : gameReducer(state, { type: 'moveEgg', from, to });
}

describe('ilk oyun rehberi', () => {
  it('rehberde yalnızca elin gösterdiği hamle işe yarar', () => {
    // Sepetten iki yumurta: el ilkini kuluçkaya sürüklemeyi gösterir.
    let state = gameReducer(createInitialState(T0), { type: 'takeEgg' });
    state = gameReducer(state, { type: 'takeEgg' });
    const hint = tutorialHint(state);
    assert.equal(hint?.kind, 'drag');
    assert.equal(hint?.kind === 'drag' && hint.to, 'slot-0');

    // Birleştirmek, sepete tekrar dokunmak ya da yükseltme almak hiçbir şey yapmaz.
    assert.equal(gameReducer(state, { type: 'moveEgg', from: 0, to: 1 }), state);
    assert.equal(gameReducer(state, { type: 'takeEgg' }), state);
    assert.equal(gameReducer({ ...state, gold: 1e9 }, { type: 'buyUpgrade', id: 'moreVisitors' }).upgrades.moreVisitors, 0);

    // Gösterilen hamle çalışır; yumurta çatlarken başka hamle yapılamaz, zaman ilerler.
    const hatching = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    assert.notEqual(hatching.incubator[0], null);
    assert.equal(tutorialHint(hatching)?.kind, 'wait');
    assert.equal(gameReducer(hatching, { type: 'takeEgg' }), hatching);
    assert.notEqual(gameReducer(hatching, { type: 'tick', now: T0 + 1000 }), hatching);
  });

  it('birleştirme adımında iki yumurta hangi yönde sürüklenirse sürüklensin birleşir', () => {
    // İkinci adım (tavşan): elde iki civciv yumurtası.
    let state: GameState = { ...createInitialState(T0), tutorialStep: 2, discovered: [1] };
    state = gameReducer(state, { type: 'takeEgg' });
    state = gameReducer(state, { type: 'takeEgg' });
    const hint = tutorialHint(state);
    assert.deepEqual(hint && hint.kind === 'drag' && [hint.from, hint.to], ['cell-0', 'cell-1']);
    assert.equal(gameReducer(state, { type: 'moveEgg', from: 1, to: 0 }).grid[0]?.level, 2);
    assert.equal(gameReducer(state, { type: 'incubate', from: 0, slot: 0 }), state);
  });

  it('son adımda yalnızca besleme yapılabilir', () => {
    let state = createInitialState(T0);
    const ui = { animalsOpen: false };
    while (state.tutorialStep !== null && state.tutorialStep <= TUTORIAL_ANIMALS) state = follow(state, ui);
    assert.equal(state.basket > 0 && state.grid.includes(null), true);
    assert.equal(gameReducer(state, { type: 'takeEgg' }), state);
    const chick = state.park.find((a) => a.level === 1)!;
    assert.equal(gameReducer(state, { type: 'feedAnimal', id: chick.id, food: 'seed' }).food.seed, 0);
  });

  it('rehber bitince her hamle serbest', () => {
    const state: GameState = { ...createInitialState(T0), tutorialStep: null, discovered: [1] };
    const merged = gameReducer(gameReducer(gameReducer(state, { type: 'takeEgg' }), { type: 'takeEgg' }), {
      type: 'moveEgg',
      from: 0,
      to: 1,
    });
    assert.equal(merged.grid[1]?.level, 2);
  });

  it('yeni oyunda el önce sepeti gösterir', () => {
    assert.deepEqual(tutorialHint(createInitialState(T0)), {
      kind: 'tap',
      target: 'basket',
      text: 'Sepete dokun',
    });
  });

  it('eli takip eden çocuk civcivi, tavşanı ve kediyi sırayla çıkarır, besler, rehber biter', () => {
    let state = createInitialState(T0);
    const ui = { animalsOpen: false };
    const order: number[] = [];
    const texts: string[] = [];
    for (let i = 0; i < 200 && state.tutorialStep !== null; i++) {
      const text = tutorialHint(state, ui.animalsOpen)?.text;
      if (text && texts.at(-1) !== text) texts.push(text);
      state = follow(state, ui);
      for (const level of state.discovered) if (!order.includes(level)) order.push(level);
    }
    assert.deepEqual(texts.slice(-5), [
      'Hayvanlarına bak!',
      '🌾 Civcivini besle',
      '🥕 Tavşanını besle',
      '🐟 Kedini besle',
      'Aferin! Acıkınca yine besle 🎉',
    ]);
    // Hediye yemlerin hepsi yendi, üç hayvan da tok. Rehberde kazanılan seviyelerin hediyesi rehber
    // bitince gelir: her seviyede bulunan her hayvana birer yem.
    const levels = state.levelUps.length;
    assert.ok(levels > 0);
    assert.equal(state.level, 1 + levels);
    assert.deepEqual(state.food, { seed: levels, carrot: levels, fish: levels });
    assert.ok(state.park.every((a) => a.fedAt === state.now));
    assert.equal(state.tutorialStep, null);
    assert.deepEqual(order, [1, 2, 3]);
    assert.deepEqual(
      state.park.map((a) => a.level).sort(),
      Array.from({ length: TUTORIAL_ANIMALS }, (_, i) => i + 1),
    );
    // Rehber 3 hayvanı birkaç dakikada bitirir; bekleme yalnızca 3'er saniye.
    assert.ok(state.now - T0 < 2 * 60_000, `rehber çok uzun sürdü: ${(state.now - T0) / 1000} sn`);
  });

  it('rehber bitince el görünmez ve kuluçka normal sürer', () => {
    const done = {
      ...createInitialState(T0),
      tutorialStep: null,
      firstHatchDone: true,
    };
    assert.equal(tutorialHint(done), null);
    const grid = [...done.grid];
    grid[0] = { id: 1, level: 3, variant: { shiny: false } };
    const incubated = gameReducer({ ...done, grid }, { type: 'incubate', from: 0, slot: 0 });
    assert.ok(incubated.incubator[0]!.durationMs > FIRST_HATCH_SEC * 1000);
  });

  it('baştan başlayınca her şey sıfırlanır ve rehber yeniden başlar', () => {
    const played = {
      ...createInitialState(T0),
      gold: 20_000_000,
      discovered: [1, 2, 3, 9],
      tutorialStep: null,
    };
    const fresh = gameReducer(played, { type: 'reset', now: T0 + 1000 });
    assert.deepEqual(fresh, createInitialState(T0 + 1000));
    assert.equal(fresh.tutorialStep, 1);
  });

  it('rehberden önce başlamış oyunlar rehberi görmez', () => {
    const { tutorialStep: _, ...old } = createInitialState(T0);
    const loaded = parseSave(JSON.stringify({ version: SAVE_VERSION, state: old }))!;
    assert.equal(loaded.tutorialStep, null);
  });
});
