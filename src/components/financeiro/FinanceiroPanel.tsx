import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  getRecipientBalance,
  getRecipientTransfers,
  getRecipientAnticipations,
} from "@/lib/recipient.functions";
import { BalanceCards } from "./BalanceCards";
import { TransfersTable } from "./TransfersTable";
import { AnticipationsTable } from "./AnticipationsTable";
import { AnticipationModal } from "./AnticipationModal";
import { brl } from "./format";

export function FinanceiroPanel({
  scope,
  title,
  subtitle,
  showFeeDetails = false,
  platformSummary,
}: {
  scope: "tenant" | "platform";
  title: string;
  subtitle?: string;
  showFeeDetails?: boolean;
  platformSummary?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [openModal, setOpenModal] = useState(false);

  const balanceFn = useServerFn(getRecipientBalance);
  const transfersFn = useServerFn(getRecipientTransfers);
  const anticipationsFn = useServerFn(getRecipientAnticipations);

  const balance = useQuery({
    queryKey: ["pagarme-balance", scope],
    queryFn: () => balanceFn({ data: { scope } }),
  });
  const transfers = useQuery({
    queryKey: ["pagarme-transfers", scope],
    queryFn: () => transfersFn({ data: { scope, page: 1, size: 20 } }),
  });
  const anticipations = useQuery({
    queryKey: ["pagarme-anticipations", scope],
    queryFn: () => anticipationsFn({ data: { scope, page: 1, size: 20 } }),
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["pagarme-balance", scope] });
    qc.invalidateQueries({ queryKey: ["pagarme-transfers", scope] });
    qc.invalidateQueries({ queryKey: ["pagarme-anticipations", scope] });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </header>

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="transferencias">Transferências</TabsTrigger>
          <TabsTrigger value="antecipacoes">Antecipações</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6">
          {balance.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>{balance.error instanceof Error ? balance.error.message : "Erro ao carregar saldo"}</span>
                <Button size="sm" variant="outline" onClick={() => balance.refetch()}>Tentar novamente</Button>
              </AlertDescription>
            </Alert>
          )}
          <BalanceCards balance={balance.data} loading={balance.isLoading} />
          {platformSummary}
        </TabsContent>

        <TabsContent value="transferencias" className="space-y-4">
          {transfers.error ? (
            <ErrorBlock message={transfers.error instanceof Error ? transfers.error.message : "Erro"} onRetry={() => transfers.refetch()} />
          ) : (
            <TransfersTable items={transfers.data?.items} loading={transfers.isLoading} showRecipient={scope === "platform"} />
          )}
        </TabsContent>

        <TabsContent value="antecipacoes" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Saldo a receber</p>
                <p className="mt-2 font-display text-2xl">{brl(balance.data?.waiting_funds?.amount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Disponível para antecipação</p>
                  <p className="mt-2 font-display text-2xl">{brl(balance.data?.waiting_funds?.amount)}</p>
                </div>
                <Button onClick={() => setOpenModal(true)}>Simular antecipação</Button>
              </CardContent>
            </Card>
          </div>

          {anticipations.error ? (
            <ErrorBlock message={anticipations.error instanceof Error ? anticipations.error.message : "Erro"} onRetry={() => anticipations.refetch()} />
          ) : (
            <AnticipationsTable items={anticipations.data?.items} loading={anticipations.isLoading} showFeeDetails={showFeeDetails} />
          )}
        </TabsContent>
      </Tabs>

      <AnticipationModal
        open={openModal}
        onOpenChange={setOpenModal}
        scope={scope}
        showFeeDetails={showFeeDetails}
        onDone={refetchAll}
      />
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>{message}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>Tentar novamente</Button>
      </AlertDescription>
    </Alert>
  );
}
