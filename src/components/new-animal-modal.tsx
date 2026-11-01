import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { animalFor, DIAMONDS_PER_NEW_ANIMAL, MAX_LEVEL } from '@/game/config';

type Props = {
  level: number;
  onClose: () => void;
};

export function NewAnimalModal({ level, onClose }: Props) {
  const animal = animalFor(level);
  const next = level < MAX_LEVEL ? animalFor(level + 1) : null;
  const [scale] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={styles.title}>Yeni hayvan!</Text>
        <Text style={styles.emoji}>{animal.emoji}</Text>
        <Text style={styles.name}>{animal.name}</Text>
        <Text style={styles.reward}>+{DIAMONDS_PER_NEW_ANIMAL} 💎</Text>
        {next && (
          <View style={styles.nextRow}>
            <Text style={styles.nextLabel}>Sıradaki:</Text>
            {/* Sıradaki hayvan gizli: "Sonra ne çıkacak?" merakı. Gerçek siluet görselleri gelince değişecek. */}
            <View style={styles.mystery}>
              <Text style={styles.mysteryText}>?</Text>
            </View>
          </View>
        )}
        <Pressable style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Harika!</Text>
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
    color: '#8A4FFF',
  },
  emoji: {
    fontSize: 96,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#5B3A1E',
  },
  reward: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2F7DD1',
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  nextLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A0763F',
  },
  mystery: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3A2A1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mysteryText: {
    fontSize: 22,
    fontWeight: '900',
    color: 'white',
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
