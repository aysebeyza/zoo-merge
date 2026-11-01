import { StyleSheet, Text, View } from 'react-native';

import { PARK_LIMIT } from '@/game/config';
import { formatNumber } from '@/game/format';

type Props = {
  gold: number;
  diamonds: number;
  incomePerSecond: number;
  parkCount: number;
};

export function Hud({ gold, diamonds, incomePerSecond, parkCount }: Props) {
  return (
    <View style={styles.row}>
      <Pill icon="🪙" text={formatNumber(gold)} />
      <Pill icon="💎" text={formatNumber(diamonds)} />
      <Pill icon="🐾" text={`${parkCount}/${PARK_LIMIT}`} />
      <Pill icon="⏱️" text={`+${formatNumber(incomePerSecond)}/sn`} />
    </View>
  );
}

function Pill({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  icon: {
    fontSize: 15,
  },
  text: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5B3A1E',
  },
});
