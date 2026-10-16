import { invoke } from "@tauri-apps/api/core";
import type { PortInfo } from "../types/ports";

/**
 * List all TCP ports in LISTENING state and all bound UDP ports
 * @returns Promise resolving to an array of port information
 */
export async function listPorts(): Promise<PortInfo[]> {
  try {
    const ports = await invoke<PortInfo[]>("list_listening_ports");
    return ports;
  } catch (error) {
    throw new Error(
      `Failed to list ports: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Kill a process by its PID
 * @param pid Process ID to terminate
 * @param tree Also terminate all child processes
 * @returns Number of processes terminated
 * @throws Error if the process cannot be killed
 */
export async function killProcess(pid: number, tree = false): Promise<number> {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Invalid PID: ${pid}. PID must be a positive integer.`);
  }

  try {
    return await invoke<number>("kill_process", { pid, tree });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

/** Whether Open Port is running with Administrator privileges */
export async function isElevated(): Promise<boolean> {
  try {
    return await invoke<boolean>("is_elevated");
  } catch {
    return false;
  }
}

/** Restart Open Port as Administrator (shows the UAC prompt) */
export async function relaunchAsAdmin(): Promise<void> {
  await invoke("relaunch_as_admin");
}
