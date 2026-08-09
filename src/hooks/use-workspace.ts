import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export function useSessionUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export interface Workspace {
  memberId: string;
  organizationId: string;
  role: string;
  fullName: string;
  email: string;
  orgName: string;
  currencySymbol: string;
  isDemo: boolean;
  permissions: string[];
}

export function useWorkspace() {
  return useQuery({
    queryKey: ["workspace"],
    staleTime: 60_000,
    queryFn: async (): Promise<Workspace | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;

      const { data: member, error } = await supabase
        .from("organization_members")
        .select(
          "id, organization_id, role, full_name, email, organizations(name, currency_symbol, is_demo)",
        )
        .eq("user_id", auth.user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!member) return null;

      const { data: perms } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role", member.role);

      const org = member.organizations as unknown as {
        name: string;
        currency_symbol: string;
        is_demo: boolean;
      } | null;

      return {
        memberId: member.id,
        organizationId: member.organization_id,
        role: member.role,
        fullName: member.full_name,
        email: member.email,
        orgName: org?.name ?? "Workspace",
        currencySymbol: org?.currency_symbol ?? "₹",
        isDemo: org?.is_demo ?? false,
        permissions: (perms ?? []).map((p) => p.permission_key),
      };
    },
  });
}

export function can(ws: Workspace | null | undefined, key: string) {
  if (!ws) return false;
  if (ws.permissions.length === 0) return ws.role === "owner" || ws.role === "admin";
  return ws.permissions.includes(key);
}