// Meyve birleştirme mini oyunu: yukarıdan meyve bırakılır, aynı iki meyve değince bir büyüğüne dönüşür.
// Kuluçkadaki yumurtanın süresini kısaltmak için oynanır. Fizik matter-js ile; ekrandan bağımsızdır.

import Matter from 'matter-js';

export type FruitConfig = { emoji: string; name: string; radius: number };

/** Küçükten büyüğe meyveler. İki aynı meyve bir sonrakine dönüşür; iki karpuz birleşince ikisi de patlar. */
export const FRUITS: readonly FruitConfig[] = [
  { emoji: '🍒', name: 'Kiraz', radius: 12 },
  { emoji: '🍓', name: 'Çilek', radius: 16 },
  { emoji: '🍇', name: 'Üzüm', radius: 21 },
  { emoji: '🍊', name: 'Portakal', radius: 26 },
  { emoji: '🍎', name: 'Elma', radius: 32 },
  { emoji: '🍐', name: 'Armut', radius: 38 },
  { emoji: '🍑', name: 'Şeftali', radius: 45 },
  { emoji: '🍍', name: 'Ananas', radius: 52 },
  { emoji: '🍈', name: 'Kavun', radius: 60 },
  { emoji: '🍉', name: 'Karpuz', radius: 70 },
];

export const FRUIT_GAME = {
  /** Oyun alanı, birim cinsinden; ekranda telefon genişliğine göre büyütülür. */
  width: 300,
  height: 420,
  /** Meyvelerin bırakıldığı yükseklik. */
  dropY: 30,
  /** Bu çizginin üstünde duran meyve "kutu doldu" demek; oyun erken biter. */
  overflowY: 60,
  durationSec: 30,
  /** Bırakılan meyve en fazla bu seviyede olur (kiraz-portakal). */
  dropMaxLevel: 4,
  /** Art arda bırakma arasında beklenmesi gereken süre. */
  dropCooldownMs: 450,
  /** Bu puana ulaşan en büyük ödülü alır. */
  targetScore: 150,
  /** Ödül: kalan kuluçka süresinin kısalan oranı. Kaybetme yok, en kötü oyunda bile en az bu kadar. */
  minReward: 0.1,
  maxReward: 0.3,
} as const;

const STEP_MS = 1000 / 60;

export type FruitGame = {
  engine: Matter.Engine;
  /** Meyve gövdelerinin seviyesi (1 = kiraz). */
  levels: Map<number, number>;
  /** Meyvenin oyuna girdiği an; yeni düşen meyve "kutu doldu" sayılmasın diye. */
  bornAt: Map<number, number>;
  time: number;
  /** Henüz adıma dönüşmemiş süre; fizik hep eşit adımlarla ilerler. */
  pending: number;
  lastDropAt: number;
  score: number;
  /** Sıradaki bırakılacak meyvenin seviyesi; ekranda önceden görünür. */
  nextLevel: number;
  /** Birleşme anları; ekranda kısa bir parlama göstermek için. */
  pops: { x: number; y: number; level: number; at: number }[];
  ended: boolean;
};

/** roll: 0 ile 1 arası rastgele sayı; ilk meyvenin seviyesi için. */
export function createFruitGame(roll: number): FruitGame {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0012 } });
  const { width, height } = FRUIT_GAME;
  const wall = { isStatic: true, friction: 0.2, restitution: 0.1 };
  Matter.Composite.add(engine.world, [
    Matter.Bodies.rectangle(width / 2, height + 25, width + 100, 50, wall),
    Matter.Bodies.rectangle(-25, height / 2, 50, height * 3, wall),
    Matter.Bodies.rectangle(width + 25, height / 2, 50, height * 3, wall),
  ]);
  return {
    engine,
    levels: new Map(),
    bornAt: new Map(),
    time: 0,
    pending: 0,
    lastDropAt: -Infinity,
    score: 0,
    nextLevel: dropLevel(roll),
    pops: [],
    ended: false,
  };
}

function dropLevel(roll: number): number {
  return 1 + Math.min(FRUIT_GAME.dropMaxLevel - 1, Math.floor(roll * FRUIT_GAME.dropMaxLevel));
}

function addFruit(game: FruitGame, level: number, x: number, y: number): Matter.Body {
  const radius = FRUITS[level - 1].radius;
  const body = Matter.Bodies.circle(x, y, radius, { restitution: 0.15, friction: 0.1, density: 0.001 });
  game.levels.set(body.id, level);
  game.bornAt.set(body.id, game.time);
  Matter.Composite.add(game.engine.world, body);
  return body;
}

export function canDrop(game: FruitGame): boolean {
  return !game.ended && game.time - game.lastDropAt >= FRUIT_GAME.dropCooldownMs;
}

/** Sıradaki meyveyi x hizasından bırakır. roll: bir sonraki meyvenin seviyesi için rastgele sayı. */
export function dropFruit(game: FruitGame, x: number, roll: number): boolean {
  if (!canDrop(game)) return false;
  const radius = FRUITS[game.nextLevel - 1].radius;
  const clamped = Math.min(FRUIT_GAME.width - radius, Math.max(radius, x));
  addFruit(game, game.nextLevel, clamped, FRUIT_GAME.dropY);
  game.lastDropAt = game.time;
  game.nextLevel = dropLevel(roll);
  return true;
}

/** Puan: birleşmeyle ortaya çıkan meyve büyüdükçe artar (kiraz+kiraz = 5, çilek+çilek = 10 ...). */
export function mergePoints(newLevel: number): number {
  return (newLevel - 1) * 5;
}

/**
 * Oyunu ms kadar ilerletir: fizik, birleşmeler, süre ve "kutu doldu" kontrolü.
 * Fizik hep eşit adımlarla ilerler; artan süre bir sonraki çağrıya kalır. Farklı uzunlukta adımlar
 * matter-js'te meyvelerin birbirine çarpınca fırlamasına yol açıyordu.
 */
export function stepFruitGame(game: FruitGame, ms: number): void {
  if (game.ended) return;
  game.pending += ms;
  // Küçük pay: 30.000 ms ondalık hata yüzünden 1.799,99 adım etmesin.
  while (game.pending >= STEP_MS - 1e-6 && !game.ended) {
    Matter.Engine.update(game.engine, STEP_MS);
    game.time += STEP_MS;
    game.pending -= STEP_MS;
    mergeTouching(game);
    // Eşit adımların toplamı ondalık hesap yüzünden 29.9999 sn'de kalabilir; yarım adım pay bırakılır.
    if (game.time >= FRUIT_GAME.durationSec * 1000 - STEP_MS / 2 || overflowing(game)) game.ended = true;
  }
  game.pops = game.pops.filter((p) => game.time - p.at < 400);
}

/** Birbirine değen aynı meyveleri birleştirir. Bir meyve bir adımda yalnızca bir kez birleşir. */
function mergeTouching(game: FruitGame): void {
  const used = new Set<number>();
  for (const pair of game.engine.pairs.list) {
    if (!pair.isActive) continue;
    const { bodyA: a, bodyB: b } = pair;
    const level = game.levels.get(a.id);
    if (level === undefined || level !== game.levels.get(b.id) || used.has(a.id) || used.has(b.id)) continue;
    used.add(a.id);
    used.add(b.id);
    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    removeFruit(game, a);
    removeFruit(game, b);
    if (level < FRUITS.length) {
      addFruit(game, level + 1, x, y);
      game.score += mergePoints(level + 1);
    } else {
      // İki karpuz: ikisi de patlar, büyük bonus.
      game.score += mergePoints(FRUITS.length) * 2;
    }
    game.pops.push({ x, y, level: Math.min(level + 1, FRUITS.length), at: game.time });
  }
}

function removeFruit(game: FruitGame, body: Matter.Body): void {
  Matter.Composite.remove(game.engine.world, body);
  game.levels.delete(body.id);
  game.bornAt.delete(body.id);
}

/** Bir saniyeden uzun süredir oyunda olan ve neredeyse duran bir meyve çizginin üstündeyse kutu dolmuştur. */
function overflowing(game: FruitGame): boolean {
  return fruitBodies(game).some(
    (body) =>
      game.time - (game.bornAt.get(body.id) ?? 0) > 1000 &&
      body.speed < 0.3 &&
      body.position.y - FRUITS[game.levels.get(body.id)! - 1].radius < FRUIT_GAME.overflowY,
  );
}

function fruitBodies(game: FruitGame): Matter.Body[] {
  return Matter.Composite.allBodies(game.engine.world).filter((b) => game.levels.has(b.id));
}

/** Ekranda çizilecek meyveler. */
export function fruitsOf(game: FruitGame): { id: number; level: number; x: number; y: number; angle: number }[] {
  return fruitBodies(game).map((b) => ({
    id: b.id,
    level: game.levels.get(b.id)!,
    x: b.position.x,
    y: b.position.y,
    angle: b.angle,
  }));
}

export function timeLeftSec(game: FruitGame): number {
  return Math.max(0, FRUIT_GAME.durationSec - game.time / 1000);
}

/** Puana göre kuluçka süresinden kısalacak oran: en az %10, hedef puanda %30. */
export function rewardFraction(score: number): number {
  const { minReward, maxReward, targetScore } = FRUIT_GAME;
  return minReward + (maxReward - minReward) * Math.min(1, score / targetScore);
}
