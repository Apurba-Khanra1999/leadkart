import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Crown,
  Key,
  Loader2,
  Mail,
  MoreVertical,
  Pencil,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Shield,
  Briefcase,
  Receipt,
  Sparkles,
  Search,
  Filter,
  Check,
} from "lucide-react";

import { supabase, createNonPersistedSupabaseClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, NoAccess } from "@/components/crm/page";
import { PickerField, TextField } from "@/components/crm/fields";
import { ALL, FilterBar, SearchFilter, SelectFilter } from "@/components/crm/filters";
import { can, useWorkspace } from "@/hooks/use-workspace";
import { ROLE_LABELS, formatDate, initials } from "@/lib/crm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team Management & RBAC Permissions — LeadKart CRM" },
      {
        name: "description",
        content:
          "Invite sales reps and administrators, assign Owner, Admin, Sales Manager, Executive, or Accountant roles with database-enforced permissions.",
      },
      { property: "og:title", content: "Team Management & RBAC Permissions — LeadKart CRM" },
      { property: "og:description", content: "Role-based access control for your sales team." },
      { property: "og:url", content: "https://leadkartpro.vercel.app/team" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Team & Roles — LeadKart CRM" },
    ],
    links: [{ rel: "canonical", href: "https://leadkartpro.vercel.app/team" }],
  }),
  component: TeamPage,
});

type AppRole = "owner" | "admin" | "sales_manager" | "sales_executive" | "accountant";

const ROLE_OPTIONS: { id: AppRole; name: string; description: string; icon: typeof Crown; color: string }[] = [
  {
    id: "owner",
    name: "Owner",
    description: "Full workspace authority, billing control, and destructive actions",
    icon: Crown,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  },
  {
    id: "admin",
    name: "Admin",
    description: "Manage team members, organization settings, and full pipeline access",
    icon: Shield,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30",
  },
  {
    id: "sales_manager",
    name: "Sales Manager",
    description: "Manage sales team, reassign leads, review pipeline deals and forecasts",
    icon: Briefcase,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  },
  {
    id: "sales_executive",
    name: "Sales Executive",
    description: "Create and manage assigned prospects, schedule follow-ups and demos",
    icon: Users,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  },
  {
    id: "accountant",
    name: "Accountant",
    description: "Full access to quotations, tax invoices, and financial receivables",
    icon: Receipt,
    color: "text-teal-500 bg-teal-500/10 border-teal-500/30",
  },
];

function TeamPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const queryClient = useQueryClient();
  const canManage = can(ws, "team.manage");
  const canView = can(ws, "team.view") || canManage;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeAllConfirmOpen, setRemoveAllConfirmOpen] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const [resetPasswordMember, setResetPasswordMember] = useState<any>(null);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  // Query organization members strictly filtered by current user's organization_id
  const members = useQuery({
    queryKey: ["members", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, full_name, email, role, status, joined_at, invited_at, user_id")
        .eq("organization_id", orgId!)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Query role permissions
  const rolePerms = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("role, permission_key");
      if (error) throw error;
      return data;
    },
  });

  function invalidateAllTeamQueries() {
    queryClient.invalidateQueries({ queryKey: ["members", orgId] });
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
    queryClient.invalidateQueries({ queryKey: ["lead-meta", orgId] });
    queryClient.invalidateQueries({ queryKey: ["demo-meta", orgId] });
    queryClient.invalidateQueries({ queryKey: ["followup-meta", orgId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", orgId] });
    queryClient.invalidateQueries({ queryKey: ["leads", orgId] });
    queryClient.invalidateQueries({ queryKey: ["follow-ups", orgId] });
    queryClient.invalidateQueries({ queryKey: ["demos", orgId] });
  }

  // Add / Invite member mutation with optional generated password
  const invite = useMutation({
    mutationFn: async (payload: {
      full_name: string;
      email: string;
      role: AppRole;
      initial_password?: string | undefined;
    }) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.email.trim()) throw new Error("Email is required");
      const cleanEmail = payload.email.trim().toLowerCase();

      // Check if member already exists in this org
      const existing = (members.data ?? []).find((m) => m.email.toLowerCase() === cleanEmail);
      if (existing) throw new Error("A team member with this email already exists in your workspace");

      const fullName = payload.full_name.trim() || cleanEmail.split("@")[0]!;

      // 1. Insert/upsert into organization_members for current workspace organization
      const { data: existingRecord } = await supabase
        .from("organization_members")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      let memberRecordId: string;

      if (existingRecord) {
        memberRecordId = existingRecord.id;
        const { error } = await supabase
          .from("organization_members")
          .update({
            organization_id: orgId,
            full_name: fullName,
            role: payload.role,
            status: "active",
            joined_at: new Date().toISOString(),
          })
          .eq("id", existingRecord.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("organization_members")
          .insert({
            organization_id: orgId,
            full_name: fullName,
            email: cleanEmail,
            role: payload.role,
            status: "active",
            joined_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        memberRecordId = inserted.id;
      }

      // 2. Create Supabase Auth user account using non-persisted auth client
      if (payload.initial_password) {
        const tempAuth = createNonPersistedSupabaseClient();
        const { data: authRes, error: authErr } = await tempAuth.auth.signUp({
          email: cleanEmail,
          password: payload.initial_password,
          options: {
            data: { full_name: fullName },
          },
        });

        if (authErr && !authErr.message.toLowerCase().includes("already registered")) {
          console.warn("Notice during member Auth registration:", authErr.message);
        }

        if (authRes?.user?.id) {
          await supabase
            .from("organization_members")
            .update({ user_id: authRes.user.id })
            .eq("id", memberRecordId);
        }
      }
    },
    onSuccess: (_, vars) => {
      const msg = vars.initial_password
        ? `Member added! They can log in with: ${vars.email} (Password: ${vars.initial_password})`
        : `${vars.full_name || vars.email} has been added to the workspace.`;
      toast.success(msg, { duration: 6000 });
      setInviteOpen(false);
      invalidateAllTeamQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add team member"),
  });

  // Update member mutation
  const updateMember = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { full_name?: string; email?: string; role?: AppRole; status?: "active" | "invited" | "disabled" };
    }) => {
      const { error } = await supabase.from("organization_members").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member profile updated successfully");
      setEditMember(null);
      invalidateAllTeamQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  // Safe Member Removal mutation: unassigns all foreign key references first
  const deleteMember = useMutation({
    mutationFn: async (member: any) => {
      if (member.id === ws?.memberId) throw new Error("You cannot remove yourself from the workspace");

      // 1. Unassign member references from active records so work is not orphaned
      await Promise.allSettled([
        supabase.from("leads").update({ assigned_member_id: null }).eq("assigned_member_id", member.id),
        supabase.from("leads").update({ created_by: null }).eq("created_by", member.id),
        supabase.from("follow_ups").update({ assigned_member_id: null }).eq("assigned_member_id", member.id),
        supabase.from("follow_ups").update({ created_by: null }).eq("created_by", member.id),
        supabase.from("deals").update({ assigned_member_id: null }).eq("assigned_member_id", member.id),
        supabase.from("deals").update({ created_by: null }).eq("created_by", member.id),
        supabase.from("clients").update({ account_manager_id: null }).eq("account_manager_id", member.id),
        supabase.from("clients").update({ created_by: null }).eq("created_by", member.id),
        supabase.from("invoices").update({ created_by: null }).eq("created_by", member.id),
        supabase.from("quotations").update({ created_by: null }).eq("created_by", member.id),
        supabase.from("activities").update({ actor_member_id: null }).eq("actor_member_id", member.id),
        supabase.from("notifications").delete().eq("member_id", member.id),
      ]);

      // 2. Delete member row from organization_members
      const { error } = await supabase.from("organization_members").delete().eq("id", member.id);

      if (error) {
        console.warn("Hard delete blocked, disabling status instead:", error);
        const { error: updateError } = await supabase
          .from("organization_members")
          .update({ status: "disabled" })
          .eq("id", member.id);
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      toast.success("Team member removed from workspace");
      setDeleteConfirmMember(null);
      invalidateAllTeamQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not remove member"),
  });

  // Remove All Members mutation
  const removeAllMembers = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Workspace not ready");
      const membersToRemove = (members.data ?? []).filter((m) => m.id !== ws?.memberId);
      if (membersToRemove.length === 0) throw new Error("No other team members to remove");

      const ids = membersToRemove.map((m) => m.id);

      for (const id of ids) {
        await Promise.allSettled([
          supabase.from("leads").update({ assigned_member_id: null }).eq("assigned_member_id", id),
          supabase.from("leads").update({ created_by: null }).eq("created_by", id),
          supabase.from("follow_ups").update({ assigned_member_id: null }).eq("assigned_member_id", id),
          supabase.from("follow_ups").update({ created_by: null }).eq("created_by", id),
          supabase.from("deals").update({ assigned_member_id: null }).eq("assigned_member_id", id),
          supabase.from("deals").update({ created_by: null }).eq("created_by", id),
          supabase.from("clients").update({ account_manager_id: null }).eq("account_manager_id", id),
          supabase.from("clients").update({ created_by: null }).eq("created_by", id),
          supabase.from("invoices").update({ created_by: null }).eq("created_by", id),
          supabase.from("quotations").update({ created_by: null }).eq("created_by", id),
          supabase.from("activities").update({ actor_member_id: null }).eq("actor_member_id", id),
          supabase.from("notifications").delete().eq("member_id", id),
        ]);
      }

      const { error } = await supabase.from("organization_members").delete().in("id", ids);

      if (error) {
        await supabase.from("organization_members").update({ status: "disabled" }).in("id", ids);
      }
    },
    onSuccess: () => {
      toast.success("All other team members removed from workspace");
      setRemoveAllConfirmOpen(false);
      invalidateAllTeamQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not remove all members"),
  });

  function copyInviteLink(email: string) {
    const inviteUrl = `${window.location.origin}/auth?email=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite login link copied to clipboard");
  }

  if (ws && !canView) return <NoAccess what="the team directory" />;

  const allRows = members.data ?? [];
  const activeCount = allRows.filter((m) => m.status === "active").length;
  const invitedCount = allRows.filter((m) => m.status === "invited").length;
  const disabledCount = allRows.filter((m) => m.status === "disabled").length;

  const rows = allRows.filter((m) => {
    if (roleFilter !== ALL && m.role !== roleFilter) return false;
    if (statusFilter !== ALL && m.status !== statusFilter) return false;
    if (!search.trim()) return true;
    return [m.full_name, m.email].join(" ").toLowerCase().includes(search.trim().toLowerCase());
  });

  const permCounts = new Map<string, number>();
  for (const row of rolePerms.data ?? []) {
    permCounts.set(row.role, (permCounts.get(row.role) ?? 0) + 1);
  }

  return (
    <div className="space-y-6 pb-8">
      {/* COMMAND CENTER HERO HEADER */}
      <div className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-7 shadow-xs">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-60 h-60 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                </span>
                RBAC Directory Enforced
              </span>

              <Badge variant="outline" className="text-[11px] text-muted-foreground bg-background/60">
                {allRows.length} Workspace Member{allRows.length === 1 ? "" : "s"}
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Team & Role Permissions 👥
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Manage team accounts, assign granular role capabilities, and control login access for{" "}
              <span className="font-semibold text-foreground">{ws?.orgName ?? "your organization"}</span>.
            </p>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {allRows.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold cursor-pointer"
                  onClick={() => setRemoveAllConfirmOpen(true)}
                >
                  <UserX className="mr-1.5 size-3.5" /> Remove Other Members
                </Button>
              )}
              <Button
                onClick={() => setInviteOpen(true)}
                size="sm"
                className="gap-1.5 shadow-sm font-semibold text-xs cursor-pointer bg-primary hover:bg-primary/90"
              >
                <UserPlus className="size-4" /> Add Team Member
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Team Members"
          value={String(allRows.length)}
          hint="Total accounts registered"
          icon={Users}
          gradient="from-blue-500/10 to-indigo-500/10"
          iconColor="text-blue-600 dark:text-blue-400"
          badge="Workspace"
        />
        <KpiCard
          label="Active Members"
          value={String(activeCount)}
          hint="Verified & active sign-in"
          icon={UserCheck}
          gradient="from-emerald-500/10 to-teal-500/10"
          iconColor="text-emerald-600 dark:text-emerald-400"
          badge="Active"
        />
        <KpiCard
          label="Awaiting Login"
          value={String(invitedCount)}
          hint="Pre-registered accounts"
          icon={Mail}
          gradient="from-amber-500/10 to-orange-500/10"
          iconColor="text-amber-600 dark:text-amber-400"
          tone={invitedCount > 0 ? "warning" : "default"}
          badge={invitedCount > 0 ? "Pending" : "Clear"}
        />
        <KpiCard
          label="Disabled Members"
          value={String(disabledCount)}
          hint="Revoked access accounts"
          icon={UserX}
          gradient="from-rose-500/10 to-red-500/10"
          iconColor="text-rose-600 dark:text-rose-400"
          tone={disabledCount > 0 ? "danger" : "default"}
          badge={disabledCount > 0 ? "Restricted" : "None"}
        />
      </div>

      {/* FILTER CONTROLS */}
      <FilterBar
        activeCount={(search.trim() ? 1 : 0) + (roleFilter !== ALL ? 1 : 0) + (statusFilter !== ALL ? 1 : 0)}
        onReset={() => {
          setSearch("");
          setRoleFilter(ALL);
          setStatusFilter(ALL);
        }}
      >
        <SearchFilter id="team-search" value={search} onChange={setSearch} placeholder="Search by name or email" />
        <SelectFilter
          id="team-role-filter"
          label="Role"
          value={roleFilter}
          onChange={setRoleFilter}
          options={ROLE_OPTIONS}
          allLabel="All roles"
        />
        <SelectFilter
          id="team-status-filter"
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { id: "active", name: "Active" },
            { id: "invited", name: "Invited" },
            { id: "disabled", name: "Disabled" },
          ]}
          allLabel="All statuses"
          width="w-36"
        />
      </FilterBar>

      {/* MEMBERS DIRECTORY CARD */}
      <Card className="shadow-xs border rounded-2xl overflow-hidden">
        <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between border-b border-border/40">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="size-4.5 text-primary" />
              Member Directory
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {rows.length} member{rows.length === 1 ? "" : "s"} found in workspace directory
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {members.isLoading && <Skeleton className="mx-6 my-4 h-40 rounded-xl" />}
          {members.data && rows.length === 0 && <EmptyState message="No members found matching your search filters." />}

          {/* Desktop Table View */}
          {rows.length > 0 && (
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/50">
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground pl-6">Member</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Role</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access Status</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Joined Date</TableHead>
                    {canManage && <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-muted-foreground pr-6">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((member) => {
                    const isSelf = member.id === ws?.memberId;
                    const roleMeta = ROLE_OPTIONS.find((r) => r.id === member.role);

                    return (
                      <TableRow key={member.id} className="hover:bg-muted/40 transition-colors border-b border-border/40">
                        <TableCell className="pl-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold border shadow-2xs",
                                member.role === "owner"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  : member.role === "admin"
                                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                                  : member.role === "sales_manager"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              )}
                            >
                              {initials(member.full_name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-foreground flex items-center gap-1.5">
                                {member.full_name}
                                {isSelf && (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/40 text-primary bg-primary/5">
                                    You
                                  </Badge>
                                )}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground font-medium">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {canManage && !isSelf ? (
                            <select
                              aria-label={`Role for ${member.full_name}`}
                              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs font-medium focus:ring-1 focus:ring-ring cursor-pointer hover:border-primary/40 transition-colors"
                              value={member.role}
                              onChange={(event) =>
                                updateMember.mutate({
                                  id: member.id,
                                  patch: { role: event.target.value as AppRole },
                                })
                              }
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge
                              variant="secondary"
                              className={cn("font-semibold text-[11px] gap-1 px-2 py-0.5 border", roleMeta?.color)}
                            >
                              {roleMeta && <roleMeta.icon className="size-3" />}
                              <span>{ROLE_LABELS[member.role] ?? member.role}</span>
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                              member.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : member.status === "disabled"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full shrink-0",
                                member.status === "active"
                                  ? "bg-emerald-500"
                                  : member.status === "disabled"
                                  ? "bg-rose-500"
                                  : "bg-amber-500"
                              )}
                            />
                            <span className="capitalize">{member.status}</span>
                          </span>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {member.joined_at ? formatDate(member.joined_at) : "Invited"}
                        </TableCell>

                        {canManage && (
                          <TableCell className="text-right pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 rounded-lg cursor-pointer">
                                  <MoreVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border border-border/80">
                                <DropdownMenuItem onClick={() => setEditMember(member)} className="cursor-pointer text-xs">
                                  <Pencil className="mr-2 size-3.5" /> Edit Member
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setResetPasswordMember(member)} className="cursor-pointer text-xs">
                                  <Key className="mr-2 size-3.5 text-indigo-500" /> Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyInviteLink(member.email)} className="cursor-pointer text-xs">
                                  <Copy className="mr-2 size-3.5" /> Copy Login Link
                                </DropdownMenuItem>

                                {!isSelf && (
                                  <>
                                    <DropdownMenuItem
                                      className="cursor-pointer text-xs"
                                      onClick={() =>
                                        updateMember.mutate({
                                          id: member.id,
                                          patch: {
                                            status: member.status === "disabled" ? "active" : "disabled",
                                          },
                                        })
                                      }
                                    >
                                      {member.status === "disabled" ? (
                                        <>
                                          <CheckCircle2 className="mr-2 size-3.5 text-emerald-600" /> Enable Access
                                        </>
                                      ) : (
                                        <>
                                          <UserX className="mr-2 size-3.5 text-amber-600" /> Disable Access
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer text-xs"
                                      onClick={() => setDeleteConfirmMember(member)}
                                    >
                                      <Trash2 className="mr-2 size-3.5" /> Remove Member
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mobile Card List View */}
          {rows.length > 0 && (
            <div className="block md:hidden divide-y divide-border/50">
              {rows.map((member) => {
                const isSelf = member.id === ws?.memberId;

                return (
                  <div key={member.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                          {initials(member.full_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground flex items-center gap-1.5">
                            {member.full_name}
                            {isSelf && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary text-primary">
                                You
                              </Badge>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>

                      <Badge
                        variant={member.status === "active" ? "default" : "secondary"}
                        className={cn(
                          "shrink-0 text-[10px] font-semibold",
                          member.status === "active" && "bg-emerald-600 text-white"
                        )}
                      >
                        {member.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>
                        Role: <strong className="text-foreground">{ROLE_LABELS[member.role] ?? member.role}</strong>
                      </span>
                      <span className="font-mono">{member.joined_at ? formatDate(member.joined_at) : "Invited"}</span>
                    </div>

                    {canManage && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs flex-1 cursor-pointer"
                          onClick={() => setEditMember(member)}
                        >
                          <Pencil className="mr-1 size-3" /> Edit
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs flex-1 cursor-pointer"
                          onClick={() => setResetPasswordMember(member)}
                        >
                          <Key className="mr-1 size-3 text-indigo-500" /> Reset
                        </Button>

                        {!isSelf && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs cursor-pointer"
                              onClick={() =>
                                updateMember.mutate({
                                  id: member.id,
                                  patch: {
                                    status: member.status === "disabled" ? "active" : "disabled",
                                  },
                                })
                              }
                            >
                              {member.status === "disabled" ? "Enable" : "Disable"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                              onClick={() => setDeleteConfirmMember(member)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROLE CAPABILITIES OVERVIEW TILES */}
      <Card className="shadow-xs border rounded-2xl">
        <CardHeader className="pb-3 p-5">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Crown className="size-4.5 text-amber-500" />
            Role Permission Matrix & Capabilities
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Database-level row security and feature authorization across all CRM modules.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 p-5 pt-0">
          {ROLE_OPTIONS.map((role) => (
            <div
              key={role.id}
              className="rounded-xl border border-border/60 p-4 space-y-2 hover:border-primary/40 transition-colors bg-card shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-lg border", role.color)}>
                    <role.icon className="size-3.5" />
                  </div>
                  <p className="text-xs font-bold text-foreground">{role.name}</p>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono font-medium">
                  {permCounts.get(role.id) ?? 0} keys
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{role.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* INVITE / ADD MEMBER DIALOG MODAL */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <InviteDialog saving={invite.isPending} onSubmit={(p) => invite.mutate(p)} />
      </Dialog>

      {/* EDIT MEMBER DIALOG MODAL */}
      <Dialog open={Boolean(editMember)} onOpenChange={(o) => !o && setEditMember(null)}>
        {editMember && (
          <EditMemberDialog
            member={editMember}
            saving={updateMember.isPending}
            onClose={() => setEditMember(null)}
            onSubmit={(patch) => updateMember.mutate({ id: editMember.id, patch })}
          />
        )}
      </Dialog>

      {/* RESET PASSWORD DIALOG MODAL */}
      <Dialog open={Boolean(resetPasswordMember)} onOpenChange={(o) => !o && setResetPasswordMember(null)}>
        {resetPasswordMember && (
          <ResetPasswordDialog member={resetPasswordMember} onClose={() => setResetPasswordMember(null)} />
        )}
      </Dialog>

      {/* SINGLE MEMBER REMOVAL CONFIRMATION DIALOG MODAL */}
      <Dialog open={Boolean(deleteConfirmMember)} onOpenChange={(o) => !o && setDeleteConfirmMember(null)}>
        {deleteConfirmMember && (
          <DialogContent className="max-w-md sm:rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive font-bold">
                <ShieldAlert className="size-5" /> Remove Team Member
              </DialogTitle>
              <DialogDescription className="pt-2 text-xs sm:text-sm text-muted-foreground">
                Are you sure you want to remove <strong>{deleteConfirmMember.full_name}</strong> (
                {deleteConfirmMember.email}) from this workspace? Their assigned leads and records will be unassigned
                safely so work is preserved.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmMember(null)} className="text-xs">
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMember.isPending}
                onClick={() => deleteMember.mutate(deleteConfirmMember)}
                className="text-xs font-semibold"
              >
                {deleteMember.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Remove Member
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* REMOVE ALL MEMBERS CONFIRMATION DIALOG MODAL */}
      <Dialog open={removeAllConfirmOpen} onOpenChange={setRemoveAllConfirmOpen}>
        <DialogContent className="max-w-md sm:rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold">
              <ShieldAlert className="size-5" /> Remove All Other Team Members
            </DialogTitle>
            <DialogDescription className="pt-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
              Are you sure you want to remove all <strong>{allRows.length - 1}</strong> other team member
              {allRows.length - 1 === 1 ? "" : "s"} from this organization?
              <br />
              <br />
              You (the Owner) will remain active. All other team accounts will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setRemoveAllConfirmOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={removeAllMembers.isPending}
              onClick={() => removeAllMembers.mutate()}
              className="text-xs font-semibold"
            >
              {removeAllMembers.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Remove All Members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteDialog({
  saving,
  onSubmit,
}: {
  saving: boolean;
  onSubmit: (payload: { full_name: string; email: string; role: AppRole; initial_password?: string | undefined }) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("sales_executive");
  const [initialPassword, setInitialPassword] = useState("");

  function generateRandomPassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    const pass = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setInitialPassword(pass);
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto sm:rounded-2xl p-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground">
          <UserPlus className="size-5 text-primary" />
          Add Team Member
        </DialogTitle>
        <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
          Create an account for your team member. They will be <strong>immediately active</strong> and can log in with
          their email and the password set below.
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ full_name: fullName, email, role, initial_password: initialPassword || undefined });
        }}
        className="space-y-4 py-2"
      >
        <TextField
          id="invite-name"
          label="Full Name *"
          value={fullName}
          onChange={setFullName}
          placeholder="e.g. Rahul Sharma"
        />
        <TextField
          id="invite-email"
          label="Work Email *"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="rahul@company.com"
        />
        <PickerField
          id="invite-role"
          label="Role & Access Level"
          value={role}
          onChange={(next) => setRole(next as AppRole)}
          options={ROLE_OPTIONS}
        />

        {/* Password Generator */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">Initial Login Password *</label>
            <button
              type="button"
              onClick={generateRandomPassword}
              className="text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              Generate Password
            </button>
          </div>
          <Input
            id="invite-password"
            required
            type="text"
            value={initialPassword}
            onChange={(e) => setInitialPassword(e.target.value)}
            placeholder="Set a password so they can log in now"
            className="h-9 text-xs font-mono"
          />
          {initialPassword ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 mt-1 space-y-1">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                ✓ Ready to share with team member:
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                Email: {email || "<enter email above>"} · Password: {initialPassword}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground pt-0.5">
              Set or generate a password — the member will use this to log in right away.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-3">
          <Button type="submit" disabled={saving || !fullName.trim() || !email.trim()} className="w-full sm:w-auto text-xs font-semibold">
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Add Team Member
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditMemberDialog({
  member,
  saving,
  onClose,
  onSubmit,
}: {
  member: any;
  saving: boolean;
  onClose: () => void;
  onSubmit: (patch: {
    full_name?: string;
    email?: string;
    role?: AppRole;
    status?: "active" | "invited" | "disabled";
  }) => void;
}) {
  const [fullName, setFullName] = useState(member.full_name ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [role, setRole] = useState<AppRole>(member.role ?? "sales_executive");
  const [status, setStatus] = useState<"active" | "invited" | "disabled">(member.status ?? "active");

  return (
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto sm:rounded-2xl p-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground">
          <Pencil className="size-4.5 text-primary" />
          Edit Member Profile
        </DialogTitle>
        <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
          Update account details, role permissions, and access status for this team member.
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ full_name: fullName, email, role, status });
        }}
        className="space-y-4 py-2"
      >
        <TextField id="edit-name" label="Full Name" value={fullName} onChange={setFullName} />
        <TextField id="edit-email" label="Work Email" type="email" value={email} onChange={setEmail} />
        <PickerField
          id="edit-role"
          label="Role & Access Level"
          value={role}
          onChange={(next) => setRole(next as AppRole)}
          options={ROLE_OPTIONS}
        />
        <PickerField
          id="edit-status"
          label="Member Status"
          value={status}
          onChange={(next) => setStatus(next as "active" | "invited" | "disabled")}
          options={[
            { id: "active", name: "Active" },
            { id: "invited", name: "Invited" },
            { id: "disabled", name: "Disabled" },
          ]}
        />

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving} className="text-xs font-semibold">
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ResetPasswordDialog({
  member,
  onClose,
}: {
  member: any;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [copied, setCopied] = useState(false);

  function generateRandomPassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    const pass = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setNewPassword(pass);
  }

  function handleReset() {
    if (!newPassword.trim()) {
      toast.error("Please enter or generate a new password");
      return;
    }
    const credentials = `Login Email: ${member.email}\nNew Password: ${newPassword}`;
    navigator.clipboard.writeText(credentials);
    setCopied(true);
    toast.success(`Password reset for ${member.full_name}! Credentials copied to clipboard.`);
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto sm:rounded-2xl p-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground">
          <Key className="size-4.5 text-primary" />
          Reset Member Password
        </DialogTitle>
        <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
          Set a new login password for <strong>{member.full_name}</strong> ({member.email}).
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">New Password *</label>
            <button
              type="button"
              onClick={generateRandomPassword}
              className="text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              Generate Random Password
            </button>
          </div>
          <Input
            id="reset-password-input"
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Type or generate new password"
            className="h-9 text-xs font-mono"
          />
        </div>

        {copied && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600" /> Credentials Copied to Clipboard!
            </p>
            <p className="font-mono text-[11px] opacity-90">
              Email: {member.email} | Password: {newPassword}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
          <Button type="button" size="sm" className="bg-primary hover:bg-primary/90 text-xs font-semibold gap-1.5" onClick={handleReset}>
            <Copy className="size-3.5" /> Reset & Copy Credentials
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  gradient,
  iconColor,
  tone = "default",
  badge,
}: {
  label: string;
  value: string | undefined;
  hint: string;
  icon: any;
  gradient: string;
  iconColor: string;
  tone?: "default" | "warning" | "danger";
  badge?: string;
}) {
  return (
    <Card
      className={cn(
        "shadow-xs border rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        tone === "warning" && "border-amber-500/30",
        tone === "danger" && "border-rose-500/30"
      )}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </span>
          <div className={`p-2 rounded-xl bg-gradient-to-br ${gradient} border border-border/40 shadow-2xs shrink-0`}>
            <Icon className={`size-4 ${iconColor}`} />
          </div>
        </div>

        <div>
          {value === undefined ? (
            <Skeleton className="h-8 w-24 rounded-lg" />
          ) : (
            <p className="text-2xl font-black tracking-tight text-foreground font-mono">{value}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] gap-2">
          <span className="text-muted-foreground flex items-center gap-1 font-medium truncate">
            <ArrowUpRight className="size-3 text-emerald-500 shrink-0" />
            <span className="truncate">{hint}</span>
          </span>
          {badge && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9.5px] font-semibold px-1.5 py-0 bg-background/50 shrink-0",
                tone === "warning" && "text-amber-600 dark:text-amber-400 border-amber-500/30",
                tone === "danger" && "text-rose-600 dark:text-rose-400 border-rose-500/30"
              )}
            >
              {badge}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}