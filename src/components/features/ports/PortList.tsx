import { useMemo, useState, useEffect } from "react";
import { PortTable, type SortKey, type SortState } from "./PortTable";
import { SearchBar, type QuickFilter } from "./SearchBar";
import { Button } from "@/components/ui/button";
import { SearchX, ShieldOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  portKey,
  processLabel,
  type PortInfo,
  type ProtocolFilter,
} from "@/types/ports";

interface PortListProps {
  ports: PortInfo[];
  loading: boolean;
  killingPid: number | null;
  newKeys: Map<string, number>;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onOpenDetail: (port: PortInfo) => void;
  onKillClick: (port: PortInfo) => void;
  onMetricsChange?: (metrics: PortMetrics) => void;
  /** True while the user is pointing at or interacting with rows */
  onInteractionChange: (interacting: boolean) => void;
  hideSystem: boolean;
  onHideSystemChange: (hide: boolean) => void;
  watchedPorts: number[];
  onToggleWatch: (port: number) => void;
}

export type PortMetrics = {
  total: number;
  filtered: number;
  activeFilter: string | null;
};

const PROTOCOL_FILTER_KEY = "protocol-filter";
const SORT_KEY = "port-sort";
const MAX_QUICK_FILTERS = 6;
/** Processes too generic to be useful as a quick filter */
const QUICK_FILTER_EXCLUDED = new Set(["svchost.exe", "system", "lsass.exe"]);

function readStorage<T>(key: string, parse: (raw: string) => T | null, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return (raw !== null && parse(raw)) || fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}

/** ":80" matches port 80 exactly instead of every port containing "80" */
function matchesSearch(port: PortInfo, search: string): boolean {
  const exactPort = /^:(\d+)$/.exec(search);
  if (exactPort) return port.port === Number(exactPort[1]);

  return (
    port.port.toString().includes(search) ||
    processLabel(port).toLowerCase().includes(search) ||
    port.command_line.toLowerCase().includes(search) ||
    port.pid.toString().includes(search) ||
    port.protocol.toLowerCase() === search ||
    port.local_addresses.some((a) => a.toLowerCase().includes(search))
  );
}

function compareBy(sort: SortState) {
  const factor = sort.dir === "asc" ? 1 : -1;
  return (a: PortInfo, b: PortInfo) => {
    let result = 0;
    if (sort.key === "port") result = a.port - b.port;
    if (sort.key === "pid") result = a.pid - b.pid;
    if (sort.key === "process")
      result = a.process_name.localeCompare(b.process_name, undefined, {
        sensitivity: "base",
      });
    // Stable, predictable order for ties
    return factor * result || a.port - b.port || a.protocol.localeCompare(b.protocol);
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function PortList({
  ports,
  loading,
  killingPid,
  newKeys,
  searchTerm,
  onSearchChange,
  onRefresh,
  onOpenDetail,
  onKillClick,
  onMetricsChange,
  onInteractionChange,
  hideSystem,
  onHideSystemChange,
  watchedPorts,
  onToggleWatch,
}: PortListProps) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [protocolFilter, setProtocolFilter] = useState<ProtocolFilter>(() =>
    readStorage<ProtocolFilter>(
      PROTOCOL_FILTER_KEY,
      (raw) => (["all", "TCP", "UDP"].includes(raw) ? (raw as ProtocolFilter) : null),
      "all"
    )
  );
  const [sort, setSort] = useState<SortState>(() =>
    readStorage<SortState>(
      SORT_KEY,
      (raw) => {
        const parsed = JSON.parse(raw);
        return ["port", "process", "pid"].includes(parsed?.key) &&
          ["asc", "desc"].includes(parsed?.dir)
          ? parsed
          : null;
      },
      { key: "port", dir: "asc" }
    )
  );
  const [hovering, setHovering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    onInteractionChange(hovering || menuOpen);
  }, [hovering, menuOpen, onInteractionChange]);

  const handleProtocolFilterChange = (filter: ProtocolFilter) => {
    setProtocolFilter(filter);
    writeStorage(PROTOCOL_FILTER_KEY, filter);
  };

  const handleSortChange = (key: SortKey) => {
    setSort((prev) => {
      const next: SortState =
        prev.key === key
          ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
          : { key, dir: "asc" };
      writeStorage(SORT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleFilterChange = (filter: string | null) => {
    setActiveFilter(filter);
    onSearchChange(filter ?? "");
  };

  // Typing in the search box replaces a quick filter
  useEffect(() => {
    if (activeFilter && searchTerm !== activeFilter) setActiveFilter(null);
  }, [searchTerm, activeFilter]);

  const systemCount = useMemo(
    () => ports.filter((p) => p.is_system).length,
    [ports]
  );

  // Ports after the "hide system processes" toggle
  const visiblePorts = useMemo(
    () => (hideSystem ? ports.filter((p) => !p.is_system) : ports),
    [ports, hideSystem]
  );

  const protocolCounts = useMemo(() => {
    const counts: Record<ProtocolFilter, number> = {
      all: visiblePorts.length,
      TCP: 0,
      UDP: 0,
    };
    for (const port of visiblePorts) counts[port.protocol] += 1;
    return counts;
  }, [visiblePorts]);

  // The most common processes currently listening
  const quickFilters = useMemo<QuickFilter[]>(() => {
    const counts = new Map<string, number>();
    for (const port of visiblePorts) {
      const name = port.process_name.toLowerCase();
      if (QUICK_FILTER_EXCLUDED.has(name) || name.startsWith("pid ")) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    const top = [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_QUICK_FILTERS);
    // Keep the active filter visible even if it dropped out of the top list
    if (activeFilter && !top.some(([name]) => name === activeFilter)) {
      top.push([activeFilter, counts.get(activeFilter) ?? 0]);
    }

    return top.map(([name, count]) => ({
      value: name,
      label: name.replace(/\.exe$/, ""),
      count,
    }));
  }, [visiblePorts, activeFilter]);

  const search = searchTerm.trim().toLowerCase();

  const filteredPorts = useMemo(() => {
    const byProtocol =
      protocolFilter === "all"
        ? visiblePorts
        : visiblePorts.filter((port) => port.protocol === protocolFilter);
    const matched = search
      ? byProtocol.filter((port) => matchesSearch(port, search))
      : byProtocol;
    return [...matched].sort(compareBy(sort));
  }, [visiblePorts, protocolFilter, search, sort]);

  // System results the toggle is currently hiding from this search
  const hiddenSystemMatches = useMemo(() => {
    if (!hideSystem) return 0;
    return ports.filter(
      (port) =>
        port.is_system &&
        (protocolFilter === "all" || port.protocol === protocolFilter) &&
        (!search || matchesSearch(port, search))
    ).length;
  }, [ports, hideSystem, protocolFilter, search]);

  // Report metrics to parent for status bar
  useEffect(() => {
    onMetricsChange?.({
      total: ports.length,
      filtered: filteredPorts.length,
      activeFilter,
    });
  }, [ports.length, filteredPorts.length, activeFilter, onMetricsChange]);

  // Keyboard navigation: ↑/↓/Home/End to select, Enter for details, Delete to kill
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
      // Leave keys alone while a dialog or menu is open
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      if (filteredPorts.length === 0) return;

      const index = filteredPorts.findIndex((p) => portKey(p) === selectedKey);
      const selected = index >= 0 ? filteredPorts[index] : null;
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowDown":
          nextIndex = index < 0 ? 0 : Math.min(index + 1, filteredPorts.length - 1);
          break;
        case "ArrowUp":
          nextIndex = index < 0 ? 0 : Math.max(index - 1, 0);
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = filteredPorts.length - 1;
          break;
        case "Enter":
          if (selected) onOpenDetail(selected);
          break;
        case "Delete":
          if (selected) onKillClick(selected);
          break;
        default:
          return;
      }

      e.preventDefault();
      if (nextIndex !== null) {
        const key = portKey(filteredPorts[nextIndex]);
        setSelectedKey(key);
        document
          .querySelector(`[data-port-key="${CSS.escape(key)}"]`)
          ?.scrollIntoView({ block: "nearest" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredPorts, selectedKey, onOpenDetail, onKillClick]);

  const showHidden = () => onHideSystemChange(false);

  const emptyState =
    ports.length === 0 ? (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <SearchX className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("ports.noPorts")}</p>
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <SearchX className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {search
            ? t("ports.noMatches", { query: searchTerm.trim() })
            : t("ports.noMatchesFilter")}
        </p>
        <div className="flex gap-2">
          {hiddenSystemMatches > 0 && (
            <Button variant="secondary" size="sm" onClick={showHidden}>
              <ShieldOff className="h-3.5 w-3.5" />
              {t("ports.showHiddenSystem", { count: hiddenSystemMatches })}
            </Button>
          )}
          {(search || protocolFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleFilterChange(null);
                handleProtocolFilterChange("all");
              }}
            >
              {t("search.clear")}
            </Button>
          )}
        </div>
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
        loading={loading}
        quickFilters={quickFilters}
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        protocolFilter={protocolFilter}
        onProtocolFilterChange={handleProtocolFilterChange}
        protocolCounts={protocolCounts}
        hideSystem={hideSystem}
        onHideSystemChange={onHideSystemChange}
        systemCount={systemCount}
      />

      <div
        className="min-h-0 flex-1 overflow-auto rounded-sm border border-border bg-background"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <PortTable
          ports={filteredPorts}
          loading={loading}
          killingPid={killingPid}
          selectedKey={selectedKey}
          newKeys={newKeys}
          sort={sort}
          emptyState={emptyState}
          onSortChange={handleSortChange}
          onSelect={setSelectedKey}
          onOpenDetail={onOpenDetail}
          onKillClick={onKillClick}
          onContextMenuOpenChange={setMenuOpen}
          watchedPorts={watchedPorts}
          onToggleWatch={onToggleWatch}
        />
      </div>

      {filteredPorts.length > 0 && hiddenSystemMatches > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          {t("ports.hiddenSystemNote", { count: hiddenSystemMatches })}{" "}
          <button
            type="button"
            className="font-medium text-foreground underline-offset-2 hover:underline"
            onClick={showHidden}
          >
            {t("ports.showAll")}
          </button>
        </p>
      )}
    </div>
  );
}
