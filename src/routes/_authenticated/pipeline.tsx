import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, NoAccess } from "@/components/crm/page";
import { PRIORITY_OPTIONS, PickerField, TextField } from "@/components/crm/fields";
import {
  ALL,
  FilterBar,
  NumberFilter,
  PRIORITY_FILTER_OPTIONS,
  SearchFilter,
  SelectFilter,
} from "@/components/crm/filters";
import { can, useWorkspace } from "@/hooks/use-workspace";
import { formatDate, formatMoney, initials } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Kanban Deal Pipeline & Revenue Forecast — LeadKart CRM" },
      {
        name: "description",
        content:
          "Track open sales deals by Kanban stage with weighted forecast values, assigned team members, win probabilities, and close date tracking.",
      },
      { property: "og:title", content: "Kanban Deal Pipeline & Revenue Forecast — LeadKart CRM" },
      { property: "og:description", content: "Stage-by-stage weighted sales pipeline and deal forecasting." },
      { property: "og:url", content: "https://leadkart.lovable.app/pipeline" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Deal Pipeline & Forecasting — LeadKart CRM" },
    ],
    links: [{ rel: "canonical", href: "https://leadkart.lovable.app/pipeline" }],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const symbol = ws?.currencySymbol ?? "₹";
  const queryClient = useQueryClient();
  const canManage = can(ws, "deals.manage");
  const canView = can(ws, "deals.view.all") || can(ws, "deals.view.own");

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [clientFilter, setClientFilter] = useState(ALL);
  const [priorityFilter, setPriorityFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState("open");
  const [closeFilter, setCloseFilter] = useState(ALL);
  const [minValue, setMinValue] = useState("");

  const meta = useQuery({
    queryKey: ["deal-meta", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const [stages, clients, members] = await Promise.all([
        supabase
          .from("deal_stages")
          .select("id, name, sort_order, default_probability, is_won, is_lost")
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("clients").select("id, company_name").is("deleted_at", null).order("company_name"),
        supabase
          .from("organization_members")
          .select("id, full_name")
          .eq("status", "active")
          .order("full_name"),
      ]);
      return {
        stages: stages.data ?? [],
        clients: clients.data ?? [],
        members: members.data ?? [],
      };
    },
  });

  const deals = useQuery({
    queryKey: ["deals", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, deal_number, name, value, probability, weighted_value, stage_id, client_id, assigned_member_id, expected_close_date, status, priority",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => {
      const stage = meta.data?.stages.find((s) => s.id === stageId);
      const { error } = await supabase
        .from("deals")
        .update({
          stage_id: stageId,
          probability: stage?.default_probability ?? 10,
          status: stage?.is_won ? "won" : stage?.is_lost ? "lost" : "open",
          closed_at: stage?.is_won || stage?.is_lost ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deal moved");
      queryClient.invalidateQueries({ queryKey: ["deals", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", orgId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not move deal"),
  });

  const createDeal = useMutation({
    mutationFn: async (payload: {
      name: string;
      value: number;
      stage_id: string | null;
      client_id: string | null;
      assigned_member_id: string | null;
      expected_close_date: string | null;
      priority: string;
    }) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.name.trim()) throw new Error("Deal name is required");
      const stage = meta.data?.stages.find((s) => s.id === payload.stage_id);
      const { error } = await supabase.from("deals").insert({
        organization_id: orgId,
        created_by: ws?.memberId ?? null,
        name: payload.name.trim(),
        value: payload.value,
        probability: stage?.default_probability ?? 10,
        stage_id: payload.stage_id,
        client_id: payload.client_id,
        assigned_member_id: payload.assigned_member_id,
        expected_close_date: payload.expected_close_date,
        priority: payload.priority as "low" | "medium" | "high" | "urgent",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deal created");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["deals", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", orgId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save deal"),
  });

  const clientMap = useMemo(
    () => new Map((meta.data?.clients ?? []).map((c) => [c.id, c.company_name])),
    [meta.data],
  );
  const memberMap = useMemo(
    () => new Map((meta.data?.members ?? []).map((m) => [m.id, m.full_name])),
    [meta.data],
  );

  if (ws && !canView) return <NoAccess what="the pipeline" />;

  const stages = meta.data?.stages ?? [];
  const now = Date.now();
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  const visibleDeals = (deals.data ?? []).filter((deal) => {
    if (statusFilter !== ALL && deal.status !== statusFilter) return false;
    if (ownerFilter !== ALL) {
      if (ownerFilter === "unassigned" ? deal.assigned_member_id : deal.assigned_member_id !== ownerFilter)
        return false;
    }
    if (clientFilter !== ALL) {
      if (clientFilter === "none" ? deal.client_id : deal.client_id !== clientFilter) return false;
    }
    if (priorityFilter !== ALL && deal.priority !== priorityFilter) return false;
    if (minValue.trim() && Number(deal.value ?? 0) < Number(minValue)) return false;
    if (closeFilter !== ALL) {
      const close = deal.expected_close_date ? new Date(deal.expected_close_date).getTime() : null;
      if (closeFilter === "none" && close) return false;
      if (closeFilter === "overdue" && (!close || close >= now)) return false;
      if (closeFilter === "month" && (!close || close < now || close > endOfMonth.getTime()))
        return false;
    }
    if (search.trim()) {
      const haystack = [deal.name, deal.deal_number, clientMap.get(deal.client_id ?? "") ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });

  const openDeals = visibleDeals.filter((d) => d.status === "open");
  const weighted = openDeals.reduce((sum, d) => sum + Number(d.weighted_value ?? 0), 0);
  const gross = openDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0);

  const activeFilters =
    (search.trim() ? 1 : 0) +
    (ownerFilter !== ALL ? 1 : 0) +
    (clientFilter !== ALL ? 1 : 0) +
    (priorityFilter !== ALL ? 1 : 0) +
    (statusFilter !== "open" ? 1 : 0) +
    (closeFilter !== ALL ? 1 : 0) +
    (minValue.trim() ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        subtitle={`${openDeals.length} open deals · ${formatMoney(gross, symbol)} gross · ${formatMoney(weighted, symbol)} weighted forecast`}
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 size-4" /> New deal
                </Button>
              </DialogTrigger>
              <NewDealDialog
                meta={meta.data}
                saving={createDeal.isPending}
                onSubmit={(payload) => createDeal.mutate(payload)}
              />
            </Dialog>
          ) : null
        }
      />

      <FilterBar
        activeCount={activeFilters}
        onReset={() => {
          setSearch("");
          setOwnerFilter(ALL);
          setClientFilter(ALL);
          setPriorityFilter(ALL);
          setStatusFilter("open");
          setCloseFilter(ALL);
          setMinValue("");
        }}
      >
        <SearchFilter
          id="deal-search"
          value={search}
          onChange={setSearch}
          placeholder="Deal name, number or client"
        />
        <SelectFilter
          id="deal-status-filter"
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { id: "open", name: "Open" },
            { id: "won", name: "Won" },
            { id: "lost", name: "Lost" },
          ]}
          allLabel="All statuses"
          width="w-36"
        />
        <SelectFilter
          id="deal-owner-filter"
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
          id="deal-client-filter"
          label="Client"
          value={clientFilter}
          onChange={setClientFilter}
          options={[
            { id: "none", name: "No client" },
            ...(meta.data?.clients ?? []).map((c) => ({ id: c.id, name: c.company_name })),
          ]}
          allLabel="All clients"
        />
        <SelectFilter
          id="deal-priority-filter"
          label="Priority"
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={PRIORITY_FILTER_OPTIONS}
          allLabel="Any priority"
          width="w-36"
        />
        <SelectFilter
          id="deal-close-filter"
          label="Expected close"
          value={closeFilter}
          onChange={setCloseFilter}
          options={[
            { id: "overdue", name: "Past due" },
            { id: "month", name: "This month" },
            { id: "none", name: "No date" },
          ]}
          allLabel="Any date"
        />
        <NumberFilter id="deal-min-value" label="Min value" value={minValue} onChange={setMinValue} />
      </FilterBar>

      {deals.isLoading && <Skeleton className="h-64" />}

      {!deals.isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = visibleDeals.filter((d) => d.stage_id === stage.id);
            const stageValue = stageDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
            return (
              <section key={stage.id} className="w-72 shrink-0 rounded-xl bg-muted/40 p-3">
                <header className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">{stage.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {stageDeals.length} · {formatMoney(stageValue, symbol)}
                    </p>
                  </div>
                  <Badge variant="outline">{stage.default_probability}%</Badge>
                </header>

                <div className="space-y-2">
                  {stageDeals.length === 0 && (
                    <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                      No deals here
                    </p>
                  )}
                  {stageDeals.map((deal) => (
                    <article key={deal.id} className="shadow-card space-y-2 rounded-lg bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{deal.name}</p>
                        <span className="text-xs text-muted-foreground">{deal.deal_number}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {deal.client_id ? clientMap.get(deal.client_id) ?? "—" : "No client"}
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{formatMoney(deal.value, symbol)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatMoney(deal.weighted_value, symbol)} wtd
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                            {initials(
                              deal.assigned_member_id
                                ? memberMap.get(deal.assigned_member_id)
                                : null,
                            )}
                          </span>
                          {deal.assigned_member_id
                            ? memberMap.get(deal.assigned_member_id) ?? "—"
                            : "Unassigned"}
                        </span>
                        <span>{formatDate(deal.expected_close_date)}</span>
                      </div>
                      {canManage && (
                        <Select
                          value={deal.stage_id ?? ""}
                          onValueChange={(stageId) => moveStage.mutate({ id: deal.id, stageId })}
                        >
                          <SelectTrigger
                            className="h-8 text-xs"
                            aria-label={`Move ${deal.name} to another stage`}
                          >
                            <SelectValue placeholder="Move to stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

type DealMeta = {
  stages: { id: string; name: string }[];
  clients: { id: string; company_name: string }[];
  members: { id: string; full_name: string }[];
};

function NewDealDialog({
  meta,
  saving,
  onSubmit,
}: {
  meta: DealMeta | undefined;
  saving: boolean;
  onSubmit: (payload: {
    name: string;
    value: number;
    stage_id: string | null;
    client_id: string | null;
    assigned_member_id: string | null;
    expected_close_date: string | null;
    priority: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("0");
  const [stageId, setStageId] = useState("");
  const [clientId, setClientId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [priority, setPriority] = useState("medium");

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>New deal</DialogTitle>
        <DialogDescription>
          Weighted forecast value is calculated automatically from the stage probability.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField id="deal-name" label="Deal name" value={name} onChange={setName} />
        </div>
        <TextField id="deal-value" label="Value" type="number" value={value} onChange={setValue} />
        <TextField
          id="deal-close"
          label="Expected close"
          type="date"
          value={closeDate}
          onChange={setCloseDate}
        />
        <PickerField
          id="deal-stage"
          label="Stage"
          value={stageId}
          onChange={setStageId}
          options={(meta?.stages ?? []).map((s) => ({ id: s.id, name: s.name }))}
        />
        <PickerField
          id="deal-priority"
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={PRIORITY_OPTIONS}
        />
        <PickerField
          id="deal-client"
          label="Client"
          value={clientId}
          onChange={setClientId}
          options={(meta?.clients ?? []).map((c) => ({ id: c.id, name: c.company_name }))}
        />
        <PickerField
          id="deal-owner"
          label="Assign to"
          value={memberId}
          onChange={setMemberId}
          options={(meta?.members ?? []).map((m) => ({ id: m.id, name: m.full_name }))}
        />
      </div>

      <DialogFooter>
        <Button
          disabled={saving}
          onClick={() =>
            onSubmit({
              name,
              value: Number(value) || 0,
              stage_id: stageId || null,
              client_id: clientId || null,
              assigned_member_id: memberId || null,
              expected_close_date: closeDate || null,
              priority,
            })
          }
        >
          {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
          Save deal
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}