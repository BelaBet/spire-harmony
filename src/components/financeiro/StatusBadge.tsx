import { Badge } from "@/components/ui/badge";
import { translateStatus } from "./format";

const VARIANTS: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  transferred: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  processing: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  failed: "bg-red-500/15 text-red-600 border-red-500/30",
  refused: "bg-red-500/15 text-red-600 border-red-500/30",
  canceled: "bg-muted text-muted-foreground border-muted-foreground/30",
  refunded: "bg-muted text-muted-foreground border-muted-foreground/30",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const cls = VARIANTS[status ?? ""] ?? "bg-muted text-muted-foreground border-muted-foreground/30";
  return (
    <Badge variant="outline" className={cls}>
      {translateStatus(status)}
    </Badge>
  );
}
