import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PortMetrics } from "@/components/features/ports/PortList";
import { Command, Loader2, Pause, Shield, ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

const REFRESH_INTERVALS_MS = [1000, 2000, 5000, 10000, 30000];

export type PauseReason = "interacting" | "dialog" | "hidden";

type StatusBarProps = {
  metrics: PortMetrics | null;
  killingPid: number | null;
  refreshIntervalMs: number;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: () => void;
  onChangeAutoRefreshInterval: (ms: number) => void;
  onClearFilter: () => void;
  lastUpdated: number | null;
  pauseReason: PauseReason | null;
  elevated: boolean;
  onRelaunchAsAdmin: () => void;
  onOpenPalette: () => void;
};

/** Re-render every second so relative times stay current */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const formatSeconds = (ms: number) => `${Math.round(ms / 100) / 10}s`;

export function StatusBar({
  metrics,
  killingPid,
  refreshIntervalMs,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  onChangeAutoRefreshInterval,
  onClearFilter,
  lastUpdated,
  pauseReason,
  elevated,
  onRelaunchAsAdmin,
  onOpenPalette,
}: StatusBarProps) {
  const { t } = useTranslation();
  const now = useNow();
  const secondsAgo =
    lastUpdated === null ? null : Math.max(0, Math.round((now - lastUpdated) / 1000));
  const total = metrics?.total ?? 0;
  const filtered = metrics?.filtered ?? 0;
  const activeFilter = metrics?.activeFilter ?? null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-7 items-center gap-3 border-t border-border bg-background/90 px-3 text-[11px] text-muted-foreground backdrop-blur">
      <div className="flex items-center gap-1.5">
        <span className="text-foreground/80">{t("statusBar.ports")}</span>
        <span className="tabular-nums">
          {filtered === total ? total : `${filtered}/${total}`}
        </span>
      </div>

      {activeFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-[11px]"
          onClick={onClearFilter}
          title={t("statusBar.clearFilter")}
        >
          <span className="text-foreground/80">{t("statusBar.filter")}</span>
          <Badge variant="outline" className="h-5 px-2 text-[11px]">
            {activeFilter}
          </Badge>
          <X className="h-3 w-3" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 px-2 text-[11px]"
            title={t("statusBar.autoRefresh")}
          >
            <span className="text-foreground/80">
              {t("statusBar.autoRefresh")}
            </span>
            <Badge variant="outline" className="h-5 px-2 text-[11px]">
              {autoRefreshEnabled
                ? formatSeconds(refreshIntervalMs)
                : t("statusBar.off")}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" sideOffset={6}>
          <DropdownMenuLabel className="text-[11px]">
            {t("statusBar.refreshInterval")}
          </DropdownMenuLabel>
          {REFRESH_INTERVALS_MS.map((ms) => (
            <DropdownMenuItem
              key={ms}
              className="text-[12px]"
              onSelect={() => {
                onChangeAutoRefreshInterval(ms);
                if (!autoRefreshEnabled) onToggleAutoRefresh();
              }}
            >
              {formatSeconds(ms)}
              {autoRefreshEnabled && refreshIntervalMs === ms && (
                <span className="ml-auto text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-[12px]"
            onSelect={onToggleAutoRefresh}
          >
            {autoRefreshEnabled
              ? t("statusBar.turnOff")
              : t("statusBar.turnOn")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {autoRefreshEnabled && pauseReason && (
        <span
          className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
          title={t(`statusBar.pausedReason.${pauseReason}`)}
        >
          <Pause className="h-3 w-3" />
          {t("statusBar.paused")}
        </span>
      )}

      {secondsAgo !== null && (
        <span className="tabular-nums">
          {secondsAgo < 2
            ? t("statusBar.updatedJustNow")
            : t("statusBar.updatedAgo", { seconds: secondsAgo })}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {killingPid !== null && (
          <div className="flex items-center gap-1.5 text-destructive">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{t("statusBar.killing", { pid: killingPid })}</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={onOpenPalette}
          title={t("palette.title")}
        >
          <Command className="h-3 w-3" />
          Ctrl+K
        </Button>

        {elevated ? (
          <span
            className="flex items-center gap-1 text-foreground/80"
            title={t("statusBar.elevatedHint")}
          >
            <ShieldCheck className="h-3 w-3" />
            {t("statusBar.elevated")}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={onRelaunchAsAdmin}
            title={t("statusBar.notElevatedHint")}
          >
            <Shield className="h-3 w-3" />
            {t("actions.relaunchAsAdmin")}
          </Button>
        )}
      </div>
    </div>
  );
}
