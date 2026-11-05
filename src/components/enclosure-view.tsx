import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { animalFor, FULLNESS_COLOR, MAX_SKILL, moodFor, skillFor } from '@/game/config';
import { formatNumber, formatWait } from '@/game/format';
import {
  animalIncomePerSecond,
  canFeed,
  foodStock,
  fullnessAt,
  hungryAt,
  releaseValue,
  skillCost,
  skillUnlockAt,
  stateIncomeBonus,
  type GameState,
  type ParkAnimal,
} from '@/game/state';

type Props = {
  state: GameState;
  /** Hangi hayvanın alanı açık. */
  level: number;
  onFeed: (id: number) => void;
  /** Yem bitince yem dükkanı açılır. */
  onBuyFood: () => void;
  onUpgradeSkill: (id: number) => void;
  onRelease: (id: number) => void;
  /** Sevince telefon hafifçe titrer. */
  onPet: () => void;
  onClose: () => void;
};

const HEART_COUNT = 5;

/**
 * Bir hayvanın alanı: ortada tek bir büyük hayvan. Bu türden birden çok hayvan varsa oklarla
 * sırayla gezilir. Hayvan beslenir, sevilir, yeteneği geliştirilir ya da doğaya salınır.
 */
export function EnclosureView({ state, level, onFeed, onBuyFood, onUpgradeSkill, onRelease, onPet, onClose }: Props) {
  const animals = state.park.filter((a) => a.level === level);
  // İlk açılışta en aç hayvan gösterilir: çocuk önce onu beslesin.
  const [index, setIndex] = useState(() => {
    let hungriest = 0;
    animals.forEach((a, i) => {
      if (fullnessAt(a, state.now) < fullnessAt(animals[hungriest], state.now)) hungriest = i;
    });
    return hungriest;
  });
  const [petCount, setPetCount] = useState(0);
  const config = animalFor(level);

  if (animals.length === 0) return null;
  // Salınan hayvan listeden çıkınca sıra kaymasın.
  const current = Math.min(index, animals.length - 1);
  const animal = animals[current];
  const go = (step: number) => setIndex((current + step + animals.length) % animals.length);
  const pet = () => {
    setPetCount((c) => c + 1);
    onPet();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {config.emoji} {config.name} alanı
          </Text>
          <Text style={styles.gold}>🪙 {formatNumber(state.gold)}</Text>
          <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.stage}>
          <Arrow direction="left" visible={animals.length > 1} onPress={() => go(-1)} />
          <Habitat key={animal.id} animal={animal} state={state} petCount={petCount} onPet={pet} />
          <Arrow direction="right" visible={animals.length > 1} onPress={() => go(1)} />
        </View>

        {animals.length > 1 && (
          <View style={styles.dots}>
            {animals.map((a, i) => (
              <View key={a.id} style={[styles.pageDot, i === current && styles.pageDotActive]} />
            ))}
          </View>
        )}

        <AnimalInfo
          animal={animal}
          state={state}
          onFeed={() => onFeed(animal.id)}
          onBuyFood={onBuyFood}
          onPet={pet}
          onUpgradeSkill={() => onUpgradeSkill(animal.id)}
          onRelease={() => onRelease(animal.id)}
        />
      </View>
    </View>
  );
}

function Arrow({ direction, visible, onPress }: { direction: 'left' | 'right'; visible: boolean; onPress: () => void }) {
  // Tek hayvan varken ok görünmez ama yerini korur; alan ortada kalsın.
  return (
    <Pressable style={[styles.arrow, !visible && styles.hidden]} disabled={!visible} onPress={onPress} hitSlop={8}>
      <Text style={styles.arrowText}>{direction === 'left' ? '◀' : '▶'}</Text>
    </Pressable>
  );
}

type HabitatProps = {
  animal: ParkAnimal;
  state: GameState;
  /** Kaç kez sevildi; her sevgide kalpler uçar. */
  petCount: number;
  onPet: () => void;
};

/** Alanın içi: büyük hayvan. Dokununca sevilir, zıplar ve kalpler çıkar. */
function Habitat({ animal, state, petCount, onPet }: HabitatProps) {
  const config = animalFor(animal.level);
  const mood = moodFor(fullnessAt(animal, state.now));
  const sad = mood === 'sad' || mood === 'leaving';
  const [bob] = useState(() => new Animated.Value(0));
  const [jump] = useState(() => new Animated.Value(0));

  // Mutlu hayvan durduğu yerde hafifçe sallanır; üzgün hayvan oturur.
  useEffect(() => {
    if (sad) {
      bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, sad]);

  useEffect(() => {
    if (petCount === 0) return;
    jump.setValue(0);
    Animated.sequence([
      Animated.timing(jump, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(jump, { toValue: 0, duration: 260, easing: Easing.bounce, useNativeDriver: true }),
    ]).start();
  }, [jump, petCount]);

  const bubble = mood === 'hungry' ? '🍖' : mood === 'sad' ? '😢' : mood === 'leaving' ? '😭' : null;

  return (
    <Pressable style={styles.habitat} onPress={onPet}>
      <Text style={[styles.decoration, { top: 10, left: 10 }]}>🌳</Text>
      <Text style={[styles.decoration, { bottom: 10, right: 12 }]}>🌼</Text>
      <Text style={[styles.decoration, { bottom: 14, left: 16, fontSize: 18 }]}>🌷</Text>
      {animal.lastDropAt !== null && <CoinPop key={animal.lastDropAt} amount={animal.lastDropAmount} />}
      <Animated.View
        style={{
          alignItems: 'center',
          transform: [
            { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
            { translateY: jump.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) },
            { scale: jump.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
          ],
        }}>
        {bubble && <Text style={styles.moodBubble}>{bubble}</Text>}
        <Text style={[styles.bigEmoji, mood === 'leaving' && { opacity: 0.6 }]}>{config.emoji}</Text>
        {animal.variant.shiny && <Text style={styles.shiny}>✨</Text>}
      </Animated.View>
      {petCount > 0 &&
        Array.from({ length: HEART_COUNT }, (_, i) => <Heart key={`${petCount}-${i}`} index={i} />)}
    </Pressable>
  );
}

/** Sevilince hayvanın üstünden yukarı uçan kalp. */
function Heart({ index }: { index: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const [drift] = useState(() => (index - (HEART_COUNT - 1) / 2) * 26 + (Math.random() - 0.5) * 12);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 900 + index * 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress, index]);

  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.heart,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -110] }) },
            { scale: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.1, 0.9] }) },
          ],
        },
      ]}>
      ❤️
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
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) }],
        },
      ]}>
      +{formatNumber(amount)}
    </Animated.Text>
  );
}

type InfoProps = {
  animal: ParkAnimal;
  state: GameState;
  onFeed: () => void;
  onBuyFood: () => void;
  onPet: () => void;
  onUpgradeSkill: () => void;
  onRelease: () => void;
};

/** Hayvanın kazancı, tokluğu, yeteneği ve düğmeleri. */
function AnimalInfo({ animal, state, onFeed, onBuyFood, onPet, onUpgradeSkill, onRelease }: InfoProps) {
  const config = animalFor(animal.level);
  const bonus = stateIncomeBonus(state);
  const fullness = fullnessAt(animal, state.now);
  const mood = moodFor(fullness);
  const stock = foodStock(state, animal.level);
  const unlockAt = skillUnlockAt(animal);
  const cost = skillCost(animal, bonus);
  const skill = skillFor(animal.level);

  return (
    <View style={styles.info}>
      <View style={styles.infoRow}>
        <Text style={styles.stars}>
          {'★'.repeat(animal.skill)}
          <Text style={styles.starsEmpty}>{'★'.repeat(MAX_SKILL - animal.skill)}</Text>{' '}
          <Text style={styles.skillName}>
            {skill.name}
            {animal.skill > 0 && ` +%${Math.round(skill.bonuses[animal.skill - 1] * 100)}`}
          </Text>
        </Text>
        <Text style={styles.income}>🪙 {formatNumber(animalIncomePerSecond(animal, bonus, state.now))}/sn</Text>
      </View>
      {/* Tokluk çubuğu: yeşil tok, sarı acıkmış, turuncu üzgün, kırmızı kaçmak üzere. */}
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.max(4, fullness * 100)}%`, backgroundColor: FULLNESS_COLOR[mood] }]} />
      </View>
      <Text style={[styles.status, mood === 'leaving' && styles.statusAlarm, mood === 'happy' && styles.statusCalm]}>
        {mood === 'happy'
          ? `⏰ ${formatWait((hungryAt(animal) - state.now) / 1000)} sonra acıkır`
          : mood === 'leaving'
            ? '😭 Kaçmak üzere! Hemen besle!'
            : '🍖 Şimdi besle!'}
      </Text>

      <View style={styles.actions}>
        {stock > 0 ? (
          <Pressable
            style={[styles.button, styles.feed, !canFeed(state, animal) && styles.disabled]}
            disabled={!canFeed(state, animal)}
            onPress={onFeed}>
            <Text style={styles.buttonText}>
              {config.food.emoji} Besle ×{stock}
            </Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.button, styles.buyFood]} onPress={onBuyFood}>
            <Text style={styles.buttonText}>{config.food.emoji} Yem al</Text>
          </Pressable>
        )}
        <Pressable style={[styles.button, styles.pet]} onPress={onPet}>
          <Text style={styles.buttonText}>❤️ Sev</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        {unlockAt === null || cost === null ? (
          <View style={[styles.button, styles.skillMaxed]}>
            <Text style={styles.buttonText}>★ Yetenek tam</Text>
          </View>
        ) : state.now < unlockAt ? (
          <View style={[styles.button, styles.skill, styles.disabled]}>
            <Text style={styles.buttonText}>🔒 {formatWait((unlockAt - state.now) / 1000)}</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.button, styles.skill, state.gold < cost && styles.disabled]}
            disabled={state.gold < cost}
            onPress={onUpgradeSkill}>
            <Text style={styles.buttonText}>★ Geliştir {formatNumber(cost)}</Text>
          </Pressable>
        )}
        <Pressable style={[styles.button, styles.release]} onPress={onRelease}>
          <Text style={styles.releaseText}>Doğaya sal +{formatNumber(releaseValue(animal, bonus))}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,20,10,0.55)',
    justifyContent: 'flex-end',
    zIndex: 90,
    elevation: 90,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFF8E8',
    paddingTop: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  gold: {
    fontSize: 17,
    fontWeight: '800',
    color: '#5B3A1E',
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1E2C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  arrow: {
    width: 44,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F1E2C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 24,
    color: '#5B3A1E',
  },
  hidden: {
    opacity: 0,
  },
  habitat: {
    flex: 1,
    maxWidth: 280,
    height: 230,
    borderRadius: 24,
    borderWidth: 5,
    borderColor: '#8B5A2B',
    backgroundColor: '#C8EFA0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  decoration: {
    position: 'absolute',
    fontSize: 26,
  },
  bigEmoji: {
    fontSize: 110,
  },
  moodBubble: {
    position: 'absolute',
    top: -14,
    right: -18,
    fontSize: 30,
  },
  shiny: {
    position: 'absolute',
    top: 8,
    right: -14,
    fontSize: 26,
  },
  heart: {
    position: 'absolute',
    top: '40%',
    fontSize: 28,
  },
  coinPop: {
    position: 'absolute',
    top: 24,
    color: '#FFE14D',
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: '#7A4B00',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(91,58,30,0.2)',
  },
  pageDotActive: {
    backgroundColor: '#8B5A2B',
    width: 20,
  },
  info: {
    gap: 8,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stars: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFB020',
  },
  starsEmpty: {
    color: 'rgba(91,58,30,0.2)',
  },
  skillName: {
    fontSize: 14,
    color: '#5B3A1E',
  },
  income: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5B3A1E',
  },
  bar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(91,58,30,0.15)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  status: {
    fontSize: 15,
    fontWeight: '800',
    color: '#C2410C',
  },
  statusAlarm: {
    color: '#DC2626',
  },
  statusCalm: {
    color: '#5B3A1E',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '900',
    color: 'white',
  },
  feed: {
    backgroundColor: '#5CC85C',
  },
  buyFood: {
    backgroundColor: '#FF9F45',
  },
  pet: {
    backgroundColor: '#FF7AA8',
  },
  skill: {
    backgroundColor: '#B983FF',
  },
  skillMaxed: {
    backgroundColor: '#8EDB8E',
  },
  release: {
    backgroundColor: '#FFC93C',
  },
  releaseText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  disabled: {
    opacity: 0.5,
  },
});
