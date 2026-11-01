import { StyleSheet, Text, View, type HostInstance } from 'react-native';

import { EggView } from '@/components/egg-view';
import { PARK_LIMIT } from '@/game/config';
import { formatDuration } from '@/game/format';
import type { IncubatorSlot } from '@/game/state';

type Props = {
  slots: (IncubatorSlot | null)[];
  now: number;
  parkCount: number;
  /** Her yuva bir bırakma alanıdır; ekran onları bu fonksiyonla kaydeder. */
  zoneRef: (id: string) => (view: HostInstance | null) => void;
};

export function Incubator({ slots, now, parkCount, zoneRef }: Props) {
  return (
    <View style={styles.row}>
      {slots.map((slot, i) => (
        <View key={i} ref={zoneRef(`slot-${i}`)} style={[styles.slot, !slot && styles.emptySlot]}>
          {slot ? <SlotContent slot={slot} now={now} parkFull={parkCount >= PARK_LIMIT} /> : <EmptySlot />}
        </View>
      ))}
    </View>
  );
}

function SlotContent({ slot, now, parkFull }: { slot: IncubatorSlot; now: number; parkFull: boolean }) {
  const elapsed = now - slot.startedAt;
  const progress = Math.min(1, elapsed / slot.durationMs);
  const done = progress >= 1;

  return (
    <>
      <EggView level={slot.egg.level} variant={slot.egg.variant} size={52} pop={false} />
      <View style={styles.info}>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.time}>
          {done ? (parkFull ? 'Park dolu!' : 'Çatlıyor!') : formatDuration((slot.durationMs - elapsed) / 1000)}
        </Text>
      </View>
    </>
  );
}

function EmptySlot() {
  return (
    <>
      <Text style={styles.emptyIcon}>🥚</Text>
      <Text style={styles.emptyText}>Kuluçka{'\n'}buraya sürükle</Text>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 10,
  },
  slot: {
    flex: 1,
    height: 84,
    borderRadius: 18,
    backgroundColor: '#FFE7B8',
    borderWidth: 3,
    borderColor: '#F2B84B',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  emptySlot: {
    borderStyle: 'dashed',
    backgroundColor: '#FFF4DC',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 6,
  },
  bar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(91,58,30,0.15)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#FF9F45',
  },
  time: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5B3A1E',
  },
  emptyIcon: {
    fontSize: 26,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A0763F',
  },
});
