import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Megaphone, Settings, ArrowLeft } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import { initials } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/manage/dashboard", icon: LayoutDashboard },
  { title: "Membros", url: "/manage/members", icon: Users },
  { title: "Mensagens", url: "/messages", icon: Megaphone },
  { title: "Configurações", url: "/manage/settings", icon: Settings },
];

export function ManagerSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { tenant } = useTenant();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
            {initials(tenant?.name ?? "Gestão")}
          </div>
          {!collapsed && <span className="font-display text-sm">{tenant?.name ?? "Gestão"}</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestão</SidebarGroupLabel>
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
                {!collapsed && <span>Sair da gestão</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
