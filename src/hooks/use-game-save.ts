import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState, type Dispatch } from 'react';
import { AppState } from 'react-native';

import { parseSave, serializeSave } from '@/game/save';
import type { GameAction, GameState } from '@/game/state';

const SAVE_KEY = 'zoo-merge/save';
const SAVE_EVERY_MS = 5000;

/**
 * Açılışta kayıtlı oyunu yükler; sonra birkaç saniyede bir ve uygulama arka plana geçerken kaydeder.
 * Yükleme bitene kadar false döner, ekran o sırada boş kalır.
 */
export function useGameSave(state: GameState, dispatch: Dispatch<GameAction>): boolean {
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(state);

  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(SAVE_KEY)
      .catch(() => null)
      .then((json) => {
        if (cancelled) return;
        const saved = parseSave(json);
        if (saved) dispatch({ type: 'load', state: saved });
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    // Yükleme bitmeden kaydedilirse boş oyun, kayıtlı oyunun üstüne yazılır.
    if (!loaded) return;
    const save = () => {
      AsyncStorage.setItem(SAVE_KEY, serializeSave(latest.current)).catch(() => {});
    };
    const timer = setInterval(save, SAVE_EVERY_MS);
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState !== 'active') save();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
      save();
    };
  }, [loaded]);

  return loaded;
}
