import { useImpersonation } from "@/lib/impersonation";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export function ImpersonationBanner() {
  const { active, tenantId, stop } = useImpersonation();
  if (!active) return null;
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm text-amber-950 shadow">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" />
        <span>
          Visualizando como tenant <code className="font-mono text-xs">{tenantId?.slice(0, 8)}…</code> — toda ação é auditada.
        </span>
      </div>
      <Button size="sm" variant="secondary" onClick={() => stop()}>
        Sair da impersonação
      </Button>
    </div>
  );
}
