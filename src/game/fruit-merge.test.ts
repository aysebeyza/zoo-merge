import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canDrop,
  createFruitGame,
  dropFruit,
  FRUIT_GAME,
  fruitsOf,
  rewardFraction,
  stepFruitGame,
  timeLeftSec,
} from './fruit-merge.ts';

/** roll 0: bırakılan meyve hep kiraz olur. */
const CHERRY = 0;

describe('meyve birleştirme', () => {
  it('bırakılan meyve düşer ve yerde durur', () => {
    const game = createFruitGame(CHERRY);
    dropFruit(game, 150, CHERRY);
    stepFruitGame(game, 3000);
    const [fruit] = fruitsOf(game);
    assert.equal(fruit.level, 1);
    assert.ok(fruit.y > FRUIT_GAME.height - 20, `meyve yerde değil: y=${fruit.y}`);
  });

  it('iki aynı meyve değince bir büyüğüne dönüşür ve puan verir', () => {
    const game = createFruitGame(CHERRY);
    dropFruit(game, 150, CHERRY);
    stepFruitGame(game, 600);
    dropFruit(game, 150, CHERRY);
    stepFruitGame(game, 3000);
    const fruits = fruitsOf(game);
    assert.equal(fruits.length, 1);
    assert.equal(fruits[0].level, 2);
    assert.equal(game.score, 5);
  });

  it('farklı meyveler birleşmez', () => {
    const game = createFruitGame(CHERRY);
    dropFruit(game, 150, 0.99);
    stepFruitGame(game, 600);
    dropFruit(game, 150, CHERRY);
    stepFruitGame(game, 3000);
    assert.deepEqual(fruitsOf(game).map((f) => f.level).sort(), [1, 4]);
    assert.equal(game.score, 0);
  });

  it('art arda çok hızlı bırakılamaz', () => {
    const game = createFruitGame(CHERRY);
    assert.equal(dropFruit(game, 100, CHERRY), true);
    assert.equal(canDrop(game), false);
    assert.equal(dropFruit(game, 200, CHERRY), false);
    stepFruitGame(game, FRUIT_GAME.dropCooldownMs + 20);
    assert.equal(canDrop(game), true);
  });

  it('düzensiz kare süreleriyle de meyveler alanın içinde kalır', () => {
    // Yavaş telefonda ya da arka planda kareler 250 ms'ye kadar uzayabilir.
    const game = createFruitGame(0.5);
    for (const x of [149, 149, 82, 216, 149, 120, 192, 149]) {
      dropFruit(game, x, 0.5);
      for (const ms of [250, 37, 250, 113, 250]) stepFruitGame(game, ms);
    }
    for (const f of fruitsOf(game)) {
      assert.ok(f.x >= 0 && f.x <= FRUIT_GAME.width, `meyve yanlardan çıktı: x=${f.x}`);
      assert.ok(f.y >= 0 && f.y <= FRUIT_GAME.height, `meyve alttan ya da üstten çıktı: y=${f.y}`);
    }
  });

  it('meyve kenardan taşmaz', () => {
    const game = createFruitGame(CHERRY);
    dropFruit(game, -500, CHERRY);
    stepFruitGame(game, 2000);
    assert.ok(fruitsOf(game)[0].x >= 0);
  });

  it('süre bitince oyun biter', () => {
    const game = createFruitGame(CHERRY);
    stepFruitGame(game, FRUIT_GAME.durationSec * 1000);
    assert.equal(game.ended, true);
    assert.equal(timeLeftSec(game), 0);
    assert.equal(dropFruit(game, 150, CHERRY), false);
  });

  it('ödül en az %10, hedef puanda %30 ve daha fazla olmaz', () => {
    assert.equal(rewardFraction(0), 0.1);
    assert.equal(rewardFraction(FRUIT_GAME.targetScore), 0.3);
    assert.equal(rewardFraction(FRUIT_GAME.targetScore * 10), 0.3);
  });
});
