import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";
import { DonationsSummary } from "@/components/donations-summary";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel" }] }),
});

function Dashboard() {
  const { profile, roles } = useAuth();
  const isStaff = roles.includes("manager") || roles.includes("admin");

  const { data: stats } = useQuery({
    queryKey: ["dash-stats", profile?.tenant_id, isStaff],
    enabled: !!profile && isStaff,
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      return { members: count ?? 0 };
    },
  });

  const { data: myTenant } = useQuery({
    queryKey: ["my-tenant", profile?.tenant_id],
    enabled: !!profile?.tenant_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("name, logo_url, slug")
        .eq("id", profile!.tenant_id)
        .maybeSingle();
      return data;
    },
  });

  const onboardingDone = myTenant ? myTenant.logo_url != null && myTenant.name !== "Comunidade Demo" : false;

  const greeting = `Olá, ${profile?.full_name?.split(" ")[0] ?? "membro"} 👋`;

  const cards = [
    ...(isStaff ? [{ label: "Membros", value: stats?.members ?? "—", icon: Users }] : []),
  ];

  return (
    <div>
      <h1 className="font-display text-3xl md:text-4xl">{greeting}</h1>
      <p className="mt-1 text-muted-foreground">
        {isStaff ? "Visão geral da sua comunidade." : "Acompanhe sua jornada na comunidade."}
      </p>

      <DonationsSummary />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 font-display text-3xl">{c.value}</div>
          </div>
        ))}
      </div>

      {!onboardingDone && (
        <div className="mt-10 rounded-2xl border bg-card p-6">
          <h2 className="font-display text-xl">Próximos passos</h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              <Link to="/igrejas/onboarding" className="underline decoration-primary hover:text-foreground transition-colors">
                Atualize seu <strong>perfil</strong> e preferências de privacidade.
              </Link>
            </li>
            {isStaff && <li>Crie uma nova campanha de doação.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
