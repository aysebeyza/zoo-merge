import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  /** Ebeveyne neyi onayladığı söylenir, ör. "Bütün ilerleme silinecek." */
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

type Question = { a: number; b: number; options: number[] };

/** 6-9 arası iki sayının çarpımı ve iki yanlış seçenek; küçük bir çocuğun tahminle geçmesi zor olsun. */
function makeQuestion(): Question {
  const a = 6 + Math.floor(Math.random() * 4);
  const b = 6 + Math.floor(Math.random() * 4);
  const answer = a * b;
  const options = [answer, answer + a, answer - b].sort(() => Math.random() - 0.5);
  return { a, b, options };
}

/**
 * Ebeveyn kapısı (doküman, uyum kuralları): satın almalar ve oyunu silmek gibi işler yalnızca bir
 * yetişkinin çözebileceği bir sorudan sonra yapılır.
 */
export function ParentGate({ message, onConfirm, onCancel }: Props) {
  const [question, setQuestion] = useState(makeQuestion);
  const [wrong, setWrong] = useState(false);

  const answer = (value: number) => {
    if (value === question.a * question.b) {
      onConfirm();
      return;
    }
    // Yanlış cevapta yeni bir soru; tekrar tekrar deneyerek bulunmasın.
    setWrong(true);
    setQuestion(makeQuestion());
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>Ebeveyn onayı</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.question}>
          {question.a} × {question.b} = ?
        </Text>
        {wrong && <Text style={styles.wrong}>Yanlış oldu, bir daha dene.</Text>}
        <View style={styles.options}>
          {question.options.map((option) => (
            <Pressable key={option} style={styles.option} onPress={() => answer(option)}>
              <Text style={styles.optionText}>{option}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.cancel}>Vazgeç</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,20,10,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 150,
    elevation: 150,
  },
  card: {
    width: 300,
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#FFF8E8',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  message: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A0763F',
    textAlign: 'center',
  },
  question: {
    fontSize: 30,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  wrong: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF4D4D',
  },
  options: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    minWidth: 70,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#B983FF',
  },
  optionText: {
    fontSize: 20,
    fontWeight: '900',
    color: 'white',
  },
  cancel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#A0763F',
  },
});
