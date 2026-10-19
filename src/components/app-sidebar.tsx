import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
  ClipboardList,
  X,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
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
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials, ROLE_LABELS } from "@/lib/crm";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/hooks/use-workspace";
import { supabase } from "@/integrations/supabase/client";

const salesItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Follow-ups", url: "/follow-ups", icon: CalendarClock },
  { title: "Demos", url: "/demos", icon: Video },
  { title: "Clients", url: "/clients", icon: Building2 },
  { title: "Forms", url: "/forms", icon: ClipboardList },
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
  const { state, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  // On mobile drawer, always expand full titles even if desktop collapsed state was active
  const showLabels = isMobile || !collapsed;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function handleMobileSignOut() {
    if (isMobile) setOpenMobile(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon" className="transition-all duration-200 border-r border-sidebar-border/50">
      {/* Sidebar Header */}
      <SidebarHeader className="border-b border-sidebar-border/40 px-3 py-2.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:justify-center transition-[padding] duration-200">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center w-full">
          <div className="flex items-center gap-2.5 min-w-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
            {collapsed && !isMobile ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to="/dashboard"
                    className="bg-gradient-to-br from-primary to-primary/85 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-primary-foreground shadow-xs shadow-primary/20 hover:scale-105 transition-transform"
                    aria-label="LeadKart Dashboard"
                  >
                    LK
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" align="center" sideOffset={10}>
                  <p className="font-semibold text-xs">LeadKart CRM</p>
                  <p className="text-[10px] text-muted-foreground">{workspace?.orgName ?? "Workspace"}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="bg-gradient-to-br from-primary to-primary/85 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-primary-foreground shadow-xs shadow-primary/20">
                LK
              </div>
            )}

            {showLabels && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-sidebar-foreground">
                  {workspace?.orgName ?? "LeadKart Workspace"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="truncate text-[10px] text-sidebar-foreground/60 font-medium">LeadKart CRM</span>
                  {workspace?.isDemo && (
                    <Badge variant="outline" className="text-[8.5px] px-1 py-0 h-3.5 border-primary/30 text-primary bg-primary/5">
                      Demo
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Explicit mobile close button */}
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer"
              onClick={() => setOpenMobile(false)}
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </Button>
          ) : (
            showLabels && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer shrink-0 transition-colors"
                    onClick={toggleSidebar}
                    aria-label="Collapse sidebar"
                  >
                    <ChevronsLeft className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Collapse sidebar <span className="opacity-60 text-[10px] font-mono ml-1">⌘B</span>
                </TooltipContent>
              </Tooltip>
            )
          )}
        </div>
      </SidebarHeader>

      {/* Sidebar Navigation Content */}
      <SidebarContent className="px-2 py-2 overflow-y-auto overflow-x-hidden group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:gap-0.5 select-none">
        {groups.map((group, groupIndex) => (
          <SidebarGroup key={group.label} className="py-1 group-data-[collapsible=icon]:py-0">
            {/* Divider between sections in collapsed mode */}
            {groupIndex > 0 && (
              <div className="hidden group-data-[collapsible=icon]:flex justify-center my-1.5 w-full">
                <span className="w-4 h-px bg-sidebar-border/70 rounded-full" />
              </div>
            )}

            <SidebarGroupLabel className="text-[10px] uppercase font-bold tracking-wider text-sidebar-foreground/50 px-2.5 h-6 flex items-center group-data-[collapsible=icon]:hidden">
              {group.label}
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const isActive =
                    item.url === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.url);

                  return (
                    <SidebarMenuItem
                      key={item.title}
                      className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full"
                    >
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={isActive}
                        className={cn(
                          "h-9 px-2.5 rounded-lg transition-all text-xs font-medium cursor-pointer group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center",
                          isActive
                            ? "bg-primary/10 text-primary font-semibold border border-primary/20 shadow-xs group-data-[collapsible=icon]:bg-primary group-data-[collapsible=icon]:text-primary-foreground group-data-[collapsible=icon]:border-primary group-data-[collapsible=icon]:shadow-xs group-data-[collapsible=icon]:shadow-primary/30"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                        )}
                      >
                        <Link
                          to={item.url}
                          onClick={() => {
                            if (isMobile) setOpenMobile(false);
                          }}
                          className="flex items-center gap-2.5 w-full h-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                        >
                          <item.icon className="size-4 shrink-0 transition-transform duration-150 group-hover/menu-item:scale-105" />
                          {showLabels && <span className="truncate flex-1">{item.title}</span>}
                          {isActive && showLabels && (
                            <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto shadow-xs shadow-primary/40" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Sidebar Footer */}
      <SidebarFooter className="border-t border-sidebar-border/40 p-2.5 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center transition-[padding] duration-200">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-1.5 w-full">
          {collapsed && !isMobile ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all">
                  {initials(workspace?.fullName)}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" sideOffset={10} className="space-y-0.5">
                <p className="font-semibold text-xs">{workspace?.fullName ?? "Sales User"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {ROLE_LABELS[workspace?.role ?? ""] ?? workspace?.role ?? "Member"}
                </p>
                {workspace?.email && (
                  <p className="text-[10px] text-muted-foreground/80">{workspace.email}</p>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                {initials(workspace?.fullName)}
              </div>
              {showLabels && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-sidebar-foreground">
                    {workspace?.fullName ?? "Sales User"}
                  </p>
                  <p className="truncate text-[10px] text-sidebar-foreground/60">
                    {ROLE_LABELS[workspace?.role ?? ""] ?? workspace?.role ?? "Member"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Desktop Expand Button when collapsed */}
          {collapsed && !isMobile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer transition-colors"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                >
                  <ChevronsRight className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Expand sidebar <span className="opacity-60 text-[10px] font-mono ml-1">⌘B</span>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Quick Sign Out Action on Mobile Drawer */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
              onClick={handleMobileSignOut}
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5" />
            </Button>
          )}
        </div>
      </SidebarFooter>

      {/* Interactive sidebar edge rail */}
      <SidebarRail />
    </Sidebar>
  );
}