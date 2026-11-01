import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { COLOR_HEX, type Variant } from '@/game/colors';
import { animalFor } from '@/game/config';

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
            borderWidth: variant.pure ? 3 : 1.5,
            borderColor: variant.pure ? '#FFF7C2' : 'rgba(0,0,0,0.15)',
          },
        ]}>
        <View style={[styles.shine, { width: width * 0.22, height: height * 0.18, borderRadius: width }]} />
        {variant.patterned && (
          <>
            <View style={[styles.spot, { top: '22%', left: '58%' }]} />
            <View style={[styles.spot, { top: '58%', left: '18%' }]} />
            <View style={[styles.spot, { top: '70%', left: '62%' }]} />
          </>
        )}
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
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  spot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
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
