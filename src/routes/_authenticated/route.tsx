import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, PanelsTopLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar workspace={workspace} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 sm:gap-3 border-b bg-card/85 px-3 sm:px-4 backdrop-blur">
            <SidebarTrigger className="cursor-pointer shrink-0" />
            <PanelsTopLeft className="size-4 text-muted-foreground hidden sm:inline-block shrink-0" />
            <span className="truncate text-xs sm:text-sm font-semibold max-w-[140px] sm:max-w-xs md:max-w-none text-foreground">
              {workspace?.orgName ?? "Loading workspace…"}
            </span>
            {workspace?.isDemo && (
              <Badge variant="secondary" className="text-[10px] h-5 hidden xs:inline-flex shrink-0">
                Demo
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <span className="hidden text-xs text-muted-foreground md:inline truncate max-w-[200px]">
                {workspace?.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="h-8 px-2 sm:px-3 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}