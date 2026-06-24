import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/manage")({
  component: ManageLayout,
});

function ManageLayout() {
  const { isStaff, loading } = useAuth();
  if (loading) return null;
  if (!isStaff) {
    return (
      <Card className="p-8 text-center text-muted-foreground">Acesso restrito a gestores.</Card>
    );
  }
  return (
    <SidebarProvider className="min-h-0">
      <div className="relative flex min-h-[calc(100vh-4rem)] w-full -mx-6 -my-8 [transform:translateZ(0)]">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-12 items-center border-b bg-card/60 backdrop-blur">
            <SidebarTrigger className="ml-2" />
          </header>
          <main className="flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
