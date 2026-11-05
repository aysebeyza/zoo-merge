import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ANIMALS,
  diamondsForNewAnimal,
  AUTO_FEEDER_REFUND,
  BASKET_CAP,
  BASKET_EVERY_SEC,
  BASKET_START,
  FOOD_MIN_PRICE,
  TASTES,
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
  basketCap,
  createInitialState as createNewGame,
  foodPrice,
  foodStock,
  fullnessAt,
  hungryAt,
  missingFood,
  wantedFood,
  nextBasketEggAt,
  gameReducer,
  goldPerSecond,
  type Egg,
  type GameState,
} from './state.ts';
import { goldMultiplier, mixVariants, newVariant, NORMAL } from './variant.ts';

const T0 = 1_000_000;
const SHINY = { shiny: true };
/** Civcivin altın düşürme aralığı ve miktarı; testler sayıları tablodan alır, tablo değişse de bozulmaz. */
const CHICK_EVERY_MS = ANIMALS[0].dropEverySec * 1000;
const CHICK_DROP = ANIMALS[0].dropAmount;
const CHICK_PER_SEC = CHICK_DROP / ANIMALS[0].dropEverySec;
/** Zürafa: büyük sayılarla çarpanlar (yarı, onda bir) yuvarlamaya takılmadan denenir. */
const GIRAFFE = ANIMALS[8];

/** Bu testler oyunun kurallarını dener; ilk oyun rehberi (kısa kuluçkalar) tutorial.test.ts'te. */
function createInitialState(now: number): GameState {
  return { ...createNewGame(now), tutorialStep: null };
}

function egg(id: number, level: number, shiny = false): Egg {
  return { id, level, variant: shiny ? SHINY : NORMAL };
}

function withGrid(state: GameState, eggs: Record<number, Egg>): GameState {
  const grid = [...state.grid];
  for (const [cell, e] of Object.entries(eggs)) grid[Number(cell)] = e;
  return { ...state, grid, nextId: 100 };
}

describe('parlak yumurta', () => {
  it('yeni yumurta küçük bir şansla parlak gelir', () => {
    assert.deepEqual(newVariant(0.01), SHINY);
    assert.deepEqual(newVariant(0.5), NORMAL);
    assert.deepEqual(newVariant(), NORMAL);
  });

  it('birleştirince parlaklık korunur', () => {
    assert.deepEqual(mixVariants(NORMAL, NORMAL), NORMAL);
    assert.deepEqual(mixVariants(SHINY, NORMAL), SHINY);
    assert.deepEqual(mixVariants(NORMAL, SHINY), SHINY);
  });

  it('parlak hayvan %50 fazla kazandırır', () => {
    assert.equal(goldMultiplier(NORMAL), 1);
    assert.equal(goldMultiplier(SHINY), 1.5);
  });

  it('her hayvanın yumurta rengi farklı', () => {
    const colors = ANIMALS.map((a) => a.eggColor);
    assert.equal(new Set(colors).size, ANIMALS.length);
  });
});

describe('yumurta sepeti', () => {
  it('sepetten alınan yumurta ilk boş kutuya gelir, altın harcanmaz', () => {
    const state = gameReducer(createInitialState(T0), { type: 'takeEgg' });
    assert.equal(state.gold, START_GOLD);
    assert.equal(state.basket, BASKET_START - 1);
    assert.deepEqual(state.grid[0], egg(1, 1));
  });

  it('şans tutarsa alınan yumurta parlak olur', () => {
    const state = gameReducer(createInitialState(T0), { type: 'takeEgg', shinyRoll: 0.01 });
    assert.equal(state.grid[0]?.variant.shiny, true);
  });

  it('sepet boşsa ya da alan doluysa yumurta alınamaz', () => {
    const empty = { ...createInitialState(T0), basket: 0 };
    assert.equal(gameReducer(empty, { type: 'takeEgg' }), empty);
    const fresh = createInitialState(T0);
    const full = { ...fresh, grid: fresh.grid.map((_, i) => egg(200 + i, 3)) };
    assert.equal(gameReducer(full, { type: 'takeEgg' }), full);
  });

  it('Tavuk Anne aralıklarla sepete yumurta bırakır, oyun kapalıyken de', () => {
    const state = { ...createInitialState(T0), basket: 0 };
    const every = BASKET_EVERY_SEC * 1000;
    assert.equal(gameReducer(state, { type: 'tick', now: T0 + every - 1 }).basket, 0);
    assert.equal(gameReducer(state, { type: 'tick', now: T0 + every }).basket, 1);
    assert.equal(gameReducer(state, { type: 'tick', now: T0 + 5 * every + 10 }).basket, 5);
  });

  it('sepet dolunca durur; yer açılınca sayaç baştan başlar', () => {
    const state = { ...createInitialState(T0), basket: 0 };
    const every = BASKET_EVERY_SEC * 1000;
    // Bir gece boyunca kapalı kaldı: sepet taşmaz.
    const morning = gameReducer(state, { type: 'tick', now: T0 + 12 * HOUR });
    assert.equal(morning.basket, BASKET_CAP[0]);
    const taken = gameReducer(morning, { type: 'takeEgg' });
    assert.equal(taken.basket, BASKET_CAP[0] - 1);
    assert.equal(nextBasketEggAt(taken), morning.now + every);
  });

  it('Büyük sepet yükseltmesi sepeti büyütür, yumurta hızı değişmez', () => {
    const state = withUpgrades({ ...createInitialState(T0), basket: 0 }, { biggerBasket: 3 });
    const every = BASKET_EVERY_SEC * 1000;
    assert.equal(gameReducer(state, { type: 'tick', now: T0 + 10 * every }).basket, 10);
    assert.equal(gameReducer(state, { type: 'tick', now: T0 + 24 * HOUR }).basket, BASKET_CAP[3]);
  });
});

describe('birleştirme', () => {
  it('aynı seviyedeki iki yumurta bir üst seviyeye çıkar, parlaklık korunur', () => {
    const state = withGrid({ ...createInitialState(T0), discovered: [1] }, { 0: egg(1, 1, true), 1: egg(2, 1) });
    const next = gameReducer(state, { type: 'moveEgg', from: 0, to: 1 });
    assert.equal(next.grid[0], null);
    assert.equal(next.grid[1]?.level, 2);
    assert.equal(next.grid[1]?.variant.shiny, true);
  });

  it('bulunmamış hayvanın yumurtası birleştirmeyle yapılamaz; yumurta yerinde kalır', () => {
    // Kedi bulundu, köpek bulunmadı: iki köpek yumurtası panda yumurtası olamaz.
    const state = withGrid({ ...createInitialState(T0), discovered: [1, 2, 3] }, { 0: egg(1, 4), 1: egg(2, 4) });
    assert.equal(gameReducer(state, { type: 'moveEgg', from: 0, to: 1 }), state);
    // İki kedi yumurtası köpek yumurtası olabilir: köpek bir sonraki hayvan.
    const cats = withGrid(state, { 0: egg(1, 3), 1: egg(2, 3) });
    assert.equal(gameReducer(cats, { type: 'moveEgg', from: 0, to: 1 }).grid[1]?.level, 4);
    // Köpek bulununca kilit açılır.
    const found = { ...state, discovered: [1, 2, 3, 4] };
    assert.equal(gameReducer(found, { type: 'moveEgg', from: 0, to: 1 }).grid[1]?.level, 5);
  });

  it('farklı seviyeler yer değiştirir', () => {
    const state = withGrid(createInitialState(T0), { 0: egg(1, 1), 1: egg(2, 2) });
    const next = gameReducer(state, { type: 'moveEgg', from: 0, to: 1 });
    assert.equal(next.grid[0]?.id, 2);
    assert.equal(next.grid[1]?.id, 1);
  });

  it('unicorn yumurtaları birleşmez', () => {
    const state = withGrid(createInitialState(T0), { 0: egg(1, 10), 1: egg(2, 10) });
    const next = gameReducer(state, { type: 'moveEgg', from: 0, to: 1 });
    assert.equal(next.grid[1]?.level, 10);
    assert.equal(next.grid[0]?.level, 10);
  });
});

describe('kuluçka ve park', () => {
  it('ilk civciv kısa sürede çıkar, yeni hayvan kutlaması ve elmas verir', () => {
    let state = withGrid(createInitialState(T0), { 0: egg(1, 1) });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    state = gameReducer(state, { type: 'tick', now: T0 + FIRST_HATCH_SEC * 1000 - 1 });
    assert.equal(state.park.length, 0);
    state = gameReducer(state, { type: 'tick', now: T0 + FIRST_HATCH_SEC * 1000 });
    assert.equal(state.park.length, 1);
    assert.equal(state.incubator[0], null);
    assert.deepEqual(state.newAnimalQueue, [1]);
    assert.equal(state.diamonds, 1);
  });

  it('yeni hayvanın elması her hayvanda 1 artar, bütün oyunda 55 elmas', () => {
    const rewards = ANIMALS.map((a) => diamondsForNewAnimal(a.level));
    assert.deepEqual(rewards, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(rewards.reduce((a, b) => a + b, 0), 55);
  });

  it('bilinen bir hayvan yeniden çıkınca elmas vermez', () => {
    let state = { ...withGrid(createInitialState(T0), { 0: egg(1, 3) }), firstHatchDone: true, discovered: [1, 2, 3] };
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    state = gameReducer(state, { type: 'tick', now: T0 + ANIMALS[2].incubationSec * 1000 });
    assert.equal(state.park.length, 1);
    assert.equal(state.diamonds, 0);
  });

  it('sonraki kuluçkalar tablodaki süreyi kullanır', () => {
    let state = { ...withGrid(createInitialState(T0), { 0: egg(1, 2) }), firstHatchDone: true };
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 1 });
    assert.equal(state.incubator[1]?.durationMs, ANIMALS[1].incubationSec * 1000);
  });

  it('park doluysa hayvan kuluçkada bekler', () => {
    let state = withGrid(createInitialState(T0), { 0: egg(1, 1) });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    const full = Array.from({ length: PARK_LIMIT }, (_, i) => ({
      id: 500 + i,
      level: 1,
      variant: NORMAL,
      nextDropAt: Infinity,
      lastDropAt: null,
      lastDropAmount: 0,
      fedAt: T0,
      skill: 0,
      parkedAt: T0,
      happiness: 0,
      petAt: 0,
      wishDoneDay: null,
      washedAt: T0,
    }));
    state = gameReducer({ ...state, park: full }, { type: 'tick', now: T0 + 60_000 });
    assert.equal(state.park.length, PARK_LIMIT);
    assert.notEqual(state.incubator[0], null);
  });

  it('hayvanlar aralıklarla altın düşürür, kaçırılan düşürmeler de sayılır', () => {
    let state = withGrid(createInitialState(T0), { 0: egg(1, 1) });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    const hatchAt = T0 + FIRST_HATCH_SEC * 1000;
    state = gameReducer(state, { type: 'tick', now: hatchAt });
    const goldAfterHatch = state.gold;
    // Uzun bir aradan sonra aradaki 5 düşürme birlikte sayılır.
    state = gameReducer(state, { type: 'tick', now: hatchAt + 5 * CHICK_EVERY_MS });
    assert.equal(state.gold - goldAfterHatch, 5 * CHICK_DROP);
  });

  it('doğaya salınan hayvan 1 dakikalık kazancını verir', () => {
    let state = withGrid(createInitialState(T0), { 0: egg(1, 1) });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    state = gameReducer(state, { type: 'tick', now: T0 + FIRST_HATCH_SEC * 1000 });
    const before = state.gold;
    state = gameReducer(state, { type: 'releaseAnimal', id: state.park[0].id });
    assert.equal(state.park.length, 0);
    assert.equal(state.gold - before, Math.round(CHICK_PER_SEC * 60));
  });
});

/** Parkta bir civcivi olan oyun; civciv 2 saniyede 2 altın düşürür. Dönen zaman, civcivin çıktığı an. */
function withChick(): { state: GameState; hatchAt: number } {
  let state = withGrid(createInitialState(T0), { 0: egg(1, 1) });
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
    assert.equal(next.gold - state.gold, CHICK_PER_SEC * 600);
    assert.equal(next.awayGold, CHICK_PER_SEC * 600);
    assert.equal(gameReducer(next, { type: 'dismissAwayGold' }).awayGold, 0);
  });

  it('en fazla 2 saatlik altın birikir, sonra hayvan normal düzenine döner', () => {
    const { state, hatchAt } = withChick();
    const away = hatchAt + 5 * 60 * 60_000;
    const back = gameReducer(state, { type: 'tick', now: away });
    // Civciv ilk 2 saatte tok (%50'nin üstünde): 2 saatlik tam kazanç.
    assert.equal(back.gold - state.gold, CHICK_PER_SEC * OFFLINE_EARNING_CAP_SEC);
    const fed = gameReducer({ ...back, food: { seed: 1 } }, { type: 'feedAnimal', id: back.park[0].id, food: 'seed' });
    const later = gameReducer(fed, { type: 'tick', now: away + CHICK_EVERY_MS });
    assert.equal(later.gold - fed.gold, CHICK_DROP);
  });

  it('kuluçka oyun kapalıyken de sürer', () => {
    let state = { ...withGrid(createInitialState(T0), { 0: egg(1, 2) }), firstHatchDone: true };
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
      const { currency, costs } = upgradeFor(id);
      const funded =
        currency === 'diamonds' ? { ...next, diamonds: next.diamonds + costs[i] } : { ...next, gold: next.gold + costs[i] };
      next = gameReducer(funded, { type: 'buyUpgrade', id });
    }
  }
  return next;
}

describe('yükseltmeler', () => {
  it('altın yetince alınır, bedeli düşer, seviye artar', () => {
    const cost = upgradeFor('moreVisitors').costs[0];
    const state = { ...createInitialState(T0), gold: cost + 5 };
    const next = gameReducer(state, { type: 'buyUpgrade', id: 'moreVisitors' });
    assert.equal(next.upgrades.moreVisitors, 1);
    assert.equal(next.gold, 5);
  });

  it('altın yetmezse ya da en üst seviyedeyse alınamaz', () => {
    const poor = { ...createInitialState(T0), gold: 0 };
    assert.equal(gameReducer(poor, { type: 'buyUpgrade', id: 'moreVisitors' }), poor);
    const maxed = withUpgrades(createInitialState(T0), { moreVisitors: upgradeFor('moreVisitors').costs.length });
    const rich = { ...maxed, gold: 1e12 };
    assert.equal(gameReducer(rich, { type: 'buyUpgrade', id: 'moreVisitors' }), rich);
  });

  it('elmaslı yükseltme elmasla alınır, altın yetmez', () => {
    const cost = upgradeFor('incubatorSlot').costs[0];
    const goldOnly = { ...createInitialState(T0), gold: 1e12, diamonds: cost - 1 };
    assert.equal(gameReducer(goldOnly, { type: 'buyUpgrade', id: 'incubatorSlot' }), goldOnly);
    const next = gameReducer({ ...goldOnly, diamonds: cost + 3 }, { type: 'buyUpgrade', id: 'incubatorSlot' });
    assert.equal(next.upgrades.incubatorSlot, 1);
    assert.equal(next.diamonds, 3);
    assert.equal(next.gold, 1e12);
  });

  it('sepet 20 yumurtayla başlar, büyük sepet her seviyede 10 artırır', () => {
    const state = createInitialState(T0);
    assert.equal(state.basket, 20);
    assert.equal(basketCap(state), 20);
    assert.equal(basketCap(withUpgrades(state, { biggerBasket: 1 })), 30);
    assert.equal(basketCap(withUpgrades(state, { biggerBasket: 4 })), 60);
  });

  it('daha iyi yumurta, şans tutunca sepetten 2. seviye yumurta çıkar', () => {
    const state = withUpgrades(createInitialState(T0), { betterEgg: 1 });
    assert.equal(gameReducer(state, { type: 'takeEgg', roll: 0.1 }).grid[0]?.level, 2);
    assert.equal(gameReducer(state, { type: 'takeEgg', roll: 0.9 }).grid[0]?.level, 1);
  });

  it('daha çok ziyaretçi altın kazancını artırır', () => {
    const { state, hatchAt } = withChick();
    const boosted = withUpgrades(state, { moreVisitors: 5 });
    const before = boosted.gold;
    const next = gameReducer(boosted, { type: 'tick', now: hatchAt + 5 * CHICK_EVERY_MS });
    // +%50 ziyaretçi: her düşürme 1,5 katı (yuvarlanır); 5 düşürme.
    assert.equal(next.gold - before, 5 * Math.round(CHICK_DROP * 1.5));
    assert.ok(next.gold - before > 5 * CHICK_DROP);
  });

  it('kuluçka makinesi süreyi kısaltır', () => {
    let state = { ...withGrid(createInitialState(T0), { 0: egg(1, 2) }), firstHatchDone: true };
    state = withUpgrades(state, { fasterIncubator: 5 });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    assert.equal(state.incubator[0]?.durationMs, ANIMALS[1].incubationSec * 1000 * 0.5);
  });

  it('kuluçka makinesi alınınca kuluçkadaki yumurtanın kalan süresi de kısalır', () => {
    let state = { ...withGrid(createInitialState(T0), { 0: egg(1, 3) }), firstHatchDone: true };
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    // Kedi 90 sn sürer; 30 sn geçince 60 sn kalır. %10 hızlanınca kalan süre 54 sn olur.
    state = gameReducer(state, { type: 'tick', now: T0 + 30_000 });
    state = withUpgrades(state, { fasterIncubator: 1 });
    assert.equal(state.incubator[0]?.durationMs, 84_000);
  });

  it('mini oyun kuluçkadaki yumurtanın kalan süresini kısaltır, yumurta başına bir kez', () => {
    let state = { ...withGrid(createInitialState(T0), { 0: egg(1, 3) }), firstHatchDone: true };
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 0 });
    // Kedi 90 sn; 30 sn sonra 60 sn kalır, %25 kısalınca 45 sn kalır.
    state = gameReducer(state, { type: 'tick', now: T0 + 30_000 });
    state = gameReducer(state, { type: 'boostIncubation', slot: 0, fraction: 0.25 });
    assert.equal(state.incubator[0]?.durationMs, 75_000);
    assert.equal(state.incubator[0]?.boosted, true);
    const again = gameReducer(state, { type: 'boostIncubation', slot: 0, fraction: 0.25 });
    assert.equal(again, state);
  });

  it('yeni kuluçka yuvası ve daha büyük park kapasiteyi artırır', () => {
    let state = withUpgrades(createInitialState(T0), { incubatorSlot: 2, biggerPark: 1 });
    assert.equal(state.incubator.length, 4);
    state = withGrid(state, { 0: egg(1, 1) });
    state = gameReducer(state, { type: 'incubate', from: 0, slot: 3 });
    const full = Array.from({ length: PARK_LIMIT }, (_, i) => ({
      id: 500 + i,
      level: 1,
      variant: NORMAL,
      nextDropAt: Infinity,
      lastDropAt: null,
      lastDropAmount: 0,
      fedAt: T0,
      skill: 0,
      parkedAt: T0,
      happiness: 0,
      petAt: 0,
      wishDoneDay: null,
      washedAt: T0,
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
    const lion = { ...state.park[0], level: GIRAFFE.level, nextDropAt: hatchAt + 3000 };
    const at = (fullness: number) => {
      const fedAt = hatchAt + 3000 - (1 - fullness) * HUNGER_SEC * 1000;
      const s = gameReducer({ ...state, park: [{ ...lion, fedAt }] }, { type: 'tick', now: hatchAt + 3000 });
      return s.gold - state.gold;
    };
    assert.equal(at(0.8), GIRAFFE.dropAmount);
    assert.equal(at(0.3), Math.round(GIRAFFE.dropAmount * 0.5));
    assert.equal(at(0.1), Math.round(GIRAFFE.dropAmount * 0.1));
    assert.equal(at(0), 0);
  });

  it('dükkândan yiyecek alınır; fiyat parkın 30 saniyelik kazancı, en az 20 altın', () => {
    const { state } = withChick();
    assert.equal(foodPrice(state), FOOD_MIN_PRICE);
    const bought = gameReducer({ ...state, gold: 1000 }, { type: 'buyFood', food: 'seed' });
    assert.equal(bought.gold, 1000 - FOOD_MIN_PRICE);
    assert.equal(foodStock(bought, 'seed'), 1);
    const poor = { ...state, gold: 10 };
    assert.equal(gameReducer(poor, { type: 'buyFood', food: 'seed' }), poor);
  });

  it('hayvan yediği yiyecekle tamamen doyar, stoktan bir tane gider', () => {
    const { state, hatchAt } = withChick();
    const hungry = gameReducer({ ...state, food: { seed: 2 } }, { type: 'tick', now: hatchAt + 3 * HOUR });
    const fed = gameReducer(hungry, { type: 'feedAnimal', id: hungry.park[0].id, food: 'seed' });
    assert.equal(fullnessAt(fed.park[0], fed.now), 1);
    assert.equal(foodStock(fed, 'seed'), 1);
  });

  it('sevmediği yiyeceği yemez; yiyecek yoksa ya da tok ise beslenmez', () => {
    const { state, hatchAt } = withChick();
    const id = state.park[0].id;
    const hungry = gameReducer(state, { type: 'tick', now: hatchAt + 3 * HOUR });
    assert.equal(gameReducer(hungry, { type: 'feedAnimal', id, food: 'seed' }), hungry);
    // Civciv peynir sevmez: yemez, peynir stokta kalır, sevmediği öğrenilir.
    const dislike = TASTES[1].dislikes[0];
    const offered = gameReducer({ ...hungry, food: { [dislike]: 1 } }, { type: 'feedAnimal', id, food: dislike });
    assert.equal(foodStock(offered, dislike), 1);
    assert.equal(offered.park[0].fedAt, hungry.park[0].fedAt);
    assert.deepEqual(offered.triedFoods[1], [dislike]);
    const full = { ...state, food: { seed: 5 } };
    assert.equal(gameReducer(full, { type: 'feedAnimal', id, food: 'seed' }), full);
  });

  it('uzun süre aç kalan hayvan kaçar ve parlaklığını koruyarak yumurtasına döner', () => {
    const { state, hatchAt } = withChick();
    const shiny = { ...state.park[0], variant: SHINY };
    const escapeAt = hatchAt + (HUNGER_SEC + ESCAPE_AFTER_EMPTY_SEC) * 1000;
    const before = gameReducer({ ...state, park: [shiny] }, { type: 'tick', now: escapeAt - 1 });
    assert.equal(before.park.length, 1);
    const after = gameReducer(before, { type: 'tick', now: escapeAt });
    assert.equal(after.park.length, 0);
    assert.equal(after.grid[0]?.level, 1);
    assert.equal(after.grid[0]?.variant.shiny, true);
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

  it('hayvanın ne zaman acıkacağı hesaplanır: tokluğun yarısı bitince', () => {
    const { state, hatchAt } = withChick();
    assert.equal(hungryAt(state.park[0]), hatchAt + HUNGER_SEC * 500);
  });

  it('eksik yiyecekler: her hayvana istediği yiyecekten birer tane', () => {
    const { state } = withChick();
    const cat = { ...state.park[0], level: 3 };
    const park = [state.park[0], { ...cat, id: 50 }, { ...cat, id: 51 }, { ...cat, id: 52 }];
    const s = { ...state, park, discovered: [1, 3], food: {} };
    const chickWants = wantedFood(park[0], s.now);
    const catWants = wantedFood(park[1], s.now);
    assert.deepEqual(missingFood(s), { items: { [chickWants]: 1, [catWants]: 3 }, cost: 4 * foodPrice(s) });
    // Stokta 1 tane varsa o eksikten düşer.
    const stocked = { ...s, food: { [catWants]: 1 } };
    assert.equal(missingFood(stocked).items[catWants], 2);
  });

  it('istediklerini al, altın yetiyorsa eksiklerin hepsini birden alır', () => {
    const { state } = withChick();
    const s = { ...state, park: [state.park[0], { ...state.park[0], id: 50 }], gold: 1000 };
    const wants = wantedFood(state.park[0], s.now);
    const bought = gameReducer(s, { type: 'buyMissingFood' });
    assert.equal(foodStock(bought, wants), 2);
    assert.equal(bought.gold, 1000 - 2 * foodPrice(s));
    // Eksik kalmadı, tekrar basınca bir şey olmaz; altın yetmezse de olmaz.
    assert.equal(gameReducer(bought, { type: 'buyMissingFood' }), bought);
    const poor = { ...s, gold: 10 };
    assert.equal(gameReducer(poor, { type: 'buyMissingFood' }), poor);
  });

  it('kaldırılan otomatik yemliği almış eski kayda bedeli iade edilir, yalnızca bir kez', () => {
    const { state } = withChick();
    const old = { ...state, upgrades: { ...state.upgrades, autoFeeder: 1 } };
    const loaded = parseSave(JSON.stringify({ version: SAVE_VERSION, state: old }))!;
    assert.equal(loaded.gold, state.gold + AUTO_FEEDER_REFUND);
    assert.equal('autoFeeder' in loaded.upgrades, false);
    assert.equal(parseSave(serializeSave(loaded))!.gold, loaded.gold);
  });
});

describe('yetenekler', () => {
  it('tam gelişmiş yetenek dokümandaki oranlarda kazandırır', () => {
    // Doküman: Sevimlilik +%100, Gösteri +%75, Görkem +%60, Sihir +%45 (kedi, tilki, zürafa, unicorn).
    const ratio = (level: number) =>
      goldPerSecond({ level, variant: NORMAL, skill: 3 }) / goldPerSecond({ level, variant: NORMAL, skill: 0 });
    assert.equal(ratio(3), 2);
    assert.equal(ratio(6), 1.75);
    assert.equal(ratio(9), 1.6);
    assert.equal(ratio(10), 1.45);
  });

  it('seviye parkta kalma süresi dolunca açılır ve hayvanın kazancına göre ücretlidir', () => {
    const { state, hatchAt } = withChick();
    const id = state.park[0].id;
    const rich = { ...state, gold: 10_000 };
    // 5 dakika dolmadan geliştirilemez.
    const early = gameReducer({ ...rich, now: hatchAt + 5 * 60_000 - 1 }, { type: 'upgradeSkill', id });
    assert.equal(early.park[0].skill, 0);
    // 1. seviyenin bedeli civcivin 2 dakikalık kazancı.
    const ready = { ...rich, now: hatchAt + 5 * 60_000 };
    const up = gameReducer(ready, { type: 'upgradeSkill', id });
    assert.equal(up.park[0].skill, 1);
    assert.equal(up.gold, ready.gold - Math.ceil(CHICK_PER_SEC * 120));
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
    // Zürafa, 3. seviye Görkem (+%60).
    const lion = { ...state.park[0], level: GIRAFFE.level, skill: 3, nextDropAt: hatchAt + 3000 };
    const at = (fullness: number) => {
      const fedAt = hatchAt + 3000 - (1 - fullness) * HUNGER_SEC * 1000;
      const s = gameReducer({ ...state, park: [{ ...lion, fedAt }] }, { type: 'tick', now: hatchAt + 3000 });
      return s.gold - state.gold;
    };
    const skilled = Math.round(GIRAFFE.dropAmount * 1.6);
    assert.equal(at(0.8), skilled);
    assert.equal(at(0.3), Math.round(skilled * 0.5));
    // Üzgün: yetenek çalışmaz, normal kazancın onda biri.
    assert.equal(at(0.1), Math.round(GIRAFFE.dropAmount * 0.1));
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

describe('renk karışımı döneminden kalan kayıt', () => {
  it('desenli yumurta ve hayvan parlak olur, saf ve düz renkler normal olur', () => {
    const old = (pure: boolean, patterned: boolean) => ({ color: 'purple', pure, patterned });
    const { state } = withChick();
    const saved = {
      ...state,
      nextEggColor: 'red',
      grid: state.grid.map((_, i) =>
        i === 0 ? { id: 1, level: 2, variant: old(false, true) } : i === 1 ? { id: 2, level: 2, variant: old(true, false) } : null,
      ),
      park: [{ ...state.park[0], variant: old(false, true) }],
    };
    const loaded = parseSave(JSON.stringify({ version: SAVE_VERSION, state: saved }))!;
    assert.deepEqual(loaded.grid[0]?.variant, SHINY);
    assert.deepEqual(loaded.grid[1]?.variant, NORMAL);
    assert.deepEqual(loaded.park[0].variant, SHINY);
    assert.equal('nextEggColor' in loaded, false);
  });
});

describe('kayıt', () => {
  it('kaydedilen oyun aynen geri yüklenir', () => {
    const { state } = withChick();
    assert.deepEqual(parseSave(serializeSave(state)), state);
  });

  it('kayıt yoksa, bozuksa ya da sürümü farklıysa null döner', () => {
    assert.equal(parseSave(null), null);
    assert.equal(parseSave('{bozuk'), null);
    assert.equal(parseSave(JSON.stringify({ version: SAVE_VERSION + 1, state: {} })), null);
  });

  it('eski kayıtta olmayan alanlar başlangıç değerini alır', () => {
    const { state } = withChick();
    const { awayGold: _, ...old } = state;
    const loaded = parseSave(JSON.stringify({ version: SAVE_VERSION, state: old }));
    assert.equal(loaded?.awayGold, 0);
    assert.equal(loaded?.gold, state.gold);
  });

  it('yükseltmeler kaydedilir; eski kayıtta olmayan yükseltmeler 0 olur', () => {
    const state = withUpgrades(createInitialState(T0), { incubatorSlot: 1, moreVisitors: 2 });
    assert.deepEqual(parseSave(serializeSave(state)), state);
    const { upgrades: _, ...old } = createInitialState(T0);
    const loaded = parseSave(JSON.stringify({ version: SAVE_VERSION, state: old }));
    assert.equal(loaded?.upgrades.betterEgg, 0);
  });

  it('kaldırılan Tavuk Anne yükseltmesine harcanan altın iade edilir', () => {
    const state = createInitialState(T0);
    const old = { ...state, upgrades: { ...state.upgrades, fasterHen: 2 } };
    const loaded = parseSave(JSON.stringify({ version: SAVE_VERSION, state: old }));
    assert.equal(loaded?.gold, state.gold + 500 + 5_000);
    assert.equal('fasterHen' in (loaded?.upgrades ?? {}), false);
  });

  it('altınla yumurta dönemindeki kayıt: otomatik yumurta bedeli iade edilir, sepet dolu başlar', () => {
    const fresh = createInitialState(T0);
    const { basket: _b, basketFilledAt: _f, ...rest } = fresh;
    const old = { ...rest, eggsBought: 120, nextAutoEggAt: T0, upgrades: { ...fresh.upgrades, autoEgg: 2 } };
    const loaded = parseSave(JSON.stringify({ version: SAVE_VERSION, state: old }))!;
    assert.equal(loaded.gold, fresh.gold + 150 + 2_000);
    assert.equal(loaded.basket, BASKET_START);
    assert.equal('eggsBought' in loaded, false);
    assert.equal('autoEgg' in loaded.upgrades, false);
  });

  it('yüklenen oyun, kapalı kalınan sürenin altınını alır', () => {
    const { state, hatchAt } = withChick();
    const loaded = parseSave(serializeSave(state))!;
    let next = gameReducer(createInitialState(hatchAt + 60 * 60_000), { type: 'load', state: loaded });
    next = gameReducer(next, { type: 'tick', now: hatchAt + 60 * 60_000 });
    assert.equal(next.awayGold, CHICK_PER_SEC * 3600);
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
