import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { TitleBar } from "@/components/layout/TitleBar";
import {
  PortList,
  type PortMetrics,
} from "@/components/features/ports/PortList";
import { KillDialog } from "@/components/features/ports/KillDialog";
import { PortDetailDialog } from "@/components/features/ports/PortDetailDialog";
import { CommandPalette } from "@/components/features/ports/CommandPalette";
import { SEARCH_INPUT_ID } from "@/components/features/ports/SearchBar";
import { isElevated, relaunchAsAdmin } from "@/api/ports";
import { processLabel, type PortInfo } from "@/types/ports";
import { usePorts } from "@/hooks/usePorts";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useDesktopIntegration } from "@/hooks/useDesktopIntegration";
import type { ImperativePanelGroupHandle } from "react-resizable-panels";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sidebar,
  SidebarRail,
  type FavoritePreset,
} from "@/components/layout/Sidebar";
import { StatusBar, type PauseReason } from "@/components/layout/StatusBar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function App() {
  const { t } = useTranslation();
  const {
    ports,
    loading,
    error,
    killingPid,
    lastUpdated,
    newKeys,
    loadPorts,
    killProcess,
  } = usePorts();
  const { watchedPorts, toggleWatch, closeToTray, setCloseToTray } =
    useDesktopIntegration();

  const [searchTerm, setSearchTerm] = useState("");
  const [confirmKill, setConfirmKill] = useState<PortInfo | null>(null);
  const [detailPort, setDetailPort] = useState<PortInfo | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [windowHidden, setWindowHidden] = useState(
    () => document.visibilityState === "hidden"
  );
  const [elevated, setElevated] = useState(false);
  const [hideSystem, setHideSystem] = useState<boolean>(() => {
    try {
      return localStorage.getItem("hide-system") !== "false";
    } catch {
      return true;
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lastExpandedLayout, setLastExpandedLayout] = useState<number[]>([
    24, 76,
  ]);
  const [statusBarVisible, setStatusBarVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem("status-bar-visible");
    if (saved === null) return true;
    return saved === "true";
  });
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("auto-refresh-enabled");
    if (saved === null) return true;
    return saved === "true";
  });
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(() => {
    const saved = localStorage.getItem("auto-refresh-interval");
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) && parsed > 500 ? parsed : 2000;
  });
  const [metrics, setMetrics] = useState<PortMetrics | null>(null);
  const panelGroupRef = useRef<ImperativePanelGroupHandle | null>(null);

  const SIDEBAR_LAYOUT_KEY = "sidebar-layout-v1";
  const defaultLayout = [24, 76];
  // Khi "collapsed" phần nội dung sidebar ẩn hoàn toàn (activity bar nằm ngoài panel)
  const collapsedLayout = useMemo(() => [0, 100], []);
  const minSidebarSize = 18;
  const FAVORITES_KEY = "favorite-presets-v1";

  const normalizeLayout = useMemo(
    () => (layout: number[]) => {
      // Keep the sidebar above its minimum so reopening never restores a zero-width panel
      const sidebar = Math.max(layout[0], minSidebarSize);
      const content = 100 - sidebar;
      return [sidebar, content];
    },
    []
  );

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_LAYOUT_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        layout?: number[];
        collapsed?: boolean;
      };
      const savedLayout =
        parsed.layout && Array.isArray(parsed.layout)
          ? parsed.layout
          : defaultLayout;
      const savedCollapsed =
        typeof parsed.collapsed === "boolean" ? parsed.collapsed : false;

      if (!savedCollapsed) {
        setLastExpandedLayout(normalizeLayout(savedLayout));
      }

      panelGroupRef.current?.setLayout(
        savedCollapsed ? collapsedLayout : normalizeLayout(savedLayout)
      );
      setSidebarCollapsed(savedCollapsed);
    } catch {
      // ignore corrupted layout
    }
  }, [collapsedLayout, normalizeLayout]);

  const persistLayout = (nextLayout: number[], nextCollapsed: boolean) => {
    localStorage.setItem(
      SIDEBAR_LAYOUT_KEY,
      JSON.stringify({ layout: nextLayout, collapsed: nextCollapsed })
    );
  };

  const persistStatusBar = (next: boolean) => {
    localStorage.setItem("status-bar-visible", String(next));
    setStatusBarVisible(next);
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("auto-refresh-enabled", String(next));
      return next;
    });
  };

  const updateAutoRefreshInterval = (nextMs: number) => {
    const safe = Math.max(500, Math.min(nextMs, 30000));
    localStorage.setItem("auto-refresh-interval", String(safe));
    setAutoRefreshInterval(safe);
  };

  const handleLayout = (nextLayout: number[]) => {
    const sidebarSize = nextLayout[0];

    // Treat near-zero sizes as collapsed to avoid persisting unusable layouts
    if (sidebarSize <= collapsedLayout[0] + 0.1) {
      setSidebarCollapsed(true);
      persistLayout(collapsedLayout, true);
      return;
    }

    const normalized = normalizeLayout(nextLayout);
    setLastExpandedLayout(normalized);
    setSidebarCollapsed(false);
    persistLayout(normalized, false);
  };

  const toggleCollapse = () => {
    if (sidebarCollapsed) {
      const expandLayout = lastExpandedLayout || defaultLayout;
      setSidebarCollapsed(false);
      // Đợi 1 tick để minSize/maxSize cập nhật theo trạng thái mới rồi mới set layout
      setTimeout(() => {
        panelGroupRef.current?.setLayout(expandLayout);
      }, 0);
      persistLayout(expandLayout, false);
      return;
    }

    panelGroupRef.current?.setLayout(collapsedLayout);
    setSidebarCollapsed(true);
    persistLayout(collapsedLayout, true);
  };

  // ":port" matches the port exactly instead of every port/PID containing the digits
  const defaultFavorites: FavoritePreset[] = [
    { label: "Frontend (3000)", query: ":3000" },
    { label: "API (8080)", query: ":8080" },
    { label: "Database (5432)", query: ":5432" },
  ];
  const legacyDefaultQueries = new Set(["3000", "8080", "5432"]);

  const [favoritePresets, setFavoritePresets] = useState<FavoritePreset[]>(
    () => {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (!saved) return defaultFavorites;
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter(
              (item): item is FavoritePreset =>
                typeof item?.label === "string" &&
                typeof item?.query === "string"
            )
            .map((item) =>
              // Migrate the old substring-matching default presets
              legacyDefaultQueries.has(item.query)
                ? { ...item, query: `:${item.query}` }
                : item
            );
        }
        return defaultFavorites;
      } catch {
        return defaultFavorites;
      }
    }
  );

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritePresets));
    } catch {
      // ignore persistence errors
    }
  }, [favoritePresets]);

  const handleAddFavorite = (preset: FavoritePreset) => {
    setFavoritePresets((prev) => {
      const exists = prev.some(
        (p) => p.label === preset.label && p.query === preset.query
      );
      if (exists) return prev;
      return [...prev, preset];
    });
  };

  const handleUpdateFavorite = (index: number, preset: FavoritePreset) => {
    setFavoritePresets((prev) =>
      prev.map((item, i) => (i === index ? preset : item))
    );
  };

  const handleDeleteFavorite = (index: number) => {
    setFavoritePresets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleHideSystemChange = useCallback((hide: boolean) => {
    setHideSystem(hide);
    try {
      localStorage.setItem("hide-system", String(hide));
    } catch {
      // storage unavailable
    }
  }, []);

  useEffect(() => {
    isElevated().then(setElevated);
  }, []);

  useEffect(() => {
    const onVisibility = () =>
      setWindowHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Pause while the user is aiming at a row, so rows never shift under the cursor
  // (e.g. right before clicking kill), while a dialog is open, and while minimized
  const pauseReason: PauseReason | null = windowHidden
    ? "hidden"
    : confirmKill || detailPort || paletteOpen
      ? "dialog"
      : interacting
        ? "interacting"
        : null;

  useAutoRefresh(
    loadPorts,
    autoRefreshInterval,
    autoRefreshEnabled,
    pauseReason !== null
  );

  const handleRelaunchAsAdmin = useCallback(async () => {
    try {
      await relaunchAsAdmin();
    } catch (err) {
      toast.error(t("actions.relaunchFailed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [t]);

  const handleKillClick = useCallback((port: PortInfo) => {
    setConfirmKill(port);
  }, []);

  const handleOpenDetail = useCallback((port: PortInfo) => {
    setDetailPort(port);
  }, []);

  const handleClearFilter = () => setSearchTerm("");

  const handleKillConfirm = async (tree: boolean) => {
    if (!confirmKill) return;

    const { pid } = confirmKill;
    const name = processLabel(confirmKill);
    try {
      const killed = await killProcess(pid, tree);
      setConfirmKill(null);
      toast.success(t("ports.killSuccess", { name, pid }), {
        description:
          killed > 1 ? t("ports.killTreeSuccess", { count: killed }) : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const accessDenied = /access denied/i.test(message);
      toast.error(t("ports.killFailed"), {
        description: message,
        action:
          accessDenied && !elevated
            ? {
                label: t("actions.relaunchAsAdmin"),
                onClick: handleRelaunchAsAdmin,
              }
            : undefined,
      });
    }
  };

  // Global shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (ctrl && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const input = document.getElementById(SEARCH_INPUT_ID);
        if (input instanceof HTMLInputElement) {
          input.focus();
          input.select();
        }
      } else if (e.key === "F5" || (ctrl && e.key.toLowerCase() === "r")) {
        // Refresh the list instead of reloading the whole webview
        e.preventDefault();
        loadPorts();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadPorts]);

  // Every port of the process about to be killed, from the latest data
  const killPorts = useMemo(
    () => (confirmKill ? ports.filter((p) => p.pid === confirmKill.pid) : []),
    [ports, confirmKill]
  );

  return (
    <div className="h-screen bg-background overflow-hidden">
      <TitleBar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleCollapse}
      />
      <div className={cn("flex h-full pt-9", statusBarVisible ? "pb-7" : "")}>
        <SidebarRail
          sidebarOpen={!sidebarCollapsed}
          onToggleSidebar={toggleCollapse}
          statusBarVisible={statusBarVisible}
          onToggleStatusBar={persistStatusBar}
          closeToTray={closeToTray}
          onCloseToTrayChange={setCloseToTray}
        />
        <div className="flex h-full min-w-0 flex-1 flex-col">
          <ResizablePanelGroup
            ref={panelGroupRef}
            direction="horizontal"
            className="flex-1"
            onLayout={handleLayout}
          >
            <ResizablePanel
              defaultSize={24}
              minSize={sidebarCollapsed ? 0 : 18}
              maxSize={sidebarCollapsed ? 0 : 40}
              collapsedSize={0}
              collapsible
            >
              <Sidebar
                collapsed={sidebarCollapsed}
                favorites={favoritePresets}
                onSelectQuery={setSearchTerm}
                searchTerm={searchTerm}
                onAddFavorite={handleAddFavorite}
                onUpdateFavorite={handleUpdateFavorite}
                onDeleteFavorite={handleDeleteFavorite}
                ports={ports}
                watchedPorts={watchedPorts}
                onToggleWatch={toggleWatch}
              />
            </ResizablePanel>
            {!sidebarCollapsed && <ResizableHandle withHandle />}
            <ResizablePanel minSize={45}>
              <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-4 md:px-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <PortList
                  ports={ports}
                  loading={loading}
                  killingPid={killingPid}
                  newKeys={newKeys}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  onRefresh={loadPorts}
                  onOpenDetail={handleOpenDetail}
                  onKillClick={handleKillClick}
                  onMetricsChange={setMetrics}
                  onInteractionChange={setInteracting}
                  hideSystem={hideSystem}
                  onHideSystemChange={handleHideSystemChange}
                  watchedPorts={watchedPorts}
                  onToggleWatch={toggleWatch}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      {confirmKill && (
        <KillDialog
          open={!!confirmKill}
          onOpenChange={(open) => !open && setConfirmKill(null)}
          port={confirmKill}
          processPorts={killPorts.length > 0 ? killPorts : [confirmKill]}
          onConfirm={handleKillConfirm}
          killing={killingPid === confirmKill.pid}
        />
      )}

      <PortDetailDialog
        open={!!detailPort}
        onOpenChange={(open) => !open && setDetailPort(null)}
        port={detailPort}
        onKillClick={handleKillClick}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        ports={ports}
        onRefresh={loadPorts}
        autoRefreshEnabled={autoRefreshEnabled}
        onToggleAutoRefresh={toggleAutoRefresh}
        hideSystem={hideSystem}
        onToggleHideSystem={() => handleHideSystemChange(!hideSystem)}
        elevated={elevated}
        onRelaunchAsAdmin={handleRelaunchAsAdmin}
        onKill={handleKillClick}
        onOpenDetail={handleOpenDetail}
      />

      {statusBarVisible && (
        <StatusBar
          metrics={metrics}
          killingPid={killingPid}
          refreshIntervalMs={autoRefreshInterval}
          autoRefreshEnabled={autoRefreshEnabled}
          onToggleAutoRefresh={toggleAutoRefresh}
          onChangeAutoRefreshInterval={updateAutoRefreshInterval}
          onClearFilter={handleClearFilter}
          lastUpdated={lastUpdated}
          pauseReason={pauseReason}
          elevated={elevated}
          onRelaunchAsAdmin={handleRelaunchAsAdmin}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      )}
    </div>
  );
}

export default App;
