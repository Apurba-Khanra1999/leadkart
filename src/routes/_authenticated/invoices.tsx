import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { IndianRupee, Loader2, Plus } from "lucide-react";

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
import { formatDate, formatMoney, formatMoneyFull } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices & payments — Zenith CRM" },
      {
        name: "description",
        content:
          "Raise invoices, record part payments and watch outstanding balances and overdue accounts update automatically.",
      },
      { property: "og:title", content: "Invoices & payments — Zenith CRM" },
      {
        property: "og:description",
        content: "Invoice balances and overdue status update themselves as payments land.",
      },
    ],
  }),
  component: InvoicesPage,
});

const PAYMENT_METHODS = [
  { id: "bank_transfer", name: "Bank transfer" },
  { id: "upi", name: "UPI" },
  { id: "cash", name: "Cash" },
  { id: "card", name: "Card" },
  { id: "cheque", name: "Cheque" },
  { id: "other", name: "Other" },
];

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  overdue: "destructive",
  cancelled: "outline",
  draft: "outline",
  sent: "secondary",
  partially_paid: "secondary",
};

function InvoicesPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const symbol = ws?.currencySymbol ?? "₹";
  const queryClient = useQueryClient();
  const canManage = can(ws, "invoices.manage");
  const canView = can(ws, "invoices.view") || canManage;
  const canRecordPayment = can(ws, "payments.record");

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [clientFilter, setClientFilter] = useState(ALL);
  const [balanceFilter, setBalanceFilter] = useState(ALL);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [payFor, setPayFor] = useState<{ id: string; number: string; outstanding: number } | null>(
    null,
  );

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

  const invoices = useQuery({
    queryKey: ["invoices", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, client_id, issue_date, due_date, total, paid_amount, outstanding_amount, status",
        )
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createInvoice = useMutation({
    mutationFn: async (payload: {
      client_id: string | null;
      due_date: string;
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
      if (!payload.due_date) throw new Error("Pick a due date");
      const usable = payload.items.filter((i) => i.description.trim() !== "");
      if (usable.length === 0) throw new Error("Add at least one line item");

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          organization_id: orgId,
          created_by: ws?.memberId ?? null,
          client_id: payload.client_id,
          due_date: payload.due_date,
          subtotal: payload.subtotal,
          tax_total: payload.tax_total,
          total: payload.total,
          notes: payload.notes || null,
          terms: payload.terms || null,
          status: "sent",
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("invoice_items").insert(
        usable.map((item, index) => ({
          organization_id: orgId,
          invoice_id: invoice.id,
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
      toast.success("Invoice created");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", orgId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not create invoice"),
  });

  const recordPayment = useMutation({
    mutationFn: async (payload: {
      invoice_id: string;
      client_id: string | null;
      amount: number;
      paid_on: string;
      method: string;
      reference: string;
    }) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!(payload.amount > 0)) throw new Error("Enter an amount greater than zero");
      const { error } = await supabase.from("payments").insert({
        organization_id: orgId,
        invoice_id: payload.invoice_id,
        client_id: payload.client_id,
        amount: payload.amount,
        paid_on: payload.paid_on,
        method: payload.method as
          | "cash"
          | "bank_transfer"
          | "upi"
          | "card"
          | "cheque"
          | "other",
        reference: payload.reference || null,
        recorded_by: ws?.memberId ?? null,
        status: "recorded",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setPayFor(null);
      queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", orgId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not record payment"),
  });

  const clientMap = useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c.company_name])),
    [clients.data],
  );

  if (ws && !canView) return <NoAccess what="invoices" />;

  const allRows = invoices.data ?? [];
  const rows = allRows.filter((invoice) => {
    if (statusFilter !== ALL && invoice.status !== statusFilter) return false;
    if (clientFilter !== ALL && invoice.client_id !== clientFilter) return false;
    const balance = Number(invoice.outstanding_amount ?? 0);
    if (balanceFilter === "open" && balance <= 0) return false;
    if (balanceFilter === "settled" && balance > 0) return false;
    if (dueFrom && new Date(invoice.due_date).getTime() < new Date(`${dueFrom}T00:00:00`).getTime())
      return false;
    if (dueTo && new Date(invoice.due_date).getTime() > new Date(`${dueTo}T23:59:59`).getTime())
      return false;
    if (search.trim()) {
      const haystack = [
        invoice.invoice_number,
        invoice.client_id ? clientMap.get(invoice.client_id) ?? "" : "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });
  const outstanding = rows.reduce((sum, i) => sum + Number(i.outstanding_amount ?? 0), 0);
  const overdue = rows.filter((i) => i.status === "overdue");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle={`${formatMoney(outstanding, symbol)} outstanding · ${overdue.length} overdue`}
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1 size-4" /> New invoice
                </Button>
              </DialogTrigger>
              <NewInvoiceDialog
                clients={clients.data ?? []}
                symbol={symbol}
                saving={createInvoice.isPending}
                onSubmit={(payload) => createInvoice.mutate(payload)}
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
          (balanceFilter !== ALL ? 1 : 0) +
          (dueFrom ? 1 : 0) +
          (dueTo ? 1 : 0)
        }
        onReset={() => {
          setSearch("");
          setStatusFilter(ALL);
          setClientFilter(ALL);
          setBalanceFilter(ALL);
          setDueFrom("");
          setDueTo("");
        }}
      >
        <SearchFilter
          id="invoice-search"
          value={search}
          onChange={setSearch}
          placeholder="Invoice number or client"
        />
        <SelectFilter
          id="invoice-status-filter"
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { id: "draft", name: "Draft" },
            { id: "sent", name: "Sent" },
            { id: "partially_paid", name: "Partially paid" },
            { id: "paid", name: "Paid" },
            { id: "overdue", name: "Overdue" },
            { id: "cancelled", name: "Cancelled" },
          ]}
          allLabel="All statuses"
        />
        <SelectFilter
          id="invoice-client-filter"
          label="Client"
          value={clientFilter}
          onChange={setClientFilter}
          options={(clients.data ?? []).map((c) => ({ id: c.id, name: c.company_name }))}
          allLabel="All clients"
        />
        <SelectFilter
          id="invoice-balance-filter"
          label="Balance"
          value={balanceFilter}
          onChange={setBalanceFilter}
          options={[
            { id: "open", name: "Outstanding" },
            { id: "settled", name: "Fully paid" },
          ]}
          allLabel="Any balance"
          width="w-40"
        />
        <DateFilter id="invoice-due-from" label="Due from" value={dueFrom} onChange={setDueFrom} />
        <DateFilter id="invoice-due-to" label="Due to" value={dueTo} onChange={setDueTo} />
      </FilterBar>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Receivables</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {invoices.isLoading && <Skeleton className="mx-6 h-40" />}
          {invoices.data && rows.length === 0 && (
            <EmptyState
              message={
                allRows.length === 0
                  ? "No invoices yet — raise one from a quotation or from scratch."
                  : "No invoices match your filters."
              }
            />
          )}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    {canRecordPayment && <TableHead className="text-right">Payment</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell className="text-sm">
                        {invoice.client_id ? clientMap.get(invoice.client_id) ?? "—" : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(invoice.issue_date)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(invoice.due_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoneyFull(invoice.total, symbol)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoneyFull(invoice.outstanding_amount, symbol)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_TONE[invoice.status] ?? "secondary"}>
                          {invoice.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      {canRecordPayment && (
                        <TableCell className="text-right">
                          {Number(invoice.outstanding_amount) > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPayFor({
                                  id: invoice.id,
                                  number: invoice.invoice_number ?? "",
                                  outstanding: Number(invoice.outstanding_amount ?? 0),
                                })
                              }
                            >
                              <IndianRupee className="mr-1 size-3.5" /> Record
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

      <Dialog open={Boolean(payFor)} onOpenChange={(next) => !next && setPayFor(null)}>
        {payFor && (
          <RecordPaymentDialog
            invoiceNumber={payFor.number}
            outstanding={payFor.outstanding}
            symbol={symbol}
            saving={recordPayment.isPending}
            onSubmit={(payload) =>
              recordPayment.mutate({
                invoice_id: payFor.id,
                client_id:
                  rows.find((r) => r.id === payFor.id)?.client_id ?? null,
                ...payload,
              })
            }
          />
        )}
      </Dialog>
    </div>
  );
}

function NewInvoiceDialog({
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
    due_date: string;
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
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const editor = useLineItems();

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New invoice</DialogTitle>
        <DialogDescription>
          Invoice numbers, balances and overdue status are handled by the backend.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <PickerField
          id="invoice-client"
          label="Client"
          value={clientId}
          onChange={setClientId}
          options={clients.map((c) => ({ id: c.id, name: c.company_name }))}
        />
        <TextField
          id="invoice-due"
          label="Due date"
          type="date"
          value={dueDate}
          onChange={setDueDate}
        />
      </div>

      <LineItemsEditor editor={editor} symbol={symbol} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AreaField id="invoice-notes" label="Notes" value={notes} onChange={setNotes} />
        <AreaField id="invoice-terms" label="Terms" value={terms} onChange={setTerms} />
      </div>

      <DialogFooter>
        <Button
          disabled={saving}
          onClick={() =>
            onSubmit({
              client_id: clientId || null,
              due_date: dueDate,
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
          Save invoice
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function RecordPaymentDialog({
  invoiceNumber,
  outstanding,
  symbol,
  saving,
  onSubmit,
}: {
  invoiceNumber: string;
  outstanding: number;
  symbol: string;
  saving: boolean;
  onSubmit: (payload: {
    amount: number;
    paid_on: string;
    method: string;
    reference: string;
  }) => void;
}) {
  const [amount, setAmount] = useState(String(outstanding));
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Record payment · {invoiceNumber}</DialogTitle>
        <DialogDescription>
          {formatMoneyFull(outstanding, symbol)} outstanding. Payments above the balance are
          rejected by the backend.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="pay-amount" label="Amount" type="number" value={amount} onChange={setAmount} />
        <TextField id="pay-date" label="Paid on" type="date" value={paidOn} onChange={setPaidOn} />
        <PickerField
          id="pay-method"
          label="Method"
          value={method}
          onChange={setMethod}
          options={PAYMENT_METHODS}
        />
        <TextField
          id="pay-reference"
          label="Reference"
          value={reference}
          onChange={setReference}
        />
      </div>

      <DialogFooter>
        <Button
          disabled={saving}
          onClick={() =>
            onSubmit({ amount: Number(amount) || 0, paid_on: paidOn, method, reference })
          }
        >
          {saving && <Loader2 className="mr-1 size-4 animate-spin" />}
          Record payment
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}