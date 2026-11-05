import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type HostInstance } from 'react-native';

import type { AnimalsTab } from '@/components/animals-panel';
import { ANIMALS, MAX_LEVEL, moodFor, type Mood } from '@/game/config';
import { formatNumber } from '@/game/format';
import { fullnessAt, skillCost, skillUnlockAt, type ParkAnimal } from '@/game/state';

type Props = {
  animals: ParkAnimal[];
  now: number;
  gold: number;
  /** "Daha çok ziyaretçi" yükseltmesinin kazanç çarpanı. */
  incomeBonus: number;
  /** Bulunan hayvanların seviyeleri; bulunmayanın alanında soru işareti durur. */
  discovered: number[];
  onOpenAnimals: (tab: AnimalsTab) => void;
  /** Bir alana dokunulunca o hayvanın alanı açılır. */
  onOpenEnclosure: (level: number) => void;
  /** Rehberin eli Hayvanlarım düğmesini gösterebilsin diye düğmenin yeri ölçülür ("animals"). */
  targetRef: (id: string) => (view: HostInstance | null) => void;
};

/** Bir sırada kaç alan var; 10 hayvan iki sıraya dizilir. */
const PER_ROW = 5;

/** Ruh hallerinin kötüden iyiye sırası; alanda en kötü durumdaki hayvanın işareti gösterilir. */
const MOOD_ORDER: Mood[] = ['leaving', 'sad', 'hungry', 'happy'];
const MOOD_BUBBLE: Record<Mood, string | null> = {
  happy: null,
  hungry: '🍖',
  sad: '😢',
  leaving: '😭',
};

/** Yeteneğin bir sonraki seviyesi şimdi geliştirilebilir mi: süre dolmuş ve altın yetiyor. */
export function skillReady(animal: ParkAnimal, now: number, gold: number, bonus: number): boolean {
  const unlockAt = skillUnlockAt(animal);
  const cost = skillCost(animal, bonus);
  return unlockAt !== null && cost !== null && now >= unlockAt && gold >= cost;
}

/**
 * Hayvanat bahçesi: her hayvanın kendi alanı var. Alanda o türden kaç hayvan olduğu, acıkan olup
 * olmadığı görünür; dokununca alan büyür ve hayvanlar tek tek gezilir.
 */
export function Zoo({ animals, now, gold, incomeBonus, discovered, onOpenAnimals, onOpenEnclosure, targetRef }: Props) {
  const someoneHungry = animals.some((a) => moodFor(fullnessAt(a, now)) !== 'happy');
  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  const rows = [levels.slice(0, PER_ROW), levels.slice(PER_ROW)];

  return (
    <View style={styles.zoo}>
      <View style={styles.header}>
        <Pressable ref={targetRef('animals')} style={styles.myAnimals} onPress={() => onOpenAnimals('animals')}>
          <Text style={styles.myAnimalsText}>🐾 Hayvanlarım</Text>
          {someoneHungry && <View style={styles.dot} />}
        </Pressable>
      </View>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((level) => (
            <EnclosureTile
              key={level}
              level={level}
              animals={animals.filter((a) => a.level === level)}
              found={discovered.includes(level)}
              now={now}
              gold={gold}
              incomeBonus={incomeBonus}
              onPress={() => onOpenEnclosure(level)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

type TileProps = {
  level: number;
  /** Bu alandaki hayvanlar (aynı tür). */
  animals: ParkAnimal[];
  found: boolean;
  now: number;
  gold: number;
  incomeBonus: number;
  onPress: () => void;
};

function EnclosureTile({ level, animals, found, now, gold, incomeBonus, onPress }: TileProps) {
  const config = ANIMALS[level - 1];
  const moods = animals.map((a) => moodFor(fullnessAt(a, now)));
  const worst = MOOD_ORDER.find((m) => moods.includes(m)) ?? 'happy';
  const bubble = animals.length > 0 ? MOOD_BUBBLE[worst] : null;
  // En son altın düşüren hayvanın kazancı alanın üstünde uçar.
  const lastDrop = animals.reduce<ParkAnimal | null>(
    (best, a) => (a.lastDropAt !== null && (best?.lastDropAt ?? -1) < a.lastDropAt ? a : best),
    null,
  );
  const star = animals.some((a) => skillReady(a, now, gold, incomeBonus));
  const shiny = animals.some((a) => a.variant.shiny);

  return (
    <Pressable style={styles.tile} onPress={onPress} disabled={animals.length === 0}>
      <View style={[styles.box, animals.length === 0 && styles.boxEmpty]}>
        {!found ? (
          <Text style={styles.unknown}>?</Text>
        ) : animals.length === 0 ? (
          // Bulunmuş ama şu an parkta yok: silik durur, alan boş görünmesin.
          <Text style={[styles.emoji, styles.faded]}>{config.emoji}</Text>
        ) : (
          <BobbingEmoji emoji={config.emoji} still={worst === 'sad' || worst === 'leaving'} />
        )}
        {animals.length > 1 && <Text style={styles.count}>×{animals.length}</Text>}
        {shiny && <Text style={styles.shiny}>✨</Text>}
      </View>
      {bubble && <Text style={styles.moodBubble}>{bubble}</Text>}
      {star && <Text style={styles.skillBubble}>⭐</Text>}
      {lastDrop && <CoinPop key={lastDrop.lastDropAt} amount={lastDrop.lastDropAmount} />}
      <Text style={styles.label} numberOfLines={1}>
        {found ? config.name : '???'}
      </Text>
    </Pressable>
  );
}

/** Mutlu hayvan alanında hafifçe zıplar; üzgün hayvan kıpırdamaz. */
function BobbingEmoji({ emoji, still }: { emoji: string; still: boolean }) {
  const [bob] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (still) {
      bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(400 + Math.random() * 1200),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, still]);

  return (
    <Animated.Text
      style={[
        styles.emoji,
        { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] },
      ]}>
      {emoji}
    </Animated.Text>
  );
}

function CoinPop({ amount }: { amount: number }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, [progress]);

  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.coinPop,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) }],
        },
      ]}>
      +{formatNumber(amount)}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  zoo: {
    flex: 1,
    minHeight: 200,
    marginHorizontal: 12,
    paddingHorizontal: 6,
    paddingBottom: 6,
    borderRadius: 24,
    backgroundColor: '#9BD770',
    borderWidth: 4,
    borderColor: '#7DBB55',
    gap: 4,
  },
  header: {
    alignItems: 'center',
    paddingTop: 6,
  },
  myAnimals: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,248,232,0.95)',
    borderWidth: 2,
    borderColor: '#F2B84B',
  },
  myAnimalsText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  dot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF4D4D',
    borderWidth: 2,
    borderColor: 'white',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
  },
  box: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#8B5A2B',
    backgroundColor: '#C8EFA0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxEmpty: {
    borderColor: 'rgba(139,90,43,0.45)',
    backgroundColor: 'rgba(200,239,160,0.5)',
  },
  emoji: {
    fontSize: 28,
  },
  faded: {
    opacity: 0.35,
  },
  unknown: {
    fontSize: 22,
    fontWeight: '900',
    color: 'rgba(91,58,30,0.35)',
  },
  count: {
    position: 'absolute',
    right: 3,
    bottom: 1,
    fontSize: 12,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  shiny: {
    position: 'absolute',
    left: 3,
    bottom: 2,
    fontSize: 11,
  },
  moodBubble: {
    position: 'absolute',
    top: -8,
    right: -4,
    fontSize: 15,
  },
  skillBubble: {
    position: 'absolute',
    top: -8,
    left: -4,
    fontSize: 13,
  },
  coinPop: {
    position: 'absolute',
    top: 0,
    color: '#FFE14D',
    fontSize: 13,
    fontWeight: '900',
    textShadowColor: '#7A4B00',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '900',
    color: '#3E6B26',
  },
});
