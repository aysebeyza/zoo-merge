import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { animalFor } from '@/game/config';
import { formatNumber } from '@/game/format';
import type { LevelUp } from '@/game/state';

type Props = {
  levelUp: LevelUp;
  onClose: () => void;
};

/** Bahçe seviye atladı: kutlama ve gelen hediyeler (hediyeler zaten verilmiş, burada gösterilir). */
export function LevelUpModal({ levelUp, onClose }: Props) {
  const [scale] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={styles.title}>Bahçen büyüdü!</Text>
        <View style={styles.star}>
          <Text style={styles.starEmoji}>⭐</Text>
          <Text style={styles.starLevel}>{levelUp.level}</Text>
        </View>
        <Text style={styles.subtitle}>{levelUp.level}. seviye</Text>
        <Text style={styles.giftTitle}>🎁 Hediyen</Text>
        <View style={styles.gifts}>
          <Text style={styles.gift}>🪙 +{formatNumber(levelUp.gold)}</Text>
          {levelUp.diamonds > 0 && <Text style={[styles.gift, styles.diamond]}>💎 +{levelUp.diamonds}</Text>}
        </View>
        {levelUp.food.length > 0 && (
          <Text style={styles.food}>{levelUp.food.map((l) => animalFor(l).food.emoji).join(' ')} +1</Text>
        )}
        <Pressable style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Topla!</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,20,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  card: {
    width: 280,
    padding: 24,
    borderRadius: 28,
    backgroundColor: '#FFF8E8',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#E08A00',
  },
  star: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  starEmoji: {
    fontSize: 100,
  },
  starLevel: {
    position: 'absolute',
    fontSize: 30,
    fontWeight: '900',
    color: '#7A4B00',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#5B3A1E',
  },
  giftTitle: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '800',
    color: '#A0763F',
  },
  gifts: {
    flexDirection: 'row',
    gap: 14,
  },
  gift: {
    fontSize: 20,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  diamond: {
    color: '#2F7DD1',
  },
  food: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5B3A1E',
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#5CC85C',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '900',
    color: 'white',
  },
});
