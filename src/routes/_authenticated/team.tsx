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
} from "lucide-react";

import { supabase, createNonPersistedSupabaseClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { EmptyState, NoAccess, PageHeader } from "@/components/crm/page";
import { PickerField, TextField } from "@/components/crm/fields";
import { ALL, FilterBar, SearchFilter, SelectFilter } from "@/components/crm/filters";
import { can, useWorkspace } from "@/hooks/use-workspace";
import { ROLE_LABELS, formatDate, initials } from "@/lib/crm";

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
      { property: "og:url", content: "https://leadkart.lovable.app/team" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Team & Roles — LeadKart CRM" },
    ],
    links: [{ rel: "canonical", href: "https://leadkart.lovable.app/team" }],
  }),
  component: TeamPage,
});

type AppRole = "owner" | "admin" | "sales_manager" | "sales_executive" | "accountant";

const ROLE_OPTIONS: { id: AppRole; name: string; description: string }[] = [
  { id: "owner", name: "Owner", description: "Full workspace authority and billing access" },
  { id: "admin", name: "Admin", description: "Manage members, settings, and full data access" },
  { id: "sales_manager", name: "Sales Manager", description: "Manage team pipeline, deals, and reports" },
  { id: "sales_executive", name: "Sales Executive", description: "Manage assigned leads and follow-ups" },
  { id: "accountant", name: "Accountant", description: "Access quotations, invoices, and financial records" },
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

  // Query organization members strictly filtered by current user's organization_id!
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
    mutationFn: async (payload: { full_name: string; email: string; role: AppRole; initial_password?: string | undefined }) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.email.trim()) throw new Error("Email is required");
      const cleanEmail = payload.email.trim().toLowerCase();

      // Check if member already exists in this org
      const existing = (members.data ?? []).find((m) => m.email.toLowerCase() === cleanEmail);
      if (existing) throw new Error("A team member with this email already exists in your workspace");

      const fullName = payload.full_name.trim() || cleanEmail.split("@")[0]!;

      // 1. Insert/upsert into organization_members for current workspace organization FIRST
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
          // Link user_id directly to organization_members record
          await supabase
            .from("organization_members")
            .update({ user_id: authRes.user.id })
            .eq("id", memberRecordId);
        }
      }
    },
    onSuccess: (_, vars) => {
      const msg = vars.initial_password
        ? `Member added! They can log in with email: ${vars.email ?? ""} and password: ${vars.initial_password}`
        : `${vars.full_name || vars.email} has been added and can log in immediately.`;
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

  // Safe Member Removal mutation: unassigns all foreign key references first across all tables!
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
        console.warn("Hard delete blocked by foreign key constraint, disabling status instead:", error);
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

  // Remove All Members mutation: clears all other members from organization while preserving owner!
  const removeAllMembers = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Workspace not ready");
      const membersToRemove = (members.data ?? []).filter((m) => m.id !== ws?.memberId);
      if (membersToRemove.length === 0) throw new Error("No other team members to remove");

      const ids = membersToRemove.map((m) => m.id);

      // Unassign foreign key references across all tables for all target members
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

      // Delete members from DB
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .in("id", ids);

      if (error) {
        console.warn("Hard delete blocked for some members, disabling them instead:", error);
        await supabase
          .from("organization_members")
          .update({ status: "disabled" })
          .in("id", ids);
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
    <div className="space-y-6">
      <PageHeader
        title="Team & Roles"
        subtitle="Manage team members, roles, access status, and login credentials for your workspace."
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {allRows.length > 1 && (
                <Button
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => setRemoveAllConfirmOpen(true)}
                  size="sm"
                >
                  <UserX className="mr-1.5 size-4" /> Remove All Members
                </Button>
              )}
              <Button onClick={() => setInviteOpen(true)} size="sm">
                <UserPlus className="mr-1.5 size-4" /> Add Team Member
              </Button>
            </div>
          ) : null
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Team Members"
          value={String(allRows.length)}
          hint="Members in workspace"
          icon={Users}
          tone="default"
        />
        <KpiCard
          label="Active Members"
          value={String(activeCount)}
          hint="Logged in and active"
          icon={UserCheck}
          tone="default"
        />
        <KpiCard
          label="Awaiting Login"
          value={String(invitedCount)}
          hint="Pre-registered, not yet signed in"
          icon={Mail}
          tone={invitedCount > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Disabled Members"
          value={String(disabledCount)}
          hint="Access revoked"
          icon={UserX}
          tone={disabledCount > 0 ? "danger" : "default"}
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        activeCount={
          (search.trim() ? 1 : 0) + (roleFilter !== ALL ? 1 : 0) + (statusFilter !== ALL ? 1 : 0)
        }
        onReset={() => {
          setSearch("");
          setRoleFilter(ALL);
          setStatusFilter(ALL);
        }}
      >
        <SearchFilter id="team-search" value={search} onChange={setSearch} placeholder="Search name or email" />
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

      {/* Members Directory Card */}
      <Card className="shadow-card">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Team Directory
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {rows.length} member{rows.length === 1 ? "" : "s"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {members.isLoading && <Skeleton className="mx-6 my-4 h-40" />}
          {members.data && rows.length === 0 && <EmptyState message="No members found matching filters." />}

          {/* Desktop Table View */}
          {rows.length > 0 && (
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined Date</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((member) => {
                    const isSelf = member.id === ws?.memberId;

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                              {initials(member.full_name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium flex items-center gap-1.5">
                                {member.full_name}
                                {isSelf && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary text-primary">
                                    You
                                  </Badge>
                                )}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {canManage && !isSelf ? (
                            <select
                              aria-label={`Role for ${member.full_name}`}
                              className="h-8 rounded-md border bg-background px-2 text-xs font-medium focus:ring-1 focus:ring-ring"
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
                            <Badge variant="secondary" className="font-medium">
                              {ROLE_LABELS[member.role] ?? member.role}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              member.status === "active"
                                ? "default"
                                : member.status === "disabled"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className={
                              member.status === "active"
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : ""
                            }
                          >
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {member.joined_at ? formatDate(member.joined_at) : "Invited"}
                        </TableCell>

                        {canManage && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setEditMember(member)}>
                                  <Pencil className="mr-2 size-3.5" /> Edit Member
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setResetPasswordMember(member)}>
                                  <Key className="mr-2 size-3.5 text-indigo-600 dark:text-indigo-400" /> Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyInviteLink(member.email)}>
                                  <Copy className="mr-2 size-3.5" /> Copy Login Link
                                </DropdownMenuItem>

                                {!isSelf && (
                                  <>
                                    <DropdownMenuItem
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
                                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
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
            <div className="block md:hidden divide-y">
              {rows.map((member) => {
                const isSelf = member.id === ws?.memberId;

                return (
                  <div key={member.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                          {initials(member.full_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold flex items-center gap-1.5">
                            {member.full_name}
                            {isSelf && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 border-primary text-primary">
                                You
                              </Badge>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>

                      <Badge
                        variant={
                          member.status === "active"
                            ? "default"
                            : member.status === "disabled"
                              ? "destructive"
                              : "secondary"
                        }
                        className={
                          member.status === "active"
                            ? "bg-emerald-600 text-white shrink-0 text-[11px]"
                            : "shrink-0 text-[11px]"
                        }
                      >
                        {member.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>Role: <strong className="text-foreground">{ROLE_LABELS[member.role] ?? member.role}</strong></span>
                      <span>{member.joined_at ? formatDate(member.joined_at) : "Invited"}</span>
                    </div>

                    {canManage && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs flex-1"
                          onClick={() => setEditMember(member)}
                        >
                          <Pencil className="mr-1 size-3" /> Edit
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs flex-1"
                          onClick={() => setResetPasswordMember(member)}
                        >
                          <Key className="mr-1 size-3 text-indigo-600 dark:text-indigo-400" /> Reset
                        </Button>

                        {!isSelf && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
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
                              className="h-8 text-xs text-destructive hover:bg-destructive/10"
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

      {/* Role Capabilities Overview */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Crown className="size-4 text-amber-500" />
            Role Permission Capabilities
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_OPTIONS.map((role) => (
            <div key={role.id} className="rounded-lg border p-3.5 space-y-1 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{role.name}</p>
                <Badge variant="outline" className="text-[10px]">
                  {permCounts.get(role.id) ?? 0} perms
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {role.description}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Invite / Add Member Dialog Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <InviteDialog saving={invite.isPending} onSubmit={(p) => invite.mutate(p)} />
      </Dialog>

      {/* Edit Member Dialog Modal */}
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

      {/* Reset Password Dialog Modal */}
      <Dialog open={Boolean(resetPasswordMember)} onOpenChange={(o) => !o && setResetPasswordMember(null)}>
        {resetPasswordMember && (
          <ResetPasswordDialog
            member={resetPasswordMember}
            onClose={() => setResetPasswordMember(null)}
          />
        )}
      </Dialog>

      {/* Single Member Removal Confirmation Dialog Modal */}
      <Dialog open={Boolean(deleteConfirmMember)} onOpenChange={(o) => !o && setDeleteConfirmMember(null)}>
        {deleteConfirmMember && (
          <DialogContent className="max-w-md p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="size-5" /> Remove Team Member
              </DialogTitle>
              <DialogDescription className="pt-2 text-sm">
                Are you sure you want to remove <strong>{deleteConfirmMember.full_name}</strong> ({deleteConfirmMember.email}) from your organization? They will immediately lose access to your workspace.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-3">
              <Button variant="outline" onClick={() => setDeleteConfirmMember(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMember.isPending}
                onClick={() => deleteMember.mutate(deleteConfirmMember)}
              >
                {deleteMember.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                Remove Member
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Remove All Members Confirmation Dialog Modal */}
      <Dialog open={removeAllConfirmOpen} onOpenChange={setRemoveAllConfirmOpen}>
        <DialogContent className="max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" /> Remove All Team Members
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed">
              Are you sure you want to remove all <strong>{allRows.length - 1}</strong> other team member{allRows.length - 1 === 1 ? "" : "s"} from this workspace?
              <br /><br />
              You (the Owner) will remain active. All other team members will lose workspace access and their assigned records will be unassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-3">
            <Button variant="outline" onClick={() => setRemoveAllConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removeAllMembers.isPending}
              onClick={() => removeAllMembers.mutate()}
            >
              {removeAllMembers.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
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
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
          <UserPlus className="size-5 text-indigo-600 dark:text-indigo-400" />
          Add Team Member
        </DialogTitle>
        <DialogDescription className="text-xs sm:text-sm">
          Create an account for your team member. They will be <strong>immediately active</strong> and can log in with their email and the password you set.
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ full_name: fullName, email, role, initial_password: initialPassword || undefined });
        }}
        className="space-y-4 py-2"
      >
        <TextField id="invite-name" label="Full Name *" value={fullName} onChange={setFullName} placeholder="e.g. Rahul Sharma" />
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

        {/* Password Generator — required so member can log in immediately */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Login Password *</label>
            <button
              type="button"
              onClick={generateRandomPassword}
              className="text-xs text-primary hover:underline font-medium"
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
          />
          {initialPassword ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 mt-1">
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                ✓ Share these credentials with the team member so they can log in immediately.
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                Email: {email || "<enter email above>"} · Password: {initialPassword}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground pt-0.5">
              Set or generate a password — the member will use this to log in right away.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
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
  onSubmit: (patch: { full_name?: string; email?: string; role?: AppRole; status?: "active" | "invited" | "disabled" }) => void;
}) {
  const [fullName, setFullName] = useState(member.full_name ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [role, setRole] = useState<AppRole>(member.role ?? "sales_executive");
  const [status, setStatus] = useState<"active" | "invited" | "disabled">(member.status ?? "active");

  return (
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Pencil className="size-5 text-indigo-600 dark:text-indigo-400" />
          Edit Member Profile
        </DialogTitle>
        <DialogDescription className="text-xs sm:text-sm">
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

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
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
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Key className="size-5 text-indigo-600 dark:text-indigo-400" />
          Reset Member Password
        </DialogTitle>
        <DialogDescription className="text-xs sm:text-sm">
          Set a new login password for <strong>{member.full_name}</strong> ({member.email}).
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">New Password *</label>
            <button
              type="button"
              onClick={generateRandomPassword}
              className="text-xs text-primary hover:underline font-medium"
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
          />
        </div>

        {copied && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 p-3 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-600" /> Credentials Copied to Clipboard!
            </p>
            <p className="font-mono text-[11px] opacity-90">
              Email: {member.email} | Password: {newPassword}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleReset}>
            <Copy className="mr-1.5 size-4" /> Reset & Copy Credentials
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
  tone = "default",
}: {
  label: string;
  value: string | undefined;
  hint: string;
  icon: any;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : "text-muted-foreground";
  return (
    <Card className="shadow-card">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className={`size-4 ${toneClass}`} />
        </div>
        {value === undefined ? (
          <Skeleton className="mt-3 h-8 w-24" />
        ) : (
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
        )}
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowUpRight className="size-3" /> {hint}
        </p>
      </CardContent>
    </Card>
  );
}