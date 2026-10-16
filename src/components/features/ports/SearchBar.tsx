import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, ShieldOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ProtocolFilter } from "@/types/ports";

export const SEARCH_INPUT_ID = "port-search";

export type QuickFilter = { label: string; value: string; count: number };

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
  quickFilters: QuickFilter[];
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  protocolFilter: ProtocolFilter;
  onProtocolFilterChange: (filter: ProtocolFilter) => void;
  protocolCounts: Record<ProtocolFilter, number>;
  hideSystem: boolean;
  onHideSystemChange: (hide: boolean) => void;
  systemCount: number;
}

const PROTOCOL_OPTIONS: ProtocolFilter[] = ["all", "TCP", "UDP"];

export function SearchBar({
  searchTerm,
  onSearchChange,
  onRefresh,
  loading,
  quickFilters,
  activeFilter,
  onFilterChange,
  protocolFilter,
  onProtocolFilterChange,
  protocolCounts,
  hideSystem,
  onHideSystemChange,
  systemCount,
}: SearchBarProps) {
  const { t } = useTranslation();

  const handleFilterClick = (filterValue: string) => {
    if (activeFilter === filterValue) {
      onFilterChange(null);
    } else {
      onFilterChange(filterValue);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            id={SEARCH_INPUT_ID}
            type="text"
            placeholder={t("search.placeholder")}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchTerm) {
                e.preventDefault();
                onFilterChange(null);
              }
            }}
            className="pl-9 pr-9"
            title={`${t("search.placeholder")} (Ctrl+F)`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onFilterChange(null)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("search.clear")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div
          role="radiogroup"
          aria-label={t("ports.table.protocol")}
          className="inline-flex shrink-0 rounded-md border border-border p-0.5"
        >
          {PROTOCOL_OPTIONS.map((option) => {
            const active = protocolFilter === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onProtocolFilterChange(option)}
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-3 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {option === "all" ? t("search.protocolAll") : option}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    active ? "opacity-80" : "opacity-60"
                  )}
                >
                  {protocolCounts[option]}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          onClick={onRefresh}
          disabled={loading}
          variant="outline"
          title={`${t("search.refresh")} (F5)`}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          {t("search.refresh")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {quickFilters.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {t("search.quickFilters")}
          </span>
        )}
        {quickFilters.map((filter) => (
          <Badge
            key={filter.value}
            variant={activeFilter === filter.value ? "default" : "outline"}
            className="cursor-pointer gap-1 transition-colors hover:bg-primary/10"
            onClick={() => handleFilterClick(filter.value)}
          >
            {filter.label}
            <span className="opacity-60 tabular-nums">{filter.count}</span>
          </Badge>
        ))}
        {(activeFilter || searchTerm) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFilterChange(null)}
            className="h-6 px-2 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            {t("search.clear")}
          </Button>
        )}

        <Button
          variant={hideSystem ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={hideSystem}
          onClick={() => onHideSystemChange(!hideSystem)}
          className="ml-auto h-7 gap-1.5 px-2 text-xs"
          title={t("search.hideSystemHint")}
        >
          <ShieldOff className="h-3.5 w-3.5" />
          {t("search.hideSystem")}
          <span className="opacity-60 tabular-nums">{systemCount}</span>
        </Button>
      </div>
    </div>
  );
}
