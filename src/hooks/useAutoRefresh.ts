import { useEffect, useRef } from "react";

/**
 * Call `callback` every `interval` ms while enabled and not paused.
 * Runs once immediately on mount and whenever refreshing resumes.
 */
export function useAutoRefresh(
  callback: () => void,
  interval: number = 2000,
  enabled: boolean = true,
  paused: boolean = false
) {
  const hasRun = useRef(false);

  useEffect(() => {
    // Always populate data once, even when auto refresh is off
    if (!hasRun.current || (enabled && !paused)) {
      hasRun.current = true;
      callback();
    }

    if (!enabled || paused) return;

    const id = setInterval(callback, interval);
    return () => clearInterval(id);
  }, [callback, interval, enabled, paused]);
}
