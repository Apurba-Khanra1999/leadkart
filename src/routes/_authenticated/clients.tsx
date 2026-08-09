import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

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
import { AreaField, PickerField, TextField } from "@/components/crm/fields";
import { ALL, FilterBar, SearchFilter, SelectFilter } from "@/components/crm/filters";
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
import { can, useWorkspace } from "@/hooks/use-workspace";
import { INDUSTRY_OPTIONS, formatDate, initials } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Client Directory & Customer Accounts — LeadKart CRM" },
      {
        name: "description",
        content:
          "Manage active customer accounts, key contacts, account manager assignments, billing information, and status tiers.",
      },
      { property: "og:title", content: "Client Directory & Customer Accounts — LeadKart CRM" },
      { property: "og:description", content: "Manage your client database and contact relationships." },
      { property: "og:url", content: "https://leadkart.lovable.app/clients" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Client Accounts — LeadKart CRM" },
    ],
    links: [{ rel: "canonical", href: "https://leadkart.lovable.app/clients" }],
  }),
  component: ClientsPage,
});

const STATUS_OPTIONS = [
  { id: "active", name: "Active" },
  { id: "vip", name: "VIP" },
  { id: "at_risk", name: "At risk" },
  { id: "inactive", name: "Inactive" },
  { id: "lost", name: "Lost" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  vip: "default",
  at_risk: "destructive",
  inactive: "secondary",
  lost: "outline",
};

type ClientRow = {
  id: string;
  client_code: string | null;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  billing_address: string | null;
  status: string;
  account_manager_id: string | null;
  created_at: string;
};

type ClientPayload = {
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  industry: string;
  billing_address: string;
  status: string;
  account_manager_id: string | null;
};

function ClientsPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const queryClient = useQueryClient();
  const canManage = can(ws, "clients.manage");
  const canView = can(ws, "clients.view.all") || can(ws, "clients.view.own");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [managerFilter, setManagerFilter] = useState(ALL);
  const [industryFilter, setIndustryFilter] = useState(ALL);
  const [sort, setSort] = useState(ALL);
  const [open, setOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientRow | null>(null);

  const members = useQuery({
    queryKey: ["members", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name");
      return data ?? [];
    },
  });

  const clients = useQuery({
    queryKey: ["clients", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, client_code, company_name, contact_person, phone, email, industry, billing_address, status, account_manager_id, created_at",
        )
        .is("deleted_at", null)
        .order("company_name");
      if (error) throw error;
      return data as ClientRow[];
    },
  });

  const createClient = useMutation({
    mutationFn: async (payload: ClientPayload) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.company_name.trim()) throw new Error("Company name is required");
      const { error } = await supabase.from("clients").insert({
        organization_id: orgId,
        created_by: ws?.memberId ?? null,
        company_name: payload.company_name.trim(),
        contact_person: payload.contact_person || null,
        phone: payload.phone || null,
        email: payload.email || null,
        industry: payload.industry || null,
        billing_address: payload.billing_address || null,
        account_manager_id: payload.account_manager_id,
        status: payload.status as "active" | "inactive" | "vip" | "at_risk" | "lost",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client added");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["clients", orgId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save client"),
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ClientPayload }) => {
      if (!payload.company_name.trim()) throw new Error("Company name is required");
      const { error } = await supabase
        .from("clients")
        .update({
          company_name: payload.company_name.trim(),
          contact_person: payload.contact_person || null,
          phone: payload.phone || null,
          email: payload.email || null,
          industry: payload.industry || null,
          billing_address: payload.billing_address || null,
          account_manager_id: payload.account_manager_id,
          status: payload.status as "active" | "inactive" | "vip" | "at_risk" | "lost",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client updated");
      setEditClient(null);
      queryClient.invalidateQueries({ queryKey: ["clients", orgId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("clients")
        .update({ status: status as "active" | "inactive" | "vip" | "at_risk" | "lost" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients", orgId] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const archiveClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client archived");
      queryClient.invalidateQueries({ queryKey: ["clients", orgId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not archive"),
  });

  const memberMap = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.id, m.full_name])),
    [members.data],
  );

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const option of INDUSTRY_OPTIONS) set.add(option.name);
    for (const c of clients.data ?? []) if (c.industry) set.add(c.industry);
    return [...set].sort().map((i) => ({ id: i, name: i }));
  }, [clients.data]);

  const filtered = useMemo(() => {
    const rows = (clients.data ?? []).filter((c) => {
      if (statusFilter !== ALL && c.status !== statusFilter) return false;
      if (managerFilter !== ALL) {
        if (managerFilter === "unassigned" ? c.account_manager_id : c.account_manager_id !== managerFilter)
          return false;
      }
      if (industryFilter !== ALL && c.industry !== industryFilter) return false;
      if (!search.trim()) return true;
      return [c.company_name, c.contact_person, c.email, c.phone, c.client_code, c.industry]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    });
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sort === "name_desc") return b.company_name.localeCompare(a.company_name);
      if (sort === "newest")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return a.company_name.localeCompare(b.company_name);
    });
    return sorted;
  }, [clients.data, statusFilter, managerFilter, industryFilter, search, sort]);

  const activeFilters =
    (search.trim() ? 1 : 0) +
    (statusFilter !== ALL ? 1 : 0) +
    (managerFilter !== ALL ? 1 : 0) +
    (industryFilter !== ALL ? 1 : 0);

  function resetFilters() {
    setSearch("");
    setStatusFilter(ALL);
    setManagerFilter(ALL);
    setIndustryFilter(ALL);
  }

  if (ws && !canView) return <NoAccess what="clients" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle={`${filtered.length} of ${clients.data?.length ?? 0} accounts`}
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 size-4" /> New client
                </Button>
              </DialogTrigger>
              <ClientDialog
                key="new-client"
                members={members.data ?? []}
                saving={createClient.isPending}
                onSubmit={(payload) => createClient.mutate(payload)}
              />
            </Dialog>
          ) : null
        }
      />

      <FilterBar onReset={resetFilters} activeCount={activeFilters}>
        <SearchFilter
          id="client-search"
          value={search}
          onChange={setSearch}
          placeholder="Company, contact, email, phone, industry or code"
        />
        <SelectFilter
          id="client-status-filter"
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          allLabel="All statuses"
        />
        <SelectFilter
          id="client-manager-filter"
          label="Account manager"
          value={managerFilter}
          onChange={setManagerFilter}
          options={[
            { id: "unassigned", name: "Unassigned" },
            ...(members.data ?? []).map((m) => ({ id: m.id, name: m.full_name })),
          ]}
          allLabel="All managers"
        />
        <SelectFilter
          id="client-industry-filter"
          label="Industry"
          value={industryFilter}
          onChange={setIndustryFilter}
          options={industries}
          allLabel="All industries"
        />
        <SelectFilter
          id="client-sort"
          label="Sort"
          value={sort}
          onChange={setSort}
          options={[
            { id: "name_desc", name: "Company Z–A" },
            { id: "newest", name: "Newest first" },
            { id: "oldest", name: "Oldest first" },
          ]}
          allLabel="Company A–Z"
          width="w-40"
        />
      </FilterBar>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All clients</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {clients.isLoading && <Skeleton className="mx-6 h-40" />}
          {clients.data && filtered.length === 0 && (
            <EmptyState message="No clients match your search." />
          )}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Account manager</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Since</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <p className="font-medium">{client.company_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {client.client_code} · {client.industry ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        <p>{client.contact_person ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{client.email ?? client.phone ?? ""}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {client.account_manager_id ? (
                          <span className="flex items-center gap-2">
                            <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                              {initials(memberMap.get(client.account_manager_id))}
                            </span>
                            {memberMap.get(client.account_manager_id) ?? "—"}
                          </span>
                        ) : (
                          <Badge variant="outline">Unassigned</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <Select
                            value={client.status}
                            onValueChange={(status) => setStatus.mutate({ id: client.id, status })}
                          >
                            <SelectTrigger
                              className="h-8 w-32 text-xs"
                              aria-label={`Change status of ${client.company_name}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={STATUS_VARIANT[client.status] ?? "secondary"}>
                            {STATUS_OPTIONS.find((s) => s.id === client.status)?.name ??
                              client.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(client.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for ${client.company_name}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>{client.company_name}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => setEditClient(client)}>
                                <Pencil className="mr-2 size-3.5" /> Edit client
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onSelect={() => archiveClient.mutate(client.id)}
                              >
                                <Trash2 className="mr-2 size-3.5" /> Archive client
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editClient)} onOpenChange={(next) => !next && setEditClient(null)}>
        {editClient && (
          <ClientDialog
            key={editClient.id}
            members={members.data ?? []}
            initial={editClient}
            saving={updateClient.isPending}
            onSubmit={(payload) => updateClient.mutate({ id: editClient.id, payload })}
          />
        )}
      </Dialog>
    </div>
  );
}

function ClientDialog({
  members,
  initial,
  saving,
  onSubmit,
}: {
  members: { id: string; full_name: string }[];
  initial?: ClientRow;
  saving: boolean;
  onSubmit: (payload: ClientPayload) => void;
}) {
  const [companyName, setCompanyName] = useState(initial?.company_name ?? "");
  const [contactPerson, setContactPerson] = useState(initial?.contact_person ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [billingAddress, setBillingAddress] = useState(initial?.billing_address ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [managerId, setManagerId] = useState(initial?.account_manager_id ?? "");

  const industryOptions = useMemo(() => {
    const known = INDUSTRY_OPTIONS.map((o) => o.name);
    if (initial?.industry && !known.includes(initial.industry))
      return [{ id: initial.industry, name: initial.industry }, ...INDUSTRY_OPTIONS];
    return INDUSTRY_OPTIONS;
  }, [initial?.industry]);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{initial ? `Edit ${initial.company_name}` : "New client"}</DialogTitle>
        <DialogDescription>
          {initial
            ? `Client ${initial.client_code ?? ""} · added ${formatDate(initial.created_at)}`
            : "A client code is generated automatically for your organisation."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField
            id="client-company"
            label="Company name"
            value={companyName}
            onChange={setCompanyName}
          />
        </div>
        <TextField
          id="client-contact"
          label="Contact person"
          value={contactPerson}
          onChange={setContactPerson}
        />
        <TextField id="client-phone" label="Phone" value={phone} onChange={setPhone} />
        <TextField id="client-email" label="Email" type="email" value={email} onChange={setEmail} />
        <PickerField
          id="client-industry"
          label="Industry"
          value={industry}
          onChange={setIndustry}
          options={industryOptions}
          placeholder="Select industry"
        />
        <PickerField
          id="client-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
        />
        <div className="sm:col-span-2">
          <PickerField
            id="client-manager"
            label="Account manager"
            value={managerId}
            onChange={setManagerId}
            options={members.map((m) => ({ id: m.id, name: m.full_name }))}
          />
        </div>
        <div className="sm:col-span-2">
          <AreaField
            id="client-billing"
            label="Billing address"
            value={billingAddress}
            onChange={setBillingAddress}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          disabled={saving}
          onClick={() =>
            onSubmit({
              company_name: companyName,
              contact_person: contactPerson,
              phone,
              email,
              industry,
              billing_address: billingAddress,
              status,
              account_manager_id: managerId || null,
            })
          }
        >
          {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
          {initial ? "Save changes" : "Save client"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
