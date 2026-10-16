import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  ExternalLink,
  Eye,
  RefreshCw,
  Shield,
  ShieldOff,
  Timer,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePortActions } from "@/hooks/usePortActions";
import {
  isLocallyReachable,
  portKey,
  processLabel,
  type PortInfo,
} from "@/types/ports";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ports: PortInfo[];
  onRefresh: () => void;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: () => void;
  hideSystem: boolean;
  onToggleHideSystem: () => void;
  elevated: boolean;
  onRelaunchAsAdmin: () => void;
  onKill: (port: PortInfo) => void;
  onOpenDetail: (port: PortInfo) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  ports,
  onRefresh,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  hideSystem,
  onToggleHideSystem,
  elevated,
  onRelaunchAsAdmin,
  onKill,
  onOpenDetail,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const { openInBrowser } = usePortActions();

  // Close first so dialogs opened by the command are not stacked on the palette
  const run = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  const visiblePorts = hideSystem ? ports.filter((p) => !p.is_system) : ports;
  const browsable = visiblePorts.filter(
    (p) => p.protocol === "TCP" && isLocallyReachable(p)
  );
  const describe = (port: PortInfo) =>
    `:${port.port} ${port.protocol} ${processLabel(port)} ${port.pid}`;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("palette.title")}
      description={t("palette.placeholder")}
    >
      <CommandInput placeholder={t("palette.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("palette.empty")}</CommandEmpty>

        <CommandGroup heading={t("palette.commands")}>
          <CommandItem onSelect={run(onRefresh)}>
            <RefreshCw />
            {t("search.refresh")}
            <CommandShortcut>F5</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(onToggleAutoRefresh)}>
            <Timer />
            {autoRefreshEnabled
              ? t("palette.autoRefreshOff")
              : t("palette.autoRefreshOn")}
          </CommandItem>
          <CommandItem onSelect={run(onToggleHideSystem)}>
            <ShieldOff />
            {hideSystem ? t("palette.showSystem") : t("palette.hideSystem")}
          </CommandItem>
          {!elevated && (
            <CommandItem onSelect={run(onRelaunchAsAdmin)}>
              <Shield />
              {t("actions.relaunchAsAdmin")}
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("palette.kill")}>
          {visiblePorts.map((port) => (
            <CommandItem
              key={`kill-${portKey(port)}`}
              value={`kill ${describe(port)}`}
              onSelect={run(() => onKill(port))}
            >
              <X className="text-destructive" />
              <span className="font-mono">:{port.port}</span>
              <span className="truncate text-muted-foreground">
                {processLabel(port)} · {port.protocol} · PID {port.pid}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading={t("palette.open")}>
          {browsable.map((port) => (
            <CommandItem
              key={`open-${portKey(port)}`}
              value={`open browser ${describe(port)}`}
              onSelect={run(() => openInBrowser(port))}
            >
              <ExternalLink />
              <span className="font-mono">localhost:{port.port}</span>
              <span className="truncate text-muted-foreground">
                {processLabel(port)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading={t("palette.details")}>
          {visiblePorts.map((port) => (
            <CommandItem
              key={`detail-${portKey(port)}`}
              value={`detail ${describe(port)}`}
              onSelect={run(() => onOpenDetail(port))}
            >
              <Eye />
              <span className="font-mono">:{port.port}</span>
              <span className="truncate text-muted-foreground">
                {processLabel(port)} · {port.protocol}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
