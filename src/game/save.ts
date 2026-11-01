// Oyun durumunu yazıya (JSON) çevirir ve geri okur. Depolamanın kendisi arayüz tarafında yapılır.

import type { ColorId } from './colors.ts';
import { GRID_SIZE, incubatorSlots } from './config.ts';
import { createInitialState, type GameState } from './state.ts';

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
export function parseSave(json: string | null, firstColor: ColorId): GameState | null {
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

  // Sonradan eklenen alanlar eski kayıtta yoksa başlangıç değerleri kullanılır.
  const fresh = createInitialState(saved.now, firstColor);
  const upgrades = { ...fresh.upgrades, ...saved.upgrades };
  return {
    ...fresh,
    ...saved,
    upgrades,
    // Besleme gelmeden önceki kayıtlarda tokluk yok: hayvanlar kaydın yapıldığı anda tok sayılır.
    park: saved.park.map((animal) => ({ ...animal, fedAt: animal.fedAt ?? saved.now })),
    grid: fitLength(saved.grid, GRID_SIZE),
    incubator: fitLength(saved.incubator, incubatorSlots(upgrades.incubatorSlot)),
  };
}

function fitLength<T>(items: (T | null)[], length: number): (T | null)[] {
  return Array.from({ length }, (_, i) => items[i] ?? null);
}
