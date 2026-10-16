import { useState, useCallback, useRef, useEffect } from "react";
import { listPorts, killProcess } from "@/api/ports";
import { portKey, type PortInfo } from "@/types/ports";

/** How long a newly opened port stays highlighted */
const NEW_PORT_HIGHLIGHT_MS = 4000;

export function usePorts() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  /** Keys of rows that appeared since a previous refresh, with when they appeared */
  const [newKeys, setNewKeys] = useState<Map<string, number>>(new Map());
  // Prevent overlapping requests when a refresh takes longer than the interval
  const inFlight = useRef(false);
  const knownKeys = useRef<Set<string> | null>(null);

  const loadPorts = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const data = await listPorts();
      const keys = new Set(data.map(portKey));

      // Nothing is "new" on the very first load
      if (knownKeys.current) {
        const now = Date.now();
        const appeared = [...keys].filter((k) => !knownKeys.current!.has(k));
        if (appeared.length > 0) {
          setNewKeys((prev) => {
            const next = new Map(prev);
            for (const key of appeared) next.set(key, now);
            return next;
          });
        }
      }
      knownKeys.current = keys;

      setPorts(data);
      setLastUpdated(Date.now());
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load ports";
      setError(errorMessage);
      console.error("Error loading ports:", err);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  // Drop highlights once they have expired
  const hasNewKeys = newKeys.size > 0;
  useEffect(() => {
    if (!hasNewKeys) return;
    const id = setInterval(() => {
      const now = Date.now();
      setNewKeys((prev) => {
        const next = new Map(
          [...prev].filter(([, at]) => now - at < NEW_PORT_HIGHLIGHT_MS)
        );
        return next.size === prev.size ? prev : next;
      });
    }, 500);
    return () => clearInterval(id);
  }, [hasNewKeys]);

  /**
   * Kill a process (optionally with its children) and refresh the list.
   * Errors are rethrown for the caller to display (e.g. as a toast), so they are not
   * wiped out by the next auto refresh.
   */
  const handleKillProcess = useCallback(
    async (pid: number, tree = false) => {
      setKillingPid(pid);

      let killed: number;
      try {
        killed = await killProcess(pid, tree);
      } finally {
        setKillingPid(null);
      }

      await loadPorts();
      return killed;
    },
    [loadPorts]
  );

  return {
    ports,
    loading,
    error,
    killingPid,
    lastUpdated,
    newKeys,
    loadPorts,
    killProcess: handleKillProcess,
    setError,
  };
}
