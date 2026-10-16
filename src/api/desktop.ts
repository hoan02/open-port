import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type WatchLabels = {
  /** "{port}" and "{process}" are replaced */
  in_use: string;
  /** "{port}" is replaced */
  freed: string;
};

export type WatchEvent = {
  port: number;
  in_use: boolean;
  pid: number | null;
  process_name: string | null;
};

/** Tell the background watcher which ports to notify about */
export async function setWatchedPorts(
  ports: number[],
  labels: WatchLabels
): Promise<void> {
  await invoke("set_watched_ports", { ports, labels });
}

export async function setCloseToTray(enabled: boolean): Promise<void> {
  await invoke("set_close_to_tray", { enabled });
}

export async function setTrayLabels(show: string, quit: string): Promise<void> {
  await invoke("set_tray_labels", { show, quit });
}

export function onWatchChanged(
  handler: (event: WatchEvent) => void
): Promise<UnlistenFn> {
  return listen<WatchEvent>("watch-changed", (event) => handler(event.payload));
}
