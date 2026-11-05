// Oyun dengesini ölçen simülasyon: oyunun gerçek kurallarıyla, akıllı bir oyuncu gibi oynar ve
// her hayvanın ne zaman çıktığını yazar. Çalıştırma: npm run sim
//
// İki oyuncu ölçülür:
// - Aralıksız oynayan: hiç ara vermeden oynar.
// - Günde 3 kez oynayan: 08:00, 15:00 ve 20:00'de 20'şer dakika oynar; arada oyun kapalıdır.

import { ANIMALS, MAX_LEVEL, upgradeCost, upgradeFor, UPGRADES, type UpgradeId } from '../src/game/config.ts';
import { formatNumber } from '../src/game/format.ts';
import {
  canAffordUpgrade,
  canBoost,
  canFeed,
  canMerge,
  createInitialState,
  foodPrice,
  foodStock,
  isDirty,
  wantedFood,
  fullnessAt,
  gameReducer,
  hungryAt,
  skillCost,
  skillUnlockAt,
  stateIncomeBonus,
  stateParkLimit,
  type GameAction,
  type GameState,
} from '../src/game/state.ts';

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Mini oyunda ortalama bir çocuğun aldığı ödül (en az %10, en çok %30). */
const MINI_GAME_REWARD = 0.2;

/** Tekrarlanabilir rastgele sayılar: her çalıştırmada aynı sonuç çıksın. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simülasyon boyunca alınan yükseltmeler: hangisi, kaçıncı seviye, ne zaman. */
let purchases: { id: UpgradeId; level: number; at: number }[] = [];

/** Oyuncunun bir anda yapabildiği her şeyi yapar; değişiklik kalmayınca durur. */
function play(state: GameState, random: () => number): GameState {
  let s = state;
  const run = (action: GameAction) => {
    const next = gameReducer(s, action);
    const changed = next !== s;
    s = next;
    return changed;
  };

  for (let guard = 0; guard < 300; guard++) {
    let changed = false;

    // 0. Ziyaretçilerin bahşişlerini topla.
    if (s.tipUntil !== null) changed = run({ type: 'collectTip' }) || changed;

    // 1. Acıkan hayvanları besle; yemi yoksa önce al.
    for (const animal of s.park) {
      if (s.now < hungryAt(animal)) continue;
      // Bugün istediği yiyeceği (yoksa en bilinen yiyeceğini) verir.
      const food = wantedFood(animal, s.now);
      if (foodStock(s, food) === 0 && s.gold >= foodPrice(s)) changed = run({ type: 'buyFood', food }) || changed;
      if (canFeed(s, animal)) changed = run({ type: 'feedAnimal', id: animal.id, food }) || changed;
    }

    // Kirlenen hayvanları yıka, kakaları temizle.
    for (const animal of s.park) if (isDirty(animal, s.now)) changed = run({ type: 'washAnimal', id: animal.id }) || changed;
    for (let level = 1; level <= MAX_LEVEL; level++) {
      while ((s.poops[level] ?? 0) > 0) changed = run({ type: 'cleanPoop', level }) || changed;
    }

    // 2. Hazır yetenekleri geliştir.
    for (const animal of s.park) {
      const unlockAt = skillUnlockAt(animal);
      const cost = skillCost(animal, stateIncomeBonus(s));
      if (unlockAt !== null && cost !== null && s.now >= unlockAt && s.gold >= cost) {
        changed = run({ type: 'upgradeSkill', id: animal.id }) || changed;
      }
    }

    // 3. Alınabilen en ucuz yükseltmeyi al (elmaslılar arasında da en ucuzu).
    // SKIP_UPGRADES=autoEgg,betterEgg gibi: o yükseltmeler hiç alınmaz; etkilerini ölçmek için.
    const skipped = (process.env.SKIP_UPGRADES ?? '').split(',');
    const affordable = UPGRADES.filter((u) => !skipped.includes(u.id))
      .filter((u) => canAffordUpgrade(s, u.id))
      .map((u) => ({ id: u.id, cost: upgradeCost(u.id, s.upgrades[u.id])!, diamonds: u.currency === 'diamonds' }))
      .sort((a, b) => Number(a.diamonds) - Number(b.diamonds) || a.cost - b.cost);
    if (affordable.length > 0 && run({ type: 'buyUpgrade', id: affordable[0].id })) {
      changed = true;
      purchases.push({ id: affordable[0].id, level: s.upgrades[affordable[0].id], at: s.now });
    }

    // 4. Aynı seviyedeki yumurtaları birleştir (küçükten başlayarak, zincirleme birleşsin).
    const byLevel = new Map<number, number[]>();
    s.grid.forEach((egg, i) => egg && byLevel.set(egg.level, [...(byLevel.get(egg.level) ?? []), i]));
    for (const [, cells] of [...byLevel].sort((a, b) => a[0] - b[0])) {
      if (cells.length >= 2 && canMerge(s.grid[cells[0]]!, s.grid[cells[1]]!, s.discovered)) {
        changed = run({ type: 'moveEgg', from: cells[0], to: cells[1] }) || changed;
        break;
      }
    }

    // 5. Yer varsa sepetten yumurta al.
    changed = run({ type: 'takeEgg', roll: random(), shinyRoll: random() }) || changed;

    // 6. Kuluçka: boş yuvaya en iyi yumurtayı koy. Yeni bir hayvansa hemen; bilinen bir hayvansa
    // yalnızca şimdiye kadarki en büyük hayvanlardan biriyse (küçükler birleşmek için biriktirilir).
    const slot = s.incubator.indexOf(null);
    if (slot !== -1) {
      const eggs = s.grid.map((egg, i) => ({ egg, i })).filter((e) => e.egg !== null);
      const best = eggs.sort((a, b) => b.egg!.level - a.egg!.level)[0];
      const busy = s.park.length + s.incubator.filter(Boolean).length;
      const worst = Math.min(...s.park.map((a) => a.level), Infinity);
      const top = Math.max(0, ...s.discovered);
      const bigEnough = best && best.egg!.level >= top - 1;
      if (
        best &&
        (!s.discovered.includes(best.egg!.level) ||
          (bigEnough && (busy < stateParkLimit(s) || best.egg!.level > worst)))
      ) {
        changed = run({ type: 'incubate', from: best.i, slot }) || changed;
        const placed = s.incubator[slot];
        if (placed && canBoost(placed, s.now) && placed.startedAt + placed.durationMs - s.now > 30 * SEC) {
          run({ type: 'boostIncubation', slot, fraction: MINI_GAME_REWARD });
        }
      }
    }

    // 7. Park dolu ve kuluçkada daha iyi bir hayvan bekliyorsa en küçük hayvanı doğaya sal.
    const waiting = s.incubator.filter((x) => x && s.now >= x.startedAt + x.durationMs);
    if (s.park.length >= stateParkLimit(s) && waiting.length > 0) {
      const lowest = [...s.park].sort((a, b) => a.level - b.level)[0];
      if (lowest.level < Math.max(...waiting.map((x) => x!.egg.level))) {
        changed = run({ type: 'releaseAnimal', id: lowest.id }) || changed;
      }
    }

    // Kutlama ekranlarını kapat.
    if (s.newAnimalQueue.length) changed = run({ type: 'dismissNewAnimal' }) || changed;
    if (s.escapedQueue.length) changed = run({ type: 'dismissEscaped' }) || changed;
    if (s.awayGold) changed = run({ type: 'dismissAwayGold' }) || changed;
    if (s.giftBox.length) changed = run({ type: 'takeGift' }) || changed;

    if (!changed) break;
  }
  return s;
}

type Result = { level: number; wallMs: number; playMs: number }[];

/** isPlaying: o anda oyun açık mı. Kapalıyken oyun yalnızca oyuncu geri dönünce ilerler. */
type Simulation = { found: Result; state: GameState; earnedByDay: number[]; levelByDay: number[]; bought: typeof purchases };

function simulate(isPlaying: (t: number) => boolean, maxMs: number): Simulation {
  const random = rng(42);
  purchases = [];
  const earnedByDay: number[] = [];
  const levelByDay: number[] = [];
  const start = 8 * HOUR; // 1. gün, sabah 08:00
  // Rehber elle oynanır; simülasyon onu atlar (rehberde yalnızca elin gösterdiği hamle yapılabilir).
  let s = gameReducer(createInitialState(start), { type: 'finishTutorial' });
  let played = 0;
  const found: Result = [];
  let wasPlaying = true;

  for (let t = start; t < start + maxMs; t += SEC) {
    if (!isPlaying(t - start)) {
      wasPlaying = false;
      continue;
    }
    // Oyuncu geri döndü: kapalı geçen süre tek seferde işlenir (sepet, 2 saat sınırı, açlık, kaçma).
    wasPlaying = true;
    const goldBefore = s.gold;
    s = gameReducer(s, { type: 'tick', now: t });
    const day = Math.floor((t - start) / DAY);
    earnedByDay[day] = (earnedByDay[day] ?? 0) + Math.max(0, s.gold - goldBefore);
    levelByDay[day] = s.level;
    const before = s.discovered.length;
    s = play(s, random);
    played += SEC;
    for (const level of s.discovered.slice(before)) found.push({ level, wallMs: t - start, playMs: played });
    // Kuluçkadan çıkışlar tick içinde olur; onları da yakala.
    for (const level of s.discovered) {
      if (!found.some((f) => f.level === level)) found.push({ level, wallMs: t - start, playMs: played });
    }
    if (s.discovered.includes(MAX_LEVEL)) break;
  }
  return { found, state: s, earnedByDay, levelByDay, bought: purchases };
}

function wall(ms: number): string {
  const day = Math.floor(ms / DAY) + 1;
  const inDay = (ms % DAY) + 8 * HOUR;
  const h = Math.floor(inDay / HOUR) % 24;
  const m = Math.floor((inDay % HOUR) / MIN);
  return `${day}. gün ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function duration(ms: number): string {
  const h = Math.floor(ms / HOUR);
  const m = Math.round((ms % HOUR) / MIN);
  return h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
}

function report(title: string, found: Result, state: GameState, showWall: boolean) {
  console.log(`\n=== ${title} ===`);
  console.log(showWall ? 'Hayvan     | Oynanan süre | Takvimde' : 'Hayvan     | Oynanan süre');
  for (const animal of ANIMALS) {
    const f = found.find((x) => x.level === animal.level);
    const play = f ? duration(f.playMs) : '-';
    console.log(`${animal.name.padEnd(10)} | ${play.padStart(12)}${showWall ? ` | ${f ? wall(f.wallMs) : '-'}` : ''}`);
  }
  console.log(`Sonda altın: ${formatNumber(state.gold)} · Parkta ${state.park.length} hayvan · Bahçe ${state.level}. seviye`);
}

/** Her gün ne kadar altın kazanıldığını ve hangi yükseltmelerin alındığını yazar. */
function reportDays(sim: Simulation) {
  console.log('Gün | Bahçe seviyesi | Kazanılan altın | Alınan yükseltmeler');
  sim.earnedByDay.forEach((earned, day) => {
    const bought = sim.bought
      .filter((p) => Math.floor((p.at - 8 * HOUR) / DAY) === day)
      .map((p) => `${upgradeFor(p.id).name} ${p.level}`);
    console.log(
      `${String(day + 1).padStart(3)} | ${String(sim.levelByDay[day]).padStart(14)} | ${formatNumber(earned).padStart(15)} | ${bought.join(', ') || '-'}`,
    );
  });
}

const continuous = simulate(() => true, 10 * DAY);
report('Aralıksız oynayan', continuous.found, continuous.state, false);

// 08:00, 15:00, 20:00'de 20'şer dakika (başlangıç 08:00 olduğu için 0, 7 ve 12. saatler).
const sessions = [0, 7 * HOUR, 12 * HOUR];
const daily = simulate((t) => sessions.some((s) => t % DAY >= s && t % DAY < s + 20 * MIN), 30 * DAY);
report('Günde 3 kez 20 dakika oynayan', daily.found, daily.state, true);
reportDays(daily);
