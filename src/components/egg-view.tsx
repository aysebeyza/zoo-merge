import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { COLOR_HEX, type Variant } from '@/game/colors';
import { animalFor } from '@/game/config';

/** Desenli yumurtanın kabuğundaki yıldızlar: yer ve yumurta genişliğine göre boyut. */
const STARS = [
  { top: '6%', left: '54%', scale: 0.32 },
  { top: '44%', left: '4%', scale: 0.28 },
  { top: '62%', left: '60%', scale: 0.3 },
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
  const width = size * (0.56 + level * 0.03);
  const height = width * 1.28;

  return (
    <Animated.View style={{ width, height, transform: [{ scale }] }}>
      <View
        style={[
          styles.shell,
          {
            borderRadius: width / 2,
            backgroundColor: COLOR_HEX[variant.color],
            borderWidth: variant.pure || variant.patterned ? 3 : 1.5,
            borderColor: variant.patterned ? '#FFFFFF' : variant.pure ? '#FFF7C2' : 'rgba(0,0,0,0.15)',
          },
        ]}>
        {/* Parlama soluk tutulur ki desenli yumurtanın yıldızlarıyla karışmasın. */}
        <View style={[styles.shine, { width: width * 0.18, height: height * 0.13, borderRadius: width }]} />
        {variant.patterned &&
          STARS.map((star, i) => (
            <Text key={i} style={[styles.star, { top: star.top, left: star.left, fontSize: width * star.scale }]}>
              ★
            </Text>
          ))}
        <Text style={{ fontSize: width * 0.4 }}>{animalFor(level).emoji}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{level}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: '12%',
    left: '18%',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  star: {
    position: 'absolute',
    color: '#FFFFFF',
    fontWeight: '900',
    textShadowColor: 'rgba(91,58,30,0.6)',
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -4,
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
