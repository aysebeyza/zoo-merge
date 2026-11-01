import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { animalFor } from '@/game/config';

type Props = {
  level: number;
  /** Yumurta alan dolu olduğu için hediye kutusuna mı gitti? */
  inGiftBox: boolean;
  onClose: () => void;
};

/**
 * Aç kalan hayvan kaçınca gösterilir. Çocuğu korkutmadan ne olduğunu ve nasıl geri getireceğini anlatır:
 * hayvan kaybolmadı, yumurtasına döndü (doküman: "Ceza zaman kaybettirir, emeği değil").
 */
export function EscapedModal({ level, inGiftBox, onClose }: Props) {
  const animal = animalFor(level);
  const [scale] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Text style={styles.title}>Eyvah!</Text>
        <Text style={styles.emoji}>{animal.emoji}🥚</Text>
        <Text style={styles.text}>
          {animal.name} çok acıktı ve yumurtasına geri döndü.
          {inGiftBox ? ' Yumurtası 🎁 hediye kutusunda.' : ''}
        </Text>
        <Text style={styles.hint}>{"Kuluçkaya koyarsan geri gelir. Hayvanlarını 🐾 Hayvanlarım'dan beslemeyi unutma!"}</Text>
        <Pressable style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Tamam</Text>
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
    width: 290,
    padding: 24,
    borderRadius: 28,
    backgroundColor: '#FFF8E8',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FF7A45',
  },
  emoji: {
    fontSize: 64,
  },
  text: {
    fontSize: 17,
    fontWeight: '800',
    color: '#5B3A1E',
    textAlign: 'center',
  },
  hint: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A0763F',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
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
