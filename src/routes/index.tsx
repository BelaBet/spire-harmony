import { createFileRoute, Link } from "@tanstack/react-router";
import { useTenant } from "@/lib/tenant-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Calendar, Heart, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Comunidade — Plataforma para sua congregação" },
      { name: "description", content: "Gerencie eventos, doações, grupos e comunicação da sua comunidade religiosa em um só lugar." },
    ],
  }),
});

function Index() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const name = tenant?.name ?? "Comunidade";

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
          )}
          <span className="font-display text-lg">{name}</span>
        </div>
        <nav className="flex gap-2">
          {user ? (
            <Button asChild><Link to="/dashboard">Entrar no painel</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link to="/login">Entrar</Link></Button>
              <Button asChild><Link to="/signup">Criar conta</Link></Button>
            </>
          )}
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-12 pb-20 md:pt-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-[420px] opacity-30 blur-3xl"
             style={{ background: "var(--gradient-hero)" }} />
        <div className="max-w-2xl">
          <p className="mb-4 inline-block rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Plataforma white-label · LGPD compliant
          </p>
          <h1 className="font-display text-5xl leading-[1.05] md:text-6xl">
            Sua comunidade,<br/>
            <span style={{ color: "var(--brand-primary)" }}>conectada com propósito.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            {name} oferece tudo que sua congregação precisa: eventos, doações, grupos e comunicação direta — com a sua identidade visual.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to={user ? "/dashboard" : "/signup"}>Começar agora</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/events">Ver eventos</Link></Button>
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { icon: Calendar, title: "Eventos & Ingressos", desc: "Crie cultos, retiros e campanhas. Membros se inscrevem com QR code." },
            { icon: Heart, title: "Doações & Dízimos", desc: "Receba via PIX e cartão. Recibos automáticos para cada contribuição." },
            { icon: Users, title: "Grupos & Comunicação", desc: "Pequenos grupos, mensagens e notificações em tempo real." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                   style={{ background: "color-mix(in oklab, var(--brand-primary) 12%, transparent)", color: "var(--brand-primary)" }}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {name}. Dados protegidos conforme a LGPD.
        </div>
      </footer>
    </div>
  );
}
