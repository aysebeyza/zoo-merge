import * as Haptics from 'expo-haptics';
import { useEffect, useReducer, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type HostInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AwayGoldModal } from '@/components/away-gold-modal';
import { DraggableEgg } from '@/components/draggable-egg';
import { EscapedModal } from '@/components/escaped-modal';
import { Hud } from '@/components/hud';
import { Incubator } from '@/components/incubator';
import { NewAnimalModal } from '@/components/new-animal-modal';
import { Park } from '@/components/park';
import { UpgradesPanel } from '@/components/upgrades-panel';
import { COLOR_HEX, PRIMARY_COLORS, type ColorId } from '@/game/colors';
import { eggPrice, GRID_COLUMNS, UPGRADES, upgradeCost } from '@/game/config';
import { formatNumber } from '@/game/format';
import {
  canMerge,
  createInitialState,
  feedAllCost,
  feedPlan,
  gameReducer,
  parkIncomePerSecond,
  stateIncomeBonus,
  stateParkLimit,
} from '@/game/state';
import { useGameSave } from '@/hooks/use-game-save';
import { findDropZone, type Rect } from '@/lib/drop-zone';

const TICK_MS = 250;
const MAX_BOARD_WIDTH = 480;
const GRID_GAP = 8;

function randomPrimary(): ColorId {
  return PRIMARY_COLORS[Math.floor(Math.random() * PRIMARY_COLORS.length)];
}

function haptic(kind: 'merge' | 'success') {
  if (Platform.OS === 'web') return;
  if (kind === 'merge') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export default function GameScreen() {
  const [state, dispatch] = useReducer(gameReducer, null, () => createInitialState(Date.now(), randomPrimary()));
  const loaded = useGameSave(state, dispatch);
  const [draggingFrom, setDraggingFrom] = useState<number | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<number | null>(null);
  const [upgradesOpen, setUpgradesOpen] = useState(false);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const timer = setInterval(
      () => dispatch({ type: 'tick', now: Date.now(), eggColor: randomPrimary(), roll: Math.random() }),
      TICK_MS,
    );
    return () => clearInterval(timer);
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
  // Parmağın ucu değil, sürüklenen yumurtanın ortası sayılır: ekranda nereye bırakıldığı görünüyorsa oraya düşer.
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
      if (moving && other && from !== target && canMerge(moving, other)) haptic('merge');
      dispatch({ type: 'moveEgg', from, to: target });
    } else if (kind === 'slot') {
      dispatch({ type: 'incubate', from, slot: target });
    }
  };

  const boardWidth = Math.min(width, MAX_BOARD_WIDTH) - 24;
  const cellSize = (boardWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const price = eggPrice(state.eggsBought);
  const gridFull = !state.grid.includes(null);
  const canBuy = !gridFull && state.gold >= price;
  const incomeBonus = stateIncomeBonus(state);
  const parkLimit = stateParkLimit(state);
  const feedCost = feedAllCost(state);
  const canFeed = feedPlan(state).ids.length > 0;
  // Alınabilecek bir yükseltme varsa düğmede işaret çıkar.
  const upgradeReady = UPGRADES.some((u) => {
    const cost = upgradeCost(u.id, state.upgrades[u.id]);
    return cost !== null && state.gold >= cost;
  });

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
        incomeBonus={incomeBonus}
        feedCost={feedCost}
        canFeed={canFeed}
        onFeed={() => {
          dispatch({ type: 'feedAll' });
          haptic('success');
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
        <Pressable
          style={[styles.buyButton, !canBuy && styles.buyDisabled]}
          disabled={!canBuy}
          onPress={() => dispatch({ type: 'buyEgg', nextColor: randomPrimary(), roll: Math.random() })}>
          {/* Sıradaki yumurtanın rengi önceden görünür, çocuk plan yapabilsin. */}
          <View style={[styles.nextColor, { backgroundColor: COLOR_HEX[state.nextEggColor] }]} />
          <Text style={styles.buyTitle}>{gridFull ? 'Alan dolu' : 'Yumurta'}</Text>
          <Text style={styles.buyPrice}>🪙 {formatNumber(price)}</Text>
        </Pressable>

        <Pressable style={styles.upgradeButton} onPress={() => setUpgradesOpen(true)}>
          <Text style={styles.upgradeIcon}>⭐</Text>
          <Text style={styles.upgradeTitle}>Yükselt</Text>
          {upgradeReady && <View style={styles.badge} />}
        </Pressable>
      </View>

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

      {upgradesOpen && (
        <UpgradesPanel
          gold={state.gold}
          levels={state.upgrades}
          onBuy={(id) => {
            dispatch({ type: 'buyUpgrade', id });
            haptic('success');
          }}
          onClose={() => setUpgradesOpen(false)}
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
  nextColor: {
    width: 22,
    height: 28,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'white',
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
