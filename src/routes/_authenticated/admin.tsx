import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { isPlatformAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isPlatformAdmin) {
    return (
      <Card className="p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <p className="text-muted-foreground">Acesso restrito a administradores da plataforma.</p>
      </Card>
    );
  }
  return (
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-4rem)] w-full -mx-6 -my-8">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-12 items-center justify-between gap-3 border-b bg-card/60 px-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-xs font-medium uppercase tracking-wider text-amber-600">Plataforma</span>
            </div>
            <TenantSwitcher />
          </header>
          <main className="flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
