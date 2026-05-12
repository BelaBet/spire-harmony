import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
  head: () => ({ meta: [{ title: "Painel — Auditoria" }] }),
});

function AuditPage() {
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [days, setDays] = useState<string>("7");

  const { data: tenants } = useQuery({
    queryKey: ["audit-tenant-list"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id,name").order("name");
      return data ?? [];
    },
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", tenantFilter, actionFilter, days],
    queryFn: async () => {
      let q = supabase.from("audit_logs")
        .select("id, created_at, user_id, action, entity, entity_id, tenant_id, metadata, tenants(name)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (tenantFilter !== "all") q = q.eq("tenant_id", tenantFilter);
      if (actionFilter) q = q.ilike("action", `%${actionFilter}%`);
      if (days !== "all") {
        const since = new Date(); since.setDate(since.getDate() - Number(days));
        q = q.gte("created_at", since.toISOString());
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl">Auditoria Global</h1>
        <p className="text-sm text-muted-foreground">Histórico de ações e alterações em todas as igrejas.</p>
      </div>

      <Card className="p-4 grid gap-3 sm:grid-cols-3">
        <Select value={tenantFilter} onValueChange={setTenantFilter}>
          <SelectTrigger><SelectValue placeholder="Tenant" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tenants</SelectItem>
            {tenants?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Ação (ex: UPDATE:tenants)" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} />
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Últimas 24h</SelectItem>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Igreja</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Carregando…</TableCell></TableRow>}
            {logs?.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-xs">{(l.tenants as { name?: string } | null)?.name ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono">{l.user_id?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell className="text-xs font-medium">{l.action}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.entity}{l.entity_id ? ` · ${(l.entity_id as string).slice(0,8)}` : ""}</TableCell>
              </TableRow>
            ))}
            {(logs?.length ?? 0) === 0 && !isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhum registro.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
