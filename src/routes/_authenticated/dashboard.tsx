import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { DonationsSummary } from "@/components/donations-summary";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel" }] }),
});

function Dashboard() {
  const { profile, roles } = useAuth();
  const isStaff = roles.includes("manager") || roles.includes("admin");


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


  return (
    <div>
      <h1 className="font-display text-3xl md:text-4xl">{greeting}</h1>
      <p className="mt-1 text-muted-foreground">
        {isStaff ? "Visão geral da sua comunidade." : "Acompanhe sua jornada na comunidade."}
      </p>

      <DonationsSummary />


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
