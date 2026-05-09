import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Calendar, User, LogOut, Sparkles, Users, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, signOut, profile } = useAuth();
  const { tenant } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // soft client-side redirect
      router.navigate({ to: "/login" });
    }
  }, [user, loading, router]);

  // Avoid SSR auth check (session is browser-only); also gate via supabase
  void supabase;
  void redirect;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }
  if (!user) return null;

  const name = tenant?.name ?? "Comunidade";

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
            )}
            <span className="font-display">{name}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard">Painel</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/events">Eventos</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/groups">Grupos</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/messages">Mensagens</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/notifications"><Bell className="h-4 w-4" /></Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/profile">Perfil</Link></Button>
            <Button onClick={signOut} variant="ghost" size="sm">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </nav>
          <span className="hidden text-xs text-muted-foreground md:inline">
            {profile?.full_name ?? user.email}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card md:hidden">
        {[
          { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
          { to: "/events", label: "Eventos", icon: Calendar },
          { to: "/groups", label: "Grupos", icon: Users },
          { to: "/notifications", label: "Avisos", icon: Bell },
          { to: "/profile", label: "Perfil", icon: User },
        ].map((i) => (
          <Link key={i.to} to={i.to} className="flex flex-col items-center justify-center gap-0.5 py-2 text-xs text-muted-foreground"
                activeProps={{ className: "flex flex-col items-center justify-center gap-0.5 py-2 text-xs text-primary" }}>
            <i.icon className="h-5 w-5" />
            {i.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
