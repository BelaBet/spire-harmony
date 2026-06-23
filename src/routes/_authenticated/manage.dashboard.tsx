import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { Users, UserCheck, DollarSign, Calendar, Ticket } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/manage/dashboard")({
  component: ManagerDashboard,
  head: () => ({ meta: [{ title: "Painel — Visão geral" }] }),
});

type Kpis = { total: number; active: number; pending: number; donationsMonth: number; eventsMonth: number; ticketsMonth: number };

function ManagerDashboard() {
  const [kpis, setKpis] = useState<Kpis>({ total: 0, active: 0, pending: 0, donationsMonth: 0, eventsMonth: 0, ticketsMonth: 0 });
  const [donationSeries, setDonationSeries] = useState<{ month: string; total: number }[]>([]);
  const [attendance, setAttendance] = useState<{ event: string; count: number }[]>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const startMonth = startOfMonth(new Date()).toISOString();
      const endMonthIso = endOfMonth(new Date()).toISOString();

      const [profilesRes, donationsAllRes, donationsMonthRes, eventsMonthRes, ticketsMonthRes, eventsAttRes] = await Promise.all([
        supabase.from("profiles").select("id, status, created_at"),
        supabase.from("donations").select("amount, created_at"),
        supabase.from("donations").select("amount").gte("created_at", startMonth).lte("created_at", endMonthIso),
        supabase.from("events").select("id").gte("date", startMonth).lte("date", endMonthIso),
        supabase.from("tickets").select("id").gte("created_at", startMonth).lte("created_at", endMonthIso),
        supabase.from("events").select("id, title, tickets(count)").order("date", { ascending: false }).limit(8),
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

      
      setLoading(false);
    })();
  }, []);

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Dashboard analítico</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua igreja</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard icon={Users} label="Membros totais" value={kpis.total} loading={loading} />
        <KpiCard icon={UserCheck} label="Membros ativos" value={kpis.active} loading={loading} hint={`${kpis.pending} pendentes`} />
        <KpiCard icon={DollarSign} label="Doações no mês" value={fmtBRL(kpis.donationsMonth)} loading={loading} />
        <KpiCard icon={Calendar} label="Eventos no mês" value={kpis.eventsMonth} loading={loading} />
        <KpiCard icon={Ticket} label="Ingressos no mês" value={kpis.ticketsMonth} loading={loading} />
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

    </div>
  );
}
