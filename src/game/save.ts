// Oyun durumunu yazıya (JSON) çevirir ve geri okur. Depolamanın kendisi arayüz tarafında yapılır.

import {
  AUTO_EGG_REFUND_COSTS,
  AUTO_FEEDER_REFUND,
  FASTER_HEN_REFUND_COSTS,
  GRID_SIZE,
  incubatorSlots,
  levelForXp,
  UPGRADES,
  xpForNewAnimal,
} from './config.ts';
import { createInitialState, type Egg, type GameState } from './state.ts';
import type { Variant } from './variant.ts';

/** Kayıt biçimi değişirse artırılır; eski kayıtlar parseSave içinde yeni biçime çevrilir. */
export const SAVE_VERSION = 1;

type SaveFile = {
  version: number;
  state: GameState;
};

export function serializeSave(state: GameState): string {
  const file: SaveFile = { version: SAVE_VERSION, state };
  return JSON.stringify(file);
}

/** Kayıt bozuksa ya da tanınmıyorsa null döner; oyun o zaman baştan başlar. */
export function parseSave(json: string | null): GameState | null {
  if (!json) return null;
  let file: Partial<SaveFile>;
  try {
    file = JSON.parse(json);
  } catch {
    return null;
  }
  const saved = file.state;
  if (file.version !== SAVE_VERSION || !saved || typeof saved.now !== 'number') return null;
  if (!Array.isArray(saved.grid) || !Array.isArray(saved.incubator) || !Array.isArray(saved.park)) return null;

  // Kaldırılan alanlar atılır: renk karışımının "sıradaki renk"i, altınla yumurta almanın sayacı ve
  // otomatik yumurtanın zamanı, biriken bahşiş sayısı (artık bahşiş ziyaretçiyle gelip gidiyor).
  const {
    nextEggColor: _color,
    eggsBought: _bought,
    nextAutoEggAt: _auto,
    tips: _tips,
    ...rest
  } = saved as GameState & { nextEggColor?: unknown; eggsBought?: unknown; nextAutoEggAt?: unknown; tips?: unknown };
  // Sonradan eklenen alanlar eski kayıtta yoksa başlangıç değerleri kullanılır.
  const fresh = createInitialState(saved.now);
  // Yalnızca bugün olan yükseltmeler okunur. Kaldırılan otomatik yemliği, otomatik yumurtayı ve
  // Tavuk Anne'yi alanlara harcadıkları altın iade edilir.
  const savedUpgrades = (saved.upgrades ?? {}) as Record<string, number>;
  const upgrades = { ...fresh.upgrades };
  for (const { id } of UPGRADES) upgrades[id] = savedUpgrades[id] ?? 0;
  const refund =
    ((savedUpgrades.autoFeeder ?? 0) > 0 ? AUTO_FEEDER_REFUND : 0) +
    AUTO_EGG_REFUND_COSTS.slice(0, savedUpgrades.autoEgg ?? 0).reduce((sum, c) => sum + c, 0) +
    FASTER_HEN_REFUND_COSTS.slice(0, savedUpgrades.fasterHen ?? 0).reduce((sum, c) => sum + c, 0);
  // Bahçe seviyesinden önceki kayıtlar, bulunan hayvanların puanıyla ve o seviyeden (hediyesiz) başlar.
  const xp =
    typeof saved.xp === 'number' ? saved.xp : (saved.discovered ?? []).reduce((sum, l) => sum + xpForNewAnimal(l), 0);
  return {
    ...fresh,
    ...rest,
    gold: saved.gold + refund,
    // Rehber gelmeden önce başlamış oyunlar rehberi görmez.
    tutorialStep: 'tutorialStep' in saved ? saved.tutorialStep : null,
    upgrades,
    food: saved.food ?? {},
    xp,
    level: typeof saved.level === 'number' ? saved.level : levelForXp(xp),
    // Eski kayıtlarda olmayan hayvan alanları: tokluk ve parka çıkış anı kaydın yapıldığı an, yetenek 0.
    park: saved.park.map((animal) => ({
      ...animal,
      variant: migrateVariant(animal.variant),
      fedAt: animal.fedAt ?? saved.now,
      skill: animal.skill ?? 0,
      parkedAt: animal.parkedAt ?? saved.now,
      happiness: animal.happiness ?? 0,
      petAt: animal.petAt ?? 0,
      wishDoneDay: animal.wishDoneDay ?? null,
    })),
    grid: fitLength(saved.grid.map(migrateEgg), GRID_SIZE),
    incubator: fitLength(
      saved.incubator.map((slot) => slot && { ...slot, egg: migrateEgg(slot.egg)! }),
      incubatorSlots(upgrades.incubatorSlot),
    ),
    giftBox: (saved.giftBox ?? []).map((egg) => migrateEgg(egg)!),
  };
}

function migrateEgg(egg: Egg | null): Egg | null {
  return egg && { ...egg, variant: migrateVariant(egg.variant) };
}

/**
 * Renk karışımı döneminden kalan çeşitler: desenli (+%50) parlak olur, çünkü parlak da +%50 verir.
 * Saf (+%20) hal artık yok; normal sayılır.
 */
function migrateVariant(variant: Partial<Variant> & { patterned?: boolean }): Variant {
  return { shiny: Boolean(variant.shiny ?? variant.patterned) };
}

function fitLength<T>(items: (T | null)[], length: number): (T | null)[] {
  return Array.from({ length }, (_, i) => items[i] ?? null);
}
