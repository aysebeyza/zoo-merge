import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import {
  animalFor,
  dayNumber,
  FULLNESS_COLOR,
  HAPPY_MAX,
  MAX_SKILL,
  moodFor,
  PET_COOLDOWN_SEC,
  PET_HAPPINESS,
  skillFor,
  TASTE_HAPPINESS,
  TASTES,
  foodFor,
  FOODS,
  WASH_HAPPINESS,
  wishFor,
  XP_FEED,
  XP_WASH,
  xpForHappy,
  xpForWish,
  type FoodId,
  type Taste,
} from '@/game/config';
import { formatNumber, formatWait } from '@/game/format';
import {
  animalIncomePerSecond,
  canFeed,
  foodPrice,
  foodStock,
  foodTaste,
  isDirty,
  poopGold,
  fullnessAt,
  hungryAt,
  releaseValue,
  skillCost,
  skillUnlockAt,
  stateIncomeBonus,
  wishPending,
  type GameState,
  type ParkAnimal,
} from '@/game/state';

type Props = {
  state: GameState;
  /** Hangi hayvanın alanı açık. */
  level: number;
  /** Hayvanı bir yiyecekle besler; stokta yoksa önce bir tane alınır. */
  onFeed: (id: number, food: FoodId, buyFirst: boolean) => void;
  onUpgradeSkill: (id: number) => void;
  onRelease: (id: number) => void;
  /** Sevgi: mutluluk dakikada bir artar, kalpler hep uçar. */
  onPet: (id: number) => void;
  onWash: (id: number) => void;
  onCleanPoop: (level: number) => void;
  onClose: () => void;
};

const HEART_COUNT = 5;

/** Hayvanın tepkisi: yüzünde çıkan işaret ve altta yazan söz. */
const REACTION: Record<Taste | 'wash' | 'happy', { face: string; text: string }> = {
  wish: { face: '😍', text: 'Tam da bunu istiyordum!' },
  like: { face: '😋', text: 'Bayıldım!' },
  okay: { face: '🙂', text: 'Fena değil.' },
  dislike: { face: '🤢', text: 'Bunu yemem!' },
  wash: { face: '🤩', text: 'Mis gibi oldum!' },
  happy: { face: '🥰', text: 'Çok mutluyum!' },
};

type Reaction = { key: number; kind: keyof typeof REACTION; xp: number };

/** Süngerle bu kadar (piksel) ovunca hayvan temizlenir. */
const WASH_RUB = 900;
/** Alandaki kakaların yerleri. */
const POOP_SPOTS = [
  { left: '14%', bottom: 14 },
  { left: '72%', bottom: 40 },
  { left: '44%', bottom: 6 },
] as const;

/**
 * Bir hayvanın alanı: ortada tek bir büyük hayvan. Bu türden birden çok hayvan varsa oklarla
 * sırayla gezilir. Hayvan beslenir, sevilir, yeteneği geliştirilir ya da doğaya salınır.
 */
export function EnclosureView({
  state,
  level,
  onFeed,
  onUpgradeSkill,
  onRelease,
  onPet,
  onWash,
  onCleanPoop,
  onClose,
}: Props) {
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
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [washing, setWashing] = useState(false);
  const config = animalFor(level);

  if (animals.length === 0) return null;
  // Salınan hayvan listeden çıkınca sıra kaymasın.
  const current = Math.min(index, animals.length - 1);
  const animal = animals[current];
  const go = (step: number) => {
    setReaction(null);
    setWashing(false);
    setTrayOpen(false);
    setIndex((current + step + animals.length) % animals.length);
  };
  const pet = () => {
    setPetCount((c) => c + 1);
    // Sevgi mutluluğu dakikada bir artırır; çubuk dolacaksa yıldızı göster.
    if (state.now - animal.petAt >= PET_COOLDOWN_SEC * 1000 && animal.happiness + PET_HAPPINESS >= HAPPY_MAX) {
      setReaction({ key: Date.now(), kind: 'happy', xp: xpForHappy(animal.level) });
    }
    onPet(animal.id);
  };
  const feed = (food: FoodId, buyFirst: boolean) => {
    const taste = foodTaste(animal, food, state.now);
    if (taste === 'dislike') {
      // Sevmediğini yemez; yiyecek stokta kalır, tepside 🤢 işareti çıkar.
      setReaction({ key: Date.now(), kind: 'dislike', xp: 0 });
    } else {
      const full = animal.happiness + TASTE_HAPPINESS[taste] >= HAPPY_MAX;
      const xp = XP_FEED + (taste === 'wish' ? xpForWish(animal.level) : 0) + (full ? xpForHappy(animal.level) : 0);
      setReaction({ key: Date.now(), kind: taste, xp });
      setPetCount((c) => c + 1);
      setTrayOpen(false);
    }
    onFeed(animal.id, food, buyFirst);
  };
  const washed = () => {
    const full = animal.happiness + WASH_HAPPINESS >= HAPPY_MAX;
    setReaction({ key: Date.now(), kind: 'wash', xp: XP_WASH + (full ? xpForHappy(animal.level) : 0) });
    setWashing(false);
    setPetCount((c) => c + 1);
    onWash(animal.id);
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
          <Habitat
            key={animal.id}
            animal={animal}
            state={state}
            petCount={petCount}
            reaction={reaction}
            washing={washing}
            onPet={pet}
            onWashed={washed}
            onCleanPoop={() => onCleanPoop(level)}
          />
          <Arrow direction="right" visible={animals.length > 1} onPress={() => go(1)} />
        </View>

        {animals.length > 1 && (
          <View style={styles.dots}>
            {animals.map((a, i) => (
              <View key={a.id} style={[styles.pageDot, i === current && styles.pageDotActive]} />
            ))}
          </View>
        )}

        {trayOpen ? (
          <FoodTray animal={animal} state={state} onGive={feed} onClose={() => setTrayOpen(false)} />
        ) : washing ? (
          <View style={styles.info}>
            <Text style={styles.washHint}>🧽 Parmağınla hayvanın üstünü ov!</Text>
            <Pressable style={[styles.button, styles.cancel]} onPress={() => setWashing(false)}>
              <Text style={styles.releaseText}>Vazgeç</Text>
            </Pressable>
          </View>
        ) : (
          <AnimalInfo
            animal={animal}
            state={state}
            onOpenFood={() => setTrayOpen(true)}
            onWash={() => setWashing(true)}
            onPet={pet}
            onUpgradeSkill={() => onUpgradeSkill(animal.id)}
            onRelease={() => onRelease(animal.id)}
          />
        )}
      </View>
    </View>
  );
}

function Arrow({
  direction,
  visible,
  onPress,
}: {
  direction: 'left' | 'right';
  visible: boolean;
  onPress: () => void;
}) {
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
  /** Son tepkisi; birkaç saniye görünür. */
  reaction: Reaction | null;
  /** Yıkanıyor: alana dokunmak süngerle ovmak olur. */
  washing: boolean;
  onPet: () => void;
  onWashed: () => void;
  onCleanPoop: () => void;
};

/** Alanın içi: büyük hayvan. Dokununca sevilir, zıplar ve kalpler çıkar. */
function Habitat({ animal, state, petCount, reaction, washing, onPet, onWashed, onCleanPoop }: HabitatProps) {
  const config = animalFor(animal.level);
  const mood = moodFor(fullnessAt(animal, state.now));
  const sad = mood === 'sad' || mood === 'leaving';
  const [bob] = useState(() => new Animated.Value(0));
  const [jump] = useState(() => new Animated.Value(0));
  const [shake] = useState(() => new Animated.Value(0));
  // Tepki birkaç saniye sonra kaybolur: süresi dolan tepkinin anahtarı saklanır.
  const [expiredKey, setExpiredKey] = useState<number | null>(null);
  const shownReaction = reaction && reaction.key !== expiredKey ? reaction : null;
  const wish = wishPending(animal, state.now) ? foodFor(wishFor(animal.level, dayNumber(state.now))) : null;
  const dirty = isDirty(animal, state.now);
  const poops = state.poops[animal.level] ?? 0;
  const [cleaned, setCleaned] = useState<{ key: number; amount: number } | null>(null);

  // Tepki birkaç saniye görünür; sevmediği ikramda hayvan başını sallar.
  useEffect(() => {
    if (!reaction) return;
    if (reaction.kind === 'dislike') {
      shake.setValue(0);
      Animated.sequence(
        [1, -1, 1, -1, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 90, useNativeDriver: true })),
      ).start();
    }
    const timer = setTimeout(() => setExpiredKey(reaction.key), 2500);
    return () => clearTimeout(timer);
  }, [reaction, shake]);

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
    <Pressable style={styles.habitat} onPress={onPet} disabled={washing}>
      <Text style={[styles.decoration, { top: 10, right: 10 }]}>🌳</Text>
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
            { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) },
          ],
        }}>
        {shownReaction ? (
          <Text style={styles.moodBubble}>{REACTION[shownReaction.kind].face}</Text>
        ) : (
          bubble && <Text style={styles.moodBubble}>{bubble}</Text>
        )}
        <Text style={[styles.bigEmoji, mood === 'leaving' && { opacity: 0.6 }]}>{config.emoji}</Text>
        {animal.variant.shiny && <Text style={styles.shiny}>✨</Text>}
        {/* Kirli hayvan: çamur lekeleri ve etrafında uçan sinekler. */}
        {dirty && (
          <>
            <View pointerEvents="none" style={[styles.mud, { top: 34, left: 20 }]} />
            <View pointerEvents="none" style={[styles.mud, { top: 74, right: 16, width: 12, height: 12 }]} />
            <View pointerEvents="none" style={[styles.mud, { bottom: 22, left: 42 }]} />
            <Fly delay={0} />
            <Fly delay={700} />
          </>
        )}
      </Animated.View>
      {/* Kakalar: dokununca temizlenir, küçük altın ve yıldız puanı gelir. */}
      {POOP_SPOTS.slice(0, poops).map((spot, i) => (
        <Pressable
          key={i}
          style={[styles.poop, spot]}
          hitSlop={10}
          disabled={washing}
          onPress={() => {
            setCleaned({ key: Date.now(), amount: poopGold(state) });
            onCleanPoop();
          }}>
          <Text style={styles.poopEmoji}>💩</Text>
        </Pressable>
      ))}
      {cleaned && <CoinPop key={cleaned.key} amount={cleaned.amount} />}
      {washing && <WashPad onDone={onWashed} />}
      {/* Günün isteği: hayvan bugün ne yemek istiyor. */}
      {wish && !shownReaction && (
        <View style={styles.wish}>
          <Text style={styles.wishEmoji}>{wish.emoji}</Text>
        </View>
      )}
      {shownReaction && (
        <View style={styles.reaction}>
          <Text style={styles.reactionText}>{REACTION[shownReaction.kind].text}</Text>
          {shownReaction.xp > 0 && <Text style={styles.reactionXp}>+{shownReaction.xp} ⭐</Text>}
        </View>
      )}
      {petCount > 0 && Array.from({ length: HEART_COUNT }, (_, i) => <Heart key={`${petCount}-${i}`} index={i} />)}
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

/** Kirli hayvanın etrafında dönen sinek. */
function Fly({ delay }: { delay: number }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 1600, delay, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.fly,
        {
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 50, 0, -50, 0] }) },
            { translateY: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [-40, 0, 30, 0, -40] }) },
          ],
        },
      ]}>
      🦟
    </Animated.Text>
  );
}

type Bubble = { id: number; x: number; y: number };

/**
 * Yıkama: alanın üstüne gelen görünmez katman. Parmak (ya da fare) gezdikçe köpükler çıkar, üstteki çubuk
 * dolar; çubuk dolunca hayvan temizlenir.
 */
function WashPad({ onDone }: { onDone: () => void }) {
  const [rubbed, setRubbed] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [last, setLast] = useState<{ x: number; y: number } | null>(null);
  const [done, setDone] = useState(false);

  const rub = (e: GestureResponderEvent) => {
    if (done) return;
    const { locationX: x, locationY: y } = e.nativeEvent;
    const step = last ? Math.hypot(x - last.x, y - last.y) : 60;
    setLast({ x, y });
    const total = rubbed + step;
    setRubbed(total);
    if (Math.floor(total / 70) > Math.floor(rubbed / 70)) {
      setBubbles((list) => [...list.slice(-11), { id: Date.now() + Math.random(), x, y }]);
    }
    if (total >= WASH_RUB) {
      setDone(true);
      onDone();
    }
  };

  return (
    <View
      style={styles.washPad}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={rub}
      onResponderMove={rub}
      onResponderRelease={() => setLast(null)}>
      <View style={styles.washBar} pointerEvents="none">
        <View style={[styles.washFill, { width: `${Math.min(100, (rubbed / WASH_RUB) * 100)}%` }]} />
      </View>
      {bubbles.map((b) => (
        <Text key={b.id} pointerEvents="none" style={[styles.bubble, { left: b.x - 14, top: b.y - 14 }]}>
          💦
        </Text>
      ))}
      {!last && bubbles.length === 0 && (
        <Text pointerEvents="none" style={styles.sponge}>
          🧽
        </Text>
      )}
    </View>
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
  onOpenFood: () => void;
  onWash: () => void;
  onPet: () => void;
  onUpgradeSkill: () => void;
  onRelease: () => void;
};

/** Hayvanın kazancı, tokluğu, yeteneği ve düğmeleri. */
function AnimalInfo({ animal, state, onOpenFood, onWash, onPet, onUpgradeSkill, onRelease }: InfoProps) {
  const bonus = stateIncomeBonus(state);
  const fullness = fullnessAt(animal, state.now);
  const mood = moodFor(fullness);
  const hungry = canFeed(state, animal);
  const dirty = isDirty(animal, state.now);
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
        <View
          style={[styles.barFill, { width: `${Math.max(4, fullness * 100)}%`, backgroundColor: FULLNESS_COLOR[mood] }]}
        />
      </View>
      {/* Mutluluk çubuğu: ikram ve sevgiyle dolar, dolunca bahçe yıldız puanı kazanır. */}
      <View style={styles.happyRow}>
        <Text style={styles.happyLabel}>💖</Text>
        <View style={[styles.bar, styles.happyBar]}>
          <View
            style={[
              styles.barFill,
              styles.happyFill,
              { width: `${Math.max(3, (animal.happiness / HAPPY_MAX) * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.happyXp}>+{xpForHappy(animal.level)} ⭐</Text>
      </View>
      <Text style={[styles.status, mood === 'leaving' && styles.statusAlarm, mood === 'happy' && styles.statusCalm]}>
        {mood === 'happy'
          ? `⏰ ${formatWait((hungryAt(animal) - state.now) / 1000)} sonra acıkır`
          : mood === 'leaving'
            ? '😭 Kaçmak üzere! Hemen besle!'
            : '🍖 Şimdi besle!'}
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.feed, !hungry && styles.disabled]}
          disabled={!hungry}
          onPress={onOpenFood}>
          <Text style={styles.buttonText}>{hungry ? '🍽️ Besle' : '😊 Tok'}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.wash, !dirty && styles.disabled]} disabled={!dirty} onPress={onWash}>
          <Text style={styles.buttonText}>{dirty ? '🧽 Yıka' : '✨ Temiz'}</Text>
        </Pressable>
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

type TrayProps = {
  animal: ParkAnimal;
  state: GameState;
  onGive: (food: FoodId, buyFirst: boolean) => void;
  onClose: () => void;
};

/**
 * Besleme tepsisi: bütün yiyecekler. Stokta varsa sayısı, yoksa fiyatı yazar; dokununca hayvana verilir
 * (yoksa önce alınır). Bu hayvana denenmiş yiyeceklerin yanında sevip sevmediği görünür.
 */
function FoodTray({ animal, state, onGive, onClose }: TrayProps) {
  const config = animalFor(animal.level);
  const price = foodPrice(state);
  const tried = state.triedFoods[animal.level] ?? [];
  const { likes, dislikes } = TASTES[animal.level];
  return (
    <View style={styles.info}>
      <View style={styles.infoRow}>
        <Text style={styles.trayTitle}>🍽️ {config.name} ne yesin?</Text>
        <Pressable style={styles.trayClose} onPress={onClose} hitSlop={8}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.tray}>
        {FOODS.map((f) => {
          const stock = foodStock(state, f.id);
          const affordable = stock > 0 || state.gold >= price;
          const mark = !tried.includes(f.id)
            ? null
            : likes.includes(f.id)
              ? '❤️'
              : dislikes.includes(f.id)
                ? '🤢'
                : '🙂';
          return (
            <Pressable
              key={f.id}
              style={[styles.trayItem, !affordable && styles.disabled]}
              disabled={!affordable}
              onPress={() => onGive(f.id, stock === 0)}>
              <Text style={styles.trayEmoji}>{f.emoji}</Text>
              {mark && <Text style={styles.trayMark}>{mark}</Text>}
              <Text style={styles.trayStock}>{stock > 0 ? `×${stock}` : `🪙${formatNumber(price)}`}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.trayHint}>💭 Sol üstteki resim bugün ne istediğini gösterir.</Text>
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
  pet: {
    backgroundColor: '#FF7AA8',
  },
  wash: {
    backgroundColor: '#4DB6E8',
  },
  cancel: {
    flex: 0,
    backgroundColor: '#F1E2C4',
  },
  washHint: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2F7DD1',
    textAlign: 'center',
  },
  mud: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#7A4B2A',
    opacity: 0.8,
  },
  fly: {
    position: 'absolute',
    top: '40%',
    left: '45%',
    fontSize: 18,
  },
  poop: {
    position: 'absolute',
  },
  poopEmoji: {
    fontSize: 30,
  },
  washPad: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(120,200,255,0.18)',
  },
  washBar: {
    position: 'absolute',
    top: 8,
    left: 40,
    right: 40,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
  },
  washFill: {
    height: '100%',
    backgroundColor: '#4DB6E8',
  },
  bubble: {
    position: 'absolute',
    fontSize: 26,
  },
  sponge: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    fontSize: 40,
  },
  happyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  happyLabel: {
    fontSize: 14,
  },
  happyBar: {
    flex: 1,
  },
  happyFill: {
    backgroundColor: '#FF7AA8',
  },
  happyXp: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A0763F',
  },
  wish: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 18,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#FFB020',
  },
  wishEmoji: {
    fontSize: 28,
  },
  reaction: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  reactionText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  reactionXp: {
    fontSize: 14,
    fontWeight: '900',
    color: '#E08A00',
  },
  trayTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  trayClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1E2C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  trayItem: {
    width: '18%',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F1E2C4',
  },
  trayEmoji: {
    fontSize: 28,
  },
  trayMark: {
    position: 'absolute',
    top: 2,
    right: 2,
    fontSize: 12,
  },
  trayStock: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5B3A1E',
  },
  trayHint: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A0763F',
    textAlign: 'center',
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
