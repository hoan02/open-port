import { useCallback } from "react";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { PortInfo } from "@/types/ports";

/** Row actions shared by the context menu, the detail dialog and the command palette */
export function usePortActions() {
  const { t } = useTranslation();

  const copy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        toast.success(t("actions.copied"), { description: value });
      } catch {
        toast.error(t("actions.copyFailed"));
      }
    },
    [t]
  );

  const openInBrowser = useCallback(
    async (port: PortInfo) => {
      try {
        await openUrl(`http://localhost:${port.port}`);
      } catch (err) {
        toast.error(t("actions.openFailed"), { description: String(err) });
      }
    },
    [t]
  );

  const revealInExplorer = useCallback(
    async (port: PortInfo) => {
      if (!port.process_path) return;
      try {
        await revealItemInDir(port.process_path);
      } catch (err) {
        toast.error(t("actions.openFailed"), { description: String(err) });
      }
    },
    [t]
  );

  return { copy, openInBrowser, revealInExplorer };
}
