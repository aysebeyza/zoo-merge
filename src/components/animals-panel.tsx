import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type HostInstance } from 'react-native';

import { animalFor, foodPrice, FULLNESS_COLOR, HUNGER_SEC, MAX_SKILL, moodFor, skillFor } from '@/game/config';
import { formatNumber, formatWait } from '@/game/format';
import {
  animalCount,
  animalIncomePerSecond,
  canFeed,
  foodStock,
  fullnessAt,
  hungryAt,
  missingFood,
  releaseValue,
  skillCost,
  skillUnlockAt,
  stateIncomeBonus,
  type GameState,
  type ParkAnimal,
} from '@/game/state';

export type AnimalsTab = 'animals' | 'food';

type Props = {
  state: GameState;
  /** Açılınca hangi sekme görünsün; parktan "Yem al" ile gelinince yem dükkanı. */
  initialTab: AnimalsTab;
  onFeed: (id: number) => void;
  onBuyFood: (level: number) => void;
  onBuyMissingFood: () => void;
  onUpgradeSkill: (id: number) => void;
  onRelease: (id: number) => void;
  onClose: () => void;
  /** İlk oyun rehberinin eli bu düğmeleri gösterir: "feed-<id>" (Besle) ve "animals-close" (kapat). */
  targetRef: (id: string) => (view: HostInstance | null) => void;
};

/** Hayvanlarım: parktaki bütün hayvanlar tek tek; ikinci sekmede yem dükkanı. */
export function AnimalsPanel({
  state,
  initialTab,
  onFeed,
  onBuyFood,
  onBuyMissingFood,
  onUpgradeSkill,
  onRelease,
  onClose,
  targetRef,
}: Props) {
  const [tab, setTab] = useState<AnimalsTab>(initialTab);
  // En aç hayvan en üstte: çocuk kimi beslemesi gerektiğini hemen görsün.
  const animals = [...state.park].sort((a, b) => fullnessAt(a, state.now) - fullnessAt(b, state.now));
  const foodLevels = [...state.discovered].sort((a, b) => a - b);

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Hayvanlarım</Text>
          <Text style={styles.gold}>🪙 {formatNumber(state.gold)}</Text>
          <Pressable ref={targetRef('animals-close')} style={styles.close} onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.tabs}>
          <Tab label={`🐾 Hayvanlar (${state.park.length})`} active={tab === 'animals'} onPress={() => setTab('animals')} />
          <Tab label="🛒 Yem dükkanı" active={tab === 'food'} onPress={() => setTab('food')} />
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {tab === 'animals' &&
            (animals.length === 0 ? (
              <Text style={styles.empty}>Parkta henüz hayvan yok. Bir yumurtayı kuluçkaya koy!</Text>
            ) : (
              animals.map((animal) => (
                <AnimalRow
                  key={animal.id}
                  animal={animal}
                  state={state}
                  onFeed={() => onFeed(animal.id)}
                  onBuyFood={() => setTab('food')}
                  onUpgradeSkill={() => onUpgradeSkill(animal.id)}
                  onRelease={() => onRelease(animal.id)}
                  feedRef={targetRef(`feed-${animal.id}`)}
                />
              ))
            ))}
          {tab === 'food' &&
            (foodLevels.length === 0 ? (
              <Text style={styles.empty}>Bir hayvan bulunca onun yemi burada satılır.</Text>
            ) : (
              <>
                <MissingFood state={state} onBuy={onBuyMissingFood} />
                {foodLevels.map((level) => (
                  <FoodRow key={level} level={level} state={state} onBuy={() => onBuyFood(level)} />
                ))}
              </>
            ))}
        </ScrollView>
      </View>
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

type AnimalRowProps = {
  animal: ParkAnimal;
  state: GameState;
  onFeed: () => void;
  onBuyFood: () => void;
  onUpgradeSkill: () => void;
  onRelease: () => void;
  feedRef: (view: HostInstance | null) => void;
};

function AnimalRow({ animal, state, onFeed, onBuyFood, onUpgradeSkill, onRelease, feedRef }: AnimalRowProps) {
  const config = animalFor(animal.level);
  const bonus = stateIncomeBonus(state);
  const fullness = fullnessAt(animal, state.now);
  const mood = moodFor(fullness);
  const stock = foodStock(state, animal.level);
  const unlockAt = skillUnlockAt(animal);
  const cost = skillCost(animal, bonus);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.emoji}>
          {config.emoji}
          {animal.variant.shiny ? '✨' : ''}
        </Text>
        <View style={styles.info}>
          <Text style={styles.name}>
            {config.name}{' '}
            <Text style={styles.stars}>
              {'★'.repeat(animal.skill)}
              <Text style={styles.starsEmpty}>{'★'.repeat(MAX_SKILL - animal.skill)}</Text>
            </Text>
          </Text>
          <Text style={styles.detail}>
            🪙 {formatNumber(animalIncomePerSecond(animal, bonus, state.now))}/sn · {skillFor(animal.level).name}
          </Text>
        </View>
      </View>
      {/* Tokluk çubuğu: yeşil tok, sarı acıkmış, turuncu üzgün, kırmızı kaçmak üzere. */}
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.max(4, fullness * 100)}%`, backgroundColor: FULLNESS_COLOR[mood] }]} />
      </View>
      {/* "Ne zaman beslemeliyim?" sorusunun cevabı; ham saat yerine çocuğun anlayacağı bir cümle. */}
      <Text style={[styles.status, mood === 'leaving' && styles.statusAlarm, mood === 'happy' && styles.statusCalm]}>
        {mood === 'happy'
          ? `⏰ ${formatWait((hungryAt(animal) - state.now) / 1000)} sonra acıkır`
          : mood === 'leaving'
            ? '😭 Kaçmak üzere! Hemen besle!'
            : '🍖 Şimdi besle!'}
      </Text>
      <View style={styles.actions}>
        {stock > 0 ? (
          <Pressable
            ref={feedRef}
            style={[styles.button, styles.feed, !canFeed(state, animal) && styles.disabled]}
            disabled={!canFeed(state, animal)}
            onPress={onFeed}>
            <Text style={styles.buttonText}>
              {config.food.emoji} Besle ×{stock}
            </Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.button, styles.buyFood]} onPress={onBuyFood}>
            <Text style={styles.buttonText}>{config.food.emoji} Yem al</Text>
          </Pressable>
        )}
        {unlockAt === null || cost === null ? (
          <View style={[styles.button, styles.skillMaxed]}>
            <Text style={styles.buttonText}>★ Tam</Text>
          </View>
        ) : state.now < unlockAt ? (
          <View style={[styles.button, styles.skill, styles.disabled]}>
            <Text style={styles.buttonText}>🔒 {formatWait((unlockAt - state.now) / 1000)}</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.button, styles.skill, state.gold < cost && styles.disabled]}
            disabled={state.gold < cost}
            onPress={onUpgradeSkill}>
            <Text style={styles.buttonText}>★ {formatNumber(cost)}</Text>
          </Pressable>
        )}
        <Pressable style={[styles.button, styles.release]} onPress={onRelease}>
          <Text style={styles.releaseText}>Sal +{formatNumber(releaseValue(animal, bonus))}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Dükkânın üstü: bir yemin ne kadar doyurduğu ve eksik yemleri tek dokunuşla alma. */
function MissingFood({ state, onBuy }: { state: GameState; onBuy: () => void }) {
  const { cost } = missingFood(state);
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryText}>🍽️ Bir yem hayvanı yaklaşık {formatWait(HUNGER_SEC)} doyurur.</Text>
      {cost > 0 ? (
        <Pressable
          style={[styles.button, styles.missing, state.gold < cost && styles.disabled]}
          disabled={state.gold < cost}
          onPress={onBuy}>
          <Text style={styles.buyText}>🛒 Eksikleri al: 🪙 {formatNumber(cost)}</Text>
        </Pressable>
      ) : (
        <Text style={styles.summaryDone}>✅ Her hayvanın bir yemi var</Text>
      )}
    </View>
  );
}

function FoodRow({ level, state, onBuy }: { level: number; state: GameState; onBuy: () => void }) {
  const config = animalFor(level);
  const price = foodPrice(level);
  const stock = foodStock(state, level);
  const count = animalCount(state, level);
  // Parktaki bu hayvanlara yetecek kadar yem yoksa satır öne çıkar.
  const short = stock < count;

  return (
    <View style={[styles.card, styles.row, short && styles.hungryCard]}>
      <Text style={styles.emoji}>{config.food.emoji}</Text>
      <View style={styles.info}>
        <Text style={styles.name}>{config.food.name}</Text>
        <Text style={styles.detail}>
          {count > 0 ? `Parkta ${count} ${config.name.toLocaleLowerCase('tr')} var` : `${config.name} yemi`} · Stok:{' '}
          <Text style={short && styles.shortStock}>{stock}</Text>
        </Text>
      </View>
      <Pressable style={[styles.button, styles.buy, state.gold < price && styles.disabled]} disabled={state.gold < price} onPress={onBuy}>
        <Text style={styles.buyText}>🪙 {formatNumber(price)}</Text>
      </Pressable>
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
    maxHeight: '88%',
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
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F1E2C4',
  },
  tabActive: {
    backgroundColor: '#B983FF',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  tabTextActive: {
    color: 'white',
  },
  list: {
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  empty: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#A0763F',
    paddingVertical: 24,
  },
  card: {
    gap: 8,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'white',
  },
  hungryCard: {
    borderWidth: 2,
    borderColor: '#FFB020',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 34,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 17,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  stars: {
    fontSize: 14,
    color: '#FFB020',
  },
  starsEmpty: {
    color: 'rgba(91,58,30,0.2)',
  },
  detail: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A0763F',
  },
  status: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E08A00',
  },
  statusCalm: {
    color: '#A0763F',
  },
  statusAlarm: {
    color: '#FF4D4D',
  },
  summary: {
    gap: 8,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFF1D6',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5B3A1E',
    textAlign: 'center',
  },
  summaryDone: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2E9E4F',
    textAlign: 'center',
  },
  missing: {
    flex: 0,
    backgroundColor: '#FFC93C',
    borderBottomWidth: 3,
    borderBottomColor: '#E0A21E',
  },
  shortStock: {
    color: '#FF4D4D',
    fontWeight: '900',
  },
  bar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(91,58,30,0.12)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  feed: {
    backgroundColor: '#5CC85C',
  },
  buyFood: {
    backgroundColor: '#FF9F45',
  },
  skill: {
    backgroundColor: '#B983FF',
  },
  skillMaxed: {
    backgroundColor: '#8EDB8E',
  },
  release: {
    backgroundColor: '#FFC93C',
  },
  disabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '900',
    color: 'white',
  },
  releaseText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#5B3A1E',
  },
  buy: {
    flex: 0,
    minWidth: 96,
    backgroundColor: '#FFC93C',
    borderBottomWidth: 3,
    borderBottomColor: '#E0A21E',
  },
  buyText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#5B3A1E',
  },
});
