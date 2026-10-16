import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatEndpoint,
  isLocallyReachable,
  wellKnownPortName,
  type PortInfo,
} from "@/types/ports";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, FolderOpen, Info, Trash2 } from "lucide-react";
import { usePortActions } from "@/hooks/usePortActions";

interface PortDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  port: PortInfo | null;
  onKillClick: (port: PortInfo) => void;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 space-y-1 ${className ?? ""}`}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { copy } = usePortActions();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0 rounded-sm"
      onClick={() => copy(value)}
      title={label}
      aria-label={label}
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}

export function PortDetailDialog({
  open,
  onOpenChange,
  port,
  onKillClick,
}: PortDetailDialogProps) {
  const { t } = useTranslation();
  const { openInBrowser, revealInExplorer } = usePortActions();

  if (!port) return null;

  const wellKnown = wellKnownPortName(port.port);
  const canOpenBrowser = port.protocol === "TCP" && isLocallyReachable(port);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4" />
            {t("ports.detail.title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("ports.detail.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-4">
            <Field label={t("ports.table.port")}>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="font-mono">
                  {port.port}
                </Badge>
                {wellKnown && (
                  <span className="truncate text-xs text-muted-foreground">
                    {wellKnown}
                  </span>
                )}
              </div>
            </Field>
            <Field label={t("ports.table.pid")}>
              <code className="text-sm">{port.pid}</code>
            </Field>
            <Field label={t("ports.detail.protocol")}>
              <div className="flex gap-1">
                <Badge variant="secondary" className="text-xs">
                  {port.protocol}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {port.protocol === "TCP"
                    ? "LISTENING"
                    : t("ports.detail.bound")}
                </Badge>
              </div>
            </Field>
          </div>

          <Field label={t("ports.table.processName")}>
            <div className="flex items-center gap-2 text-sm">
              <span className="break-all">{port.process_name}</span>
              {port.is_system && (
                <Badge variant="secondary" className="text-[10px]">
                  {t("ports.detail.systemProcess")}
                </Badge>
              )}
            </div>
            {port.process_path && (
              <div className="flex items-start gap-1">
                <span className="flex-1 break-all text-xs text-muted-foreground">
                  {port.process_path}
                </span>
                <CopyButton
                  value={port.process_path}
                  label={t("actions.copyPath")}
                />
              </div>
            )}
          </Field>

          {port.services.length > 0 && (
            <Field label={t("ports.detail.services")}>
              <div className="flex flex-wrap gap-1">
                {port.services.map((service) => (
                  <Badge key={service} variant="outline" className="text-xs">
                    {service}
                  </Badge>
                ))}
              </div>
            </Field>
          )}

          {port.command_line && (
            <Field label={t("ports.detail.commandLine")}>
              <div className="flex items-start gap-1">
                <code className="max-h-24 flex-1 overflow-auto break-all rounded-sm bg-muted px-2 py-1 text-xs">
                  {port.command_line}
                </code>
                <CopyButton
                  value={port.command_line}
                  label={t("actions.copyCommandLine")}
                />
              </div>
            </Field>
          )}

          <Field label={t("ports.detail.localAddress")}>
            <div className="space-y-0.5">
              {port.local_addresses.map((address) => {
                const endpoint = formatEndpoint(address, port.port);
                return (
                  <div
                    key={address}
                    className="flex items-center gap-1 font-mono text-xs text-muted-foreground"
                  >
                    <span className="truncate">{endpoint}</span>
                    <CopyButton
                      value={endpoint}
                      label={t("ports.detail.copyAddress")}
                    />
                  </div>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          {canOpenBrowser && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openInBrowser(port)}
            >
              <ExternalLink className="h-4 w-4" />
              {t("actions.openInBrowser")}
            </Button>
          )}
          {port.process_path && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => revealInExplorer(port)}
            >
              <FolderOpen className="h-4 w-4" />
              {t("actions.revealInExplorer")}
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onKillClick(port);
            }}
          >
            <Trash2 className="h-4 w-4" />
            {t("ports.kill")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
