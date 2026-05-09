import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Building2, CreditCard, ScrollText, Settings, ShieldAlert, ArrowLeft } from "lucide-react";

const items = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Igrejas",   url: "/admin/tenants",   icon: Building2 },
  { title: "Billing",   url: "/admin/billing",   icon: CreditCard },
  { title: "Auditoria", url: "/admin/audit",     icon: ScrollText },
  { title: "Plataforma",url: "/admin/settings",  icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b bg-zinc-950 text-zinc-100">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-zinc-950">
            <ShieldAlert className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm">ERP Plataforma</span>
              <span className="text-[10px] uppercase tracking-wider text-amber-400">Super Admin</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((i) => (
                <SidebarMenuItem key={i.url}>
                  <SidebarMenuButton asChild isActive={path === i.url}>
                    <Link to={i.url} className="flex items-center gap-2">
                      <i.icon className="h-4 w-4" />
                      {!collapsed && <span>{i.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                {!collapsed && <span>Voltar</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
