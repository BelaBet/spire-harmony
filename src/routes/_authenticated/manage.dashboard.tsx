import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, UserCheck, DollarSign, Calendar, Ticket, Activity } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/manage/dashboard")({
  component: ManagerDashboard,
});

type Kpis = { total: number; active: number; pending: number; donationsMonth: number; eventsMonth: number; ticketsMonth: number };

function ManagerDashboard() {
  const [kpis, setKpis] = useState<Kpis>({ total: 0, active: 0, pending: 0, donationsMonth: 0, eventsMonth: 0, ticketsMonth: 0 });
  const [donationSeries, setDonationSeries] = useState<{ month: string; total: number }[]>([]);
  const [attendance, setAttendance] = useState<{ event: string; count: number }[]>([]);
  const [activity, setActivity] = useState<{ id: string; action: string; entity: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const startMonth = startOfMonth(new Date()).toISOString();
      const endMonthIso = endOfMonth(new Date()).toISOString();

      const [profilesRes, donationsAllRes, donationsMonthRes, eventsMonthRes, ticketsMonthRes, eventsAttRes, auditRes] = await Promise.all([
        supabase.from("profiles").select("id, status, created_at"),
        supabase.from("donations").select("amount, created_at"),
        supabase.from("donations").select("amount").gte("created_at", startMonth).lte("created_at", endMonthIso),
        supabase.from("events").select("id").gte("date", startMonth).lte("date", endMonthIso),
        supabase.from("tickets").select("id").gte("created_at", startMonth).lte("created_at", endMonthIso),
        supabase.from("events").select("id, title, tickets(count)").order("date", { ascending: false }).limit(8),
        supabase.from("audit_logs").select("id, action, entity, created_at").order("created_at", { ascending: false }).limit(10),
      ]);

      const profiles = profilesRes.data ?? [];
      setKpis({
        total: profiles.length,
        active: profiles.filter((p) => p.status === "approved").length,
        pending: profiles.filter((p) => p.status === "pending").length,
        donationsMonth: (donationsMonthRes.data ?? []).reduce((s, d) => s + Number(d.amount || 0), 0),
        eventsMonth: (eventsMonthRes.data ?? []).length,
        ticketsMonth: (ticketsMonthRes.data ?? []).length,
      });

      // Donations trend last 6 months
      const series: { month: string; total: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const ref = subMonths(new Date(), i);
        const s = startOfMonth(ref).getTime();
        const e = endOfMonth(ref).getTime();
        const total = (donationsAllRes.data ?? [])
          .filter((d) => { const t = new Date(d.created_at).getTime(); return t >= s && t <= e; })
          .reduce((sum, d) => sum + Number(d.amount || 0), 0);
        series.push({ month: format(ref, "MMM", { locale: ptBR }), total });
      }
      setDonationSeries(series);

      const att = (eventsAttRes.data ?? []).map((e: { title: string; tickets?: { count: number }[] }) => ({
        event: e.title.slice(0, 16),
        count: e.tickets?.[0]?.count ?? 0,
      }));
      setAttendance(att);

      setActivity(auditRes.data ?? []);
      setLoading(false);
    })();
  }, []);

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Dashboard analítico</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua comunidade</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi icon={Users} label="Membros totais" value={kpis.total} loading={loading} />
        <Kpi icon={UserCheck} label="Membros ativos" value={kpis.active} loading={loading} hint={`${kpis.pending} pendentes`} />
        <Kpi icon={DollarSign} label="Doações no mês" value={fmtBRL(kpis.donationsMonth)} loading={loading} />
        <Kpi icon={Calendar} label="Eventos no mês" value={kpis.eventsMonth} loading={loading} />
        <Kpi icon={Ticket} label="Ingressos no mês" value={kpis.ticketsMonth} loading={loading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Doações (últimos 6 meses)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={donationSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip formatter={(v) => fmtBRL(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-medium">Comparecimento por evento</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={attendance}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="event" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 font-medium"><Activity className="h-4 w-4" /> Atividade recente</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registros ainda.</p>
        ) : (
          <ul className="divide-y">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span><strong>{a.action}</strong> {a.entity && <span className="text-muted-foreground">em {a.entity}</span>}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "dd/MM HH:mm")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, loading, hint }: { icon: typeof Users; label: string; value: string | number; loading: boolean; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{loading ? "..." : value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
