import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Loader2, Plus } from "lucide-react";

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
import { ALL, DateFilter, FilterBar, SearchFilter, SelectFilter } from "@/components/crm/filters";
import { LineItemsEditor, useLineItems } from "@/components/crm/line-items";
import { can, useWorkspace } from "@/hooks/use-workspace";
import { formatDate, formatMoney } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/quotations")({
  head: () => ({
    meta: [
      { title: "B2B Quotations Generator & Proposals — LeadKart CRM" },
      {
        name: "description",
        content:
          "Build itemised quotations and sales proposals with taxes, discounts, acceptance tracking, and one-click conversion into invoices.",
      },
      { property: "og:title", content: "B2B Quotations Generator & Proposals — LeadKart CRM" },
      { property: "og:description", content: "Itemised quotes that convert seamlessly into invoices." },
      { property: "og:url", content: "https://leadkart.lovable.app/quotations" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Quotation Generator — LeadKart CRM" },
    ],
    links: [{ rel: "canonical", href: "https://leadkart.lovable.app/quotations" }],
  }),
  component: QuotationsPage,
});

type QuotationStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";

const STATUS_FLOW: { id: QuotationStatus; name: string }[] = [
  { id: "draft", name: "Draft" },
  { id: "sent", name: "Sent" },
  { id: "viewed", name: "Viewed" },
  { id: "accepted", name: "Accepted" },
  { id: "rejected", name: "Rejected" },
  { id: "expired", name: "Expired" },
];

function QuotationsPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const symbol = ws?.currencySymbol ?? "₹";
  const queryClient = useQueryClient();
  const canManage = can(ws, "quotations.manage");
  const canView = can(ws, "quotations.view") || canManage;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [clientFilter, setClientFilter] = useState(ALL);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const clients = useQuery({
    queryKey: ["clients-lite", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name")
        .is("deleted_at", null)
        .order("company_name");
      return data ?? [];
    },
  });

  const quotations = useQuery({
    queryKey: ["quotations", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select(
          "id, quotation_number, client_id, issue_date, expiry_date, subtotal, tax_total, total, status, notes",
        )
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QuotationStatus }) => {
      const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quotation updated");
      queryClient.invalidateQueries({ queryKey: ["quotations", orgId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const convert = useMutation({
    mutationFn: async (quotationId: string) => {
      if (!orgId) throw new Error("Workspace not ready");
      const { data: quote, error: quoteError } = await supabase
        .from("quotations")
        .select("id, client_id, deal_id, subtotal, discount_total, tax_total, total, notes, terms")
        .eq("id", quotationId)
        .single();
      if (quoteError) throw quoteError;

      const { data: items, error: itemsError } = await supabase
        .from("quotation_items")
        .select("description, quantity, unit_price, discount_percent, tax_percent, line_total, sort_order")
        .eq("quotation_id", quotationId)
        .order("sort_order");
      if (itemsError) throw itemsError;

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          organization_id: orgId,
          created_by: ws?.memberId ?? null,
          client_id: quote.client_id,
          deal_id: quote.deal_id,
          quotation_id: quote.id,
          subtotal: quote.subtotal,
          discount_total: quote.discount_total,
          tax_total: quote.tax_total,
          total: quote.total,
          notes: quote.notes,
          terms: quote.terms,
          status: "sent",
        })
        .select("id, invoice_number")
        .single();
      if (invoiceError) throw invoiceError;

      if ((items ?? []).length > 0) {
        const { error } = await supabase.from("invoice_items").insert(
          (items ?? []).map((item) => ({
            organization_id: orgId,
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            tax_percent: item.tax_percent,
            line_total: item.line_total,
            sort_order: item.sort_order,
          })),
        );
        if (error) throw error;
      }

      await supabase.from("quotations").update({ status: "accepted" }).eq("id", quotationId);
      return invoice.invoice_number;
    },
    onSuccess: (invoiceNumber) => {
      toast.success(`Invoice ${invoiceNumber ?? ""} created from quotation`);
      queryClient.invalidateQueries({ queryKey: ["quotations", orgId] });
      queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", orgId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not create invoice"),
  });

  const createQuotation = useMutation({
    mutationFn: async (payload: {
      client_id: string | null;
      expiry_date: string | null;
      notes: string;
      terms: string;
      subtotal: number;
      tax_total: number;
      total: number;
      items: {
        description: string;
        quantity: number;
        unit_price: number;
        tax_percent: number;
        line_total: number;
      }[];
    }) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!payload.client_id) throw new Error("Pick a client");
      const usable = payload.items.filter((i) => i.description.trim() !== "");
      if (usable.length === 0) throw new Error("Add at least one line item");

      const { data: quote, error } = await supabase
        .from("quotations")
        .insert({
          organization_id: orgId,
          created_by: ws?.memberId ?? null,
          client_id: payload.client_id,
          expiry_date: payload.expiry_date,
          subtotal: payload.subtotal,
          tax_total: payload.tax_total,
          total: payload.total,
          notes: payload.notes || null,
          terms: payload.terms || null,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("quotation_items").insert(
        usable.map((item, index) => ({
          organization_id: orgId,
          quotation_id: quote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_percent: item.tax_percent,
          line_total: item.line_total,
          sort_order: index,
        })),
      );
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success("Quotation created");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["quotations", orgId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save quote"),
  });

  const clientMap = useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])),
    [clients.data],
  );

  if (ws && !canView) return <NoAccess what="quotations" />;

  const allRows = quotations.data ?? [];
  const rows = allRows.filter((quote) => {
    if (statusFilter !== ALL && quote.status !== statusFilter) return false;
    if (clientFilter !== ALL && quote.client_id !== clientFilter) return false;
    if (fromDate && new Date(quote.issue_date).getTime() < new Date(`${fromDate}T00:00:00`).getTime())
      return false;
    if (toDate && new Date(quote.issue_date).getTime() > new Date(`${toDate}T23:59:59`).getTime())
      return false;
    if (search.trim()) {
      const haystack = [
        quote.quotation_number,
        quote.notes,
        quote.client_id ? clientMap.get(quote.client_id) ?? "" : "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });
  const openValue = rows
    .filter((q) => q.status === "sent" || q.status === "viewed" || q.status === "draft")
    .reduce((sum, q) => sum + Number(q.total ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        subtitle={`${rows.length} quotations · ${formatMoney(openValue, symbol)} awaiting decision`}
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 size-4" /> New quotation
                </Button>
              </DialogTrigger>
              <NewQuotationDialog
                clients={clients.data ?? []}
                symbol={symbol}
                saving={createQuotation.isPending}
                onSubmit={(payload) => createQuotation.mutate(payload)}
              />
            </Dialog>
          ) : null
        }
      />

      <FilterBar
        activeCount={
          (search.trim() ? 1 : 0) +
          (statusFilter !== ALL ? 1 : 0) +
          (clientFilter !== ALL ? 1 : 0) +
          (fromDate ? 1 : 0) +
          (toDate ? 1 : 0)
        }
        onReset={() => {
          setSearch("");
          setStatusFilter(ALL);
          setClientFilter(ALL);
          setFromDate("");
          setToDate("");
        }}
      >
        <SearchFilter
          id="quote-search"
          value={search}
          onChange={setSearch}
          placeholder="Quotation number, client or notes"
        />
        <SelectFilter
          id="quote-status-filter"
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FLOW}
          allLabel="All statuses"
        />
        <SelectFilter
          id="quote-client-filter"
          label="Client"
          value={clientFilter}
          onChange={setClientFilter}
          options={(clients.data ?? []).map((c) => ({ id: c.id, name: c.company_name }))}
          allLabel="All clients"
        />
        <DateFilter id="quote-from" label="Issued from" value={fromDate} onChange={setFromDate} />
        <DateFilter id="quote-to" label="Issued to" value={toDate} onChange={setToDate} />
      </FilterBar>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All quotations</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {quotations.isLoading && <Skeleton className="mx-6 h-40" />}
          {quotations.data && rows.length === 0 && (
            <EmptyState
              message={
                allRows.length === 0
                  ? "No quotations yet — create your first one."
                  : "No quotations match your filters."
              }
            />
          )}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">{quote.quotation_number}</TableCell>
                      <TableCell className="text-sm">
                        {quote.client_id ? clientMap.get(quote.client_id) ?? "—" : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(quote.issue_date)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(quote.expiry_date)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(quote.total, symbol)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            quote.status === "accepted"
                              ? "default"
                              : quote.status === "rejected" || quote.status === "expired"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {STATUS_FLOW.find((s) => s.id === quote.status)?.name ?? quote.status}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="space-x-2 text-right whitespace-nowrap">
                          {quote.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus.mutate({ id: quote.id, status: "sent" })}
                            >
                              Mark sent
                            </Button>
                          )}
                          {(quote.status === "sent" || quote.status === "viewed") && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={convert.isPending}
                              onClick={() => convert.mutate(quote.id)}
                            >
                              <FileCheck2 className="mr-1 size-3.5" /> Accept &amp; invoice
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
    </div>
  );
}

function NewQuotationDialog({
  clients,
  symbol,
  saving,
  onSubmit,
}: {
  clients: { id: string; company_name: string }[];
  symbol: string;
  saving: boolean;
  onSubmit: (payload: {
    client_id: string | null;
    expiry_date: string | null;
    notes: string;
    terms: string;
    subtotal: number;
    tax_total: number;
    total: number;
    items: {
      description: string;
      quantity: number;
      unit_price: number;
      tax_percent: number;
      line_total: number;
    }[];
  }) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const editor = useLineItems();

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New quotation</DialogTitle>
        <DialogDescription>
          Totals are calculated from your line items; the quotation number is generated
          automatically.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <PickerField
          id="quote-client"
          label="Client"
          value={clientId}
          onChange={setClientId}
          options={clients.map((c) => ({ id: c.id, name: c.company_name }))}
        />
        <TextField
          id="quote-expiry"
          label="Valid until"
          type="date"
          value={expiry}
          onChange={setExpiry}
        />
      </div>

      <LineItemsEditor editor={editor} symbol={symbol} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AreaField id="quote-notes" label="Notes" value={notes} onChange={setNotes} />
        <AreaField id="quote-terms" label="Terms" value={terms} onChange={setTerms} />
      </div>

      <DialogFooter>
        <Button
          disabled={saving}
          onClick={() =>
            onSubmit({
              client_id: clientId || null,
              expiry_date: expiry || null,
              notes,
              terms,
              subtotal: editor.subtotal,
              tax_total: editor.taxTotal,
              total: editor.total,
              items: editor.rows.map((r) => ({
                description: r.description,
                quantity: r.quantity,
                unit_price: r.price,
                tax_percent: r.taxPercent,
                line_total: r.total,
              })),
            })
          }
        >
          {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
          Save quotation
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}