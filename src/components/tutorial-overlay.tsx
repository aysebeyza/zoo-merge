import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View, type HostInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { TutorialHint } from '@/game/tutorial';
import type { Rect } from '@/lib/drop-zone';

type Props = {
  hint: TutorialHint;
  /** Hedeflerin ekrandaki yerleri (pencereye göre): "cell-3", "slot-0", "basket", "animals". */
  rects: Map<string, Rect>;
};

const HAND_SIZE = 44;
const BUBBLE_WIDTH = 220;
/** Aydınlık kalan deliğin hedeften taşan payı ve köşe yuvarlaklığı. */
const HOLE_PAD = 6;
const HOLE_RADIUS = 14;

function center(r: Rect) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function roundedRectPath({ x, y, width: w, height: h }: Rect) {
  const r = Math.min(HOLE_RADIUS, w / 2, h / 2);
  return (
    `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}` +
    `A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}` +
    `V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`
  );
}

/**
 * Deliklerin dışında kalan yeri dikdörtgenlere böler: deliklerin kenarlarından geçen çizgilerle ekranı
 * ızgaraya ayırır, hiçbir deliğe düşmeyen kareleri döndürür. Bu kareler dokunmaları yutar.
 */
function blockers(width: number, height: number, holes: Rect[]): Rect[] {
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  const xs = [...new Set([0, width, ...holes.flatMap((h) => [h.x, h.x + h.width].map((v) => clamp(v, width)))])];
  const ys = [...new Set([0, height, ...holes.flatMap((h) => [h.y, h.y + h.height].map((v) => clamp(v, height)))])];
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const result: Rect[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cell = {
        x: xs[i],
        y: ys[j],
        width: xs[i + 1] - xs[i],
        height: ys[j + 1] - ys[j],
      };
      const cx = cell.x + cell.width / 2;
      const cy = cell.y + cell.height / 2;
      const inHole = holes.some((h) => cx > h.x && cx < h.x + h.width && cy > h.y && cy < h.y + h.height);
      if (!inHole && cell.width > 0 && cell.height > 0) result.push(cell);
    }
  }
  return result;
}

/**
 * İlk oyun rehberinin eli (doküman: "talimatlar el animasyonuyla gösterilir"). Okuma bilmeyen çocuk
 * elin hareketini izler; okuyabilen için üstünde kısa bir yazı da var. Ekranın geri kalanı koyulaşır ve
 * dokunulamaz, yalnızca gösterilen yer kullanılabilir.
 */
export function TutorialOverlay({ hint, rects }: Props) {
  const overlay = useRef<HostInstance>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const { width: screenWidth } = useWindowDimensions();

  // El hep aynı ritimle hareket eder: sürüklemede bir yerden ötekine kayar, dokunmada iki kez basar.
  useEffect(() => {
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: hint.kind === 'drag' ? 1300 : 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(progress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hint.kind, progress]);

  const fromRect = rects.get(hint.kind === 'drag' ? hint.from : hint.target);
  const toRect = hint.kind === 'drag' ? rects.get(hint.to) : fromRect;
  const measure = () =>
    overlay.current?.measureInWindow((x, y, width, height) => {
      setOrigin({ x, y });
      setSize({ width, height });
    });

  let content = null;
  if (origin && size && !(fromRect && toRect)) {
    // Hedef daha ölçülmedi: el eski yerde görünmesin, ekran koyu ve dokunulamaz kalsın.
    content = (
      <View collapsable={false} onStartShouldSetResponder={() => true} style={[StyleSheet.absoluteFill, styles.dimFull]} />
    );
  } else if (origin && size && fromRect && toRect) {
    // Ölçümler pencereye göre; bu katmanın kendi yerine göre çevrilir.
    const from = {
      x: center(fromRect).x - origin.x,
      y: center(fromRect).y - origin.y,
    };
    const to = {
      x: center(toRect).x - origin.x,
      y: center(toRect).y - origin.y,
    };
    const bubbleLeft = Math.min(Math.max(8, from.x - BUBBLE_WIDTH / 2), screenWidth - BUBBLE_WIDTH - 8);
    // Yazı hedefin üstünde; hedef ekranın üst kısmındaysa ya da yumurta yukarı (kuluçkaya) sürüklenecekse
    // altında, gidilecek yeri örtmesin.
    const bubbleTop =
      from.y > 140 && to.y >= from.y ? from.y - fromRect.height / 2 - 56 : from.y + fromRect.height / 2 + 12;

    const handStyle =
      hint.kind === 'drag'
        ? {
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [from.x, to.x],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [from.y, to.y],
                }),
              },
            ],
          }
        : {
            transform: [
              { translateX: from.x },
              { translateY: from.y },
              {
                scale: progress.interpolate({
                  inputRange: [0, 0.25, 0.5, 0.75, 1],
                  outputRange: [1, 0.8, 1, 0.8, 1],
                }),
              },
            ],
          };

    // Hedefin dışı koyulaşır ve dokunulamaz; çocuk yalnızca gösterilen yere dokunabilir.
    const holes = [fromRect, ...(toRect === fromRect ? [] : [toRect])].map((r) => ({
      x: r.x - origin.x - HOLE_PAD,
      y: r.y - origin.y - HOLE_PAD,
      width: r.width + HOLE_PAD * 2,
      height: r.height + HOLE_PAD * 2,
    }));
    const dimPath = `M0,0H${size.width}V${size.height}H0Z` + holes.map(roundedRectPath).join('');
    // Beklerken hiçbir yere dokunulamaz; yumurta yalnızca görünür kalır.
    const blocks = hint.kind === 'wait' ? [{ x: 0, y: 0, ...size }] : blockers(size.width, size.height, holes);

    content = (
      <>
        <Svg width={size.width} height={size.height} style={styles.dim} pointerEvents="none">
          <Path d={dimPath} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
        </Svg>
        {/* Görünmez kutular dokunmayı kendileri alır; Android sadeleştirip silmesin diye collapsable kapalı. */}
        {blocks.map((b, i) => (
          <View
            key={i}
            collapsable={false}
            onStartShouldSetResponder={() => true}
            style={[styles.blocker, { left: b.x, top: b.y, width: b.width, height: b.height }]}
          />
        ))}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={[styles.bubble, { left: bubbleLeft, top: bubbleTop, width: BUBBLE_WIDTH }]}>
            <Text style={styles.bubbleText}>{hint.text}</Text>
          </View>
          {hint.kind === 'wait' ? (
            <Text style={[styles.waitIcon, { left: from.x - 16, top: from.y - 16 }]}>⏳</Text>
          ) : (
            // Parmak ucu hedefin ortasına gelsin diye el biraz sola ve aşağı kaydırılır.
            <Animated.Text style={[styles.hand, handStyle]}>👆</Animated.Text>
          )}
        </View>
      </>
    );
  }

  return (
    <View ref={overlay} pointerEvents="box-none" style={styles.overlay} onLayout={measure}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    // Hayvanlarım panelinin (90) üstünde: rehberin son adımı o panelin içinde.
    zIndex: 95,
    elevation: 95,
  },
  dim: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  dimFull: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  blocker: {
    position: 'absolute',
  },
  hand: {
    position: 'absolute',
    left: -HAND_SIZE * 0.3,
    top: -HAND_SIZE * 0.1,
    fontSize: HAND_SIZE,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 2 },
  },
  waitIcon: {
    position: 'absolute',
    fontSize: 32,
  },
  bubble: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#5B3A1E',
  },
  bubbleText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
});
