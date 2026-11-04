import * as Haptics from 'expo-haptics';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type HostInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimalsPanel, type AnimalsTab } from '@/components/animals-panel';
import { AwayGoldModal } from '@/components/away-gold-modal';
import { DraggableEgg } from '@/components/draggable-egg';
import { EscapedModal } from '@/components/escaped-modal';
import { FruitMergeGame } from '@/components/fruit-merge-game';
import { Hud } from '@/components/hud';
import { Incubator } from '@/components/incubator';
import { NewAnimalModal } from '@/components/new-animal-modal';
import { Park } from '@/components/park';
import { ParentGate } from '@/components/parent-gate';
import { TutorialOverlay } from '@/components/tutorial-overlay';
import { UpgradesPanel } from '@/components/upgrades-panel';
import { animalFor, GRID_COLUMNS, TUTORIAL_ANIMALS, UPGRADES } from '@/game/config';
import { formatDuration } from '@/game/format';
import {
  basketCap,
  canAffordUpgrade,
  canMerge,
  mergeLocked,
  createInitialState,
  gameReducer,
  nextBasketEggAt,
  parkIncomePerSecond,
  stateIncomeBonus,
  stateParkLimit,
} from '@/game/state';
import { tutorialHint } from '@/game/tutorial';
import { useGameSave } from '@/hooks/use-game-save';
import { findDropZone, type Rect } from '@/lib/drop-zone';

const TICK_MS = 250;
const MAX_BOARD_WIDTH = 480;
const GRID_GAP = 8;
/** Rehber hedefi henüz ölçülmediyse: el görünmez, ekran tamamen koyu kalır. */
const NO_RECTS = new Map<string, Rect>();

function haptic(kind: 'merge' | 'success') {
  if (Platform.OS === 'web') return;
  if (kind === 'merge') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export default function GameScreen() {
  const [state, dispatch] = useReducer(gameReducer, null, () => createInitialState(Date.now()));
  const loaded = useGameSave(state, dispatch);
  const [draggingFrom, setDraggingFrom] = useState<number | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<number | null>(null);
  const [upgradesOpen, setUpgradesOpen] = useState(false);
  /** "Oyunu baştan başlat"a basıldı; ebeveyn kapısı açık. */
  const [resetAsked, setResetAsked] = useState(false);
  /** Hayvanlarım ekranı açıksa hangi sekmede açıldığı; kapalıysa null. */
  const [animalsTab, setAnimalsTab] = useState<AnimalsTab | null>(null);
  /** Mini oyunla hızlandırılan kuluçka yuvası; oyun açık değilse null. */
  const [boostSlot, setBoostSlot] = useState<number | null>(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    // Oyun ekranda değilken ilerlemez. Android arka plandaki uygulamayı bir süre çalıştırmaya devam
    // ettiği için bu olmadan oyun kapalı sayılmaz, 2 saatlik kazanç sınırı da hiç uygulanmaz.
    // Geri dönünce aradaki süre tek seferde işlenir (sepet, açlık, en fazla 2 saatlik kazanç).
    const tick = () => {
      if (AppState.currentState === 'active') dispatch({ type: 'tick', now: Date.now() });
    };
    const timer = setInterval(tick, TICK_MS);
    const subscription = AppState.addEventListener('change', tick);
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const celebrating = state.newAnimalQueue[0];
  const escaped = state.escapedQueue[0];
  useEffect(() => {
    if (celebrating !== undefined) haptic('success');
  }, [celebrating]);

  // Bırakma alanları (kutular ve kuluçka yuvaları). Sürükleme başlarken ekrandaki yerleri ölçülür.
  const zoneViews = useRef(new Map<string, HostInstance>());
  const zoneRects = useRef(new Map<string, Rect>());
  const zoneRef = (id: string) => (view: HostInstance | null) => {
    if (view) zoneViews.current.set(id, view);
    else zoneViews.current.delete(id);
  };
  const measureZones = () => {
    zoneViews.current.forEach((view, id) => {
      view.measureInWindow((x, y, w, h) => zoneRects.current.set(id, { x, y, width: w, height: h }));
    });
  };
  // İlk oyun rehberi: elin göstereceği yerler bırakma alanları ile sepet ve Hayvanlarım düğmeleri.
  // Rehber açıkken yerler yarım saniyede bir ölçülür (ekran düzeni değişebilir).
  const hint = tutorialHint(state, animalsTab !== null);
  // Elin gösterdiği yer değişince (ör. besleme sonrası liste yeniden sıralanınca) hemen yeniden ölçülür;
  // eski ölçüm yeni hedef için kullanılmaz, yoksa el önce eski yere gider.
  const hintKey = hint === null ? null : hint.kind === 'drag' ? `${hint.from}>${hint.to}` : hint.target;
  const targetViews = useRef(new Map<string, HostInstance>());
  const targetRef = (id: string) => (view: HostInstance | null) => {
    if (view) targetViews.current.set(id, view);
    else targetViews.current.delete(id);
  };
  const [hintRects, setHintRects] = useState<{ key: string | null; rects: Map<string, Rect> }>(() => ({
    key: null,
    rects: new Map(),
  }));
  useEffect(() => {
    if (hintKey === null) return;
    const measureAll = () => {
      const views = [...zoneViews.current, ...targetViews.current];
      const next = new Map<string, Rect>();
      let pending = views.length;
      views.forEach(([id, view]) =>
        view.measureInWindow((x, y, w, h) => {
          next.set(id, { x, y, width: w, height: h });
          if (--pending === 0) setHintRects({ key: hintKey, rects: next });
        }),
      );
    };
    measureAll();
    const timer = setInterval(measureAll, 500);
    return () => clearInterval(timer);
  }, [hintKey]);

  // Parmağın ucu değil, sürüklenen yumurtanın ortası sayılır: ekranda nereye bırakıldığı görünüyorsa oraya düşer.
  // Kısa uyarı yazısı (ör. "Önce bir köpek çıkar!"); birkaç saniye sonra kaybolur.
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = (text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  };

  const handleDrop = (from: number, dx: number, dy: number) => {
    const start = zoneRects.current.get(`cell-${from}`);
    if (!start) return;
    const zone = findDropZone(zoneRects.current, start.x + start.width / 2 + dx, start.y + start.height / 2 + dy);
    if (!zone) return;
    const [kind, index] = zone.split('-');
    const target = Number(index);
    if (kind === 'cell') {
      const moving = state.grid[from];
      const other = state.grid[target];
      if (moving && other && from !== target && canMerge(moving, other, state.discovered)) haptic('merge');
      if (moving && other && from !== target && moving.level === other.level && mergeLocked(moving, state.discovered)) {
        // Bir sonraki hayvan bulunmadan daha üst yumurta yapılamaz; çocuğa ne yapması gerektiği söylenir.
        const next = animalFor(moving.level);
        showNotice(`${next.emoji} Önce bir ${next.name.toLocaleLowerCase('tr')} çıkar!`);
      }
      dispatch({ type: 'moveEgg', from, to: target });
    } else if (kind === 'slot') {
      dispatch({ type: 'incubate', from, slot: target });
    }
  };

  const boardWidth = Math.min(width, MAX_BOARD_WIDTH) - 24;
  const cellSize = (boardWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const gridFull = !state.grid.includes(null);
  const canTake = !gridFull && state.basket > 0;
  const nextEggAt = nextBasketEggAt(state);
  const incomeBonus = stateIncomeBonus(state);
  const parkLimit = stateParkLimit(state);
  // Alınabilecek bir yükseltme varsa düğmede işaret çıkar.
  const upgradeReady = UPGRADES.some((u) => canAffordUpgrade(state, u.id));

  if (!loaded) return <SafeAreaView style={styles.screen} />;

  return (
    <SafeAreaView style={styles.screen}>
      <Hud
        gold={state.gold}
        diamonds={state.diamonds}
        incomePerSecond={parkIncomePerSecond(state.park, incomeBonus, state.now)}
        parkCount={state.park.length}
        parkLimit={parkLimit}
      />

      <Park
        animals={state.park}
        now={state.now}
        gold={state.gold}
        onUpgradeSkill={(id) => {
          dispatch({ type: 'upgradeSkill', id });
          haptic('success');
        }}
        incomeBonus={incomeBonus}
        food={state.food}
        onFeed={(id) => {
          dispatch({ type: 'feedAnimal', id });
          haptic('success');
        }}
        targetRef={targetRef}
        onOpenAnimals={(tab) => {
          setSelectedAnimal(null);
          setAnimalsTab(tab);
        }}
        selectedId={selectedAnimal}
        onSelect={setSelectedAnimal}
        onRelease={(id) => {
          dispatch({ type: 'releaseAnimal', id });
          setSelectedAnimal(null);
        }}
      />

      <Incubator
        slots={state.incubator}
        now={state.now}
        parkCount={state.park.length}
        parkLimit={parkLimit}
        zoneRef={zoneRef}
        onPlay={setBoostSlot}
      />

      {/* Sürüklenen yumurta diğer bölümlerin üstünde görünsün diye alan öne alınır. */}
      <View style={[styles.board, { width: boardWidth }, draggingFrom !== null && styles.raised]}>
        {state.grid.map((egg, i) => (
          <View
            key={i}
            ref={zoneRef(`cell-${i}`)}
            style={[styles.cell, { width: cellSize, height: cellSize }, draggingFrom === i && styles.raised]}>
            {egg ? (
              <DraggableEgg
                key={egg.id}
                egg={egg}
                size={cellSize}
                onDragStart={() => {
                  measureZones();
                  setDraggingFrom(i);
                }}
                onDrop={(dx, dy) => handleDrop(i, dx, dy)}
                onDragEnd={() => setDraggingFrom(null)}
              />
            ) : (
              <Text style={styles.paw}>🐾</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        {/* Yumurta sepeti: dokununca sepetten bir yumurta alana gelir. Tavuk Anne zamanla doldurur. */}
        <Pressable
          ref={targetRef('basket')}
          style={[styles.buyButton, !canTake && styles.buyDisabled]}
          disabled={!canTake}
          onPress={() => dispatch({ type: 'takeEgg', roll: Math.random(), shinyRoll: Math.random() })}>
          <Text style={styles.buyIcon}>🧺</Text>
          <View>
            <Text style={styles.buyTitle}>
              {gridFull ? 'Alan dolu' : `${state.basket}/${basketCap(state)}`}
            </Text>
            <Text style={styles.buyPrice}>
              {nextEggAt === null ? 'Sepet dolu' : `🐔 ${formatDuration((nextEggAt - state.now) / 1000)}`}
            </Text>
          </View>
        </Pressable>

        <Pressable style={styles.upgradeButton} onPress={() => setUpgradesOpen(true)}>
          <Text style={styles.upgradeIcon}>⭐</Text>
          <Text style={styles.upgradeTitle}>Yükselt</Text>
          {upgradeReady && <View style={styles.badge} />}
        </Pressable>
      </View>

      {notice && (
        <View style={styles.notice} pointerEvents="none">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      {/* Kaçan hayvanların yumurtaları alan doluyken burada bekler; dokununca alana gelir. */}
      {state.giftBox.length > 0 && (
        <Pressable
          style={[styles.giftButton, gridFull && styles.buyDisabled]}
          disabled={gridFull}
          onPress={() => dispatch({ type: 'takeGift' })}>
          <Text style={styles.giftText}>
            🎁 {state.giftBox.length} yumurta bekliyor{gridFull ? ' · alan dolu' : ''}
          </Text>
        </Pressable>
      )}

      {/* Sürüklerken el kaybolur; çocuk yaptığı işe baksın. */}
      {hint && draggingFrom === null && <TutorialOverlay hint={hint} rects={hintRects.key === hintKey ? hintRects.rects : NO_RECTS} />}

      {upgradesOpen && (
        <UpgradesPanel
          gold={state.gold}
          diamonds={state.diamonds}
          levels={state.upgrades}
          onBuy={(id) => {
            dispatch({ type: 'buyUpgrade', id });
            haptic('success');
          }}
          onReset={() => setResetAsked(true)}
          onClose={() => setUpgradesOpen(false)}
        />
      )}

      {resetAsked && (
        <ParentGate
          message="Oyun baştan başlayacak; bütün hayvanlar, yumurtalar ve altın silinecek."
          onConfirm={() => {
            dispatch({ type: 'reset', now: Date.now() });
            setResetAsked(false);
            setUpgradesOpen(false);
            setSelectedAnimal(null);
          }}
          onCancel={() => setResetAsked(false)}
        />
      )}

      {animalsTab !== null && (
        <AnimalsPanel
          state={state}
          initialTab={animalsTab}
          onFeed={(id) => {
            dispatch({ type: 'feedAnimal', id });
            haptic('success');
          }}
          onBuyFood={(level) => dispatch({ type: 'buyFood', level })}
          onBuyMissingFood={() => {
            dispatch({ type: 'buyMissingFood' });
            haptic('success');
          }}
          onUpgradeSkill={(id) => {
            dispatch({ type: 'upgradeSkill', id });
            haptic('success');
          }}
          onRelease={(id) => dispatch({ type: 'releaseAnimal', id })}
          targetRef={targetRef}
          onClose={() => {
            setAnimalsTab(null);
            // Rehberin son adımı: hayvanlar beslendi, "Aferin!" yazısından sonra panel kapanınca rehber biter.
            if (state.tutorialStep !== null && state.tutorialStep > TUTORIAL_ANIMALS) dispatch({ type: 'finishTutorial' });
          }}
        />
      )}

      {boostSlot !== null && (
        <FruitMergeGame
          onCancel={() => setBoostSlot(null)}
          onFinish={(fraction) => {
            dispatch({ type: 'boostIncubation', slot: boostSlot, fraction });
            haptic('success');
            setBoostSlot(null);
          }}
        />
      )}

      {/* Önce "sen yokken" altını, sonra kaçan hayvanlar, sonra yeni hayvan kutlamaları gösterilir. */}
      {state.awayGold > 0 ? (
        <AwayGoldModal amount={state.awayGold} onClose={() => dispatch({ type: 'dismissAwayGold' })} />
      ) : escaped !== undefined ? (
        <EscapedModal
          level={escaped}
          inGiftBox={state.giftBox.length > 0}
          onClose={() => dispatch({ type: 'dismissEscaped' })}
        />
      ) : (
        celebrating !== undefined && (
          <NewAnimalModal
            key={celebrating}
            level={celebrating}
            onClose={() => dispatch({ type: 'dismissNewAnimal' })}
          />
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#CDEBFF',
    // Web'de sürüklerken yazılar seçilmesin.
    userSelect: 'none',
  },
  board: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginTop: 10,
  },
  raised: {
    zIndex: 10,
    elevation: 10,
  },
  cell: {
    borderRadius: 16,
    backgroundColor: '#FFF6E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paw: {
    fontSize: 20,
    opacity: 0.15,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 12,
    paddingHorizontal: 12,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: '#FFC93C',
    borderBottomWidth: 4,
    borderBottomColor: '#E0A21E',
  },
  buyDisabled: {
    opacity: 0.5,
  },
  buyIcon: {
    fontSize: 22,
  },
  buyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  buyPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#5B3A1E',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: '#B983FF',
    borderBottomWidth: 4,
    borderBottomColor: '#8A4FFF',
  },
  upgradeIcon: {
    fontSize: 18,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: 'white',
  },
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#5B3A1E',
    zIndex: 70,
    elevation: 70,
  },
  noticeText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '900',
  },
  giftButton: {
    alignSelf: 'center',
    marginTop: -4,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFE1EC',
    borderWidth: 2,
    borderColor: '#FF8FB1',
  },
  giftText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#8A2E52',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF4D4D',
    borderWidth: 2,
    borderColor: 'white',
  },
});
