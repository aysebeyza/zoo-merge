import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';

import {
  createFruitGame,
  dropFruit,
  FRUIT_GAME,
  FRUITS,
  fruitsOf,
  rewardFraction,
  stepFruitGame,
  timeLeftSec,
  type FruitGame,
} from '@/game/fruit-merge';
import { formatNumber } from '@/game/format';

type Props = {
  /** Oyun bitince: kuluçka süresinden kısalacak oran. */
  onFinish: (fraction: number) => void;
  /** Oyuna başlamadan vazgeçilirse. */
  onCancel: () => void;
};

/** Ekranda çizilen an; fizik nesnesine render sırasında dokunulmasın diye her karede kopyalanır. */
type Snapshot = {
  fruits: ReturnType<typeof fruitsOf>;
  pops: { x: number; y: number; age: number }[];
  score: number;
  timeLeft: number;
  nextLevel: number;
  ended: boolean;
};

function snapshotOf(game: FruitGame): Snapshot {
  return {
    fruits: fruitsOf(game),
    pops: game.pops.map((p) => ({ x: p.x, y: p.y, age: game.time - p.at })),
    score: game.score,
    timeLeft: timeLeftSec(game),
    nextLevel: game.nextLevel,
    ended: game.ended,
  };
}

export function FruitMergeGame({ onFinish, onCancel }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const scale = Math.min(screenWidth - 48, 360) / FRUIT_GAME.width;
  const game = useRef<FruitGame | null>(null);
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [aimX, setAimX] = useState(FRUIT_GAME.width / 2);

  useEffect(() => {
    if (phase !== 'playing') return;
    let frame = 0;
    let last = Date.now();
    const loop = () => {
      const g = game.current;
      if (!g) return;
      const now = Date.now();
      // Fizik kendi içinde küçük adımlarla ilerler; yavaş telefonda da süre gerçek zamana yakın akar.
      // Uygulama uzun süre takılırsa (arka plana alınırsa) meyveler birden zıplamasın diye sınır var.
      stepFruitGame(g, Math.min(250, now - last));
      last = now;
      setSnap(snapshotOf(g));
      if (g.ended) setPhase('done');
      else frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const start = () => {
    game.current = createFruitGame(Math.random());
    setSnap(snapshotOf(game.current));
    setPhase('playing');
  };

  // Parmak oyun alanında gezdikçe nişan alınır, kalkınca meyve bırakılır.
  const aim = (e: GestureResponderEvent) => setAimX(e.nativeEvent.locationX / scale);
  const release = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX / scale;
    setAimX(x);
    if (game.current) dropFruit(game.current, x, Math.random());
  };

  if (phase === 'intro' || !snap) {
    return (
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Meyve Birleştir</Text>
          <Text style={styles.bigEmoji}>🍒 + 🍒 = 🍓</Text>
          <Text style={styles.text}>Meyveleri bırak, aynı iki meyve değince büyür!</Text>
          <Text style={styles.hint}>Ne kadar çok birleştirirsen yumurtan o kadar çabuk çatlar. 30 saniyen var.</Text>
          <Pressable style={styles.button} onPress={start}>
            <Text style={styles.buttonText}>Başla!</Text>
          </Pressable>
          <Pressable onPress={onCancel} hitSlop={10}>
            <Text style={styles.cancel}>Vazgeç</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const next = FRUITS[snap.nextLevel - 1];
  const fraction = rewardFraction(snap.score);
  const progress = Math.min(1, snap.score / FRUIT_GAME.targetScore);
  const boxWidth = FRUIT_GAME.width * scale;

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.headerText}>⏱️ {Math.ceil(snap.timeLeft)}</Text>
        <Text style={styles.headerText}>⭐ {formatNumber(snap.score)}</Text>
        <Text style={styles.headerText}>Sıradaki {next.emoji}</Text>
      </View>

      {/* Ödül çubuğu: puan arttıkça dolar, yumurtanın ne kadar hızlanacağı oynarken görünür. */}
      <View style={[styles.rewardBar, { width: boxWidth }]}>
        <View style={[styles.rewardFill, progress >= 1 && styles.rewardFull, { width: `${progress * 100}%` }]} />
        <Text style={styles.rewardText}>
          {progress >= 1
            ? `🥚 En büyük ödül! %${Math.round(fraction * 100)}`
            : `🥚 %${Math.round(fraction * 100)} daha hızlı`}
        </Text>
      </View>

      <View
        style={[styles.box, { width: FRUIT_GAME.width * scale, height: FRUIT_GAME.height * scale }]}
        onStartShouldSetResponder={() => phase === 'playing'}
        onMoveShouldSetResponder={() => phase === 'playing'}
        onResponderGrant={aim}
        onResponderMove={aim}
        onResponderRelease={release}>
        {/* Çizimler dokunmayı almaz; parmağın yeri hep oyun alanına göre ölçülür. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* Bu çizginin üstünde meyve kalırsa kutu dolmuş sayılır. */}
          <View style={[styles.limit, { top: FRUIT_GAME.overflowY * scale }]} />
          {phase === 'playing' && (
            <>
              <View style={[styles.guide, { left: aimX * scale }]} />
              <Text style={[styles.fruit, styles.ghost, fruitStyle(snap.nextLevel, aimX, FRUIT_GAME.dropY, 0, scale)]}>
                {next.emoji}
              </Text>
            </>
          )}
          {snap.fruits.map((f) => (
            <Text key={f.id} style={[styles.fruit, fruitStyle(f.level, f.x, f.y, f.angle, scale)]}>
              {FRUITS[f.level - 1].emoji}
            </Text>
          ))}
          {snap.pops.map((p, i) => (
            <Text
              key={i}
              style={[styles.pop, { left: p.x * scale - 14, top: p.y * scale - 14, opacity: 1 - p.age / 400 }]}>
              ✨
            </Text>
          ))}
        </View>
      </View>

      {phase === 'done' && (
        <View style={styles.resultLayer}>
          <View style={styles.card}>
            <Text style={styles.title}>Süper!</Text>
            <Text style={styles.text}>⭐ {formatNumber(snap.score)} puan</Text>
            <Text style={styles.reward}>Yumurtan %{Math.round(fraction * 100)} daha çabuk çatlayacak 🥚</Text>
            <Pressable style={styles.button} onPress={() => onFinish(fraction)}>
              <Text style={styles.buttonText}>Topla!</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function fruitStyle(level: number, x: number, y: number, angle: number, scale: number) {
  const r = FRUITS[level - 1].radius * scale;
  return {
    left: x * scale - r,
    top: y * scale - r,
    width: r * 2,
    height: r * 2,
    lineHeight: r * 2,
    fontSize: r * 1.7,
    transform: [{ rotate: `${angle}rad` }],
  };
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFE9C7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 120,
    elevation: 120,
  },
  header: {
    flexDirection: 'row',
    gap: 18,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  rewardBar: {
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#C98B4A',
    backgroundColor: '#FFF8EC',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  rewardFill: {
    ...StyleSheet.absoluteFill,
    right: undefined,
    backgroundColor: '#8EDB8E',
  },
  rewardFull: {
    backgroundColor: '#FFC93C',
  },
  rewardText: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  box: {
    borderRadius: 18,
    borderWidth: 4,
    borderColor: '#C98B4A',
    backgroundColor: '#FFF8EC',
    overflow: 'hidden',
  },
  limit: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,77,77,0.5)',
  },
  guide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(91,58,30,0.12)',
  },
  fruit: {
    position: 'absolute',
    textAlign: 'center',
  },
  ghost: {
    opacity: 0.5,
  },
  pop: {
    position: 'absolute',
    fontSize: 28,
  },
  resultLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,20,10,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 290,
    padding: 24,
    borderRadius: 28,
    backgroundColor: '#FFF8E8',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#8A4FFF',
  },
  bigEmoji: {
    fontSize: 34,
  },
  text: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5B3A1E',
    textAlign: 'center',
  },
  hint: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A0763F',
    textAlign: 'center',
  },
  reward: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2E9E4F',
    textAlign: 'center',
  },
  button: {
    marginTop: 6,
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#5CC85C',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '900',
    color: 'white',
  },
  cancel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A0763F',
  },
});
