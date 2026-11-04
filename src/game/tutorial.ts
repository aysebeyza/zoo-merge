// İlk oyun rehberi: el işaretinin bir sonraki adımda neyi göstereceğini oyunun durumuna bakarak bulur.
// Çocuk civcivi, tavşanı ve kediyi tek tek çıkarır; böylece hem kuluçkayı hem birleştirmeyi öğrenir.
// Sonunda Hayvanlarım'ı açıp üçünü de hediye yemle besler.

import { animalFor, TUTORIAL_ANIMALS } from './config.ts';
import { canFeed, type GameAction, type GameState } from './state.ts';

/**
 * tap: hedefe dokun; drag: from'daki yumurtayı to'ya sürükle; wait: yumurtanın çatlamasını bekle.
 * Hedefler ekrandaki yerlerin adlarıdır: "cell-3", "slot-0", "basket", "animals", "feed-12" (o hayvanın
 * Besle düğmesi), "animals-close" (Hayvanlarım'ın kapatma düğmesi).
 */
export type TutorialHint =
  | { kind: 'tap'; target: string; text: string }
  | { kind: 'drag'; from: string; to: string; text: string }
  | { kind: 'wait'; target: string; text: string };

const FEED_TEXT: Record<number, string> = { 1: 'Civcivini besle', 2: 'Tavşanını besle', 3: 'Kedini besle' };

/** animalsOpen: Hayvanlarım paneli açık mı (arayüzün bildiği bir şey; son adımda el ona göre yer değiştirir). */
export function tutorialHint(state: GameState, animalsOpen = false): TutorialHint | null {
  const step = state.tutorialStep;
  // Rehber bittiyse ya da ekranda bir kutlama/uyarı açıksa el görünmez.
  if (step === null || state.newAnimalQueue.length > 0 || state.awayGold > 0 || state.escapedQueue.length > 0) {
    return null;
  }
  if (step > TUTORIAL_ANIMALS) {
    if (!animalsOpen) return { kind: 'tap', target: 'animals', text: 'Hayvanlarına bak!' };
    // Panelde en aç hayvan en üstte; beslenen alta iner, sıradaki yukarı çıkar.
    const hungry = state.park
      .filter((a) => a.level <= TUTORIAL_ANIMALS && canFeed(state, a))
      .sort((a, b) => a.level - b.level)[0];
    if (hungry) {
      const food = animalFor(hungry.level).food.emoji;
      return { kind: 'tap', target: `feed-${hungry.id}`, text: `${food} ${FEED_TEXT[hungry.level]}` };
    }
    return { kind: 'tap', target: 'animals-close', text: 'Aferin! Acıkınca yine besle 🎉' };
  }

  const name = animalFor(step).name;
  const hatching = state.incubator.findIndex((slot) => slot?.egg.level === step);
  if (hatching !== -1)
    return {
      kind: 'wait',
      target: `slot-${hatching}`,
      text: 'Yumurta çatlıyor, bekle!',
    };

  const freeSlot = state.incubator.indexOf(null);
  const egg = state.grid.findIndex((e) => e?.level === step);
  if (egg !== -1 && freeSlot !== -1) {
    return {
      kind: 'drag',
      from: `cell-${egg}`,
      to: `slot-${freeSlot}`,
      text: `${name} yumurtasını kuluçkaya sürükle`,
    };
  }

  // Bir üst yumurtaya giden aynı yumurtaları birleştir (büyükten başlayarak).
  for (let level = step - 1; level >= 1; level--) {
    const cells = state.grid.flatMap((e, i) => (e?.level === level ? [i] : []));
    if (cells.length >= 2) {
      return {
        kind: 'drag',
        from: `cell-${cells[0]}`,
        to: `cell-${cells[1]}`,
        text: 'Aynı yumurtaları birleştir',
      };
    }
  }

  if (state.basket > 0 && state.grid.includes(null)) return { kind: 'tap', target: 'basket', text: 'Sepete dokun' };
  return null;
}

/** Rehber sürerken oyuncunun yapabileceği tek hamle elin gösterdiğidir; geri kalanlar yok sayılır. */
const PLAYER_ACTIONS = new Set<GameAction['type']>([
  'takeEgg',
  'buyUpgrade',
  'moveEgg',
  'incubate',
  'releaseAnimal',
  'boostIncubation',
  'upgradeSkill',
  'buyFood',
  'feedAnimal',
  'buyMissingFood',
  'takeGift',
]);

export function tutorialAllows(state: GameState, action: GameAction): boolean {
  if (!PLAYER_ACTIONS.has(action.type)) return true;
  const step = state.tutorialStep;
  if (step === null) return true;
  // Son adımda (Hayvanlarım) yalnızca besleme; hangi hayvanın besleneceğini arayüzdeki el gösterir.
  if (step > TUTORIAL_ANIMALS) return action.type === 'feedAnimal';
  const hint = tutorialHint(state);
  if (hint === null) return true;

  switch (hint.kind) {
    case 'wait':
      return false;
    case 'tap':
      return hint.target === 'basket' && action.type === 'takeEgg';
    case 'drag': {
      const from = Number(hint.from.split('-')[1]);
      const to = Number(hint.to.split('-')[1]);
      if (hint.to.startsWith('slot-')) return action.type === 'incubate' && action.from === from && action.slot === to;
      // Birleştirmede hangi yumurtanın hangisine sürüklendiği fark etmez.
      return (
        action.type === 'moveEgg' &&
        ((action.from === from && action.to === to) || (action.from === to && action.to === from))
      );
    }
  }
}
