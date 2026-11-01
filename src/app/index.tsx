import * as Haptics from 'expo-haptics';
import { useEffect, useReducer, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type HostInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DraggableEgg } from '@/components/draggable-egg';
import { Hud } from '@/components/hud';
import { Incubator } from '@/components/incubator';
import { NewAnimalModal } from '@/components/new-animal-modal';
import { Park } from '@/components/park';
import { COLOR_HEX, PRIMARY_COLORS, type ColorId } from '@/game/colors';
import { eggPrice, GRID_COLUMNS } from '@/game/config';
import { formatNumber } from '@/game/format';
import { canMerge, createInitialState, gameReducer, parkIncomePerSecond } from '@/game/state';

const TICK_MS = 250;
const MAX_BOARD_WIDTH = 480;
const GRID_GAP = 8;

type Rect = { x: number; y: number; width: number; height: number };

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
  const [draggingFrom, setDraggingFrom] = useState<number | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<number | null>(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const timer = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const celebrating = state.newAnimalQueue[0];
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
  const zoneAt = (x: number, y: number) => {
    for (const [id, r] of zoneRects.current) {
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return id;
    }
    return null;
  };

  const handleDrop = (from: number, x: number, y: number) => {
    const zone = zoneAt(x, y);
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

  return (
    <SafeAreaView style={styles.screen}>
      <Hud
        gold={state.gold}
        diamonds={state.diamonds}
        incomePerSecond={parkIncomePerSecond(state.park)}
        parkCount={state.park.length}
      />

      <Park
        animals={state.park}
        selectedId={selectedAnimal}
        onSelect={setSelectedAnimal}
        onRelease={(id) => {
          dispatch({ type: 'releaseAnimal', id });
          setSelectedAnimal(null);
        }}
      />

      <Incubator slots={state.incubator} now={state.now} parkCount={state.park.length} zoneRef={zoneRef} />

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
                onDrop={(x, y) => handleDrop(i, x, y)}
                onDragEnd={() => setDraggingFrom(null)}
              />
            ) : (
              <Text style={styles.paw}>🐾</Text>
            )}
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.buyButton, !canBuy && styles.buyDisabled]}
        disabled={!canBuy}
        onPress={() => dispatch({ type: 'buyEgg', nextColor: randomPrimary() })}>
        {/* Sıradaki yumurtanın rengi önceden görünür, çocuk plan yapabilsin. */}
        <View style={[styles.nextColor, { backgroundColor: COLOR_HEX[state.nextEggColor] }]} />
        <Text style={styles.buyTitle}>{gridFull ? 'Alan dolu' : 'Yumurta'}</Text>
        <Text style={styles.buyPrice}>🪙 {formatNumber(price)}</Text>
      </Pressable>

      {celebrating !== undefined && (
        <NewAnimalModal key={celebrating} level={celebrating} onClose={() => dispatch({ type: 'dismissNewAnimal' })} />
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
  buyButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
    paddingHorizontal: 28,
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
});
