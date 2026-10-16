import type { ReactNode } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addressFamilies,
  formatEndpoint,
  isLocallyReachable,
  portKey,
  processLabel,
  wellKnownPortName,
  type PortInfo,
} from "@/types/ports";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  BellOff,
  Copy,
  ExternalLink,
  Eye,
  FolderOpen,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { usePortActions } from "@/hooks/usePortActions";

export type SortKey = "port" | "process" | "pid";
export type SortState = { key: SortKey; dir: "asc" | "desc" };

interface PortTableProps {
  ports: PortInfo[];
  loading: boolean;
  killingPid: number | null;
  selectedKey: string | null;
  newKeys: Map<string, number>;
  sort: SortState;
  emptyState: ReactNode;
  onSortChange: (key: SortKey) => void;
  onSelect: (key: string) => void;
  onOpenDetail: (port: PortInfo) => void;
  onKillClick: (port: PortInfo) => void;
  onContextMenuOpenChange: (open: boolean) => void;
  watchedPorts: number[];
  onToggleWatch: (port: number) => void;
}

const headClass =
  "sticky top-0 z-10 h-9 bg-muted px-3 text-xs font-medium text-muted-foreground";

function SortHeader({
  label,
  sortKey,
  sort,
  onSortChange,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSortChange: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead
      className={cn(headClass, className)}
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSortChange(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground"
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

export function PortTable({
  ports,
  loading,
  killingPid,
  selectedKey,
  newKeys,
  sort,
  emptyState,
  onSortChange,
  onSelect,
  onOpenDetail,
  onKillClick,
  onContextMenuOpenChange,
  watchedPorts,
  onToggleWatch,
}: PortTableProps) {
  const { t } = useTranslation();
  const { copy, openInBrowser, revealInExplorer } = usePortActions();

  if (loading && ports.length === 0) {
    return (
      <div className="space-y-1 p-3">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (ports.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    // Fixed layout keeps the action column visible: long values truncate instead of widening the table
    <table className="w-full min-w-[640px] table-fixed caption-bottom text-sm">
      <TableHeader>
        <TableRow className="border-b border-border hover:bg-transparent">
          <SortHeader
            label={t("ports.table.port")}
            sortKey="port"
            sort={sort}
            onSortChange={onSortChange}
            className="w-[96px] text-left"
          />
          <SortHeader
            label={t("ports.table.processName")}
            sortKey="process"
            sort={sort}
            onSortChange={onSortChange}
            className="text-left"
          />
          <SortHeader
            label={t("ports.table.pid")}
            sortKey="pid"
            sort={sort}
            onSortChange={onSortChange}
            className="w-[76px] text-left"
          />
          <TableHead className={cn(headClass, "w-[132px] text-left")}>
            {t("ports.table.address")}
          </TableHead>
          <TableHead className={cn(headClass, "w-[64px] text-center")}>
            {t("ports.table.protocol")}
          </TableHead>
          <TableHead
            className={cn(headClass, "right-0 z-20 w-[80px] text-center")}
          >
            {t("ports.table.action")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ports.map((port) => {
          const key = portKey(port);
          const selected = key === selectedKey;
          const isNew = newKeys.has(key);
          const killing = killingPid === port.pid;
          const wellKnown = wellKnownPortName(port.port);
          const detail = port.command_line || port.process_path;
          const [firstAddress, ...otherAddresses] = port.local_addresses;
          const canOpenBrowser =
            port.protocol === "TCP" && isLocallyReachable(port);
          const watched = watchedPorts.includes(port.port);

          return (
            <ContextMenu key={key} onOpenChange={onContextMenuOpenChange}>
              <ContextMenuTrigger asChild>
                <TableRow
                  data-port-key={key}
                  aria-selected={selected}
                  onClick={() => onSelect(key)}
                  onDoubleClick={() => onOpenDetail(port)}
                  onContextMenu={() => onSelect(key)}
                  className={cn(
                    "group cursor-default border-b border-border/50",
                    selected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30",
                    isNew && "animate-new-port",
                    killing && "opacity-50"
                  )}
                >
                  <TableCell className="px-3 py-2">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="flex items-center gap-1">
                        <Badge variant="outline" className="font-mono text-xs">
                          {port.port}
                        </Badge>
                        {watched && (
                          <Bell
                            className="h-3 w-3 text-primary"
                            aria-label={t("watch.watching")}
                          />
                        )}
                      </span>
                      {wellKnown && (
                        <span className="max-w-full truncate text-[10px] text-muted-foreground">
                          {wellKnown}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="truncate text-sm font-normal"
                          title={processLabel(port)}
                        >
                          {processLabel(port)}
                        </span>
                        {isNew && (
                          <Badge className="h-4 shrink-0 px-1 text-[10px]">
                            {t("ports.new")}
                          </Badge>
                        )}
                      </span>
                      {detail && (
                        <span
                          className="truncate font-mono text-[11px] text-muted-foreground"
                          title={detail}
                        >
                          {detail}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <code className="text-xs text-muted-foreground">
                      {port.pid}
                    </code>
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <div
                      className="flex min-w-0 items-center gap-1"
                      title={port.local_addresses.join("\n")}
                    >
                      <code className="truncate text-xs text-muted-foreground">
                        {firstAddress}
                      </code>
                      {otherAddresses.length > 0 && (
                        <Badge
                          variant="secondary"
                          className="h-4 shrink-0 px-1 text-[10px]"
                        >
                          +{otherAddresses.length}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/70">
                      {addressFamilies(port)}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center">
                    <Badge
                      variant={port.protocol === "TCP" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {port.protocol}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "sticky right-0 px-3 py-2 text-center",
                      selected
                        ? "bg-[color-mix(in_oklab,var(--primary)_10%,var(--background))] group-hover:bg-[color-mix(in_oklab,var(--primary)_15%,var(--background))]"
                        : "bg-background group-hover:bg-[color-mix(in_oklab,var(--muted)_30%,var(--background))]",
                      isNew && "animate-new-port-cell"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-sm hover:bg-border/60 dark:hover:bg-border/40"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetail(port);
                        }}
                        title={t("ports.detail.view")}
                        aria-label={t("ports.detail.view")}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-sm hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onKillClick(port);
                        }}
                        disabled={killing}
                        title={killing ? t("ports.killing") : t("ports.kill")}
                        aria-label={t("ports.kill")}
                      >
                        <X
                          className={cn("h-3.5 w-3.5", killing && "animate-pulse")}
                        />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56">
                {canOpenBrowser && (
                  <ContextMenuItem onSelect={() => openInBrowser(port)}>
                    <ExternalLink />
                    {t("actions.openInBrowser")}
                  </ContextMenuItem>
                )}
                <ContextMenuItem onSelect={() => onOpenDetail(port)}>
                  <Eye />
                  {t("ports.detail.view")}
                  <ContextMenuShortcut>Enter</ContextMenuShortcut>
                </ContextMenuItem>
                {port.process_path && (
                  <ContextMenuItem onSelect={() => revealInExplorer(port)}>
                    <FolderOpen />
                    {t("actions.revealInExplorer")}
                  </ContextMenuItem>
                )}
                <ContextMenuItem onSelect={() => onToggleWatch(port.port)}>
                  {watched ? <BellOff /> : <Bell />}
                  {watched
                    ? t("watch.unwatch", { port: port.port })
                    : t("watch.watch", { port: port.port })}
                </ContextMenuItem>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Copy />
                    {t("actions.copy")}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-52">
                    <ContextMenuItem onSelect={() => copy(String(port.port))}>
                      {t("actions.copyPort")}
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => copy(String(port.pid))}>
                      {t("actions.copyPid")}
                    </ContextMenuItem>
                    <ContextMenuItem
                      onSelect={() => copy(formatEndpoint(firstAddress, port.port))}
                    >
                      {t("actions.copyEndpoint")}
                    </ContextMenuItem>
                    {port.command_line && (
                      <ContextMenuItem onSelect={() => copy(port.command_line)}>
                        {t("actions.copyCommandLine")}
                      </ContextMenuItem>
                    )}
                    {port.process_path && (
                      <ContextMenuItem onSelect={() => copy(port.process_path)}>
                        {t("actions.copyPath")}
                      </ContextMenuItem>
                    )}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => onKillClick(port)}
                  disabled={killing}
                >
                  <X />
                  {t("ports.kill")}
                  <ContextMenuShortcut>Del</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </TableBody>
    </table>
  );
}
