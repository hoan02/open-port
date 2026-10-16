import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Eye,
  EyeOff,
  PanelBottomClose,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type SettingsMenuProps = {
  statusBarVisible: boolean;
  onToggleStatusBar: (next: boolean) => void;
  closeToTray: boolean;
  onCloseToTrayChange: (next: boolean) => void;
};

export function SettingsMenu({
  statusBarVisible,
  onToggleStatusBar,
  closeToTray,
  onCloseToTrayChange,
}: SettingsMenuProps) {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-foreground/80 dark:text-foreground/90 hover:text-foreground hover:bg-border/60 dark:hover:bg-border/40 focus-visible:ring-1 focus-visible:ring-border"
          title={t("settings.title")}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="right"
        sideOffset={6}
        className="w-56 -ml-1"
      >
        <DropdownMenuLabel>{t("settings.language")}</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => changeLanguage("en")}
          className={cn(
            "flex h-7 items-center justify-between py-1 text-xs",
            currentLanguage === "en" && "bg-border/60 dark:bg-border/40"
          )}
        >
          <span>English</span>
          {currentLanguage === "en" && (
            <span className="text-xs text-muted-foreground">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => changeLanguage("vi")}
          className={cn(
            "flex h-7 items-center justify-between py-1 text-xs",
            currentLanguage === "vi" && "bg-border/60 dark:bg-border/40"
          )}
        >
          <span>Tiếng Việt</span>
          {currentLanguage === "vi" && (
            <span className="text-xs text-muted-foreground">✓</span>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t("settings.theme")}</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => setTheme("light")}
          className={cn(
            "flex h-7 items-center gap-2 py-1 text-xs",
            theme === "light" && "bg-border/60 dark:bg-border/40"
          )}
        >
          <Sun className="h-4 w-4" />
          <span>{t("settings.themeLight")}</span>
          {theme === "light" && (
            <span className="ml-auto text-xs text-muted-foreground">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setTheme("dark")}
          className={cn(
            "flex h-7 items-center gap-2 py-1 text-xs",
            theme === "dark" && "bg-border/60 dark:bg-border/40"
          )}
        >
          <Moon className="h-4 w-4" />
          <span>{t("settings.themeDark")}</span>
          {theme === "dark" && (
            <span className="ml-auto text-xs text-muted-foreground">✓</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setTheme("system")}
          className={cn(
            "flex h-7 items-center gap-2 py-1 text-xs",
            theme === "system" && "bg-border/60 dark:bg-border/40"
          )}
        >
          <Monitor className="h-4 w-4" />
          <span>{t("settings.themeSystem")}</span>
          {theme === "system" && (
            <span className="ml-auto text-xs text-muted-foreground">✓</span>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="flex h-7 items-center gap-2 py-1 text-xs"
          onSelect={() => onToggleStatusBar(!statusBarVisible)}
        >
          {statusBarVisible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
          <span>{t("settings.statusBar")}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {statusBarVisible ? t("settings.on") : t("settings.off")}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex h-7 items-center gap-2 py-1 text-xs"
          onSelect={() => onCloseToTrayChange(!closeToTray)}
        >
          <PanelBottomClose className="h-4 w-4" />
          <span>{t("settings.closeToTray")}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {closeToTray ? t("settings.on") : t("settings.off")}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
