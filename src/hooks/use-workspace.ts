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

      // 1. Try to find active membership for this user_id
      let { data: member, error } = await supabase
        .from("organization_members")
        .select(
          "id, organization_id, role, full_name, email, status, organizations(name, currency_symbol, is_demo)",
        )
        .eq("user_id", auth.user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // 2. If no member record by user_id, check if an invited record exists matching their email
      if (!member && auth.user.email) {
        const { data: invitedMember } = await supabase
          .from("organization_members")
          .select(
            "id, organization_id, role, full_name, email, status, organizations(name, currency_symbol, is_demo)",
          )
          .eq("email", auth.user.email.toLowerCase())
          .in("status", ["invited", "active"])
          .limit(1)
          .maybeSingle();

        if (invitedMember) {
          await supabase
            .from("organization_members")
            .update({
              user_id: auth.user.id,
              status: "active",
              joined_at: new Date().toISOString(),
            })
            .eq("id", invitedMember.id);

          member = {
            ...invitedMember,
            status: "active",
          };
        }
      }

      // 3. If STILL no member record exists, auto-create a new Organization for this user where they are OWNER!
      if (!member) {
        const userName =
          (auth.user.user_metadata as any)?.full_name ||
          (auth.user.email ? auth.user.email.split("@")[0] : "New User");
        const orgName = `${userName}'s Workspace`;

        const { data: newOrg, error: orgErr } = await supabase
          .from("organizations")
          .insert({
            name: orgName,
            slug: `org-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            currency_symbol: "₹",
            is_demo: false,
          })
          .select("id, name, currency_symbol, is_demo")
          .single();

        if (!orgErr && newOrg) {
          const { data: newMember, error: memErr } = await supabase
            .from("organization_members")
            .insert({
              organization_id: newOrg.id,
              user_id: auth.user.id,
              full_name: userName,
              email: auth.user.email ?? "",
              role: "owner",
              status: "active",
              joined_at: new Date().toISOString(),
            })
            .select("id, organization_id, role, full_name, email, status")
            .single();

          if (!memErr && newMember) {
            member = {
              ...newMember,
              organizations: newOrg as any,
            };
          }
        }
      }

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