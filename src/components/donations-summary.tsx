import { useEffect, useMemo, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
);

const AUTHORIZED_STATUSES = new Set(["paid", "authorized", "succeeded", "approved"]);
const PENDING_STATUSES = new Set(["pending", "processing", "queued", "waiting"]);
const REFUSED_STATUSES = new Set(["failed", "refused", "declined", "canceled", "cancelled", "rejected"]);

type Row = { amount: number; created_at: string; status: string | null };

function useDashboardMetrics() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("amount, created_at, payments(status)")
        .is("deleted_at", null);
      if (!alive) return;
      if (error) {
        toast.error("Erro ao carregar métricas de doações");
        setLoading(false);
        return;
      }
      const normalized: Row[] = (data ?? []).map((d: any) => ({
        amount: Number(d.amount) || 0,
        created_at: d.created_at,
        status: d.payments?.status ?? null,
      }));
      setRows(normalized);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { rows, loading };
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DonationsSummary() {
  const { rows, loading } = useDashboardMetrics();

  const { metrics, lineData, barData, statusCounts } = useMemo(() => {
    const r = rows ?? [];
    const created = r.reduce((s, x) => s + x.amount, 0);
    const authorizedRows = r.filter((x) => x.status && AUTHORIZED_STATUSES.has(x.status));
    const authorized = authorizedRows.reduce((s, x) => s + x.amount, 0);
    const count = r.length;
    const avg = count ? created / count : 0;

    // last 7 days series
    const days: { label: string; key: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      days.push({
        label: format(d, "EEE", { locale: ptBR }),
        key: format(startOfDay(d), "yyyy-MM-dd"),
      });
    }
    const authMap = new Map(days.map((d) => [d.key, 0]));
    const createdMap = new Map(days.map((d) => [d.key, 0]));
    for (const x of r) {
      const k = format(startOfDay(new Date(x.created_at)), "yyyy-MM-dd");
      if (createdMap.has(k)) createdMap.set(k, (createdMap.get(k) ?? 0) + x.amount);
      if (x.status && AUTHORIZED_STATUSES.has(x.status) && authMap.has(k)) {
        authMap.set(k, (authMap.get(k) ?? 0) + x.amount);
      }
    }

    const lineData = {
      labels: days.map((d) => d.label),
      datasets: [
        {
          label: "Autorizado",
          data: days.map((d) => authMap.get(d.key) ?? 0),
          borderColor: "#1D9E75",
          backgroundColor: "rgba(29, 158, 117, 0.08)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        },
        {
          label: "Criado",
          data: days.map((d) => createdMap.get(d.key) ?? 0),
          borderColor: "#888780",
          borderDash: [5, 3],
          backgroundColor: "transparent",
          fill: false,
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    };

    let authorizedC = 0,
      pendingC = 0,
      refusedC = 0;
    for (const x of r) {
      if (!x.status) {
        pendingC++;
        continue;
      }
      if (AUTHORIZED_STATUSES.has(x.status)) authorizedC++;
      else if (REFUSED_STATUSES.has(x.status)) refusedC++;
      else if (PENDING_STATUSES.has(x.status)) pendingC++;
      else pendingC++;
    }
    const totalC = authorizedC + pendingC + refusedC;
    const barData = {
      labels: ["Autorizadas", "Pendentes", "Recusadas"],
      datasets: [
        {
          label: "Doações",
          data: [authorizedC, pendingC, refusedC],
          backgroundColor: ["#1D9E75", "#378ADD", "#E24B4A"],
          borderRadius: 4,
        },
      ],
    };

    return {
      metrics: { created, authorized, count, avg },
      lineData,
      barData,
      statusCounts: { authorized: authorizedC, pending: pendingC, refused: refusedC, total: totalC },
    };
  }, [rows]);

  const cards = [
    { label: "Doações criadas", value: fmtBRL(metrics.created) },
    { label: "Doações autorizadas", value: fmtBRL(metrics.authorized), accent: true },
    { label: "Número de doações", value: String(metrics.count) },
    { label: "Valor médio por doação", value: fmtBRL(metrics.avg) },
  ];

  const pct = (n: number) =>
    statusCounts.total ? `${Math.round((n / statusCounts.total) * 100)}%` : "0%";

  const barLegend = [
    { color: "#1D9E75", label: "Autorizadas", pct: pct(statusCounts.authorized) },
    { color: "#378ADD", label: "Pendentes", pct: pct(statusCounts.pending) },
    { color: "#E24B4A", label: "Recusadas", pct: pct(statusCounts.refused) },
  ];

  return (
    <section
      className="mx-auto mt-10 w-full"
      style={{ maxWidth: 1200, padding: 24 }}
      aria-label="Resumo de doações do período"
    >
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        Resumo de doações do período
      </h2>

      {/* Metric cards */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-secondary"
            style={{ borderRadius: "var(--radius-md, 0.5rem)", padding: "14px 16px" }}
          >
            <div style={{ fontSize: 12 }} className="text-muted-foreground">
              {c.label}
            </div>
            {loading ? (
              <Skeleton className="mt-2 h-6 w-24" />
            ) : (
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: c.accent ? "#1D9E75" : undefined,
                }}
              >
                {c.value}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Line chart */}
      <div
        className="mt-6 bg-card"
        style={{
          border: "0.5px solid var(--border)",
          borderRadius: "var(--radius-lg, 0.75rem)",
          padding: 20,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Volume total de doações</div>
            <div className="text-xs text-muted-foreground">
              Últimos 7 dias — valores em R$
            </div>
          </div>
          <div className="flex gap-3 text-xs">
            {[
              { c: "#1D9E75", l: "Autorizado" },
              { c: "#888780", l: "Criado" },
            ].map((it) => (
              <span key={it.l} className="flex items-center gap-1.5">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: it.c,
                    display: "inline-block",
                    borderRadius: 2,
                  }}
                />
                {it.l}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4" style={{ height: 260 }}>
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <Line
              data={lineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    ticks: {
                      callback: (v) => "R$ " + Number(v).toLocaleString("pt-BR"),
                    },
                  },
                },
              }}
            />
          )}
        </div>
      </div>

      {/* Bar chart */}
      <div
        className="mt-6 bg-card"
        style={{
          border: "0.5px solid var(--border)",
          borderRadius: "var(--radius-lg, 0.75rem)",
          padding: 20,
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Doações por status</div>
            <div className="text-xs text-muted-foreground">
              Distribuição acumulada de doações
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {barLegend.map((it) => (
              <span key={it.label} className="flex items-center gap-1.5">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: it.color,
                    display: "inline-block",
                    borderRadius: 2,
                  }}
                />
                {it.label} <span className="text-muted-foreground">({it.pct})</span>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4" style={{ height: 260 }}>
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <Bar
              data={barData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { ticks: { precision: 0 } } },
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
