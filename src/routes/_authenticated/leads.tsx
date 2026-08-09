import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  CalendarClock,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserRoundPlus,
} from "lucide-react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, NoAccess, PageHeader } from "@/components/crm/page";
import { LeadDetailSheet, type LeadDetailTarget } from "@/components/crm/lead-detail";
import { AreaField, PRIORITY_OPTIONS, PickerField, TextField } from "@/components/crm/fields";
import {
  ALL,
  DateFilter,
  FilterBar,
  NumberFilter,
  PRIORITY_FILTER_OPTIONS,
  SearchFilter,
  SelectFilter,
} from "@/components/crm/filters";
import { can, useWorkspace } from "@/hooks/use-workspace";
import { formatMoney, formatDate, formatDateTime, initials } from "@/lib/crm";
import {
  fetchProductLines,
  saveRecordProducts,
  useProducts,
  type ProductLine,
} from "@/hooks/use-products";
import { ProductPicker } from "@/components/crm/product-picker";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Zenith CRM" },
      {
        name: "description",
        content:
          "Capture, filter, qualify and convert sales leads with status, source, priority, owner and follow-up tracking.",
      },
      { property: "og:title", content: "Leads — Zenith CRM" },
      {
        property: "og:description",
        content: "Filter, qualify, convert and follow up on every sales lead.",
      },
    ],
  }),
  component: LeadsPage,
});

const leadSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().max(80).optional(),
  company: z.string().trim().max(120).optional(),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]),
  phone: z.string().trim().max(20).optional(),
  estimated_value: z.coerce.number().min(0).max(1_000_000_000),
  notes: z.string().trim().max(1000).optional(),
});

type LeadValues = z.infer<typeof leadSchema>;
type LeadPatch = {
  first_name?: string;
  last_name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  estimated_value?: number;
  notes?: string | null;
  status_id?: string | null;
  source_id?: string | null;
  assigned_member_id?: string | null;
  priority?: Priority;
};
type Priority = "low" | "medium" | "high" | "urgent";

type LeadRow = {
  id: string;
  lead_number: string | null;
  first_name: string;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  estimated_value: number | null;
  priority: string;
  status_id: string | null;
  source_id: string | null;
  next_followup_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
  assigned_member_id: string | null;
  converted_client_id: string | null;
  notes: string | null;
};

const CREATED_WINDOWS = [
  { id: "7", name: "Last 7 days" },
  { id: "30", name: "Last 30 days" },
  { id: "90", name: "Last 90 days" },
];

const FOLLOWUP_FILTERS = [
  { id: "overdue", name: "Follow-up overdue" },
  { id: "today", name: "Due today" },
  { id: "upcoming", name: "Upcoming" },
  { id: "none", name: "No follow-up set" },
];

const CONVERSION_FILTERS = [
  { id: "converted", name: "Converted to client" },
  { id: "open", name: "Not converted" },
];

const SORTS = [
  { id: "created_desc", name: "Newest first" },
  { id: "created_asc", name: "Oldest first" },
  { id: "value_desc", name: "Highest value" },
  { id: "value_asc", name: "Lowest value" },
  { id: "name_asc", name: "Name A–Z" },
];

const FOLLOWUP_TYPES = [
  { id: "call", name: "Call" },
  { id: "whatsapp", name: "WhatsApp" },
  { id: "email", name: "Email" },
  { id: "meeting", name: "Meeting" },
  { id: "proposal", name: "Proposal" },
  { id: "demo", name: "Demo" },
  { id: "other", name: "Other" },
];

function leadName(lead: LeadRow) {
  return `${lead.first_name} ${lead.last_name ?? ""}`.trim();
}

function LeadsPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const queryClient = useQueryClient();
  const symbol = ws?.currencySymbol ?? "₹";

  const canView = can(ws, "leads.view.all") || can(ws, "leads.view.own");
  const canCreate = can(ws, "leads.create");
  const canUpdate = can(ws, "leads.update");
  const canDelete = can(ws, "leads.delete");
  const canConvert = can(ws, "leads.convert") && can(ws, "clients.manage");
  const canFollowUp = can(ws, "followups.manage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [sourceFilter, setSourceFilter] = useState(ALL);
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [priorityFilter, setPriorityFilter] = useState(ALL);
  const [followUpFilter, setFollowUpFilter] = useState(ALL);
  const [conversionFilter, setConversionFilter] = useState(ALL);
  const [createdWindow, setCreatedWindow] = useState(ALL);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("created_desc");

  const [open, setOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadRow | null>(null);
  const [convertLead, setConvertLead] = useState<LeadRow | null>(null);
  const [followUpLead, setFollowUpLead] = useState<LeadRow | null>(null);
  const [detailLead, setDetailLead] = useState<LeadRow | null>(null);

  const meta = useQuery({
    queryKey: ["lead-meta", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const [statuses, sources, members] = await Promise.all([
        supabase
          .from("lead_statuses")
          .select("id, name, color, sort_order, is_won, is_lost")
          .order("sort_order"),
        supabase.from("lead_sources").select("id, name").order("sort_order"),
        supabase
          .from("organization_members")
          .select("id, full_name, role")
          .eq("status", "active")
          .order("full_name"),
      ]);
      return {
        statuses: statuses.data ?? [],
        sources: sources.data ?? [],
        members: members.data ?? [],
      };
    },
  });

  const leads = useQuery({
    queryKey: ["leads", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, lead_number, first_name, last_name, company, email, phone, industry, estimated_value, priority, status_id, source_id, next_followup_at, last_contacted_at, created_at, assigned_member_id, converted_client_id, notes",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadRow[];
    },
  });

  const createLead = useMutation({
    mutationFn: async (payload: {
      values: LeadValues;
      status_id: string | null;
      source_id: string | null;
      assigned_member_id: string | null;
      priority: string;
      lines: ProductLine[];
    }) => {
      if (!orgId) throw new Error("Workspace not ready");
      const { values } = payload;
      const { data, error } = await supabase
        .from("leads")
        .insert({
        organization_id: orgId,
        created_by: ws?.memberId ?? null,
        first_name: values.first_name,
        last_name: values.last_name || null,
        company: values.company || null,
        email: values.email || null,
        phone: values.phone || null,
        estimated_value: values.estimated_value,
        notes: values.notes || null,
        status_id: payload.status_id,
        source_id: payload.source_id,
        assigned_member_id: payload.assigned_member_id,
        priority: payload.priority as Priority,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (payload.lines.length > 0) {
        await saveRecordProducts(orgId, { lead_id: data.id }, payload.lines);
      }
    },
    onSuccess: () => {
      toast.success("Lead created");
      setOpen(false);
      invalidateLeads();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save lead"),
  });

  const updateLead = useMutation({
    mutationFn: async ({
      id,
      patch,
      lines,
    }: {
      id: string;
      patch: LeadPatch;
      lines?: ProductLine[];
    }) => {
      const { error } = await supabase.from("leads").update(patch).eq("id", id);
      if (error) throw error;
      if (lines && orgId) await saveRecordProducts(orgId, { lead_id: id }, lines);
    },
    onSuccess: () => {
      toast.success("Lead updated");
      setEditLead(null);
      invalidateLeads();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const removeLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("leads")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead archived");
      invalidateLeads();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not archive"),
  });

  const convert = useMutation({
    mutationFn: async (payload: {
      lead: LeadRow;
      company_name: string;
      contact_person: string;
      phone: string;
      email: string;
      industry: string;
      status: string;
      notes: string;
    }) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.company_name.trim()) throw new Error("Company name is required");

      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          organization_id: orgId,
          created_by: ws?.memberId ?? null,
          company_name: payload.company_name.trim(),
          contact_person: payload.contact_person || null,
          phone: payload.phone || null,
          email: payload.email || null,
          industry: payload.industry || null,
          account_manager_id: payload.lead.assigned_member_id,
          notes: payload.notes || null,
          status: payload.status as "active" | "inactive" | "vip" | "at_risk" | "lost",
        })
        .select("id, company_name, client_code")
        .single();
      if (error) throw error;

      const wonStatus = (meta.data?.statuses ?? []).find((s) => s.is_won);
      const { error: leadError } = await supabase
        .from("leads")
        .update({
          converted_client_id: client.id,
          converted_at: new Date().toISOString(),
          status_id: wonStatus?.id ?? payload.lead.status_id,
        })
        .eq("id", payload.lead.id);
      if (leadError) throw leadError;

      await supabase.from("activities").insert({
        organization_id: orgId,
        type: "lead_converted",
        title: `${leadName(payload.lead)} converted to client ${client.company_name}`,
        lead_id: payload.lead.id,
        client_id: client.id,
        actor_member_id: ws?.memberId ?? null,
        actor_name: ws?.fullName ?? null,
      });

      return client;
    },
    onSuccess: (client) => {
      toast.success(`${client.company_name} added to clients`);
      setConvertLead(null);
      invalidateLeads();
      queryClient.invalidateQueries({ queryKey: ["clients", orgId] });
      queryClient.invalidateQueries({ queryKey: ["clients-lite", orgId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not convert lead"),
  });

  const scheduleFollowUp = useMutation({
    mutationFn: async (payload: {
      lead: LeadRow;
      subject: string;
      type: string;
      due_at: string;
      priority: string;
      assigned_member_id: string | null;
      notes: string;
    }) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.due_at) throw new Error("Pick a due date and time");
      const dueIso = new Date(payload.due_at).toISOString();

      const { error } = await supabase.from("follow_ups").insert({
        organization_id: orgId,
        created_by: ws?.memberId ?? null,
        lead_id: payload.lead.id,
        subject: payload.subject || `Follow up with ${leadName(payload.lead)}`,
        type: payload.type as
          | "call"
          | "whatsapp"
          | "email"
          | "meeting"
          | "proposal"
          | "payment_reminder"
          | "demo"
          | "other",
        due_at: dueIso,
        priority: payload.priority as Priority,
        assigned_member_id:
          payload.assigned_member_id ?? payload.lead.assigned_member_id ?? ws?.memberId ?? null,
        notes: payload.notes || null,
        status: "pending",
      });
      if (error) throw error;

      const current = payload.lead.next_followup_at
        ? new Date(payload.lead.next_followup_at).getTime()
        : null;
      if (!current || new Date(dueIso).getTime() < current) {
        await supabase.from("leads").update({ next_followup_at: dueIso }).eq("id", payload.lead.id);
      }
    },
    onSuccess: () => {
      toast.success("Follow-up scheduled");
      setFollowUpLead(null);
      invalidateLeads();
      queryClient.invalidateQueries({ queryKey: ["follow-ups", orgId] });
      queryClient.invalidateQueries({ queryKey: ["followup-meta", orgId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not schedule follow-up"),
  });

  function invalidateLeads() {
    queryClient.invalidateQueries({ queryKey: ["leads", orgId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", orgId] });
    queryClient.invalidateQueries({ queryKey: ["record-products"] });
    queryClient.invalidateQueries({ queryKey: ["lead-product-lines"] });
  }

  const statusMap = useMemo(
    () => new Map((meta.data?.statuses ?? []).map((s) => [s.id, s])),
    [meta.data],
  );
  const memberMap = useMemo(
    () => new Map((meta.data?.members ?? []).map((m) => [m.id, m])),
    [meta.data],
  );
  const sourceMap = useMemo(
    () => new Map((meta.data?.sources ?? []).map((s) => [s.id, s])),
    [meta.data],
  );

  const now = Date.now();
  const endOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }, []);

  const filtered = useMemo(() => {
    const rows = (leads.data ?? []).filter((lead) => {
      if (statusFilter !== ALL && lead.status_id !== statusFilter) return false;
      if (sourceFilter !== ALL && lead.source_id !== sourceFilter) return false;
      if (ownerFilter !== ALL) {
        if (ownerFilter === "unassigned" ? lead.assigned_member_id : lead.assigned_member_id !== ownerFilter)
          return false;
      }
      if (priorityFilter !== ALL && lead.priority !== priorityFilter) return false;

      if (conversionFilter === "converted" && !lead.converted_client_id) return false;
      if (conversionFilter === "open" && lead.converted_client_id) return false;

      if (followUpFilter !== ALL) {
        const due = lead.next_followup_at ? new Date(lead.next_followup_at).getTime() : null;
        if (followUpFilter === "none" && due) return false;
        if (followUpFilter === "overdue" && (!due || due >= now)) return false;
        if (followUpFilter === "today" && (!due || due < now || due > endOfToday)) return false;
        if (followUpFilter === "upcoming" && (!due || due <= endOfToday)) return false;
      }

      const value = Number(lead.estimated_value ?? 0);
      if (minValue.trim() && value < Number(minValue)) return false;
      if (maxValue.trim() && value > Number(maxValue)) return false;

      const created = new Date(lead.created_at).getTime();
      if (createdWindow !== ALL && created < now - Number(createdWindow) * 86400000) return false;
      if (fromDate && created < new Date(`${fromDate}T00:00:00`).getTime()) return false;
      if (toDate && created > new Date(`${toDate}T23:59:59`).getTime()) return false;

      if (search.trim()) {
        const haystack = [
          lead.first_name,
          lead.last_name,
          lead.company,
          lead.email,
          lead.phone,
          lead.lead_number,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });

    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "created_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "value_desc":
          return Number(b.estimated_value ?? 0) - Number(a.estimated_value ?? 0);
        case "value_asc":
          return Number(a.estimated_value ?? 0) - Number(b.estimated_value ?? 0);
        case "name_asc":
          return leadName(a).localeCompare(leadName(b));
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return sorted;
  }, [
    leads.data,
    statusFilter,
    sourceFilter,
    ownerFilter,
    priorityFilter,
    conversionFilter,
    followUpFilter,
    minValue,
    maxValue,
    createdWindow,
    fromDate,
    toDate,
    search,
    sort,
    now,
    endOfToday,
  ]);

  const activeFilters = [
    search.trim() ? 1 : 0,
    statusFilter !== ALL ? 1 : 0,
    sourceFilter !== ALL ? 1 : 0,
    ownerFilter !== ALL ? 1 : 0,
    priorityFilter !== ALL ? 1 : 0,
    followUpFilter !== ALL ? 1 : 0,
    conversionFilter !== ALL ? 1 : 0,
    createdWindow !== ALL ? 1 : 0,
    minValue.trim() ? 1 : 0,
    maxValue.trim() ? 1 : 0,
    fromDate ? 1 : 0,
    toDate ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  function resetFilters() {
    setSearch("");
    setStatusFilter(ALL);
    setSourceFilter(ALL);
    setOwnerFilter(ALL);
    setPriorityFilter(ALL);
    setFollowUpFilter(ALL);
    setConversionFilter(ALL);
    setCreatedWindow(ALL);
    setMinValue("");
    setMaxValue("");
    setFromDate("");
    setToDate("");
  }

  if (ws && !canView) return <NoAccess what="leads" />;

  const pipelineValue = filtered.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
  const convertedCount = filtered.filter((l) => l.converted_client_id).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle={`${filtered.length} of ${leads.data?.length ?? 0} leads · ${formatMoney(pipelineValue, symbol)} estimated · ${convertedCount} converted`}
        actions={
          canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 size-4" /> New lead
                </Button>
              </DialogTrigger>
              <LeadFormDialog
                title="New lead"
                description="Added to your organisation only — tenant isolation is enforced by the database."
                meta={meta.data}
                saving={createLead.isPending}
                onSubmit={(payload) => createLead.mutate(payload)}
              />
            </Dialog>
          ) : null
        }
      />

      <FilterBar onReset={resetFilters} activeCount={activeFilters}>
        <SearchFilter
          id="lead-search"
          value={search}
          onChange={setSearch}
          placeholder="Name, company, email, phone or lead number"
        />
        <SelectFilter
          id="lead-status-filter"
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={(meta.data?.statuses ?? []).map((s) => ({ id: s.id, name: s.name }))}
          allLabel="All statuses"
        />
        <SelectFilter
          id="lead-source-filter"
          label="Source"
          value={sourceFilter}
          onChange={setSourceFilter}
          options={meta.data?.sources ?? []}
          allLabel="All sources"
        />
        <SelectFilter
          id="lead-owner-filter"
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
          id="lead-priority-filter"
          label="Priority"
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={PRIORITY_FILTER_OPTIONS}
          allLabel="Any priority"
          width="w-36"
        />
        <SelectFilter
          id="lead-followup-filter"
          label="Follow-up"
          value={followUpFilter}
          onChange={setFollowUpFilter}
          options={FOLLOWUP_FILTERS}
          allLabel="Any follow-up"
        />
        <SelectFilter
          id="lead-conversion-filter"
          label="Conversion"
          value={conversionFilter}
          onChange={setConversionFilter}
          options={CONVERSION_FILTERS}
          allLabel="All leads"
        />
        <SelectFilter
          id="lead-created-filter"
          label="Created"
          value={createdWindow}
          onChange={setCreatedWindow}
          options={CREATED_WINDOWS}
          allLabel="Any time"
          width="w-36"
        />
        <NumberFilter id="lead-min-value" label="Min value" value={minValue} onChange={setMinValue} />
        <NumberFilter id="lead-max-value" label="Max value" value={maxValue} onChange={setMaxValue} />
        <DateFilter id="lead-from" label="From" value={fromDate} onChange={setFromDate} />
        <DateFilter id="lead-to" label="To" value={toDate} onChange={setToDate} />
        <div className="w-40 space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="lead-sort">
            Sort
          </label>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger id="lead-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All leads</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {leads.isLoading && <Skeleton className="mx-6 h-40" />}
          {leads.data && filtered.length === 0 && (
            <EmptyState message="No leads match your filters." />
          )}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Next follow-up</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead) => {
                    const status = lead.status_id ? statusMap.get(lead.status_id) : null;
                    const owner = lead.assigned_member_id
                      ? memberMap.get(lead.assigned_member_id)
                      : null;
                    return (
                      <TableRow key={lead.id} className="hover:bg-muted/50">
                        <TableCell
                          className="cursor-pointer"
                          onClick={() => setDetailLead(lead)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setDetailLead(lead);
                          }}
                        >
                          <p className="font-medium">
                            {leadName(lead)}
                            {lead.converted_client_id && (
                              <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
                                Client
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lead.company ?? "—"} · {lead.lead_number}
                          </p>
                        </TableCell>
                        <TableCell>
                          {canUpdate ? (
                            <Select
                              value={lead.status_id ?? ""}
                              onValueChange={(status_id) =>
                                updateLead.mutate({ id: lead.id, patch: { status_id } })
                              }
                            >
                              <SelectTrigger
                                className="h-8 w-40 text-xs"
                                aria-label={`Change status of ${leadName(lead)}`}
                              >
                                <SelectValue placeholder="Set status" />
                              </SelectTrigger>
                              <SelectContent>
                                {(meta.data?.statuses ?? []).map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : status ? (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
                              style={{ borderColor: status.color, color: status.color }}
                            >
                              <span
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: status.color }}
                              />
                              {status.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lead.source_id ? sourceMap.get(lead.source_id)?.name ?? "—" : "—"}
                        </TableCell>
                        <TableCell>
                          {owner ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                                {initials(owner.full_name)}
                              </span>
                              {owner.full_name}
                            </span>
                          ) : (
                            <Badge variant="outline">Unassigned</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(lead.estimated_value, symbol)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lead.next_followup_at ? formatDateTime(lead.next_followup_at) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for ${leadName(lead)}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>{leadName(lead)}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => setDetailLead(lead)}>
                                <Eye className="mr-2 size-3.5" /> View details
                              </DropdownMenuItem>
                              {canUpdate && (
                                <DropdownMenuItem onSelect={() => setEditLead(lead)}>
                                  <Pencil className="mr-2 size-3.5" /> Edit lead
                                </DropdownMenuItem>
                              )}
                              {canFollowUp && (
                                <DropdownMenuItem onSelect={() => setFollowUpLead(lead)}>
                                  <CalendarClock className="mr-2 size-3.5" /> Schedule follow-up
                                </DropdownMenuItem>
                              )}
                              {canConvert && !lead.converted_client_id && (
                                <DropdownMenuItem onSelect={() => setConvertLead(lead)}>
                                  <UserRoundPlus className="mr-2 size-3.5" /> Add to clients
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onSelect={() => removeLead.mutate(lead.id)}
                                  >
                                    <Trash2 className="mr-2 size-3.5" /> Archive lead
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editLead)} onOpenChange={(next) => !next && setEditLead(null)}>
        {editLead && (
          <LeadFormDialog
            title={`Edit ${leadName(editLead)}`}
            description={`Created ${formatDate(editLead.created_at)} · ${editLead.lead_number ?? ""}`}
            meta={meta.data}
            initial={editLead}
            saving={updateLead.isPending}
            onSubmit={(payload) =>
              updateLead.mutate({
                id: editLead.id,
                lines: payload.lines,
                patch: {
                  first_name: payload.values.first_name,
                  last_name: payload.values.last_name || null,
                  company: payload.values.company || null,
                  email: payload.values.email || null,
                  phone: payload.values.phone || null,
                  estimated_value: payload.values.estimated_value,
                  notes: payload.values.notes || null,
                  status_id: payload.status_id,
                  source_id: payload.source_id,
                  assigned_member_id: payload.assigned_member_id,
                  priority: payload.priority as Priority,
                },
              })
            }
          />
        )}
      </Dialog>

      <Dialog open={Boolean(convertLead)} onOpenChange={(next) => !next && setConvertLead(null)}>
        {convertLead && (
          <ConvertDialog
            lead={convertLead}
            saving={convert.isPending}
            onSubmit={(payload) => convert.mutate({ lead: convertLead, ...payload })}
          />
        )}
      </Dialog>

      <Dialog open={Boolean(followUpLead)} onOpenChange={(next) => !next && setFollowUpLead(null)}>
        {followUpLead && (
          <LeadFollowUpDialog
            lead={followUpLead}
            members={(meta.data?.members ?? []).map((m) => ({ id: m.id, name: m.full_name }))}
            saving={scheduleFollowUp.isPending}
            onSubmit={(payload) => scheduleFollowUp.mutate({ lead: followUpLead, ...payload })}
          />
        )}
      </Dialog>

      <LeadDetailSheet
        target={
          detailLead
            ? ({
                id: detailLead.id,
                name: leadName(detailLead),
                lead_number: detailLead.lead_number,
              } satisfies LeadDetailTarget)
            : null
        }
        onOpenChange={(next) => !next && setDetailLead(null)}
        statusName={detailLead?.status_id ? statusMap.get(detailLead.status_id)?.name : null}
        sourceName={detailLead?.source_id ? sourceMap.get(detailLead.source_id)?.name : null}
        ownerName={
          detailLead?.assigned_member_id
            ? memberMap.get(detailLead.assigned_member_id)?.full_name
            : null
        }
        canUpdate={canUpdate}
        canFollowUp={canFollowUp}
        canConvert={canConvert}
        onEdit={() => {
          const lead = detailLead;
          setDetailLead(null);
          setEditLead(lead);
        }}
        onScheduleFollowUp={() => {
          const lead = detailLead;
          setDetailLead(null);
          setFollowUpLead(lead);
        }}
        onConvert={() => {
          const lead = detailLead;
          setDetailLead(null);
          setConvertLead(lead);
        }}
      />
    </div>
  );
}

type Meta = {
  statuses: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  members: { id: string; full_name: string }[];
};

type LeadFormPayload = {
  values: LeadValues;
  status_id: string | null;
  source_id: string | null;
  assigned_member_id: string | null;
  priority: string;
  lines: ProductLine[];
};

function LeadFormDialog({
  title,
  description,
  meta,
  initial,
  saving,
  onSubmit,
}: {
  title: string;
  description: string;
  meta: Meta | undefined;
  initial?: LeadRow;
  saving: boolean;
  onSubmit: (payload: LeadFormPayload) => void;
}) {
  const [form, setForm] = useState({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    company: initial?.company ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    estimated_value: String(initial?.estimated_value ?? 0),
    notes: initial?.notes ?? "",
  });
  const [statusId, setStatusId] = useState(initial?.status_id ?? "");
  const [sourceId, setSourceId] = useState(initial?.source_id ?? "");
  const [memberId, setMemberId] = useState(initial?.assigned_member_id ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const { data: ws } = useWorkspace();
  const products = useProducts(ws?.organizationId);
  const [lines, setLines] = useState<ProductLine[]>([]);

  const existingLines = useQuery({
    queryKey: ["lead-product-lines", initial?.id],
    enabled: Boolean(initial?.id),
    queryFn: () => fetchProductLines({ lead_id: initial!.id }),
  });

  useEffect(() => {
    if (existingLines.data) setLines(existingLines.data);
  }, [existingLines.data]);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    const parsed = leadSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    onSubmit({
      values: parsed.data,
      status_id: statusId || null,
      source_id: sourceId || null,
      assigned_member_id: memberId || null,
      priority,
      lines,
    });
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="lead-first-name"
          label="First name"
          value={form.first_name}
          onChange={(v) => set("first_name", v)}
        />
        <TextField
          id="lead-last-name"
          label="Last name"
          value={form.last_name}
          onChange={(v) => set("last_name", v)}
        />
        <TextField
          id="lead-company"
          label="Company"
          value={form.company}
          onChange={(v) => set("company", v)}
        />
        <TextField
          id="lead-phone"
          label="Phone"
          value={form.phone}
          onChange={(v) => set("phone", v)}
        />
        <div className="sm:col-span-2">
          <TextField
            id="lead-email"
            label="Email"
            value={form.email}
            onChange={(v) => set("email", v)}
            type="email"
          />
        </div>
        <TextField
          id="lead-value"
          label="Estimated value"
          value={form.estimated_value}
          onChange={(v) => set("estimated_value", v)}
          type="number"
        />
        <PickerField
          id="lead-priority"
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={PRIORITY_OPTIONS}
        />
        <PickerField
          id="lead-status"
          label="Status"
          value={statusId}
          onChange={setStatusId}
          options={meta?.statuses ?? []}
        />
        <PickerField
          id="lead-source"
          label="Source"
          value={sourceId}
          onChange={setSourceId}
          options={meta?.sources ?? []}
        />
        <div className="sm:col-span-2">
          <PickerField
            id="lead-owner"
            label="Assign to"
            value={memberId}
            onChange={setMemberId}
            options={(meta?.members ?? []).map((m) => ({ id: m.id, name: m.full_name }))}
          />
        </div>
        <div className="sm:col-span-2">
          <AreaField
            id="lead-notes"
            label="Notes"
            value={form.notes}
            onChange={(v) => set("notes", v)}
          />
        </div>
        <div className="sm:col-span-2">
          <ProductPicker
            products={products.data ?? []}
            lines={lines}
            onChange={setLines}
            symbol={ws?.currencySymbol ?? "₹"}
            label="Interested in (services / products)"
          />
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Save lead
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

const CLIENT_STATUSES = [
  { id: "active", name: "Active" },
  { id: "vip", name: "VIP" },
  { id: "inactive", name: "Inactive" },
  { id: "at_risk", name: "At risk" },
];

function ConvertDialog({
  lead,
  saving,
  onSubmit,
}: {
  lead: LeadRow;
  saving: boolean;
  onSubmit: (payload: {
    company_name: string;
    contact_person: string;
    phone: string;
    email: string;
    industry: string;
    status: string;
    notes: string;
  }) => void;
}) {
  const [companyName, setCompanyName] = useState(lead.company ?? leadName(lead));
  const [contact, setContact] = useState(leadName(lead));
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [industry, setIndustry] = useState(lead.industry ?? "");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState(lead.notes ?? "");

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add {leadName(lead)} to clients</DialogTitle>
        <DialogDescription>
          Creates a client record, links it back to this lead and marks the lead as won.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField
            id="convert-company"
            label="Company name"
            value={companyName}
            onChange={setCompanyName}
          />
        </div>
        <TextField
          id="convert-contact"
          label="Contact person"
          value={contact}
          onChange={setContact}
        />
        <TextField id="convert-phone" label="Phone" value={phone} onChange={setPhone} />
        <TextField id="convert-email" label="Email" type="email" value={email} onChange={setEmail} />
        <TextField
          id="convert-industry"
          label="Industry"
          value={industry}
          onChange={setIndustry}
        />
        <div className="sm:col-span-2">
          <PickerField
            id="convert-status"
            label="Client status"
            value={status}
            onChange={setStatus}
            options={CLIENT_STATUSES}
          />
        </div>
        <div className="sm:col-span-2">
          <AreaField id="convert-notes" label="Notes" value={notes} onChange={setNotes} />
        </div>
      </div>

      <DialogFooter>
        <Button
          disabled={saving}
          onClick={() =>
            onSubmit({
              company_name: companyName,
              contact_person: contact,
              phone,
              email,
              industry,
              status,
              notes,
            })
          }
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Create client
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function LeadFollowUpDialog({
  lead,
  members,
  saving,
  onSubmit,
}: {
  lead: LeadRow;
  members: { id: string; name: string }[];
  saving: boolean;
  onSubmit: (payload: {
    subject: string;
    type: string;
    due_at: string;
    priority: string;
    assigned_member_id: string | null;
    notes: string;
  }) => void;
}) {
  const [subject, setSubject] = useState(`Follow up with ${leadName(lead)}`);
  const [type, setType] = useState("call");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState(lead.priority ?? "medium");
  const [memberId, setMemberId] = useState(lead.assigned_member_id ?? "");
  const [notes, setNotes] = useState("");

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Schedule follow-up</DialogTitle>
        <DialogDescription>
          Appears on the Follow-ups page and the dashboard, linked to this lead.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField id="lfu-subject" label="Subject" value={subject} onChange={setSubject} />
        </div>
        <PickerField
          id="lfu-type"
          label="Type"
          value={type}
          onChange={setType}
          options={FOLLOWUP_TYPES}
        />
        <TextField
          id="lfu-due"
          label="Due at"
          type="datetime-local"
          value={dueAt}
          onChange={setDueAt}
        />
        <PickerField
          id="lfu-priority"
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={PRIORITY_OPTIONS}
        />
        <PickerField
          id="lfu-owner"
          label="Assign to"
          value={memberId}
          onChange={setMemberId}
          options={members}
        />
        <div className="sm:col-span-2">
          <AreaField id="lfu-notes" label="Notes" value={notes} onChange={setNotes} />
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
              priority,
              assigned_member_id: memberId || null,
              notes,
            })
          }
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Schedule
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
