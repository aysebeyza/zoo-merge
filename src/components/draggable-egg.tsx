import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

import { EggView } from '@/components/egg-view';
import type { Egg } from '@/game/state';

type Props = {
  egg: Egg;
  size: number;
  onDragStart: () => void;
  /** x, y: parmağın bırakıldığı ekran noktası. */
  onDrop: (x: number, y: number) => void;
  onDragEnd: () => void;
};

const TAP_SLOP = 8;

export function DraggableEgg({ egg, size, onDragStart, onDrop, onDragEnd }: Props) {
  const [pan] = useState(() => new Animated.ValueXY());
  // PanResponder bir kez oluşturulur; en güncel props'a bu ref üzerinden ulaşır.
  const latest = useRef({ onDragStart, onDrop, onDragEnd });
  useEffect(() => {
    latest.current = { onDragStart, onDrop, onDragEnd };
  });

  const [responder] = useState(() => {
    const reset = () => {
      pan.setValue({ x: 0, y: 0 });
      latest.current.onDragEnd();
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => latest.current.onDragStart(),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > TAP_SLOP) {
          latest.current.onDrop(gesture.moveX, gesture.moveY);
        }
        reset();
      },
      onPanResponderTerminate: reset,
    });
  });

  return (
    <Animated.View {...responder.panHandlers} style={{ transform: pan.getTranslateTransform() }}>
      <EggView level={egg.level} variant={egg.variant} size={size} />
    </Animated.View>
  );
}
