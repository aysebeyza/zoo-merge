import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CURRENCY_ICON, UPGRADES, upgradeCost, type UpgradeConfig, type UpgradeId } from '@/game/config';
import { formatNumber } from '@/game/format';

type Props = {
  gold: number;
  diamonds: number;
  levels: Record<UpgradeId, number>;
  onBuy: (id: UpgradeId) => void;
  onClose: () => void;
};

export function UpgradesPanel({ gold, diamonds, levels, onBuy, onClose }: Props) {
  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Yükseltmeler</Text>
          <Text style={styles.gold}>🪙 {formatNumber(gold)}</Text>
          <Text style={styles.gold}>💎 {formatNumber(diamonds)}</Text>
          <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {UPGRADES.map((upgrade) => (
            <UpgradeCard
              key={upgrade.id}
              upgrade={upgrade}
              level={levels[upgrade.id]}
              wallet={upgrade.currency === 'diamonds' ? diamonds : gold}
              onBuy={() => onBuy(upgrade.id)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

type CardProps = {
  upgrade: UpgradeConfig;
  level: number;
  /** Bu yükseltmenin parasından (altın ya da elmas) ne kadar var. */
  wallet: number;
  onBuy: () => void;
};

function UpgradeCard({ upgrade, level, wallet, onBuy }: CardProps) {
  const cost = upgradeCost(upgrade.id, level);
  const affordable = cost !== null && wallet >= cost;

  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{upgrade.emoji}</Text>
      <View style={styles.info}>
        <Text style={styles.name}>{upgrade.name}</Text>
        {/* Seviye noktaları: dolu olanlar alınmış seviyeler. */}
        <View style={styles.dots}>
          {upgrade.costs.map((_, i) => (
            <View key={i} style={[styles.dot, i < level && styles.dotFilled]} />
          ))}
        </View>
        <Text style={styles.effect}>{upgrade.effect(level)}</Text>
        {cost !== null && <Text style={styles.next}>Sonra: {upgrade.effect(level + 1)}</Text>}
      </View>
      {cost === null ? (
        <View style={[styles.button, styles.maxed]}>
          <Text style={styles.buttonText}>Tamam!</Text>
        </View>
      ) : (
        <Pressable
          style={[styles.button, upgrade.currency === 'diamonds' && styles.diamondButton, !affordable && styles.disabled]}
          disabled={!affordable}
          onPress={onBuy}>
          <Text style={styles.buttonText}>
            {CURRENCY_ICON[upgrade.currency]} {formatNumber(cost)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,20,10,0.55)',
    justifyContent: 'flex-end',
    zIndex: 90,
    elevation: 90,
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFF8E8',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: '#8A4FFF',
  },
  gold: {
    fontSize: 17,
    fontWeight: '800',
    color: '#5B3A1E',
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1E2C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  list: {
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'white',
  },
  emoji: {
    width: 46,
    textAlign: 'center',
    fontSize: 36,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 17,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EADBC0',
  },
  dotFilled: {
    backgroundColor: '#FFB020',
  },
  effect: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5B3A1E',
  },
  next: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E9E4F',
  },
  button: {
    minWidth: 92,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FFC93C',
    borderBottomWidth: 3,
    borderBottomColor: '#E0A21E',
  },
  diamondButton: {
    backgroundColor: '#9AD4FF',
    borderBottomColor: '#5AA9E6',
  },
  disabled: {
    opacity: 0.45,
  },
  maxed: {
    backgroundColor: '#8EDB8E',
    borderBottomColor: '#5CC85C',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#5B3A1E',
  },
});
