import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { COLOR_HEX } from '@/game/colors';
import { animalFor, MAX_SKILL, moodFor, skillFor, type Mood } from '@/game/config';
import { formatNumber, formatWait } from '@/game/format';
import {
  animalIncomePerSecond,
  fullnessAt,
  releaseValue,
  skillCost,
  skillUnlockAt,
  type ParkAnimal,
} from '@/game/state';

type Props = {
  animals: ParkAnimal[];
  now: number;
  gold: number;
  /** "Daha çok ziyaretçi" yükseltmesinin kazanç çarpanı. */
  incomeBonus: number;
  /** Bütün aç hayvanları doyurmanın bedeli; 0 ise herkes tok. */
  feedCost: number;
  canFeed: boolean;
  onFeed: () => void;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onRelease: (id: number) => void;
  onUpgradeSkill: (id: number) => void;
};

/** Yeteneğin bir sonraki seviyesi şimdi geliştirilebilir mi: süre dolmuş ve altın yetiyor. */
function skillReady(animal: ParkAnimal, now: number, gold: number, bonus: number): boolean {
  const unlockAt = skillUnlockAt(animal);
  const cost = skillCost(animal, bonus);
  return unlockAt !== null && cost !== null && now >= unlockAt && gold >= cost;
}

/** Üzgün ve kaçmak üzere olan hayvan gezmez, oturur. */
function isStill(mood: Mood): boolean {
  return mood === 'sad' || mood === 'leaving';
}

/** Hayvanların parkın kenarından uzaklığı; başlarındaki işaret ve altlarındaki çubuk kesilmesin. */
const PARK_MARGIN = 8;
const BUBBLE_ROOM = 22;
/** Altta yan yana oturan hayvanlar arasındaki en büyük mesafe. */
const REST_STEP = 58;

/** Hayvanın ekrandaki yüksekliği: emoji, renk izi ve tokluk çubuğu. */
function animalHeight(size: number): number {
  return size * 1.25 + 14;
}

/** Hayvanın başının üstünde ruh haline göre çıkan işaret. */
const MOOD_BUBBLE: Record<Mood, string | null> = {
  happy: null,
  hungry: '🍖',
  sad: '😢',
  leaving: '😭',
};

const FULLNESS_COLOR: Record<Mood, string> = {
  happy: '#5CC85C',
  hungry: '#FFB020',
  sad: '#FF7A45',
  leaving: '#FF4D4D',
};

const DECORATIONS = [
  { emoji: '🌳', top: '6%', left: '4%' },
  { emoji: '🌳', top: '10%', left: '84%' },
  { emoji: '🌷', top: '78%', left: '8%' },
  { emoji: '🌼', top: '84%', left: '88%' },
  { emoji: '🪨', top: '48%', left: '90%' },
] as const;

export function Park({
  animals,
  now,
  gold,
  incomeBonus,
  feedCost,
  canFeed,
  onFeed,
  selectedId,
  onSelect,
  onRelease,
  onUpgradeSkill,
}: Props) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const selected = animals.find((a) => a.id === selectedId) ?? null;
  const selectedFullness = selected ? fullnessAt(selected, now) : 0;

  // Üzgün hayvanlar parkın altında yan yana oturur; köşeye sıkışınca başlarındaki işaret görünmüyordu.
  const resting = animals.filter((a) => isStill(moodFor(fullnessAt(a, now))));
  const restStep = Math.min(REST_STEP, (area.width - 2 * PARK_MARGIN - REST_STEP) / Math.max(1, resting.length - 1));
  const restingX = new Map(resting.map((a, i) => [a.id, PARK_MARGIN + i * restStep]));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  };

  return (
    <View style={styles.park} onLayout={onLayout}>
      {DECORATIONS.map((d, i) => (
        <Text key={i} style={[styles.decoration, { top: d.top, left: d.left }]}>
          {d.emoji}
        </Text>
      ))}

      {animals.length === 0 && (
        <Text style={styles.empty}>Yumurtayı kuluçkaya koy, hayvanın burada gezsin!</Text>
      )}

      {area.width > 0 &&
        animals.map((animal) => (
          <WanderingAnimal
            key={animal.id}
            animal={animal}
            fullness={fullnessAt(animal, now)}
            restX={restingX.get(animal.id) ?? null}
            skillReady={skillReady(animal, now, gold, incomeBonus)}
            area={area}
            selected={animal.id === selectedId}
            onPress={() => onSelect(animal.id === selectedId ? null : animal.id)}
          />
        ))}

      {animals.length > 0 && (
        <Pressable style={[styles.bowl, !canFeed && styles.bowlDisabled]} disabled={!canFeed} onPress={onFeed}>
          <Text style={styles.bowlIcon}>🥣</Text>
          <Text style={styles.bowlText}>{feedCost > 0 ? `Besle 🪙 ${formatNumber(feedCost)}` : 'Herkes tok'}</Text>
        </Pressable>
      )}

      {selected && (
        <View style={styles.panel}>
          <View style={styles.panelInfo}>
            <Text style={styles.panelText}>
              {animalFor(selected.level).emoji} {animalFor(selected.level).name} ·{' '}
              {formatNumber(animalIncomePerSecond(selected, incomeBonus, now))}/sn
            </Text>
            {/* Tokluk çubuğu: yeşil tok, sarı acıkmış, turuncu üzgün, kırmızı kaçmak üzere. */}
            <View style={styles.fullnessBar}>
              <View
                style={[
                  styles.fullnessFill,
                  {
                    width: `${Math.max(4, selectedFullness * 100)}%`,
                    backgroundColor: FULLNESS_COLOR[moodFor(selectedFullness)],
                  },
                ]}
              />
            </View>
            <Text style={styles.skillText}>
              {'★'.repeat(selected.skill)}
              <Text style={styles.skillEmpty}>{'★'.repeat(MAX_SKILL - selected.skill)}</Text> {skillFor(selected.level).name}
              {selected.skill > 0 && ` +%${Math.round(skillFor(selected.level).bonuses[selected.skill - 1] * 100)}`}
            </Text>
          </View>
          <View style={styles.panelActions}>
            <SkillButton
              animal={selected}
              now={now}
              gold={gold}
              bonus={incomeBonus}
              onPress={() => onUpgradeSkill(selected.id)}
            />
            <Pressable style={styles.releaseButton} onPress={() => onRelease(selected.id)}>
              <Text style={styles.releaseText}>Doğaya sal +{formatNumber(releaseValue(selected, incomeBonus))} 🪙</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

type SkillButtonProps = {
  animal: ParkAnimal;
  now: number;
  gold: number;
  bonus: number;
  onPress: () => void;
};

/** Yetenek düğmesi: en üst seviye, kilitli (kalan süre) ya da altınla geliştir. */
function SkillButton({ animal, now, gold, bonus, onPress }: SkillButtonProps) {
  const unlockAt = skillUnlockAt(animal);
  const cost = skillCost(animal, bonus);
  if (unlockAt === null || cost === null) {
    return (
      <View style={[styles.skillButton, styles.skillMaxed]}>
        <Text style={styles.skillButtonText}>★ Yetenek tam!</Text>
      </View>
    );
  }
  if (now < unlockAt) {
    return (
      <View style={[styles.skillButton, styles.skillLocked]}>
        <Text style={styles.skillButtonText}>🔒 {formatWait((unlockAt - now) / 1000)} sonra</Text>
      </View>
    );
  }
  return (
    <Pressable style={[styles.skillButton, gold < cost && styles.skillLocked]} disabled={gold < cost} onPress={onPress}>
      <Text style={styles.skillButtonText}>★ Geliştir 🪙 {formatNumber(cost)}</Text>
    </Pressable>
  );
}

type WanderingProps = {
  animal: ParkAnimal;
  fullness: number;
  /** Üzgünse altta oturacağı yerin x'i; gezen hayvan için null. */
  restX: number | null;
  /** Yetenek şimdi geliştirilebiliyorsa hayvanın üstünde küçük bir yıldız çıkar. */
  skillReady: boolean;
  area: { width: number; height: number };
  selected: boolean;
  onPress: () => void;
};

function WanderingAnimal({ animal, fullness, restX, skillReady, area, selected, onPress }: WanderingProps) {
  const size = 34 + animal.level * 3;
  const mood = moodFor(fullness);
  const [position] = useState(() => new Animated.ValueXY());
  const placed = useRef(false);
  // Dokümana göre: mutlu hayvan oynar, acıkmış hayvan yavaş yürür, üzgün hayvan oturur.
  const pace = mood === 'hungry' ? 2.5 : 1;

  useEffect(() => {
    // Hayvan, başındaki işaret ve altındaki çubuk parkın içinde kalacak şekilde gezer.
    const minY = BUBBLE_ROOM;
    const maxX = Math.max(PARK_MARGIN, area.width - size - PARK_MARGIN);
    const maxY = Math.max(minY, area.height - animalHeight(size) - PARK_MARGIN);
    const randomPoint = () => ({
      x: PARK_MARGIN + Math.random() * (maxX - PARK_MARGIN),
      y: minY + Math.random() * (maxY - minY),
    });
    let alive = true;

    // İlk yer bir kez seçilir; ruh hali değişince hayvan bulunduğu yerden devam eder.
    if (!placed.current) {
      position.setValue(randomPoint());
      placed.current = true;
    }
    if (restX !== null) {
      // Üzgün hayvan parkın altına yürür ve diğer üzgün hayvanların yanına oturur.
      position.stopAnimation(() => {
        Animated.timing(position, {
          toValue: { x: restX, y: maxY },
          duration: 3000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
      return () => position.stopAnimation();
    }

    const walk = () => {
      if (!alive) return;
      Animated.sequence([
        Animated.timing(position, {
          toValue: randomPoint(),
          duration: (2500 + Math.random() * 2500) * pace,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay((600 + Math.random() * 1800) * pace),
      ]).start(({ finished }) => finished && walk());
    };

    walk();
    return () => {
      alive = false;
      position.stopAnimation();
    };
  }, [area.width, area.height, size, position, restX, pace]);

  const bubble = MOOD_BUBBLE[mood];

  return (
    <Animated.View style={[styles.animal, { transform: position.getTranslateTransform() }]}>
      <Pressable onPress={onPress} hitSlop={8} style={{ alignItems: 'center' }}>
        {animal.lastDropAt !== null && <CoinPop key={animal.lastDropAt} amount={animal.lastDropAmount} />}
        {bubble && <Text style={styles.moodBubble}>{bubble}</Text>}
        {skillReady && <Text style={styles.skillBubble}>⭐</Text>}
        <Text style={{ fontSize: size, opacity: mood === 'leaving' ? 0.6 : 1 }}>{animalFor(animal.level).emoji}</Text>
        <View
          style={[
            styles.groundMark,
            {
              width: size * 0.9,
              backgroundColor: COLOR_HEX[animal.variant.color],
              borderWidth: selected ? 2 : 0,
            },
          ]}
        />
        {/* Küçük tokluk çubuğu: çocuk dokunmadan, bir bakışta kimin acıktığını görsün. */}
        <View style={[styles.miniBar, { width: size * 0.8 }]}>
          <View
            style={[
              styles.miniBarFill,
              { width: `${Math.max(8, fullness * 100)}%`, backgroundColor: FULLNESS_COLOR[mood] },
            ]}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function CoinPop({ amount }: { amount: number }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, [progress]);

  return (
    <Animated.Text
      style={[
        styles.coinPop,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) }],
        },
      ]}>
      +{formatNumber(amount)}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  park: {
    flex: 1,
    minHeight: 180,
    marginHorizontal: 12,
    borderRadius: 24,
    backgroundColor: '#9BD770',
    borderWidth: 4,
    borderColor: '#7DBB55',
    overflow: 'hidden',
  },
  decoration: {
    position: 'absolute',
    fontSize: 28,
  },
  empty: {
    position: 'absolute',
    top: '40%',
    left: 24,
    right: 24,
    textAlign: 'center',
    color: '#3E6B26',
    fontSize: 15,
    fontWeight: '700',
  },
  animal: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  groundMark: {
    height: 8,
    marginTop: -6,
    borderRadius: 8,
    opacity: 0.7,
    borderColor: 'white',
  },
  coinPop: {
    position: 'absolute',
    top: -18,
    color: '#FFE14D',
    fontSize: 15,
    fontWeight: '900',
    textShadowColor: '#7A4B00',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  panel: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,248,232,0.96)',
    gap: 8,
  },
  panelInfo: {
    gap: 6,
  },
  panelActions: {
    flexDirection: 'row',
    gap: 8,
  },
  skillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFB020',
  },
  skillEmpty: {
    color: 'rgba(91,58,30,0.2)',
  },
  skillButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#B983FF',
  },
  skillLocked: {
    opacity: 0.5,
  },
  skillMaxed: {
    backgroundColor: '#8EDB8E',
  },
  skillButtonText: {
    fontWeight: '800',
    color: 'white',
  },
  skillBubble: {
    position: 'absolute',
    top: -20,
    left: -12,
    fontSize: 16,
  },
  panelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5B3A1E',
  },
  fullnessBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(91,58,30,0.15)',
    overflow: 'hidden',
  },
  fullnessFill: {
    height: '100%',
    borderRadius: 4,
  },
  miniBar: {
    height: 8,
    marginTop: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(91,58,30,0.35)',
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
  },
  moodBubble: {
    position: 'absolute',
    top: -20,
    right: -12,
    fontSize: 18,
  },
  bowl: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,248,232,0.95)',
    borderWidth: 2,
    borderColor: '#F2B84B',
  },
  bowlDisabled: {
    opacity: 0.6,
  },
  bowlIcon: {
    fontSize: 20,
  },
  bowlText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5B3A1E',
  },
  releaseButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFC93C',
  },
  releaseText: {
    fontWeight: '800',
    color: '#5B3A1E',
  },
});
