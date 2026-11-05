import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type HostInstance,
  type LayoutChangeEvent,
} from 'react-native';

import type { AnimalsTab } from '@/components/animals-panel';
import { ANIMALS, dayNumber, MAX_LEVEL, moodFor, treatFor, wishFor, xpForLevel, type Mood } from '@/game/config';
import { formatNumber } from '@/game/format';
import { fullnessAt, skillCost, skillUnlockAt, wishPending, type ParkAnimal } from '@/game/state';

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
  /** Bahçe seviyesi ve yıldız puanı. */
  level: number;
  xp: number;
  /** Yolda yürüyen ziyaretçi sayısı ve başlarında bekleyen bahşişler. */
  visitors: number;
  /** Bahşişli ziyaretçi yoldaysa yoldan çıkacağı an; yoksa null. */
  tipUntil: number | null;
  tipAmount: number;
  onCollectTip: () => void;
};

/** Ziyaretçiler; her biri kendi hızıyla yolda yürür. */
const VISITORS = ['🧒', '👩‍👧', '👴', '👦', '👵', '👨‍👦'];

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
export function Zoo({
  animals,
  now,
  gold,
  incomeBonus,
  discovered,
  onOpenAnimals,
  onOpenEnclosure,
  targetRef,
  level,
  xp,
  visitors,
  tipUntil,
  tipAmount,
  onCollectTip,
}: Props) {
  const someoneHungry = animals.some((a) => moodFor(fullnessAt(a, now)) !== 'happy');
  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  const rows = [levels.slice(0, PER_ROW), levels.slice(PER_ROW)];

  return (
    <View style={styles.zoo}>
      <View style={styles.header}>
        <LevelBadge level={level} xp={xp} />
        <Pressable ref={targetRef('animals')} style={styles.myAnimals} onPress={() => onOpenAnimals('animals')}>
          <Text style={styles.myAnimalsText}>🐾 Hayvanlarım</Text>
          {someoneHungry && <View style={styles.dot} />}
        </Pressable>
      </View>
      {rows.map((row, r) => [
        r === 1 && (
          <VisitorPath key="path" count={visitors} tipUntil={tipUntil} tipAmount={tipAmount} onCollect={onCollectTip} />
        ),
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
        </View>,
      ])}
    </View>
  );
}

/** Bahçe seviyesi: yıldızın içinde seviye, yanında bir sonraki seviyeye kalan puan çubuğu. */
function LevelBadge({ level, xp }: { level: number; xp: number }) {
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  const progress = Math.min(1, Math.max(0, (xp - from) / (to - from)));
  return (
    <View style={styles.levelBadge}>
      <Text style={styles.levelText}>⭐ {level}</Text>
      <View style={styles.levelBar}>
        <View style={[styles.levelFill, { width: `${Math.max(4, progress * 100)}%` }]} />
      </View>
    </View>
  );
}

type PathProps = { count: number; tipUntil: number | null; tipAmount: number; onCollect: () => void };

const VISITOR_WIDTH = 30;

/**
 * İki sıra alanın arasındaki yol. Ziyaretçiler bir ucundan girip öbür ucundan çıkar. Bahşişli
 * ziyaretçinin başında 💰 olur; çocuk o yoldan çıkmadan dokunmalı, yoksa bahşiş de onunla gider.
 */
function VisitorPath({ count, tipUntil, tipAmount, onCollect }: PathProps) {
  const [width, setWidth] = useState(0);
  // Yoldaki bahşişli ziyaretçiler: bahşişi toplansa da yolun sonuna kadar yürür, sonra listeden çıkar.
  const [tipWalkers, setTipWalkers] = useState<number[]>([]);
  if (tipUntil !== null && !tipWalkers.includes(tipUntil)) setTipWalkers([...tipWalkers, tipUntil]);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.path} onLayout={onLayout}>
      {width > 0 && Array.from({ length: count }, (_, i) => <Walker key={i} index={i} width={width} />)}
      {width > 0 &&
        tipWalkers.map((until) => (
          <TipWalker
            key={until}
            until={until}
            width={width}
            hasTip={until === tipUntil}
            tipAmount={tipAmount}
            onCollect={onCollect}
            onGone={() => setTipWalkers((list) => list.filter((u) => u !== until))}
          />
        ))}
    </View>
  );
}

/** Yolun uçlarında ziyaretçi yavaşça belirir ve kaybolur; yolun dışına taşmaz. */
function edgeFade(x: Animated.Value, width: number) {
  return x.interpolate({
    inputRange: [-VISITOR_WIDTH, 0, Math.max(1, width - VISITOR_WIDTH), Math.max(2, width)],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
}

/** Rastgele bir yönden yolun öbür ucuna yürüyüş: başlangıç ve bitiş x'i, yüzünün yönü. */
function crossing(width: number) {
  const leftToRight = Math.random() < 0.5;
  return {
    from: leftToRight ? -VISITOR_WIDTH : width,
    to: leftToRight ? width : -VISITOR_WIDTH,
    facing: leftToRight ? 1 : -1,
  };
}

/** Sıradan ziyaretçi: gelir, yolu geçer, gider; biraz sonra başka biri gelir. */
function Walker({ index, width }: { index: number; width: number }) {
  const [x] = useState(() => new Animated.Value(-VISITOR_WIDTH * 2));
  const [look, setLook] = useState({ emoji: VISITORS[index % VISITORS.length], facing: 1 });

  useEffect(() => {
    let alive = true;
    // İlk girişler birbirinden ayrı olsun diye her ziyaretçi farklı bir beklemeyle başlar.
    let wait = index * 1800 + Math.random() * 1500;
    const walk = () => {
      if (!alive) return;
      const { from, to, facing } = crossing(width);
      setLook({ emoji: VISITORS[Math.floor(Math.random() * VISITORS.length)], facing });
      x.setValue(from);
      Animated.sequence([
        Animated.delay(wait),
        Animated.timing(x, {
          toValue: to,
          duration: 9000 + Math.random() * 5000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => finished && walk());
      wait = 1000 + Math.random() * 4000;
    };
    walk();
    return () => {
      alive = false;
      x.stopAnimation();
    };
  }, [x, width, index]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.visitor, { opacity: edgeFade(x, width), transform: [{ translateX: x }] }]}>
      <Text style={[styles.visitorEmoji, { transform: [{ scaleX: look.facing }] }]}>{look.emoji}</Text>
    </Animated.View>
  );
}

type TipWalkerProps = {
  until: number;
  width: number;
  hasTip: boolean;
  tipAmount: number;
  onCollect: () => void;
  onGone: () => void;
};

/** Bahşişli ziyaretçi: yolu tam bahşiş süresi içinde geçer, sonra gider. */
function TipWalker({ until, width, hasTip, tipAmount, onCollect, onGone }: TipWalkerProps) {
  const [path] = useState(() => crossing(width));
  const [x] = useState(() => new Animated.Value(path.from));
  const [bounce] = useState(() => new Animated.Value(0));
  const [collected, setCollected] = useState(false);

  useEffect(() => {
    Animated.timing(x, {
      toValue: path.to,
      duration: Math.max(3000, until - Date.now()),
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => onGone());
    return () => x.stopAnimation();
    // Yürüyüş bir kez başlar; onGone her çizimde yeni olsa da yeniden başlamasın.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, path, until]);

  // 💰 zıplar; çocuk gözden kaçırmasın.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  return (
    <Animated.View
      style={[styles.visitor, styles.tipVisitor, { opacity: edgeFade(x, width), transform: [{ translateX: x }] }]}>
      <Pressable
        onPress={
          hasTip
            ? () => {
                setCollected(true);
                onCollect();
              }
            : undefined
        }
        hitSlop={12}
        style={styles.visitorTouch}>
        {hasTip && (
          <Animated.Text
            style={[
              styles.tip,
              { transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
            ]}>
            💰
          </Animated.Text>
        )}
        <Text style={[styles.visitorEmoji, { transform: [{ scaleX: path.facing }] }]}>🧑‍🎒</Text>
      </Pressable>
      {collected && <CoinPop amount={tipAmount} />}
    </Animated.View>
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
  // Bugünkü isteği bekleyen hayvan varsa istediği ikramın resmi alanın üstünde görünür.
  const wish = animals.some((a) => wishPending(a, now)) ? treatFor(wishFor(level, dayNumber(now))) : null;

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
      {wish && (
        <View style={styles.wishBubble} pointerEvents="none">
          <Text style={styles.wishEmoji}>{wish.emoji}</Text>
        </View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 2,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,248,232,0.95)',
    borderWidth: 2,
    borderColor: '#FFB020',
  },
  levelText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  levelBar: {
    width: 54,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(91,58,30,0.15)',
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    backgroundColor: '#FFB020',
  },
  path: {
    height: 46,
    marginHorizontal: -6,
    backgroundColor: '#E8D3A8',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#D4B985',
  },
  visitor: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    alignItems: 'center',
  },
  tipVisitor: {
    zIndex: 2,
  },
  visitorTouch: {
    alignItems: 'center',
  },
  visitorEmoji: {
    fontSize: 22,
  },
  tip: {
    position: 'absolute',
    top: -18,
    fontSize: 18,
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
  wishBubble: {
    position: 'absolute',
    top: -9,
    alignSelf: 'center',
    paddingHorizontal: 3,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#FFB020',
  },
  wishEmoji: {
    fontSize: 12,
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
