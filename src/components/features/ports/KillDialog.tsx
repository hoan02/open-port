import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { portKey, processLabel, type PortInfo } from "@/types/ports";

interface KillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  port: PortInfo;
  /** Every port owned by the same process, including `port` */
  processPorts: PortInfo[];
  onConfirm: (tree: boolean) => void;
  killing: boolean;
}

const MAX_LISTED_PORTS = 12;

export function KillDialog({
  open,
  onOpenChange,
  port,
  processPorts,
  onConfirm,
  killing,
}: KillDialogProps) {
  const { t } = useTranslation();
  const [tree, setTree] = useState(false);

  useEffect(() => {
    if (open) setTree(false);
  }, [open, port.pid]);

  const listed = processPorts.slice(0, MAX_LISTED_PORTS);
  const more = processPorts.length - listed.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t("dialog.kill.title")}
          </DialogTitle>
          <DialogDescription>
            {t("dialog.kill.description")}{" "}
            <strong className="break-all">{processLabel(port)}</strong> (PID:{" "}
            <strong>{port.pid}</strong>)?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {t("dialog.kill.portsFreed", { count: processPorts.length })}
            </p>
            <div className="flex flex-wrap gap-1">
              {listed.map((p) => (
                <Badge
                  key={portKey(p)}
                  variant={portKey(p) === portKey(port) ? "default" : "outline"}
                  className="font-mono text-xs"
                >
                  {p.port}/{p.protocol}
                </Badge>
              ))}
              {more > 0 && (
                <Badge variant="secondary" className="text-xs">
                  +{more}
                </Badge>
              )}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              checked={tree}
              onChange={(e) => setTree(e.target.checked)}
              disabled={killing}
            />
            <span>
              {t("dialog.kill.tree")}
              <span className="block text-xs text-muted-foreground">
                {t("dialog.kill.treeHint")}
              </span>
            </span>
          </label>

          <p className="text-sm text-destructive">{t("dialog.kill.warning")}</p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={killing}
          >
            {t("dialog.kill.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(tree)}
            disabled={killing}
            autoFocus
          >
            {killing ? t("dialog.kill.killing") : t("dialog.kill.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
