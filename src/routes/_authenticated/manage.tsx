import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ManagerSidebar } from "@/components/manager-sidebar";
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
      <Card className="p-8 text-center text-muted-foreground">
        Acesso restrito a gestores.
      </Card>
    );
  }
  return (
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-4rem)] w-full -mx-6 -my-8">
        <ManagerSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b bg-card/60 backdrop-blur">
            <SidebarTrigger className="ml-2" />
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
