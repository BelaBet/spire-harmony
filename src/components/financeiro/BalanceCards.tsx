import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Wallet, Clock, CheckCircle2 } from "lucide-react";
import { brl } from "./format";
import type { BalanceResponse } from "@/lib/recipient.functions";

type Props = {
  balance?: BalanceResponse;
  loading?: boolean;
  onTransfer?: () => void;
};

export function BalanceCards({ balance, loading, onTransfer }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-4 w-4" /> Saldo disponível
          </div>
          <div className="mt-2 font-display text-3xl">
            {loading ? <Skeleton className="h-9 w-40" /> : brl(balance?.available?.amount)}
          </div>
          {onTransfer && (
            <Button size="sm" className="mt-4" onClick={onTransfer}>
              Transferir <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Clock className="h-4 w-4" /> Saldo a receber
          </div>
          <div className="mt-2 font-display text-3xl">
            {loading ? <Skeleton className="h-9 w-40" /> : brl(balance?.waiting_funds?.amount)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" /> Total transferido
          </div>
          <div className="mt-2 font-display text-3xl">
            {loading ? <Skeleton className="h-9 w-40" /> : brl(balance?.transferred?.amount)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
