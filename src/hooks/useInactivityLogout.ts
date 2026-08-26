import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

export const useInactivityLogout = (
  enabled: boolean,
  onInactive: () => void,
  inactivityLimitMs: number,
) => {
  const onInactiveRef = useRef(onInactive);

  useEffect(() => {
    onInactiveRef.current = onInactive;
  }, [onInactive]);

  useEffect(() => {
    if (!enabled) return undefined;

    let timeoutId: number | undefined;
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => onInactiveRef.current(), inactivityLimitMs);
    };

    ACTIVITY_EVENTS.forEach((eventName) => (
      window.addEventListener(eventName, resetTimer, { passive: true })
    ));
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [enabled, inactivityLimitMs]);
};
