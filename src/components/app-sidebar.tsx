import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  CalendarClock,
  Video,
  FileText,
  Receipt,
  Building2,
  UsersRound,
  Settings,
  PackageSearch,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { initials, ROLE_LABELS } from "@/lib/crm";
import type { Workspace } from "@/hooks/use-workspace";

const salesItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Follow-ups", url: "/follow-ups", icon: CalendarClock },
  { title: "Demos", url: "/demos", icon: Video },
  { title: "Clients", url: "/clients", icon: Building2 },
] as const;

const financeItems = [
  { title: "Services / Products", url: "/products", icon: PackageSearch },
  { title: "Quotations", url: "/quotations", icon: FileText },
  { title: "Invoices", url: "/invoices", icon: Receipt },
] as const;

const adminItems = [
  { title: "Team", url: "/team", icon: UsersRound },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

const groups = [
  { label: "Sales", items: salesItems },
  { label: "Finance", items: financeItems },
  { label: "Administration", items: adminItems },
] as const;

export function AppSidebar({ workspace }: { workspace?: Workspace | null | undefined }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-2">
          <div className="bg-brand flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground">
          LK
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {workspace?.orgName ?? "Workspace"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">LeadKart CRM</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={pathname.startsWith(item.url)}
                    >
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="size-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-1 py-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {initials(workspace?.fullName)}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-sidebar-foreground">
                {workspace?.fullName ?? "—"}
              </p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">
                {ROLE_LABELS[workspace?.role ?? ""] ?? workspace?.role ?? ""}
              </p>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}