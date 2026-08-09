import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlarmClock,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Sun,
  Video,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, NoAccess, PageHeader } from "@/components/crm/page";
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
import { formatDateTime, initials, relativeDay, getMeetLink, formatNotesWithMeetLink } from "@/lib/crm";
import {
  fetchProductLines,
  saveRecordProducts,
  useProducts,
  type ProductLine,
} from "@/hooks/use-products";
import { ProductPicker } from "@/components/crm/product-picker";

export const Route = createFileRoute("/_authenticated/follow-ups")({
  head: () => ({
    meta: [
      { title: "Sales Tasks & Follow-Up Automation — LeadKart CRM" },
      {
        name: "description",
        content:
          "Schedule, track, and complete sales follow-ups: calls, meetings, demos, WhatsApp messages, and payment reminders.",
      },
      { property: "og:title", content: "Sales Tasks & Follow-Up Automation — LeadKart CRM" },
      { property: "og:description", content: "Never miss a customer touchpoint or sales task." },
      { property: "og:url", content: "https://leadkart.lovable.app/follow-ups" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sales Follow-Ups & Reminders — LeadKart CRM" },
    ],
    links: [{ rel: "canonical", href: "https://leadkart.lovable.app/follow-ups" }],
  }),
  component: FollowUpsPage,
});

const TYPE_OPTIONS = [
  { id: "call", name: "Call" },
  { id: "whatsapp", name: "WhatsApp" },
  { id: "email", name: "Email" },
  { id: "meeting", name: "Meeting" },
  { id: "proposal", name: "Proposal" },
  { id: "payment_reminder", name: "Payment reminder" },
  { id: "demo", name: "Demo" },
  { id: "other", name: "Other" },
];

type FollowUpType =
  | "call"
  | "whatsapp"
  | "email"
  | "meeting"
  | "proposal"
  | "payment_reminder"
  | "demo"
  | "other";

type FollowUpRow = {
  id: string;
  type: string;
  due_at: string;
  priority: string;
  status: string;
  subject: string | null;
  notes: string | null;
  outcome: string | null;
  lead_id: string | null;
  assigned_member_id: string | null;
  completed_at: string | null;
};

type FollowUpFormValues = {
  subject: string;
  type: string;
  due_at: string;
  priority: string;
  lead_id: string | null;
  assigned_member_id: string | null;
  notes: string;
  lines?: ProductLine[];
};

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function FollowUpsPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const queryClient = useQueryClient();
  const canManage = can(ws, "followups.manage");
  const canView = can(ws, "followups.view.all") || can(ws, "followups.view.own");

  const [open, setOpen] = useState(false);
  const [editRow, setEditRow] = useState<FollowUpRow | null>(null);
  const [presetType, setPresetType] = useState<string | undefined>(undefined);
  const [detailTarget, setDetailTarget] = useState<FollowUpDetailTarget | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [priorityFilter, setPriorityFilter] = useState(ALL);
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [linkFilter, setLinkFilter] = useState(ALL);

  const meta = useQuery({
    queryKey: ["followup-meta", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const [leads, members] = await Promise.all([
        supabase
          .from("leads")
          .select("id, first_name, last_name, company")
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
      ]);
      return { leads: leads.data ?? [], members: members.data ?? [] };
    },
  });

  const followUps = useQuery({
    queryKey: ["follow-ups", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_ups")
        .select(
          "id, type, due_at, priority, status, subject, notes, outcome, lead_id, assigned_member_id, completed_at",
        )
        .eq("organization_id", orgId!)
        .order("due_at");
      if (error) throw error;
      return data;
    },
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("follow_ups")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Follow-up completed");
      invalidateAll();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["follow-ups", orgId] });
    queryClient.invalidateQueries({ queryKey: ["demos", orgId] });
    queryClient.invalidateQueries({ queryKey: ["follow-up-detail"] });
    queryClient.invalidateQueries({ queryKey: ["lead-detail"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", orgId] });
    queryClient.invalidateQueries({ queryKey: ["record-products"] });
    queryClient.invalidateQueries({ queryKey: ["followup-product-lines"] });
    queryClient.invalidateQueries({ queryKey: ["lead-product-lines"] });
  }

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("follow_ups")
        .update({ status: "pending", completed_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Follow-up reopened");
      invalidateAll();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const updateFollowUp = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: FollowUpFormValues }) => {
      if (!payload.due_at) throw new Error("Pick a due date and time");
      const { error } = await supabase
        .from("follow_ups")
        .update({
          subject: payload.subject || null,
          type: payload.type as FollowUpType,
          due_at: new Date(payload.due_at).toISOString(),
          priority: payload.priority as "low" | "medium" | "high" | "urgent",
          lead_id: payload.lead_id,
          assigned_member_id: payload.assigned_member_id,
          notes: formatNotesWithMeetLink(payload.notes, (payload as any).meeting_link),
        })
        .eq("id", id);
      if (error) throw error;
      if (payload.lines && orgId) {
        await saveRecordProducts(orgId, { follow_up_id: id }, payload.lines);
      }
    },
    onSuccess: () => {
      toast.success("Follow-up updated");
      setEditRow(null);
      invalidateAll();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const createFollowUp = useMutation({
    mutationFn: async (payload: FollowUpFormValues) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.due_at) throw new Error("Pick a due date and time");
      const { data, error } = await supabase
        .from("follow_ups")
        .insert({
        organization_id: orgId,
        created_by: ws?.memberId ?? null,
        subject: payload.subject || null,
        type: payload.type as FollowUpType,
        due_at: new Date(payload.due_at).toISOString(),
        priority: payload.priority as "low" | "medium" | "high" | "urgent",
        lead_id: payload.lead_id,
        assigned_member_id: payload.assigned_member_id ?? ws?.memberId ?? null,
        notes: formatNotesWithMeetLink(payload.notes, (payload as any).meeting_link),
        })
        .select("id")
        .single();
      if (error) throw error;
      if (payload.lines && payload.lines.length > 0) {
        await saveRecordProducts(orgId, { follow_up_id: data.id }, payload.lines);
      }
    },
    onSuccess: () => {
      toast.success("Follow-up scheduled");
      setOpen(false);
      invalidateAll();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not schedule"),
  });

  const memberMap = useMemo(
    () => new Map((meta.data?.members ?? []).map((m) => [m.id, m.full_name])),
    [meta.data],
  );
  const leadMap = useMemo(
    () =>
      new Map(
        (meta.data?.leads ?? []).map((l) => [
          l.id,
          `${l.first_name} ${l.last_name ?? ""}`.trim() + (l.company ? ` · ${l.company}` : ""),
        ]),
      ),
    [meta.data],
  );

  if (ws && !canView) return <NoAccess what="follow-ups" />;

  const allRows = followUps.data ?? [];
  const detailRow = allRows.find((r) => r.id === detailTarget?.id) ?? null;
  const rows = allRows.filter((row) => {
    if (typeFilter !== ALL && row.type !== typeFilter) return false;
    if (priorityFilter !== ALL && row.priority !== priorityFilter) return false;
    if (ownerFilter !== ALL) {
      if (ownerFilter === "unassigned" ? row.assigned_member_id : row.assigned_member_id !== ownerFilter)
        return false;
    }
    if (linkFilter === "lead" && !row.lead_id) return false;
    if (linkFilter === "none" && row.lead_id) return false;
    if (search.trim()) {
      const haystack = [
        row.subject,
        row.notes,
        row.lead_id ? leadMap.get(row.lead_id) ?? "" : "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });
  const pending = rows.filter((r) => r.status === "pending");
  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const overdue = pending.filter((r) => new Date(r.due_at).getTime() < now);
  const today = pending.filter(
    (r) =>
      new Date(r.due_at).getTime() >= now && new Date(r.due_at).getTime() <= endOfToday.getTime(),
  );
  const upcoming = pending.filter((r) => new Date(r.due_at).getTime() > endOfToday.getTime());
  const done = rows.filter((r) => r.status !== "pending").slice(0, 20);

  const groups = [
    {
      key: "overdue",
      title: "Overdue",
      items: overdue,
      icon: AlarmClock,
      tone: "text-destructive",
      empty: "Nothing overdue — you are on top of it.",
    },
    {
      key: "today",
      title: "Due today",
      items: today,
      icon: Sun,
      tone: "text-foreground",
      empty: "Nothing else due today.",
    },
    {
      key: "upcoming",
      title: "Upcoming",
      items: upcoming,
      icon: CalendarDays,
      tone: "text-foreground",
      empty: "No upcoming follow-ups scheduled.",
    },
    {
      key: "done",
      title: "Recently completed",
      items: done,
      icon: CheckCircle2,
      tone: "text-muted-foreground",
      empty: "No completed follow-ups yet.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        subtitle={`${overdue.length} overdue · ${today.length} due today · ${upcoming.length} upcoming`}
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="border-indigo-200 text-indigo-700 dark:text-indigo-300 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                onClick={() => {
                  setEditRow(null);
                  setPresetType("demo");
                  setOpen(true);
                }}
              >
                <Video className="mr-1.5 size-4 text-indigo-600 dark:text-indigo-400" /> Schedule Demo
              </Button>

              <Button
                onClick={() => {
                  setEditRow(null);
                  setPresetType(undefined);
                  setOpen(true);
                }}
              >
                <Plus className="mr-1.5 size-4" /> Schedule follow-up
              </Button>
            </div>
          ) : null
        }
      />

      <FilterBar
        activeCount={
          (search.trim() ? 1 : 0) +
          (typeFilter !== ALL ? 1 : 0) +
          (priorityFilter !== ALL ? 1 : 0) +
          (ownerFilter !== ALL ? 1 : 0) +
          (linkFilter !== ALL ? 1 : 0)
        }
        onReset={() => {
          setSearch("");
          setTypeFilter(ALL);
          setPriorityFilter(ALL);
          setOwnerFilter(ALL);
          setLinkFilter(ALL);
        }}
      >
        <SearchFilter
          id="fu-search"
          value={search}
          onChange={setSearch}
          placeholder="Subject, notes or linked lead"
        />
        <SelectFilter
          id="fu-type-filter"
          label="Type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={TYPE_OPTIONS}
          allLabel="All types"
        />
        <SelectFilter
          id="fu-priority-filter"
          label="Priority"
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={PRIORITY_FILTER_OPTIONS}
          allLabel="Any priority"
          width="w-36"
        />
        <SelectFilter
          id="fu-owner-filter"
          label="Owner"
          value={ownerFilter}
          onChange={setOwnerFilter}
          options={[
            { id: "unassigned", name: "Unassigned" },
            ...(meta.data?.members ?? []).map((m) => ({ id: m.id, name: m.full_name })),
          ]}
          allLabel="All owners"
        />
        <SelectFilter
          id="fu-link-filter"
          label="Linked to"
          value={linkFilter}
          onChange={setLinkFilter}
          options={[
            { id: "lead", name: "A lead" },
            { id: "none", name: "Nothing" },
          ]}
          allLabel="Anything"
        />
      </FilterBar>

      {followUps.isLoading && <Skeleton className="h-56" />}

      {!followUps.isLoading && (
        <Tabs defaultValue={overdue.length > 0 ? "overdue" : "today"}>
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
                      {group.items.length} item{group.items.length === 1 ? "" : "s"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.items.length === 0 && <EmptyState message={group.empty} />}
                  {group.items.map((item) => (
                <div
                  key={item.id}
                  className="hover:bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-colors"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="truncate text-left text-sm font-medium hover:underline"
                      onClick={() =>
                        setDetailTarget({
                          id: item.id,
                          subject:
                            item.subject ??
                            TYPE_OPTIONS.find((t) => t.id === item.type)?.name ??
                            "Follow-up",
                        })
                      }
                    >
                      {item.subject ?? TYPE_OPTIONS.find((t) => t.id === item.type)?.name}
                    </button>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.lead_id ? leadMap.get(item.lead_id) ?? "Lead" : "No linked record"} ·{" "}
                      {formatDateTime(item.due_at)} ({relativeDay(item.due_at)})
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {Boolean(getMeetLink(item)) && (
                      <a
                        href={getMeetLink(item)!.startsWith("http") ? getMeetLink(item)! : `https://${getMeetLink(item)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                      >
                        <Video className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Join Meet</span>
                        <ExternalLink className="size-3 opacity-70" />
                      </a>
                    )}
                    <Badge variant="outline">
                      {TYPE_OPTIONS.find((t) => t.id === item.type)?.name ?? item.type}
                    </Badge>
                    <Badge variant={item.priority === "urgent" ? "destructive" : "secondary"}>
                      {item.priority}
                    </Badge>
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
                    {canManage && (
                      <Button size="sm" variant="ghost" onClick={() => setEditRow(item)}>
                        <Pencil className="mr-1 size-3.5" /> Edit
                      </Button>
                    )}
                    {item.status === "pending" && canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={complete.isPending}
                        onClick={() => complete.mutate(item.id)}
                      >
                        <CheckCircle2 className="mr-1 size-3.5" /> Complete
                      </Button>
                    )}
                    {item.status !== "pending" && (
                      <>
                        <Badge>{item.status}</Badge>
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reopen.isPending}
                            onClick={() => reopen.mutate(item.id)}
                          >
                            <RotateCcw className="mr-1 size-3.5" /> Reopen
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Dialog
        open={open || Boolean(editRow)}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditRow(null);
            setPresetType(undefined);
          }
        }}
      >
        <FollowUpFormDialog
          key={editRow?.id ?? presetType ?? "new"}
          title={editRow ? "Edit follow-up" : presetType === "demo" ? "Schedule Product Demo" : "Schedule follow-up"}
          description={
            presetType === "demo"
              ? "Schedule a Google Meet demo session with a lead."
              : "Follow-ups appear on the dashboard as soon as they are due."
          }
          submitLabel={editRow ? "Save changes" : presetType === "demo" ? "Schedule Demo" : "Schedule"}
          meta={meta.data}
          saving={createFollowUp.isPending || updateFollowUp.isPending}
          initial={
            editRow
              ? {
                  subject: editRow.subject ?? "",
                  type: editRow.type,
                  due_at: toLocalInput(editRow.due_at),
                  meeting_link: getMeetLink(editRow) ?? "",
                  priority: editRow.priority,
                  lead_id: editRow.lead_id,
                  assigned_member_id: editRow.assigned_member_id,
                  notes: editRow.notes ?? "",
                }
              : presetType === "demo"
                ? ({
                    type: "demo",
                    subject: "Product Demo",
                    due_at: "",
                    priority: "medium",
                    meeting_link: generateMeetLink(),
                  } as any)
                : undefined
          }
          followUpId={editRow?.id}
          onSubmit={(payload) => {
            if (editRow) updateFollowUp.mutate({ id: editRow.id, payload });
            else createFollowUp.mutate(payload);
          }}
        />
      </Dialog>

      <FollowUpDetailSheet
        target={detailTarget}
        onOpenChange={(o) => !o && setDetailTarget(null)}
        canManage={canManage}
        leadName={detailRow?.lead_id ? leadMap.get(detailRow.lead_id) ?? "Lead" : null}
        ownerName={
          detailRow?.assigned_member_id ? memberMap.get(detailRow.assigned_member_id) ?? null : null
        }
        typeLabel={
          TYPE_OPTIONS.find((t) => t.id === detailRow?.type)?.name ?? detailRow?.type ?? null
        }
        onEdit={() => {
          if (detailRow) setEditRow(detailRow);
          setDetailTarget(null);
        }}
        onComplete={() => detailRow && complete.mutate(detailRow.id)}
        onReopen={() => detailRow && reopen.mutate(detailRow.id)}
      />
    </div>
  );
}

function generateMeetLink() {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `https://meet.google.com/${part1}-${part2}-${part3}`;
}

type FollowUpMeta = {
  leads: { id: string; first_name: string; last_name: string | null; company: string | null }[];
  members: { id: string; full_name: string }[];
};

function FollowUpFormDialog({
  meta,
  saving,
  onSubmit,
  initial,
  followUpId,
  title = "Schedule follow-up",
  description = "Follow-ups appear on the dashboard as soon as they are due.",
  submitLabel = "Schedule",
}: {
  meta: FollowUpMeta | undefined;
  saving: boolean;
  onSubmit: (payload: FollowUpFormValues) => void;
  initial?: FollowUpFormValues | undefined;
  followUpId?: string | undefined;
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const [subject, setSubject] = useState(initial?.subject ?? (initial?.type === "demo" ? "Product Demo" : ""));
  const [type, setType] = useState(initial?.type ?? "call");
  const [dueAt, setDueAt] = useState(initial?.due_at ?? "");
  const [meetingLink, setMeetingLink] = useState((initial as any)?.meeting_link || (initial?.type === "demo" ? generateMeetLink() : ""));
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [leadId, setLeadId] = useState(initial?.lead_id ?? "");
  const [memberId, setMemberId] = useState(initial?.assigned_member_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const { data: ws } = useWorkspace();

  useEffect(() => {
    if (initial) {
      setSubject(initial.subject ?? (initial.type === "demo" ? "Product Demo" : ""));
      setType(initial.type ?? "call");
      setDueAt(initial.due_at ?? "");
      setMeetingLink((initial as any)?.meeting_link || (initial.type === "demo" ? generateMeetLink() : ""));
      setPriority(initial.priority ?? "medium");
      setLeadId(initial.lead_id ?? "");
      setMemberId(initial.assigned_member_id ?? "");
      setNotes(initial.notes ?? "");
    }
  }, [initial]);
  const products = useProducts(ws?.organizationId);
  const [lines, setLines] = useState<ProductLine[]>([]);

  const existingLines = useQuery({
    queryKey: ["followup-product-lines", followUpId],
    enabled: Boolean(followUpId),
    queryFn: () => fetchProductLines({ follow_up_id: followUpId! }),
  });

  const leadLines = useQuery({
    queryKey: ["lead-product-lines", leadId],
    enabled: Boolean(leadId) && !followUpId,
    queryFn: () => fetchProductLines({ lead_id: leadId }),
  });

  useEffect(() => {
    if (existingLines.data) setLines(existingLines.data);
  }, [existingLines.data]);

  useEffect(() => {
    if (!followUpId && leadLines.data && leadLines.data.length > 0) setLines(leadLines.data);
  }, [followUpId, leadLines.data]);

  return (
    <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField id="fu-subject" label="Subject" value={subject} onChange={setSubject} />
        </div>
        <PickerField
          id="fu-type"
          label="Type"
          value={type}
          onChange={(v) => {
            setType(v);
            if (v === "demo" && !meetingLink) {
              const chars = "abcdefghijklmnopqrstuvwxyz";
              const p1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
              const p2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
              const p3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
              setMeetingLink(`https://meet.google.com/${p1}-${p2}-${p3}`);
            }
          }}
          options={TYPE_OPTIONS}
        />
        <TextField
          id="fu-due"
          label="Due at"
          type="datetime-local"
          value={dueAt}
          onChange={setDueAt}
        />

        {/* Google Meet Link Field */}
        <div className="sm:col-span-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Google Meet Link</label>
            <button
              type="button"
              onClick={() => {
                const chars = "abcdefghijklmnopqrstuvwxyz";
                const p1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
                const p2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
                const p3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
                setMeetingLink(`https://meet.google.com/${p1}-${p2}-${p3}`);
              }}
              className="text-xs text-primary hover:underline font-medium"
            >
              Generate Link
            </button>
          </div>
          <Input
            id="fu-meet"
            type="url"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
          />
        </div>

        <PickerField
          id="fu-priority"
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={PRIORITY_OPTIONS}
        />
        <PickerField
          id="fu-owner"
          label="Assign to"
          value={memberId}
          onChange={setMemberId}
          options={(meta?.members ?? []).map((m) => ({ id: m.id, name: m.full_name }))}
        />
        <div className="sm:col-span-2">
          <PickerField
            id="fu-lead"
            label="Related lead"
            value={leadId}
            onChange={setLeadId}
            options={(meta?.leads ?? []).map((l) => ({
              id: l.id,
              name: `${l.first_name} ${l.last_name ?? ""}`.trim() + (l.company ? ` · ${l.company}` : ""),
            }))}
          />
        </div>
        <div className="sm:col-span-2">
          <AreaField id="fu-notes" label="Notes" value={notes} onChange={setNotes} />
        </div>
        <div className="sm:col-span-2">
          <ProductPicker
            products={products.data ?? []}
            lines={lines}
            onChange={setLines}
            symbol={ws?.currencySymbol ?? "₹"}
            label="Services / products to discuss"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          disabled={saving}
          onClick={() =>
            onSubmit({
              subject,
              type,
              due_at: dueAt,
              meeting_link: meetingLink || null,
              priority,
              lead_id: leadId || null,
              assigned_member_id: memberId || null,
              notes,
              lines,
            } as any)
          }
        >
          {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}