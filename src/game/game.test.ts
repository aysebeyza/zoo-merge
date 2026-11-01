import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mixVariants, plainVariant } from './colors.ts';
import { ANIMALS, eggPrice, FIRST_HATCH_SEC, PARK_LIMIT, START_GOLD } from './config.ts';
import { formatDuration, formatNumber } from './format.ts';
import { createInitialState, gameReducer, type Egg, type GameState } from './state.ts';

const T0 = 1_000_000;

function egg(id: number, level: number, color: 'red' | 'blue' | 'yellow' = 'red'): Egg {
  return { id, level, variant: plainVariant(color) };
}

function withGrid(state: GameState, eggs: Record<number, Egg>): GameState {
  const grid = [...state.grid];
  for (const [cell, e] of Object.entries(eggs)) grid[Number(cell)] = e;
  return { ...state, grid, nextId: 100 };
}

describe('renk karışımı', () => {
  it('iki ana renk karışık renk verir', () => {
    assert.deepEqual(mixVariants(plainVariant('red'), plainVariant('blue')), plainVariant('purple'));
    assert.deepEqual(mixVariants(plainVariant('yellow'), plainVariant('blue')), plainVariant('green'));
    assert.deepEqual(mixVariants(plainVariant('red'), plainVariant('yellow')), plainVariant('orange'));
  });

  it('aynı renk saf hal verir', () => {
    assert.deepEqual(mixVariants(plainVariant('red'), plainVariant('red')), {
      color: 'red',
      pure: true,
      patterned: false,
    });
  });

  it('ana renk + karışık renk karışık rengi korur', () => {
    assert.deepEqual(mixVariants(plainVariant('red'), plainVariant('green')), plainVariant('green'));
  });

  it('iki farklı karışık renk desenli olur ve desen korunur', () => {
    const patterned = mixVariants(plainVariant('purple'), plainVariant('green'));
    assert.equal(patterned.patterned, true);
    assert.equal(mixVariants(plainVariant('red'), patterned).patterned, true);
  });
});

describe('yumurta alma', () => {
  it('altın düşer, yumurta ilk boş kutuya gelir, sıradaki renk güncellenir', () => {
    const state = gameReducer(createInitialState(T0, 'blue'), { type: 'buyEgg', nextColor: 'yellow' });
    assert.equal(state.gold, START_GOLD - eggPrice(0));
    assert.deepEqual(state.grid[0], egg(1, 1, 'blue'));
    assert.equal(state.nextEggColor, 'yellow');
  });

  it('altın yetmezse hiçbir şey olmaz', () => {
    const poor = { ...createInitialState(T0, 'red'), gold: 0 };
    assert.equal(gameReducer(poor, { type: 'buyEgg', nextColor: 'red' }), poor);
  });
});

describe('birleştirme', () => {
  it('aynı seviyedeki iki yumurta bir üst seviyeye çıkar ve renkler karışır', () => {
    const state = withGrid(createInitialState(T0, 'red'), { 0: egg(1, 1, 'red'), 1: egg(2, 1, 'blue') });
    const next = gameReducer(state, { type: 'moveEgg', from: 0, to: 1 });
    assert.equal(next.grid[0], null);
    assert.equal(next.grid[1]?.level, 2);
    assert.equal(next.grid[1]?.variant.color, 'purple');
  });

  it('farklı seviyeler yer değiştirir', () => {
    const state = withGrid(createInitialState(T0, 'red'), { 0: egg(1, 1), 1: egg(2, 2) });
    const next = gameReducer(state, { type: 'moveEgg', from: 0, to: 1 });
    assert.equal(next.grid[0]?.id, 2);
    assert.equal(next.grid[1]?.id, 1);
  });

  it('ejderha yumurtaları birleşmez', () => {
    const state = withGrid(createInitialState(T0, 'red'), { 0: egg(1, 10), 1: egg(2, 10) });
    const next = gameReducer(state, { type: 'moveEgg', from: 0, to: 1 });
    assert.equal(next.grid[1]?.level, 10);
    assert.equal(next.grid[0]?.level, 10);
  });
});

describe('kuluçka ve park', () => {
  it('ilk civciv kısa sürede çıkar, yeni hayvan kutlaması ve elmas verir', () => {
    let state = withGrid(createInitialState(T0, 'red'), { 0: egg(1, 1) });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    state = gameReducer(state, { type: 'tick', now: T0 + FIRST_HATCH_SEC * 1000 - 1 });
    assert.equal(state.park.length, 0);
    state = gameReducer(state, { type: 'tick', now: T0 + FIRST_HATCH_SEC * 1000 });
    assert.equal(state.park.length, 1);
    assert.equal(state.incubator[0], null);
    assert.deepEqual(state.newAnimalQueue, [1]);
    assert.equal(state.diamonds, 5);
  });

  it('sonraki kuluçkalar tablodaki süreyi kullanır', () => {
    let state = { ...withGrid(createInitialState(T0, 'red'), { 0: egg(1, 2) }), firstHatchDone: true };
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 1 });
    assert.equal(state.incubator[1]?.durationMs, ANIMALS[1].incubationSec * 1000);
  });

  it('park doluysa hayvan kuluçkada bekler', () => {
    let state = withGrid(createInitialState(T0, 'red'), { 0: egg(1, 1) });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    const full = Array.from({ length: PARK_LIMIT }, (_, i) => ({
      id: 500 + i,
      level: 1,
      variant: plainVariant('red'),
      nextDropAt: Infinity,
      lastDropAt: null,
      lastDropAmount: 0,
    }));
    state = gameReducer({ ...state, park: full }, { type: 'tick', now: T0 + 60_000 });
    assert.equal(state.park.length, PARK_LIMIT);
    assert.notEqual(state.incubator[0], null);
  });

  it('hayvanlar aralıklarla altın düşürür, kaçırılan düşürmeler de sayılır', () => {
    let state = withGrid(createInitialState(T0, 'red'), { 0: egg(1, 1) });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    const hatchAt = T0 + FIRST_HATCH_SEC * 1000;
    state = gameReducer(state, { type: 'tick', now: hatchAt });
    const goldAfterHatch = state.gold;
    // Civciv 2 saniyede 2 altın düşürür; 10 saniyede 5 kez.
    state = gameReducer(state, { type: 'tick', now: hatchAt + 10_000 });
    assert.equal(state.gold - goldAfterHatch, 10);
  });

  it('doğaya salınan hayvan 1 dakikalık kazancını verir', () => {
    let state = withGrid(createInitialState(T0, 'red'), { 0: egg(1, 1) });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    state = gameReducer(state, { type: 'tick', now: T0 + FIRST_HATCH_SEC * 1000 });
    const before = state.gold;
    state = gameReducer(state, { type: 'releaseAnimal', id: state.park[0].id });
    assert.equal(state.park.length, 0);
    assert.equal(state.gold - before, 60);
  });
});

describe('biçimlendirme', () => {
  it('sayıları Türkçe biçimde yazar', () => {
    assert.equal(formatNumber(1250), '1.250');
    assert.equal(formatNumber(2_560_000), '2,5 Mn');
  });

  it('süreleri yazar', () => {
    assert.equal(formatDuration(95), '1:35');
    assert.equal(formatDuration(3725), '1:02:05');
  });
});
