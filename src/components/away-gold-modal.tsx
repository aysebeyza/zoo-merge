import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatNumber } from '@/game/format';

type Props = {
  amount: number;
  onClose: () => void;
};

/** Oyuna geri dönünce, oyuncu yokken hayvanların biriktirdiği altını gösterir. */
export function AwayGoldModal({ amount, onClose }: Props) {
  const [scale] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={styles.title}>Tekrar hoş geldin!</Text>
        <Text style={styles.emoji}>🪙</Text>
        <Text style={styles.text}>Sen yokken hayvanların</Text>
        <Text style={styles.amount}>{formatNumber(amount)} altın</Text>
        <Text style={styles.text}>kazandı!</Text>
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
    fontSize: 24,
    fontWeight: '900',
    color: '#8A4FFF',
  },
  emoji: {
    fontSize: 80,
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5B3A1E',
  },
  amount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#D18A00',
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
