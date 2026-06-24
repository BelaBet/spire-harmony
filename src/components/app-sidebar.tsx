import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Calendar,
  Settings,
  ArrowLeft,
  HeartHandshake,
  Building2,
  CreditCard,
  ScrollText,
  Wallet,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { initials } from "@/lib/utils";

const MANAGE_ITEMS = [
  { title: "Dashboard", url: "/manage/dashboard", icon: LayoutDashboard },
  { title: "Doações", url: "/manage/donations", icon: HeartHandshake },
  { title: "Instituições", url: "/manage/members", icon: Users },
  { title: "Eventos", url: "/manage/events", icon: Calendar },
  { title: "Mensagens", url: "/messages", icon: Megaphone },
  { title: "Configurações", url: "/manage/settings", icon: Settings },
];

const PLATFORM_ITEMS = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Igrejas", url: "/admin/tenants", icon: Building2 },
  { title: "Doações", url: "/admin/donations", icon: HeartHandshake },
  { title: "Financeiro", url: "/admin/financeiro", icon: Wallet },
  { title: "Billing", url: "/admin/billing", icon: CreditCard },
  { title: "Auditoria", url: "/admin/audit", icon: ScrollText },
  { title: "Plataforma", url: "/admin/settings", icon: Settings },
];

/**
 * Sidebar única e compartilhada entre /manage e /admin.
 * Mostra a seção "Gestão" para quem é staff de algum tenant (isStaff) e a
 * seção "Plataforma" para quem tem qualquer platform_role (isPlatformAdmin).
 * Quem tem os dois papéis vê as duas seções no mesmo menu, mesmo que cada
 * uma ainda viva sob sua própria rota/layout (/manage/* e /admin/*).
 */
export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { tenant } = useTenant();
  const { isStaff, isPlatformAdmin } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-1">
          {isStaff ? (
            <>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
                {initials(tenant?.name ?? "Gestão")}
              </div>
              {!collapsed && (
                <span className="font-display text-sm">{tenant?.name ?? "Gestão"}</span>
              )}
            </>
          ) : (
            <>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <ShieldAlert className="h-4 w-4" />
              </div>
              {!collapsed && (
                <div className="flex flex-col leading-tight">
                  <span className="font-display text-sm">Painel da Plataforma</span>
                  <span className="text-[10px] uppercase tracking-wider text-accent">
                    Super Admin
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {isStaff && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {MANAGE_ITEMS.map((i) => (
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
        )}

        {isPlatformAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {PLATFORM_ITEMS.map((i) => (
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
        )}
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
