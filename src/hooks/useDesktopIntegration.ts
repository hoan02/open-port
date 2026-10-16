import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  onWatchChanged,
  setCloseToTray as applyCloseToTray,
  setTrayLabels,
  setWatchedPorts as applyWatchedPorts,
} from "@/api/desktop";

const WATCHED_PORTS_KEY = "watched-ports";
const CLOSE_TO_TRAY_KEY = "close-to-tray";

function readJson<T>(key: string, fallback: T, valid: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return valid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable
  }
}

// Backend calls fail outside Tauri (e.g. a plain browser); the UI keeps working
const ignore = () => {};

/** Watched ports, close-to-tray and the tray menu, kept in sync with the Rust side */
export function useDesktopIntegration() {
  const { t, i18n } = useTranslation();

  const [watchedPorts, setWatchedPorts] = useState<number[]>(() =>
    readJson<number[]>(WATCHED_PORTS_KEY, [], (v) =>
      Array.isArray(v) && v.every((n) => Number.isInteger(n))
    )
  );
  const [closeToTray, setCloseToTrayState] = useState<boolean>(() =>
    readJson<boolean>(CLOSE_TO_TRAY_KEY, false, (v) => typeof v === "boolean")
  );

  useEffect(() => {
    writeJson(WATCHED_PORTS_KEY, watchedPorts);
    applyWatchedPorts(watchedPorts, {
      in_use: t("watch.notifyInUse"),
      freed: t("watch.notifyFreed"),
    }).catch(ignore);
  }, [watchedPorts, t, i18n.language]);

  useEffect(() => {
    writeJson(CLOSE_TO_TRAY_KEY, closeToTray);
    applyCloseToTray(closeToTray).catch(ignore);
  }, [closeToTray]);

  useEffect(() => {
    setTrayLabels(t("tray.show"), t("tray.quit")).catch(ignore);
  }, [t, i18n.language]);

  // Mirror watcher notifications inside the app while it is in the foreground
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onWatchChanged((event) => {
      if (document.visibilityState !== "visible") return;
      // Same "{port}"/"{process}" placeholders as the Rust notification
      const template = t(event.in_use ? "watch.notifyInUse" : "watch.notifyFreed");
      toast.info(
        template
          .replace("{port}", String(event.port))
          .replace("{process}", event.process_name ?? "")
      );
    })
      .then((fn) => (unlisten = fn))
      .catch(ignore);
    return () => unlisten?.();
  }, [t]);

  const toggleWatch = useCallback((port: number) => {
    setWatchedPorts((prev) =>
      prev.includes(port)
        ? prev.filter((p) => p !== port)
        : [...prev, port].sort((a, b) => a - b)
    );
  }, []);

  return {
    watchedPorts,
    toggleWatch,
    closeToTray,
    setCloseToTray: setCloseToTrayState,
  };
}
