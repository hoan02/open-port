import {
  Bell,
  Check,
  Filter,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SettingsMenu } from "./SettingsMenu";
import type { PortInfo } from "@/types/ports";

export type FavoritePreset = {
  label: string;
  query: string;
};

type SidebarProps = {
  collapsed: boolean;
  favorites: FavoritePreset[];
  onSelectQuery: (query: string) => void;
  searchTerm: string;
  onAddFavorite: (preset: FavoritePreset) => void;
  onUpdateFavorite: (index: number, preset: FavoritePreset) => void;
  onDeleteFavorite: (index: number) => void;
  ports: PortInfo[];
  watchedPorts: number[];
  onToggleWatch: (port: number) => void;
};

type SidebarRailProps = {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  statusBarVisible: boolean;
  onToggleStatusBar: (next: boolean) => void;
  closeToTray: boolean;
  onCloseToTrayChange: (next: boolean) => void;
};

// Thanh activity bar cố định, luôn hiển thị
export function SidebarRail({
  sidebarOpen,
  onToggleSidebar,
  statusBarVisible,
  onToggleStatusBar,
  closeToTray,
  onCloseToTrayChange,
}: SidebarRailProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-11 min-w-11 flex-col items-center justify-between border-r bg-background/90 px-1 py-2">
      <Button
        variant={sidebarOpen ? "default" : "ghost"}
        size="icon"
        className={cn(
          "size-8",
          sidebarOpen && "bg-primary text-primary-foreground"
        )}
        onClick={onToggleSidebar}
        title={t("sidebar.title")}
        aria-label={t("sidebar.title")}
        aria-pressed={sidebarOpen}
      >
        <Star className="size-4" />
      </Button>
      <SettingsMenu
        statusBarVisible={statusBarVisible}
        onToggleStatusBar={onToggleStatusBar}
        closeToTray={closeToTray}
        onCloseToTrayChange={onCloseToTrayChange}
      />
    </div>
  );
}

type FavoriteEditorProps = {
  label: string;
  query: string;
  onLabelChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

function FavoriteEditor({
  label,
  query,
  onLabelChange,
  onQueryChange,
  onSave,
  onCancel,
}: FavoriteEditorProps) {
  const { t } = useTranslation();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="flex items-start gap-1.5 rounded-md border bg-background/70 p-1.5">
      <div className="flex flex-1 flex-col gap-1">
        <Input
          autoFocus
          placeholder={t("sidebar.labelPlaceholder")}
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-xs"
        />
        <Input
          placeholder={t("sidebar.queryPlaceholder")}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 font-mono text-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onSave}
          disabled={!label.trim() || !query.trim()}
          title={t("sidebar.save")}
          aria-label={t("sidebar.save")}
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onCancel}
          title={t("sidebar.cancel")}
          aria-label={t("sidebar.cancel")}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function Sidebar({
  collapsed,
  favorites,
  onSelectQuery,
  searchTerm,
  onAddFavorite,
  onUpdateFavorite,
  onDeleteFavorite,
  ports,
  watchedPorts,
  onToggleWatch,
}: SidebarProps) {
  const { t } = useTranslation();
  const [watchDraft, setWatchDraft] = useState("");

  const addWatch = () => {
    const port = Number(watchDraft.replace(/^:/, "").trim());
    if (Number.isInteger(port) && port > 0 && port <= 65535) {
      if (!watchedPorts.includes(port)) onToggleWatch(port);
      setWatchDraft("");
    }
  };
  // null: not editing, "new": creating, number: editing that index
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftQuery, setDraftQuery] = useState("");

  const beginEdit = (index: number, fav: FavoritePreset) => {
    setEditing(index);
    setDraftLabel(fav.label);
    setDraftQuery(fav.query);
  };

  const beginCreate = () => {
    // Prefill with the current search so "save this filter" is one click
    setEditing("new");
    setDraftLabel(searchTerm);
    setDraftQuery(searchTerm);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraftLabel("");
    setDraftQuery("");
  };

  const commitEdit = () => {
    if (!draftLabel.trim() || !draftQuery.trim()) return;

    const next: FavoritePreset = {
      label: draftLabel.trim(),
      query: draftQuery.trim(),
    };

    if (editing === "new") {
      onAddFavorite(next);
    } else if (editing !== null) {
      onUpdateFavorite(editing, next);
    }

    cancelEdit();
  };

  const editor = (
    <FavoriteEditor
      label={draftLabel}
      query={draftQuery}
      onLabelChange={setDraftLabel}
      onQueryChange={setDraftQuery}
      onSave={commitEdit}
      onCancel={cancelEdit}
    />
  );

  const itemClass = (active: boolean) =>
    cn(
      "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
      active
        ? "bg-primary/15 font-medium text-foreground"
        : "text-foreground/80 hover:bg-muted hover:text-foreground"
    );

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-muted/30 backdrop-blur-sm",
        collapsed && "hidden"
      )}
      aria-label={t("sidebar.title")}
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("sidebar.title")}
          </span>
          {favorites.length > 0 && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {favorites.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={beginCreate}
          disabled={editing !== null}
          title={t("sidebar.add")}
          aria-label={t("sidebar.add")}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        <button
          type="button"
          className={itemClass(searchTerm === "")}
          onClick={() => onSelectQuery("")}
        >
          <ListFilter className="size-4 shrink-0" />
          <span className="truncate">{t("sidebar.allPorts")}</span>
        </button>

        {editing === "new" && editor}

        {favorites.map((fav, index) => {
          if (editing === index) {
            return <div key={`${fav.label}-${index}`}>{editor}</div>;
          }

          const isActive = searchTerm === fav.query;

          return (
            <div
              key={`${fav.label}-${index}`}
              className={cn(itemClass(isActive), "p-0 pr-1")}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 text-left"
                onClick={() => onSelectQuery(fav.query)}
                title={fav.query}
              >
                <Filter
                  className={cn("size-4 shrink-0", isActive && "text-primary")}
                />
                <span className="truncate">{fav.label}</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                    title={t("sidebar.moreActions")}
                    aria-label={t("sidebar.moreActions")}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => beginEdit(index, fav)}>
                    <Pencil className="size-3.5" />
                    {t("sidebar.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDeleteFavorite(index)}
                  >
                    <Trash2 className="size-3.5" />
                    {t("sidebar.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}

        {favorites.length === 0 && editing === null && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {t("sidebar.empty")}
          </p>
        )}

        <div className="pt-3">
          <div className="flex items-center gap-2 px-2 pb-1">
            <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("watch.title")}
            </span>
            {watchedPorts.length > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {watchedPorts.length}
              </Badge>
            )}
          </div>

          {watchedPorts.map((port) => {
            const owner = ports.find((p) => p.port === port);
            const query = `:${port}`;
            return (
              <div
                key={port}
                className={cn(itemClass(searchTerm === query), "p-0 pr-1")}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2 text-left"
                  onClick={() => onSelectQuery(query)}
                  title={
                    owner
                      ? t("watch.inUseBy", { process: owner.process_name })
                      : t("watch.free")
                  }
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      owner ? "bg-emerald-500" : "bg-muted-foreground/40"
                    )}
                  />
                  <span className="font-mono">{port}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {owner ? owner.process_name : t("watch.free")}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => onToggleWatch(port)}
                  title={t("watch.unwatch", { port })}
                  aria-label={t("watch.unwatch", { port })}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            );
          })}

          <form
            className="flex items-center gap-1 px-1 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              addWatch();
            }}
          >
            <Bell className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={watchDraft}
              onChange={(e) => setWatchDraft(e.target.value)}
              placeholder={t("watch.addPlaceholder")}
              inputMode="numeric"
              className="h-7 font-mono text-xs"
              aria-label={t("watch.addPlaceholder")}
            />
          </form>
          {watchedPorts.length === 0 && (
            <p className="px-2 pt-1 text-xs text-muted-foreground">
              {t("watch.empty")}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
