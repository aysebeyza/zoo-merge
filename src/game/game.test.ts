import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mixVariants, plainVariant } from './colors.ts';
import {
  ANIMALS,
  eggPrice,
  ESCAPE_AFTER_EMPTY_SEC,
  FIRST_HATCH_SEC,
  HUNGER_SEC,
  OFFLINE_EARNING_CAP_SEC,
  PARK_LIMIT,
  START_GOLD,
  upgradeFor,
  type UpgradeId,
} from './config.ts';
import { formatDuration, formatNumber, formatWait } from './format.ts';
import { parseSave, SAVE_VERSION, serializeSave } from './save.ts';
import {
  createInitialState,
  feedAllCost,
  fullnessAt,
  gameReducer,
  goldPerSecond,
  type Egg,
  type GameState,
} from './state.ts';

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
      fedAt: T0,
      skill: 0,
      parkedAt: T0,
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

/** Parkta bir civcivi olan oyun; civciv 2 saniyede 2 altın düşürür. Dönen zaman, civcivin çıktığı an. */
function withChick(): { state: GameState; hatchAt: number } {
  let state = withGrid(createInitialState(T0, 'red'), { 0: egg(1, 1) });
  state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
  const hatchAt = T0 + FIRST_HATCH_SEC * 1000;
  state = gameReducer(state, { type: 'tick', now: hatchAt });
  return { state, hatchAt };
}

describe('oyun kapalıyken', () => {
  it('kısa aralıklarda "sen yokken" ekranı çıkmaz', () => {
    const { state, hatchAt } = withChick();
    const next = gameReducer(state, { type: 'tick', now: hatchAt + 10_000 });
    assert.equal(next.awayGold, 0);
  });

  it('uzak kalınca biriken altın verilir ve ekranda gösterilir', () => {
    const { state, hatchAt } = withChick();
    const next = gameReducer(state, { type: 'tick', now: hatchAt + 10 * 60_000 });
    assert.equal(next.gold - state.gold, 600);
    assert.equal(next.awayGold, 600);
    assert.equal(gameReducer(next, { type: 'dismissAwayGold' }).awayGold, 0);
  });

  it('en fazla 2 saatlik altın birikir, sonra hayvan normal düzenine döner', () => {
    const { state, hatchAt } = withChick();
    const away = hatchAt + 5 * 60 * 60_000;
    const back = gameReducer(state, { type: 'tick', now: away });
    // Civciv ilk 2 saatte tok (%50'nin üstünde), saniyede 1 altın.
    assert.equal(back.gold - state.gold, OFFLINE_EARNING_CAP_SEC);
    const fed = gameReducer({ ...back, gold: 1e6 }, { type: 'feedAll' });
    const later = gameReducer(fed, { type: 'tick', now: away + 2000 });
    assert.equal(later.gold - fed.gold, 2);
  });

  it('kuluçka oyun kapalıyken de sürer', () => {
    let state = { ...withGrid(createInitialState(T0, 'red'), { 0: egg(1, 2) }), firstHatchDone: true };
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    state = gameReducer(state, { type: 'tick', now: T0 + ANIMALS[1].incubationSec * 1000 + 60 * 60_000 });
    assert.equal(state.park.length, 1);
    assert.equal(state.incubator[0], null);
  });
});

/** Yükseltmeleri verilen seviyelere getirir; bedeli ödenmiş sayılır. */
function withUpgrades(state: GameState, levels: Partial<Record<UpgradeId, number>>): GameState {
  let next = state;
  for (const [id, level] of Object.entries(levels) as [UpgradeId, number][]) {
    for (let i = 0; i < level; i++) {
      next = gameReducer({ ...next, gold: next.gold + upgradeFor(id).costs[i] }, { type: 'buyUpgrade', id });
    }
  }
  return next;
}

describe('yükseltmeler', () => {
  it('altın yetince alınır, bedeli düşer, seviye artar', () => {
    const cost = upgradeFor('moreVisitors').costs[0];
    const state = { ...createInitialState(T0, 'red'), gold: cost + 5 };
    const next = gameReducer(state, { type: 'buyUpgrade', id: 'moreVisitors' });
    assert.equal(next.upgrades.moreVisitors, 1);
    assert.equal(next.gold, 5);
  });

  it('altın yetmezse ya da en üst seviyedeyse alınamaz', () => {
    const poor = { ...createInitialState(T0, 'red'), gold: 0 };
    assert.equal(gameReducer(poor, { type: 'buyUpgrade', id: 'autoEgg' }), poor);
    const maxed = withUpgrades(createInitialState(T0, 'red'), { autoEgg: upgradeFor('autoEgg').costs.length });
    const rich = { ...maxed, gold: 1e12 };
    assert.equal(gameReducer(rich, { type: 'buyUpgrade', id: 'autoEgg' }), rich);
  });

  it('otomatik yumurta aralıklarla boş kutuya düşer, alan doluysa bekler', () => {
    let state = withUpgrades(createInitialState(T0, 'red'), { autoEgg: 1 });
    state = gameReducer(state, { type: 'tick', now: T0 + 29_999, eggColor: 'blue' });
    assert.equal(state.grid[0], null);
    state = gameReducer(state, { type: 'tick', now: T0 + 30_000, eggColor: 'blue' });
    assert.equal(state.grid[0]?.level, 1);
    assert.equal(state.grid[0]?.variant.color, 'blue');

    const full = { ...state, grid: state.grid.map((_, i) => egg(200 + i, 3)) };
    const waited = gameReducer(full, { type: 'tick', now: T0 + 60_000 });
    assert.equal(waited.nextAutoEggAt, T0 + 90_000);
  });

  it('uzun süre uzak kalınca otomatik yumurtalar yalnızca alan dolana kadar gelir', () => {
    let state = withUpgrades(createInitialState(T0, 'red'), { autoEgg: 3 });
    for (let t = 1; t <= 30; t++) state = gameReducer(state, { type: 'tick', now: T0 + 60 * 60_000 + t });
    assert.equal(state.grid.includes(null), false);
  });

  it('daha iyi yumurta, şans tutunca 2. seviyeden başlar', () => {
    const state = withUpgrades(createInitialState(T0, 'red'), { betterEgg: 1 });
    assert.equal(gameReducer(state, { type: 'buyEgg', nextColor: 'red', roll: 0.1 }).grid[0]?.level, 2);
    assert.equal(gameReducer(state, { type: 'buyEgg', nextColor: 'red', roll: 0.9 }).grid[0]?.level, 1);
  });

  it('daha iyi yumurta otomatik yumurtalara da uygulanır', () => {
    const state = withUpgrades(createInitialState(T0, 'red'), { autoEgg: 1, betterEgg: 3 });
    const next = gameReducer(state, { type: 'tick', now: T0 + 30_000, roll: 0.99 });
    assert.equal(next.grid[0]?.level, 2);
  });

  it('daha çok ziyaretçi altın kazancını artırır', () => {
    const { state, hatchAt } = withChick();
    const boosted = withUpgrades(state, { moreVisitors: 5 });
    const before = boosted.gold;
    const next = gameReducer(boosted, { type: 'tick', now: hatchAt + 10_000 });
    // Civciv 2 altın yerine 3 altın (2 x 1,5) düşürür; 10 saniyede 5 kez.
    assert.equal(next.gold - before, 15);
  });

  it('kuluçka makinesi süreyi kısaltır', () => {
    let state = { ...withGrid(createInitialState(T0, 'red'), { 0: egg(1, 2) }), firstHatchDone: true };
    state = withUpgrades(state, { fasterIncubator: 5 });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    assert.equal(state.incubator[0]?.durationMs, ANIMALS[1].incubationSec * 1000 * 0.5);
  });

  it('kuluçka makinesi alınınca kuluçkadaki yumurtanın kalan süresi de kısalır', () => {
    let state = { ...withGrid(createInitialState(T0, 'red'), { 0: egg(1, 3) }), firstHatchDone: true };
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    // Kedi 90 sn sürer; 30 sn geçince 60 sn kalır. %10 hızlanınca kalan süre 54 sn olur.
    state = gameReducer(state, { type: 'tick', now: T0 + 30_000 });
    state = withUpgrades(state, { fasterIncubator: 1 });
    assert.equal(state.incubator[0]?.durationMs, 84_000);
  });

  it('yeni kuluçka yuvası ve daha büyük park kapasiteyi artırır', () => {
    let state = withUpgrades(createInitialState(T0, 'red'), { incubatorSlot: 2, biggerPark: 1 });
    assert.equal(state.incubator.length, 4);
    state = withGrid(state, { 0: egg(1, 1) });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 3 });
    const full = Array.from({ length: PARK_LIMIT }, (_, i) => ({
      id: 500 + i,
      level: 1,
      variant: plainVariant('red'),
      nextDropAt: Infinity,
      lastDropAt: null,
      lastDropAmount: 0,
      fedAt: T0,
      skill: 0,
      parkedAt: T0,
    }));
    state = gameReducer({ ...state, park: full }, { type: 'tick', now: T0 + 60_000 });
    assert.equal(state.park.length, PARK_LIMIT + 1);
  });
});

const HOUR = 60 * 60_000;

describe('besleme', () => {
  it('yeni çıkan hayvan toktur, zamanla acıkır', () => {
    const { state, hatchAt } = withChick();
    const animal = state.park[0];
    assert.equal(fullnessAt(animal, hatchAt), 1);
    assert.equal(fullnessAt(animal, hatchAt + HUNGER_SEC * 500), 0.5);
    assert.equal(fullnessAt(animal, hatchAt + HUNGER_SEC * 2000), 0);
  });

  it('acıkmış hayvan yarı, üzgün hayvan çok az, tokluğu bitmiş hayvan hiç altın vermez', () => {
    const { state, hatchAt } = withChick();
    // Köpek seviyesinde bir hayvan: 3 saniyede 36 altın. Küçük sayılarda yuvarlama karıştırmasın.
    const dog = { ...state.park[0], level: 4, nextDropAt: hatchAt + 3000 };
    const at = (fullness: number) => {
      const fedAt = hatchAt + 3000 - (1 - fullness) * HUNGER_SEC * 1000;
      const s = gameReducer({ ...state, park: [{ ...dog, fedAt }] }, { type: 'tick', now: hatchAt + 3000 });
      return s.gold - state.gold;
    };
    assert.equal(at(0.8), 36);
    assert.equal(at(0.3), 18);
    assert.equal(at(0.1), 4);
    assert.equal(at(0), 0);
  });

  it('mama kabı aç hayvanları doyurur ve altın düşer', () => {
    const { state, hatchAt } = withChick();
    const hungry = gameReducer({ ...state, gold: 1000 }, { type: 'tick', now: hatchAt + HUNGER_SEC * 500 });
    const cost = feedAllCost(hungry);
    // Yarı aç civciv: 10 dakikalık kazancın yarısı = 300 altın.
    assert.equal(cost, 300);
    const fed = gameReducer(hungry, { type: 'feedAll' });
    assert.equal(fed.gold, hungry.gold - cost);
    assert.equal(fullnessAt(fed.park[0], fed.now), 1);
  });

  it('altın hepsine yetmezse en aç hayvandan başlar', () => {
    const { state, hatchAt } = withChick();
    const now = hatchAt + 3 * HOUR;
    const park = [
      { ...state.park[0], id: 1, fedAt: now - 1 * HOUR },
      { ...state.park[0], id: 2, fedAt: now - 3 * HOUR },
    ];
    const s = { ...state, now, park, gold: 500 };
    const fed = gameReducer(s, { type: 'feedAll' });
    assert.equal(fullnessAt(fed.park.find((a) => a.id === 2)!, now), 1);
    assert.notEqual(fullnessAt(fed.park.find((a) => a.id === 1)!, now), 1);
  });

  it('altının yetmediği hayvan atlanır, daha ucuz aç hayvan yine doyar', () => {
    const { state, hatchAt } = withChick();
    const now = hatchAt + 3 * HOUR;
    const park = [
      // Panda çok aç ve doyurması pahalı; civciv az aç ve ucuz.
      { ...state.park[0], id: 1, level: 5, fedAt: now - 3 * HOUR },
      { ...state.park[0], id: 2, fedAt: now - 1 * HOUR },
    ];
    const fed = gameReducer({ ...state, now, park, gold: 500 }, { type: 'feedAll' });
    assert.notEqual(fullnessAt(fed.park.find((a) => a.id === 1)!, now), 1);
    assert.equal(fullnessAt(fed.park.find((a) => a.id === 2)!, now), 1);
  });

  it('uzun süre aç kalan hayvan kaçar ve rengini koruyarak yumurtasına döner', () => {
    const { state, hatchAt } = withChick();
    const purple = { ...state.park[0], variant: plainVariant('purple') };
    const escapeAt = hatchAt + (HUNGER_SEC + ESCAPE_AFTER_EMPTY_SEC) * 1000;
    const before = gameReducer({ ...state, park: [purple] }, { type: 'tick', now: escapeAt - 1 });
    assert.equal(before.park.length, 1);
    const after = gameReducer(before, { type: 'tick', now: escapeAt });
    assert.equal(after.park.length, 0);
    assert.equal(after.grid[0]?.level, 1);
    assert.equal(after.grid[0]?.variant.color, 'purple');
    assert.deepEqual(after.escapedQueue, [1]);
  });

  it('alan doluysa kaçan hayvanın yumurtası hediye kutusunda bekler', () => {
    const { state, hatchAt } = withChick();
    const full = { ...state, grid: state.grid.map((_, i) => egg(200 + i, 3)) };
    const escapeAt = hatchAt + (HUNGER_SEC + ESCAPE_AFTER_EMPTY_SEC) * 1000;
    let s = gameReducer(full, { type: 'tick', now: escapeAt });
    assert.equal(s.giftBox.length, 1);
    assert.equal(gameReducer(s, { type: 'takeGift' }), s);
    s = { ...s, grid: s.grid.map((e, i) => (i === 5 ? null : e)) };
    s = gameReducer(s, { type: 'takeGift' });
    assert.equal(s.giftBox.length, 0);
    assert.equal(s.grid[5]?.level, 1);
  });

  it('otomatik yemlik altın yettikçe hayvanı besler, oyun kapalıyken de', () => {
    const { state, hatchAt } = withChick();
    const s = { ...withUpgrades(state, { autoFeeder: 1 }), gold: 10_000 };
    const later = gameReducer(s, { type: 'tick', now: hatchAt + 24 * HOUR });
    assert.equal(later.park.length, 1);
    assert.ok(fullnessAt(later.park[0], later.now) >= 0.5);
    assert.ok(later.gold < s.gold + OFFLINE_EARNING_CAP_SEC);
  });

  it('otomatik yemlik altın yoksa besleyemez', () => {
    const { state, hatchAt } = withChick();
    const s = { ...withUpgrades(state, { autoFeeder: 1 }), gold: 0 };
    const later = gameReducer(s, { type: 'tick', now: hatchAt + 24 * HOUR });
    assert.equal(later.park.length, 0);
  });
});

describe('yetenekler', () => {
  it('dokümandaki tam gelişmiş örnekler tutar', () => {
    // Doküman: kedi 11/sn, penguen 105/sn, aslan 1.080/sn, ejderha 2.175/sn.
    const full = (level: number) => goldPerSecond({ level, variant: plainVariant('red'), skill: 3 });
    assert.equal(full(3), 11);
    assert.equal(full(6), 105);
    assert.equal(full(9), 1080);
    assert.equal(full(10), 2175);
  });

  it('seviye parkta kalma süresi dolunca açılır ve hayvanın kazancına göre ücretlidir', () => {
    const { state, hatchAt } = withChick();
    const id = state.park[0].id;
    const rich = { ...state, gold: 10_000 };
    // 5 dakika dolmadan geliştirilemez.
    const early = gameReducer({ ...rich, now: hatchAt + 5 * 60_000 - 1 }, { type: 'upgradeSkill', id });
    assert.equal(early.park[0].skill, 0);
    // Civciv saniyede 1 altın kazanır; 1. seviye 2 dakikalık kazanç = 120 altın.
    const ready = { ...rich, now: hatchAt + 5 * 60_000 };
    const up = gameReducer(ready, { type: 'upgradeSkill', id });
    assert.equal(up.park[0].skill, 1);
    assert.equal(up.gold, ready.gold - 120);
    // 2. seviye için 30 dakika dolmalı.
    assert.equal(gameReducer(up, { type: 'upgradeSkill', id }).park[0].skill, 1);
  });

  it('altın yetmezse ya da en üst seviyedeyse geliştirilemez', () => {
    const { state, hatchAt } = withChick();
    const later = { ...state, now: hatchAt + 3 * HOUR };
    const id = state.park[0].id;
    assert.equal(gameReducer({ ...later, gold: 0 }, { type: 'upgradeSkill', id }).park[0].skill, 0);
    const maxed = { ...later, gold: 1e9, park: [{ ...later.park[0], skill: 3 }] };
    assert.equal(gameReducer(maxed, { type: 'upgradeSkill', id }), maxed);
  });

  it('yetenek kazancı artırır ama üzgün hayvanda çalışmaz', () => {
    const { state, hatchAt } = withChick();
    // Köpek, 3. seviye Gösteri (+%75): 36 yerine 63 altın.
    const dog = { ...state.park[0], level: 4, skill: 3, nextDropAt: hatchAt + 3000 };
    const at = (fullness: number) => {
      const fedAt = hatchAt + 3000 - (1 - fullness) * HUNGER_SEC * 1000;
      const s = gameReducer({ ...state, park: [{ ...dog, fedAt }] }, { type: 'tick', now: hatchAt + 3000 });
      return s.gold - state.gold;
    };
    assert.equal(at(0.8), 63);
    assert.equal(at(0.3), 32);
    // Üzgün: yetenek yok, 36 altının onda biri.
    assert.equal(at(0.1), 4);
  });

  it('kaçan hayvanın yumurtası yetenek seviyesini korur, yumurtadan çıkınca geri gelir', () => {
    const { state, hatchAt } = withChick();
    const skilled = { ...state, park: [{ ...state.park[0], skill: 2 }] };
    const escapeAt = hatchAt + (HUNGER_SEC + ESCAPE_AFTER_EMPTY_SEC) * 1000;
    let s = gameReducer(skilled, { type: 'tick', now: escapeAt });
    assert.equal(s.grid[0]?.skill, 2);
    s = gameReducer(s, { type: 'incubate', from: 0, slot: 0 });
    s = gameReducer(s, { type: 'tick', now: escapeAt + ANIMALS[0].incubationSec * 1000 });
    assert.equal(s.park[0].skill, 2);
  });
});

describe('kayıt', () => {
  it('kaydedilen oyun aynen geri yüklenir', () => {
    const { state } = withChick();
    assert.deepEqual(parseSave(serializeSave(state), 'blue'), state);
  });

  it('kayıt yoksa, bozuksa ya da sürümü farklıysa null döner', () => {
    assert.equal(parseSave(null, 'red'), null);
    assert.equal(parseSave('{bozuk', 'red'), null);
    assert.equal(parseSave(JSON.stringify({ version: SAVE_VERSION + 1, state: {} }), 'red'), null);
  });

  it('eski kayıtta olmayan alanlar başlangıç değerini alır', () => {
    const { state } = withChick();
    const { awayGold: _, ...old } = state;
    const loaded = parseSave(JSON.stringify({ version: SAVE_VERSION, state: old }), 'red');
    assert.equal(loaded?.awayGold, 0);
    assert.equal(loaded?.gold, state.gold);
  });

  it('yükseltmeler kaydedilir; eski kayıtta olmayan yükseltmeler 0 olur', () => {
    const state = withUpgrades(createInitialState(T0, 'red'), { incubatorSlot: 1, autoEgg: 2 });
    assert.deepEqual(parseSave(serializeSave(state), 'red'), state);
    const { upgrades: _, ...old } = createInitialState(T0, 'red');
    const loaded = parseSave(JSON.stringify({ version: SAVE_VERSION, state: old }), 'red');
    assert.equal(loaded?.upgrades.betterEgg, 0);
  });

  it('yüklenen oyun, kapalı kalınan sürenin altınını alır', () => {
    const { state, hatchAt } = withChick();
    const loaded = parseSave(serializeSave(state), 'red')!;
    let next = gameReducer(createInitialState(hatchAt + 60 * 60_000, 'red'), { type: 'load', state: loaded });
    next = gameReducer(next, { type: 'tick', now: hatchAt + 60 * 60_000 });
    assert.equal(next.awayGold, 3600);
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

  it('bekleme sürelerini kabaca yazar', () => {
    assert.equal(formatWait(20), '1 dk');
    assert.equal(formatWait(95), '2 dk');
    assert.equal(formatWait(5400), '1 sa 30 dk');
    assert.equal(formatWait(7200), '2 sa');
  });
});
