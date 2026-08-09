import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
      { title: "Team & roles — Zenith CRM" },
      {
        name: "description",
        content:
          "Invite colleagues, assign Owner, Admin, Sales Manager, Sales Executive or Accountant roles and see exactly what each role can do.",
      },
      { property: "og:title", content: "Team & roles — Zenith CRM" },
      { property: "og:description", content: "Role-based access control for your sales team." },
    ],
  }),
  component: TeamPage,
});

type AppRole = "owner" | "admin" | "sales_manager" | "sales_executive" | "accountant";

const ROLE_OPTIONS: { id: AppRole; name: string }[] = [
  { id: "owner", name: "Owner" },
  { id: "admin", name: "Admin" },
  { id: "sales_manager", name: "Sales Manager" },
  { id: "sales_executive", name: "Sales Executive" },
  { id: "accountant", name: "Accountant" },
];

function TeamPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const queryClient = useQueryClient();
  const canManage = can(ws, "team.manage");
  const canView = can(ws, "team.view") || canManage;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const members = useQuery({
    queryKey: ["members", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, full_name, email, role, status, joined_at, invited_at, user_id")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const rolePerms = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("role, permission_key");
      if (error) throw error;
      return data;
    },
  });

  const invite = useMutation({
    mutationFn: async (payload: { full_name: string; email: string; role: AppRole }) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.email.trim()) throw new Error("Email is required");
      const { error } = await supabase.from("organization_members").insert({
        organization_id: orgId,
        full_name: payload.full_name || payload.email.split("@")[0]!,
        email: payload.email.trim().toLowerCase(),
        role: payload.role,
        status: "invited",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation created — they join automatically when they sign up");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["members", orgId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not invite"),
  });

  const updateMember = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { role?: AppRole; status?: "active" | "invited" | "disabled" };
    }) => {
      const { error } = await supabase.from("organization_members").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member updated");
      queryClient.invalidateQueries({ queryKey: ["members", orgId] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  if (ws && !canView) return <NoAccess what="the team directory" />;

  const allRows = members.data ?? [];
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
        title="Team & roles"
        subtitle={`${allRows.filter((m) => m.status === "active").length} active · ${allRows.filter((m) => m.status === "invited").length} invited`}
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-1 size-4" /> Invite member
                </Button>
              </DialogTrigger>
              <InviteDialog saving={invite.isPending} onSubmit={(p) => invite.mutate(p)} />
            </Dialog>
          ) : null
        }
      />

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
        <SearchFilter id="team-search" value={search} onChange={setSearch} placeholder="Name or email" />
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

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {members.isLoading && <Skeleton className="mx-6 h-40" />}
          {members.data && rows.length === 0 && <EmptyState message="No members yet." />}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                            {initials(member.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{member.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {canManage && member.id !== ws?.memberId ? (
                          <select
                            aria-label={`Role for ${member.full_name}`}
                            className="h-9 rounded-md border bg-background px-2 text-sm"
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
                          <Badge variant="secondary">
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
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.joined_at ? formatDate(member.joined_at) : "Pending"}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {member.id !== ws?.memberId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateMember.mutate({
                                  id: member.id,
                                  patch: {
                                    status: member.status === "disabled" ? "active" : "disabled",
                                  },
                                })
                              }
                            >
                              {member.status === "disabled" ? "Re-enable" : "Disable"}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What each role can do</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_OPTIONS.map((role) => (
            <div key={role.id} className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{role.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {permCounts.get(role.id) ?? 0} permissions granted
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function InviteDialog({
  saving,
  onSubmit,
}: {
  saving: boolean;
  onSubmit: (payload: { full_name: string; email: string; role: AppRole }) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("sales_executive");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Invite a team member</DialogTitle>
        <DialogDescription>
          The invitation is matched by email — the member becomes active as soon as they sign up.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <TextField id="invite-name" label="Full name" value={fullName} onChange={setFullName} />
        <TextField
          id="invite-email"
          label="Work email"
          type="email"
          value={email}
          onChange={setEmail}
        />
        <PickerField
          id="invite-role"
          label="Role"
          value={role}
          onChange={(next) => setRole(next as AppRole)}
          options={ROLE_OPTIONS}
        />
      </div>

      <DialogFooter>
        <Button disabled={saving} onClick={() => onSubmit({ full_name: fullName, email, role })}>
          {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
          Send invitation
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}