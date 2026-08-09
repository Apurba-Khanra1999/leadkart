import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlarmClock,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
  UserRoundPlus,
  Video,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, EmptyState, NoAccess } from "@/components/crm/page";
import { FollowUpDetailSheet, type FollowUpDetailTarget } from "@/components/crm/follow-up-detail";
import { AreaField, PRIORITY_OPTIONS, PickerField, TextField } from "@/components/crm/fields";
import {
  ALL,
  FilterBar,
  PRIORITY_FILTER_OPTIONS,
  SearchFilter,
  SelectFilter,
} from "@/components/crm/filters";
import { can, useWorkspace } from "@/hooks/use-workspace";
import {
  formatDateTime,
  relativeDay,
  initials,
  getMeetLink,
  formatNotesWithMeetLink,
  INDUSTRY_OPTIONS,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/demos")({
  head: () => ({
    meta: [
      { title: "Product Demos & Google Meet Links — LeadKart CRM" },
      {
        name: "description",
        content:
          "Schedule, track, and manage Google Meet product demos for leads and follow-ups across your sales team.",
      },
      { property: "og:title", content: "Product Demos & Google Meet Links — LeadKart CRM" },
      { property: "og:description", content: "Schedule and launch Google Meet product demos directly from your CRM." },
      { property: "og:url", content: "https://leadkart.lovable.app/demos" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Product Demos & Meet Links — LeadKart CRM" },
    ],
    links: [{ rel: "canonical", href: "https://leadkart.lovable.app/demos" }],
  }),
  component: DemosPage,
});

function generateMeetLink() {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `https://meet.google.com/${part1}-${part2}-${part3}`;
}

function DemosPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const queryClient = useQueryClient();

  const canManage = can(ws, "followups.manage");
  const canView = can(ws, "followups.view") || canManage;
  const canConvert = can(ws, "leads.convert") && can(ws, "clients.manage");

  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [detailTarget, setDetailTarget] = useState<FollowUpDetailTarget | null>(null);
  const [convertDemoTarget, setConvertDemoTarget] = useState<any>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState(ALL);
  const [ownerFilter, setOwnerFilter] = useState(ALL);

  // Metadata for picker dropdowns
  const meta = useQuery({
    queryKey: ["demo-meta", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const [leads, members, statuses] = await Promise.all([
        supabase
          .from("leads")
          .select("id, first_name, last_name, company, email, phone, industry, converted_client_id")
          .eq("organization_id", orgId!)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("organization_members")
          .select("id, full_name")
          .eq("organization_id", orgId!)
          .eq("status", "active")
          .order("full_name"),
        supabase
          .from("lead_statuses")
          .select("id, name, is_won")
          .eq("organization_id", orgId!),
      ]);
      return {
        leads: leads.data ?? [],
        members: members.data ?? [],
        statuses: statuses.data ?? [],
      };
    },
  });

  // Query Demos (follow_ups where type = 'demo' or contains meeting link)
  const demosQuery = useQuery({
    queryKey: ["demos", orgId],
    enabled: Boolean(orgId) && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_ups")
        .select(
          "id, type, due_at, priority, status, subject, notes, outcome, lead_id, assigned_member_id, completed_at, leads(id, first_name, last_name, company, email, phone, industry, converted_client_id)",
        )
        .eq("organization_id", orgId!)
        .order("due_at");
      if (error) throw error;
      return (data ?? []).filter((item) => item.type === "demo" || Boolean(getMeetLink(item)));
    },
  });

  // Maps
  const leadMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of meta.data?.leads ?? []) {
      const name = `${l.first_name} ${l.last_name ?? ""}`.trim();
      map.set(l.id, l.company ? `${name} (${l.company})` : name);
    }
    return map;
  }, [meta.data]);

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of meta.data?.members ?? []) {
      map.set(m.id, m.full_name);
    }
    return map;
  }, [meta.data]);

  // Status Change Mutations
  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("follow_ups")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demo marked as completed");
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.message || "Failed to update demo"),
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("follow_ups")
        .update({ status: "pending", completed_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demo reopened");
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.message || "Failed to reopen demo"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("follow_ups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demo deleted");
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete demo"),
  });

  // Convert Demo Prospect / Lead to Client
  const convertDemoToClientMutation = useMutation({
    mutationFn: async (payload: {
      demoId: string;
      leadId: string | null;
      company_name: string;
      contact_person: string;
      email: string;
      phone: string;
      industry: string;
      account_manager_id: string | null;
      notes: string;
      status: string;
    }) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.company_name.trim()) throw new Error("Company name is required");

      // 1. Insert Client Record
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert({
          organization_id: orgId,
          created_by: ws?.memberId ?? null,
          company_name: payload.company_name.trim(),
          contact_person: payload.contact_person || null,
          phone: payload.phone || null,
          email: payload.email || null,
          industry: payload.industry || null,
          account_manager_id: payload.account_manager_id ?? ws?.memberId ?? null,
          notes: payload.notes || null,
          status: payload.status as "active" | "inactive" | "vip" | "at_risk" | "lost",
        })
        .select("id, company_name")
        .single();

      if (clientErr) throw clientErr;

      // 2. Mark demo completed if pending
      await supabase
        .from("follow_ups")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", payload.demoId);

      // 3. Update lead converted_client_id if associated
      if (payload.leadId) {
        const wonStatus = (meta.data?.statuses ?? []).find((s) => s.is_won);
        await supabase
          .from("leads")
          .update({
            converted_client_id: client.id,
            converted_at: new Date().toISOString(),
            ...(wonStatus ? { status_id: wonStatus.id } : {}),
          })
          .eq("id", payload.leadId);

        // 4. Log conversion activity
        await supabase.from("activities").insert({
          organization_id: orgId,
          type: "lead_converted",
          title: `Prospect converted to client ${client.company_name} after product demo`,
          lead_id: payload.leadId,
          client_id: client.id,
          actor_member_id: ws?.memberId ?? null,
          actor_name: ws?.fullName ?? null,
        });
      }

      return client;
    },
    onSuccess: (client) => {
      toast.success(`${client.company_name} added to Clients page!`);
      setConvertDemoTarget(null);
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["clients", orgId] });
      queryClient.invalidateQueries({ queryKey: ["clients-lite", orgId] });
      queryClient.invalidateQueries({ queryKey: ["leads", orgId] });
    },
    onError: (err: any) => toast.error(err.message || "Could not add to clients"),
  });

  // Create / Update Mutations
  const saveMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      subject: string;
      due_at: string;
      meeting_link: string;
      priority: string;
      lead_id: string | null;
      assigned_member_id: string | null;
      notes: string;
    }) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.due_at) throw new Error("Pick a scheduled date and time");

      const dataPayload = {
        organization_id: orgId,
        subject: payload.subject || "Product Demo",
        type: "demo" as const,
        due_at: new Date(payload.due_at).toISOString(),
        priority: payload.priority as "low" | "medium" | "high" | "urgent",
        lead_id: payload.lead_id,
        assigned_member_id: payload.assigned_member_id ?? ws?.memberId ?? null,
        notes: formatNotesWithMeetLink(payload.notes, payload.meeting_link),
      };

      if (payload.id) {
        const { error } = await supabase
          .from("follow_ups")
          .update(dataPayload)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follow_ups").insert({
          ...dataPayload,
          status: "pending",
          created_by: ws?.memberId ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      toast.success(vars.id ? "Demo updated successfully" : "Product demo scheduled!");
      setOpen(false);
      setEditRow(null);
      invalidateAll();
    },
    onError: (err: any) => toast.error(err.message || "Could not save demo meeting"),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["demos", orgId] });
    queryClient.invalidateQueries({ queryKey: ["demo-meta", orgId] });
    queryClient.invalidateQueries({ queryKey: ["follow-ups", orgId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", orgId] });
  }

  function copyMeetLink(link: string) {
    navigator.clipboard.writeText(link);
    toast.success("Google Meet link copied to clipboard!");
  }

  // Filter & Grouping
  const filtered = useMemo(() => {
    const list = demosQuery.data ?? [];
    return list.filter((item) => {
      if (priorityFilter !== ALL && item.priority !== priorityFilter) return false;
      if (ownerFilter !== ALL) {
        if (ownerFilter === "unassigned" ? item.assigned_member_id : item.assigned_member_id !== ownerFilter)
          return false;
      }

      if (search.trim()) {
        const leadLabel = item.lead_id ? leadMap.get(item.lead_id) ?? "" : "";
        const meetUrl = getMeetLink(item) ?? "";
        const haystack = [item.subject, item.notes, leadLabel, meetUrl]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [demosQuery.data, priorityFilter, ownerFilter, search, leadMap]);

  const { overdue, today, upcoming, completed } = useMemo(() => {
    const now = Date.now();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const ov: typeof filtered = [];
    const td: typeof filtered = [];
    const up: typeof filtered = [];
    const cm: typeof filtered = [];

    for (const item of filtered) {
      if (item.status === "completed") {
        cm.push(item);
        continue;
      }
      const due = new Date(item.due_at).getTime();
      if (due < now && due <= endOfToday.getTime()) {
        ov.push(item);
      } else if (due <= endOfToday.getTime()) {
        td.push(item);
      } else {
        up.push(item);
      }
    }

    return { overdue: ov, today: td, upcoming: up, completed: cm };
  }, [filtered]);

  const groups = [
    {
      key: "overdue",
      title: "Overdue Demos",
      tone: "text-rose-600 dark:text-rose-400",
      icon: AlarmClock,
      items: overdue,
      empty: "No overdue product demos requiring reschedule.",
    },
    {
      key: "today",
      title: "Due Today",
      tone: "text-amber-600 dark:text-amber-400",
      icon: Sun,
      items: today,
      empty: "No product demos scheduled for today.",
    },
    {
      key: "upcoming",
      title: "Upcoming Demos",
      tone: "text-indigo-600 dark:text-indigo-400",
      icon: CalendarDays,
      items: upcoming,
      empty: "No upcoming product demos scheduled.",
    },
    {
      key: "completed",
      title: "Completed",
      tone: "text-emerald-600 dark:text-emerald-400",
      icon: CheckCircle2,
      items: completed,
      empty: "No completed product demos recorded.",
    },
  ];

  if (!canView) return <NoAccess what="Demos" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Demos"
        subtitle="Schedule, host, and manage Google Meet product demonstrations for prospective leads."
        actions={
          canManage ? (
            <Button onClick={() => { setEditRow(null); setOpen(true); }} size="sm">
              <Plus className="mr-1.5 size-4" /> Schedule Demo
            </Button>
          ) : null
        }
      />

      {/* KPI Cards (Matching Dashboard UI) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Upcoming Demos"
          value={String(upcoming.length)}
          hint="Scheduled future meetings"
          icon={Video}
          tone="default"
        />
        <KpiCard
          label="Due Today"
          value={String(today.length)}
          hint="Demos scheduled for today"
          icon={CalendarClock}
          tone={today.length > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Completed"
          value={String(completed.length)}
          hint="Successfully hosted demos"
          icon={CheckCircle2}
          tone="default"
        />
        <KpiCard
          label="Overdue"
          value={String(overdue.length)}
          hint="Past due date needing reschedule"
          icon={XCircle}
          tone={overdue.length > 0 ? "danger" : "default"}
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        activeCount={
          (search.trim() ? 1 : 0) +
          (priorityFilter !== ALL ? 1 : 0) +
          (ownerFilter !== ALL ? 1 : 0)
        }
        onReset={() => {
          setSearch("");
          setPriorityFilter(ALL);
          setOwnerFilter(ALL);
        }}
      >
        <SearchFilter
          id="demo-search"
          value={search}
          onChange={setSearch}
          placeholder="Subject, notes, lead name or meet link"
        />
        <SelectFilter
          id="demo-priority-filter"
          label="Priority"
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={PRIORITY_FILTER_OPTIONS}
          allLabel="Any priority"
          width="w-36"
        />
        <SelectFilter
          id="demo-owner-filter"
          label="Host"
          value={ownerFilter}
          onChange={setOwnerFilter}
          options={[
            { id: "unassigned", name: "Unassigned" },
            ...(meta.data?.members ?? []).map((m) => ({ id: m.id, name: m.full_name })),
          ]}
          allLabel="All hosts"
        />
      </FilterBar>

      {/* Main Tabs List */}
      {demosQuery.isLoading && <Skeleton className="h-56" />}

      {!demosQuery.isLoading && (
        <Tabs defaultValue={overdue.length > 0 ? "overdue" : today.length > 0 ? "today" : "upcoming"}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            {groups.map((group) => (
              <TabsTrigger key={group.key} value={group.key} className="gap-1.5">
                <group.icon className={`size-3.5 ${group.tone}`} />
                <span className="truncate">{group.title}</span>
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                  {group.items.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {groups.map((group) => (
            <TabsContent key={group.key} value={group.key} className="mt-4">
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className={`text-base ${group.tone}`}>
                    {group.title}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {group.items.length} demo{group.items.length === 1 ? "" : "s"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.items.length === 0 && <EmptyState message={group.empty} />}
                  {group.items.map((item) => {
                    const meetUrl = getMeetLink(item);
                    const lead = (item.leads as any) || (meta.data?.leads ?? []).find((l) => l.id === item.lead_id);
                    const isConverted = Boolean(lead?.converted_client_id);

                    return (
                      <div
                        key={item.id}
                        className="hover:bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors"
                      >
                        {/* Demo Title & Details */}
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="truncate text-left text-sm font-medium hover:underline flex items-center gap-1.5"
                            onClick={() =>
                              setDetailTarget({
                                id: item.id,
                                subject: item.subject ?? "Product Demo",
                              })
                            }
                          >
                            <Video className="size-4 text-indigo-600 shrink-0" />
                            <span>{item.subject ?? "Product Demo"}</span>
                          </button>
                          <p className="truncate text-xs text-muted-foreground mt-0.5">
                            {item.lead_id ? leadMap.get(item.lead_id) ?? "Lead" : "General Demo"} ·{" "}
                            {formatDateTime(item.due_at)} ({relativeDay(item.due_at)})
                          </p>
                        </div>

                        {/* Actions & Meet Link */}
                        <div className="flex flex-wrap items-center gap-2">
                          {meetUrl && (
                            <div className="flex items-center gap-1">
                              <a
                                href={meetUrl.startsWith("http") ? meetUrl : `https://${meetUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                              >
                                <Video className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>Join Meet</span>
                                <ExternalLink className="size-3 opacity-70" />
                              </a>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-foreground"
                                onClick={() => copyMeetLink(meetUrl)}
                                title="Copy link"
                              >
                                <Copy className="size-3.5" />
                              </Button>
                            </div>
                          )}

                          <Badge variant="outline">Demo</Badge>
                          <Badge variant={item.priority === "urgent" ? "destructive" : "secondary"}>
                            {item.priority}
                          </Badge>

                          {/* Host info */}
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                              {initials(
                                item.assigned_member_id ? memberMap.get(item.assigned_member_id) : null,
                              )}
                            </span>
                            {item.assigned_member_id
                              ? memberMap.get(item.assigned_member_id) ?? "—"
                              : "Unassigned"}
                          </span>

                          {/* Add to Clients Option */}
                          {canConvert && !isConverted && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                              onClick={() => setConvertDemoTarget(item)}
                            >
                              <UserRoundPlus className="size-3.5" /> Add to clients
                            </Button>
                          )}

                          {isConverted && (
                            <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 font-medium">
                              Client Created
                            </Badge>
                          )}

                          {canManage && (
                            <Button size="sm" variant="ghost" onClick={() => { setEditRow(item); setOpen(true); }}>
                              <Pencil className="mr-1 size-3.5" /> Edit
                            </Button>
                          )}

                          {item.status === "pending" && canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={completeMutation.isPending}
                              onClick={() => completeMutation.mutate(item.id)}
                            >
                              <CheckCircle2 className="mr-1 size-3.5 text-emerald-600" /> Complete
                            </Button>
                          )}

                          {item.status !== "pending" && (
                            <>
                              <Badge variant="default" className="bg-emerald-600">
                                {item.status}
                              </Badge>
                              {canManage && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={reopenMutation.isPending}
                                  onClick={() => reopenMutation.mutate(item.id)}
                                >
                                  <RotateCcw className="mr-1 size-3.5" /> Reopen
                                </Button>
                              )}
                            </>
                          )}

                          {canManage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => deleteMutation.mutate(item.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Schedule / Edit Demo Dialog Modal */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditRow(null); }}>
        <DemoFormDialog
          meta={meta.data}
          initial={editRow}
          saving={saveMutation.isPending}
          onSubmit={(payload) => saveMutation.mutate(payload)}
          title={editRow ? "Edit Product Demo" : "Schedule Product Demo"}
          description="Product demos appear on the Demos calendar and Follow-ups schedule linked to the prospect."
          submitLabel={editRow ? "Save changes" : "Schedule Demo"}
        />
      </Dialog>

      {/* Convert Demo Prospect to Client Modal Dialog */}
      <Dialog open={Boolean(convertDemoTarget)} onOpenChange={(o) => !o && setConvertDemoTarget(null)}>
        {convertDemoTarget && (
          <ConvertDemoToClientDialog
            demo={convertDemoTarget}
            members={meta.data?.members ?? []}
            saving={convertDemoToClientMutation.isPending}
            onClose={() => setConvertDemoTarget(null)}
            onSubmit={(payload) => convertDemoToClientMutation.mutate(payload)}
          />
        )}
      </Dialog>

      {/* Detail Drawer */}
      <FollowUpDetailSheet
        target={detailTarget}
        onOpenChange={(o) => !o && setDetailTarget(null)}
        leadName={
          detailTarget
            ? leadMap.get(
                (demosQuery.data ?? []).find((d) => d.id === detailTarget.id)?.lead_id ?? "",
              ) ?? null
            : null
        }
        ownerName={
          detailTarget
            ? memberMap.get(
                (demosQuery.data ?? []).find((d) => d.id === detailTarget.id)?.assigned_member_id ?? "",
              ) ?? null
            : null
        }
        typeLabel="Product Demo"
        canManage={canManage}
        onConvertToClient={
          canConvert && detailTarget
            ? () => {
                const item = (demosQuery.data ?? []).find((d) => d.id === detailTarget.id);
                if (item) {
                  setDetailTarget(null);
                  setConvertDemoTarget(item);
                }
              }
            : undefined
        }
        onEdit={() => {
          const item = (demosQuery.data ?? []).find((d) => d.id === detailTarget?.id);
          if (item) {
            setDetailTarget(null);
            setEditRow(item);
            setOpen(true);
          }
        }}
        onComplete={() => {
          if (detailTarget) {
            completeMutation.mutate(detailTarget.id);
            setDetailTarget(null);
          }
        }}
        onReopen={() => {
          if (detailTarget) {
            reopenMutation.mutate(detailTarget.id);
            setDetailTarget(null);
          }
        }}
      />
    </div>
  );
}

function DemoFormDialog({
  meta,
  saving,
  onSubmit,
  initial,
  title = "Schedule Product Demo",
  description = "Schedule a Google Meet product demo session with a lead.",
  submitLabel = "Schedule Demo",
}: {
  meta: { leads: any[]; members: any[] } | undefined;
  saving: boolean;
  onSubmit: (payload: {
    id?: string;
    subject: string;
    due_at: string;
    meeting_link: string;
    priority: string;
    lead_id: string | null;
    assigned_member_id: string | null;
    notes: string;
  }) => void;
  initial?: any;
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const [subject, setSubject] = useState(initial?.subject ?? "Product Demo");
  const [dueAt, setDueAt] = useState(() => {
    if (initial?.due_at) {
      const d = new Date(initial.due_at);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    const now = new Date();
    now.setHours(now.getHours() + 2, 0, 0, 0);
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [meetingLink, setMeetingLink] = useState(() => getMeetLink(initial) ?? generateMeetLink());
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [leadId, setLeadId] = useState(initial?.lead_id ?? "");
  const [memberId, setMemberId] = useState(initial?.assigned_member_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  useEffect(() => {
    if (initial) {
      setSubject(initial.subject ?? "Product Demo");
      if (initial.due_at) {
        const d = new Date(initial.due_at);
        setDueAt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      }
      setMeetingLink(getMeetLink(initial) ?? generateMeetLink());
      setPriority(initial.priority ?? "medium");
      setLeadId(initial.lead_id ?? "");
      setMemberId(initial.assigned_member_id ?? "");
      setNotes(initial.notes ?? "");
    }
  }, [initial]);

  return (
    <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Video className="size-5 text-indigo-600 dark:text-indigo-400" />
          {title}
        </DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField id="demo-subject" label="Subject" value={subject} onChange={setSubject} />
        </div>
        <TextField
          id="demo-due"
          label="Scheduled Date & Time *"
          type="datetime-local"
          value={dueAt}
          onChange={setDueAt}
        />
        <PickerField
          id="demo-priority"
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={PRIORITY_OPTIONS}
        />

        {/* Google Meet Link Field */}
        <div className="sm:col-span-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Google Meet Link</label>
            <button
              type="button"
              onClick={() => setMeetingLink(generateMeetLink())}
              className="text-xs text-primary hover:underline font-medium"
            >
              Generate Meet Link
            </button>
          </div>
          <Input
            id="demo-meet"
            type="url"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
          />
        </div>

        <PickerField
          id="demo-owner"
          label="Assign Host"
          value={memberId}
          onChange={setMemberId}
          options={(meta?.members ?? []).map((m) => ({ id: m.id, name: m.full_name }))}
        />
        <div className="sm:col-span-2">
          <PickerField
            id="demo-lead"
            label="Associated Lead"
            value={leadId}
            onChange={setLeadId}
            options={(meta?.leads ?? []).map((l) => ({
              id: l.id,
              name: `${l.first_name} ${l.last_name ?? ""}`.trim() + (l.company ? ` · ${l.company}` : ""),
            }))}
          />
        </div>
        <div className="sm:col-span-2">
          <AreaField id="demo-notes" label="Agenda & Notes" value={notes} onChange={setNotes} />
        </div>
      </div>

      <DialogFooter>
        <Button
          disabled={saving}
          onClick={() =>
            onSubmit({
              id: initial?.id,
              subject,
              due_at: dueAt,
              meeting_link: meetingLink,
              priority,
              lead_id: leadId || null,
              assigned_member_id: memberId || null,
              notes,
            })
          }
        >
          {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ConvertDemoToClientDialog({
  demo,
  members,
  saving,
  onClose,
  onSubmit,
}: {
  demo: any;
  members: { id: string; full_name: string }[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    demoId: string;
    leadId: string | null;
    company_name: string;
    contact_person: string;
    email: string;
    phone: string;
    industry: string;
    account_manager_id: string | null;
    notes: string;
    status: string;
  }) => void;
}) {
  const lead = demo.leads as any;
  const leadName = lead ? `${lead.first_name} ${lead.last_name ?? ""}`.trim() : "";

  const [companyName, setCompanyName] = useState(
    lead?.company || leadName || demo.subject || "New Client",
  );
  const [contactPerson, setContactPerson] = useState(leadName);
  const [email, setEmail] = useState(lead?.email ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [industry, setIndustry] = useState(lead?.industry ?? "");
  const [accountManagerId, setAccountManagerId] = useState(
    demo.assigned_member_id ?? lead?.assigned_member_id ?? "",
  );
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState(demo.notes ?? "");

  return (
    <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserRoundPlus className="size-5 text-emerald-600 dark:text-emerald-400" />
          Add to Clients Page
        </DialogTitle>
        <DialogDescription>
          Create an official client profile from this completed product demo session.
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            demoId: demo.id,
            leadId: demo.lead_id ?? null,
            company_name: companyName,
            contact_person: contactPerson,
            email,
            phone,
            industry,
            account_manager_id: accountManagerId || null,
            notes,
            status,
          });
        }}
        className="space-y-4 py-2"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              id="client-company"
              label="Company Name *"
              value={companyName}
              onChange={setCompanyName}
              placeholder="e.g. Acme Corporation"
            />
          </div>
          <TextField
            id="client-contact"
            label="Primary Contact Person"
            value={contactPerson}
            onChange={setContactPerson}
            placeholder="e.g. John Doe"
          />
          <TextField
            id="client-email"
            label="Email Address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="john@example.com"
          />
          <TextField
            id="client-phone"
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="+91 98765 43210"
          />
          <PickerField
            id="client-industry"
            label="Industry"
            value={industry}
            onChange={setIndustry}
            options={INDUSTRY_OPTIONS}
            placeholder="Select industry"
          />
          <PickerField
            id="client-manager"
            label="Account Manager"
            value={accountManagerId}
            onChange={setAccountManagerId}
            options={members.map((m) => ({ id: m.id, name: m.full_name }))}
            placeholder="Select manager"
          />
          <PickerField
            id="client-status"
            label="Client Status"
            value={status}
            onChange={setStatus}
            options={[
              { id: "active", name: "Active" },
              { id: "vip", name: "VIP" },
              { id: "inactive", name: "Inactive" },
            ]}
          />
          <div className="sm:col-span-2">
            <AreaField
              id="client-notes"
              label="Account Notes"
              value={notes}
              onChange={setNotes}
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            <UserRoundPlus className="mr-1.5 size-4" /> Add to Clients Page
          </Button>
        </DialogFooter>
      </form>
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
