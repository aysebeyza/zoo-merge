import { Pressable, StyleSheet, Text, View, type HostInstance } from 'react-native';

import { EggView } from '@/components/egg-view';
import { formatDuration } from '@/game/format';
import { FRUIT_GAME } from '@/game/fruit-merge';
import { canBoost, type IncubatorSlot } from '@/game/state';

type Props = {
  slots: (IncubatorSlot | null)[];
  now: number;
  parkCount: number;
  parkLimit: number;
  /** Her yuva bir bırakma alanıdır; ekran onları bu fonksiyonla kaydeder. */
  zoneRef: (id: string) => (view: HostInstance | null) => void;
  /** Yuvadaki yumurtayı mini oyunla hızlandırmak için. */
  onPlay: (slot: number) => void;
};

/**
 * Mini oyun yalnızca kalan süre oyunun kendisinden uzunsa önerilir; 10 saniyelik civciv için
 * 30 saniyelik oyun oynatmanın anlamı yok.
 */
function playable(slot: IncubatorSlot, now: number): boolean {
  return canBoost(slot, now) && slot.startedAt + slot.durationMs - now > FRUIT_GAME.durationSec * 1000;
}

export function Incubator({ slots, now, parkCount, parkLimit, zoneRef, onPlay }: Props) {
  // 2'den fazla yuva varsa ikişer ikişer alt alta dizilir, yoksa telefonda sığmaz.
  const compact = slots.length > 2;
  return (
    <View style={styles.row}>
      {slots.map((slot, i) => (
        <View
          key={i}
          ref={zoneRef(`slot-${i}`)}
          style={[styles.slot, compact && styles.compactSlot, !slot && styles.emptySlot]}>
          {slot ? (
            <SlotContent
              slot={slot}
              now={now}
              parkFull={parkCount >= parkLimit}
              onPlay={playable(slot, now) ? () => onPlay(i) : null}
            />
          ) : (
            <EmptySlot />
          )}
        </View>
      ))}
    </View>
  );
}

type SlotContentProps = {
  slot: IncubatorSlot;
  now: number;
  parkFull: boolean;
  onPlay: (() => void) | null;
};

function SlotContent({ slot, now, parkFull, onPlay }: SlotContentProps) {
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
        <View style={styles.timeRow}>
          <Text style={styles.time}>
            {done ? (parkFull ? 'Park dolu!' : 'Çatlıyor!') : formatDuration((slot.durationMs - elapsed) / 1000)}
          </Text>
          {/* Yumurta başına bir kez: mini oyunla kuluçka süresini kısalt. */}
          {onPlay && (
            <Pressable style={styles.play} onPress={onPlay} hitSlop={6}>
              <Text style={styles.playText}>🍉 Oyna</Text>
            </Pressable>
          )}
        </View>
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
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 10,
  },
  slot: {
    flexGrow: 1,
    flexBasis: '40%',
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
  compactSlot: {
    height: 64,
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  play: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#FF6B8A',
  },
  playText: {
    fontSize: 12,
    fontWeight: '900',
    color: 'white',
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
