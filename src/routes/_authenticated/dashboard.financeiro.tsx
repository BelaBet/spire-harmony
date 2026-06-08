import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { FinanceiroPanel } from "@/components/financeiro/FinanceiroPanel";

export const Route = createFileRoute("/_authenticated/dashboard/financeiro")({
  component: FinanceiroIgreja,
  head: () => ({ meta: [{ title: "Financeiro" }] }),
});

function FinanceiroIgreja() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <p className="text-muted-foreground">Acesso restrito a administradores da igreja.</p>
      </Card>
    );
  }
  return (
    <FinanceiroPanel
      scope="tenant"
      title="Financeiro"
      subtitle="Saldo, transferências e antecipações."
    />
  );
}
