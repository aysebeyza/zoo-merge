import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { animalFor, SHINY_COLOR } from '@/game/config';
import type { Variant } from '@/game/variant';

// Yumurta 100 x 136 birimlik bir alanda çizilir: üstü dar, altı geniş kabuk ve altında gölge.
const VIEW_W = 100;
const VIEW_H = 136;
const SHELL = 'M50 4 C27 4 9 46 9 79 C9 107 27 126 50 126 C73 126 91 107 91 79 C91 46 73 4 50 4 Z';
/** Kabuğun sol üstündeki parlama. */
const SHINE = 'M33 22 C23 32 18 46 19 60 C24 47 29 36 38 28 Z';
const OUTLINE = '#3A2A1E';

/** Parlak yumurtanın etrafındaki pırıltılar: yer ve yumurta genişliğine göre boyut. */
const SPARKLES = [
  { top: '2%', left: '68%', scale: 0.28 },
  { top: '40%', left: '-14%', scale: 0.22 },
  { top: '62%', left: '76%', scale: 0.24 },
] as const;

type Props = {
  level: number;
  variant: Variant;
  /** Yumurtanın sığacağı kutunun genişliği. */
  size: number;
  /** Yeni çıkan yumurta küçükten büyüyerek gelir. */
  pop?: boolean;
};

export function EggView({ level, variant, size, pop = true }: Props) {
  const [scale] = useState(() => new Animated.Value(pop ? 0.4 : 1));

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, [scale]);

  // Seviye yükseldikçe yumurta biraz büyür; içindeki hayvan seviyeyi rakamsız da belli eder.
  // 10. seviyede gölgesiyle birlikte kutunun %92'sine kadar büyür, taşmaz.
  const width = size * (0.48 + level * 0.02);
  const height = (width * VIEW_H) / VIEW_W;

  return (
    <Animated.View style={{ width, height, transform: [{ scale }] }}>
      <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={StyleSheet.absoluteFill}>
        <Ellipse cx={50} cy={128} rx={32} ry={6} fill="rgba(0,0,0,0.15)" />
        {/* Her hayvanın yumurtası hep aynı renktir; kabuk yarı saydam, içindeki hayvan silik görünür. */}
        <Path d={SHELL} fill="#FFFFFF" />
        <Path d={SHELL} fill={animalFor(level).eggColor} fillOpacity={0.82} />
        <Path d={SHINE} fill="#FFFFFF" fillOpacity={0.55} />
        {/* Parlak yumurta: koyu çizginin içinde altın sarısı bir çerçeve. */}
        {variant.shiny && <Path d={SHELL} fill="none" stroke={OUTLINE} strokeWidth={10} strokeLinejoin="round" />}
        <Path d={SHELL} fill="none" stroke={variant.shiny ? SHINY_COLOR : OUTLINE} strokeWidth={variant.shiny ? 5 : 5.5} />
      </Svg>
      <Text style={[styles.animal, { fontSize: width * 0.42, top: height * 0.38 }]}>{animalFor(level).emoji}</Text>
      {variant.shiny &&
        SPARKLES.map((s, i) => (
          <Text key={i} style={[styles.sparkle, { top: s.top, left: s.left, fontSize: width * s.scale }]}>
            ✨
          </Text>
        ))}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{level}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animal: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    opacity: 0.6,
  },
  sparkle: {
    position: 'absolute',
  },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#5B3A1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
});
