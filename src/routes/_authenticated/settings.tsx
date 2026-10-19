import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Receipt,
  BarChart3,
  Plus,
  Save,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  HelpCircle,
  Layers,
  Sliders,
  Globe,
  Phone,
  Mail,
  FileText,
  Check,
  Copy,
  Hash,
  Briefcase,
  TrendingUp,
  PieChart,
  Percent,
  Calendar,
  Lock,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { NoAccess } from "@/components/crm/page";
import { TextField } from "@/components/crm/fields";
import { can, useWorkspace } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Workspace & Organization Settings — LeadKart CRM" },
      {
        name: "description",
        content:
          "Configure company profile, financial tax rates, payment terms, currency, custom lead acquisition sources, and sales pipeline stages.",
      },
      { property: "og:title", content: "Workspace & Organization Settings — LeadKart CRM" },
      { property: "og:description", content: "Configure LeadKart CRM to match your sales workflow." },
      { property: "og:url", content: "https://leadkartpro.vercel.app/settings" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Organization Settings — LeadKart CRM" },
    ],
    links: [{ rel: "canonical", href: "https://leadkartpro.vercel.app/settings" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const queryClient = useQueryClient();
  const canManageOrg = can(ws, "org.manage");
  const canManageSettings = can(ws, "settings.manage");

  const [activeTab, setActiveTab] = useState("general");

  const org = useQuery({
    queryKey: ["org-settings", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const [organization, settings] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, business_type, email, phone, address, city, tax_number, currency, currency_symbol")
          .eq("id", orgId!)
          .single(),
        supabase
          .from("org_settings")
          .select("organization_id, default_tax_percent, default_payment_terms_days")
          .eq("organization_id", orgId!)
          .maybeSingle(),
      ]);
      if (organization.error) throw organization.error;
      return { organization: organization.data, settings: settings.data };
    },
  });

  const lists = useQuery({
    queryKey: ["config-lists", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const [sources, statuses, stages] = await Promise.all([
        supabase.from("lead_sources").select("id, name, is_active").order("sort_order"),
        supabase.from("lead_statuses").select("id, name, is_active, is_won, is_lost").order("sort_order"),
        supabase
          .from("deal_stages")
          .select("id, name, default_probability, is_active")
          .order("sort_order"),
      ]);
      return {
        sources: sources.data ?? [],
        statuses: statuses.data ?? [],
        stages: stages.data ?? [],
      };
    },
  });

  const saveOrg = useMutation({
    mutationFn: async (payload: {
      name: string;
      business_type: string;
      email: string;
      phone: string;
      city: string;
      tax_number: string;
      default_tax_percent: number;
      default_payment_terms_days: number;
    }) => {
      if (!orgId) throw new Error("Workspace not ready");
      const { error } = await supabase
        .from("organizations")
        .update({
          name: payload.name,
          business_type: payload.business_type || null,
          email: payload.email || null,
          phone: payload.phone || null,
          city: payload.city || null,
          tax_number: payload.tax_number || null,
        })
        .eq("id", orgId);
      if (error) throw error;

      const { error: settingsError } = await supabase
        .from("org_settings")
        .update({
          default_tax_percent: payload.default_tax_percent,
          default_payment_terms_days: payload.default_payment_terms_days,
        })
        .eq("organization_id", orgId);
      if (settingsError) throw settingsError;
    },
    onSuccess: () => {
      toast.success("Workspace settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["org-settings", orgId] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  const addSource = useMutation({
    mutationFn: async (name: string) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!name.trim()) throw new Error("Enter a source name");
      const { error } = await supabase.from("lead_sources").insert({
        organization_id: orgId,
        name: name.trim(),
        sort_order: (lists.data?.sources.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("New lead source added");
      setNewSource("");
      queryClient.invalidateQueries({ queryKey: ["config-lists", orgId] });
      queryClient.invalidateQueries({ queryKey: ["lead-meta", orgId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add lead source"),
  });

  const [form, setForm] = useState({
    name: "",
    business_type: "",
    email: "",
    phone: "",
    city: "",
    tax_number: "",
    default_tax_percent: "18",
    default_payment_terms_days: "15",
  });
  const [newSource, setNewSource] = useState("");

  useEffect(() => {
    if (!org.data?.organization) return;
    const o = org.data.organization;
    setForm({
      name: o.name ?? "",
      business_type: o.business_type ?? "",
      email: o.email ?? "",
      phone: o.phone ?? "",
      city: o.city ?? "",
      tax_number: o.tax_number ?? "",
      default_tax_percent: String(org.data.settings?.default_tax_percent ?? 18),
      default_payment_terms_days: String(org.data.settings?.default_payment_terms_days ?? 15),
    });
  }, [org.data]);

  // Keyboard shortcut Ctrl+S / Cmd+S to save settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (canManageOrg && !saveOrg.isPending) {
          saveOrg.mutate({
            ...form,
            default_tax_percent: Number(form.default_tax_percent) || 0,
            default_payment_terms_days: Number(form.default_payment_terms_days) || 0,
          });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [form, canManageOrg, saveOrg]);

  function copyTenantId() {
    if (!orgId) return;
    navigator.clipboard.writeText(orgId);
    toast.success("Workspace Tenant ID copied to clipboard");
  }

  if (ws && !canManageOrg && !canManageSettings) return <NoAccess what="workspace settings" />;

  const oData = org.data?.organization;

  return (
    <div className="space-y-6 pb-10">
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
                Workspace Active
              </span>

              {orgId && (
                <button
                  type="button"
                  onClick={copyTenantId}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-muted/60 text-muted-foreground hover:text-foreground border border-border/60 cursor-pointer transition-colors"
                  title="Click to copy Tenant ID"
                >
                  <Hash className="size-3 text-primary" />
                  <span>ID: {orgId.slice(0, 8)}…</span>
                  <Copy className="size-2.5 opacity-60 ml-0.5" />
                </button>
              )}

              {oData && (
                <Badge variant="outline" className="text-[11px] text-muted-foreground bg-background/60 font-mono">
                  {oData.currency} ({oData.currency_symbol})
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Workspace & Org Settings ⚙️
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Configure company profile, financial tax defaults, invoice terms, pipeline stages, and inbound lead acquisition channels.
            </p>
          </div>

          {/* QUICK SAVE ACTION */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              disabled={!canManageOrg || saveOrg.isPending}
              onClick={() =>
                saveOrg.mutate({
                  ...form,
                  default_tax_percent: Number(form.default_tax_percent) || 0,
                  default_payment_terms_days: Number(form.default_payment_terms_days) || 0,
                })
              }
              className="gap-1.5 shadow-sm font-semibold text-xs cursor-pointer"
            >
              {saveOrg.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              <span>Save Changes</span>
              <span className="opacity-60 text-[10px] font-mono ml-1 hidden sm:inline">⌘S</span>
            </Button>
          </div>
        </div>
      </div>

      {/* MODERN TABBED SETTINGS INTERFACE */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-muted/60 p-1 rounded-xl h-auto gap-1">
          <TabsTrigger value="general" className="text-xs font-semibold py-2 rounded-lg gap-1.5">
            <Building2 className="size-3.5" /> Company Profile
          </TabsTrigger>
          <TabsTrigger value="finance" className="text-xs font-semibold py-2 rounded-lg gap-1.5">
            <Receipt className="size-3.5" /> Finance & Invoicing
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs font-semibold py-2 rounded-lg gap-1.5">
            <BarChart3 className="size-3.5" /> Pipeline Stages
          </TabsTrigger>
          <TabsTrigger value="channels" className="text-xs font-semibold py-2 rounded-lg gap-1.5">
            <Layers className="size-3.5" /> Inbound Channels
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: COMPANY PROFILE */}
        <TabsContent value="general" className="space-y-6 focus-visible:outline-none">
          <Card className="shadow-xs border rounded-2xl">
            <CardHeader className="p-6 pb-4 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Building2 className="size-4.5 text-primary" />
                    Organization Profile
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Primary legal entity information displayed on quotations, client records, and headers.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {form.city ? `${form.city}, India` : "Global Tenant"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {org.isLoading && <Skeleton className="h-44 w-full rounded-xl" />}

              {org.data && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    id="org-name"
                    label="Organization / Company Name *"
                    value={form.name}
                    onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                    placeholder="e.g. Acme Tech Solutions Pvt Ltd"
                  />
                  <TextField
                    id="org-type"
                    label="Business Category / Industry"
                    value={form.business_type}
                    onChange={(v) => setForm((p) => ({ ...p, business_type: v }))}
                    placeholder="e.g. B2B SaaS, Agency, Manufacturing"
                  />
                  <TextField
                    id="org-email"
                    label="Official Billing Email"
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                    placeholder="billing@acme.com"
                  />
                  <TextField
                    id="org-phone"
                    label="Contact Telephone"
                    value={form.phone}
                    onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                    placeholder="+91 98765 43210"
                  />
                  <TextField
                    id="org-city"
                    label="Primary Operating City"
                    value={form.city}
                    onChange={(v) => setForm((p) => ({ ...p, city: v }))}
                    placeholder="Bengaluru / Mumbai"
                  />
                  <TextField
                    id="org-tax"
                    label="Tax Number (GSTIN / VAT / EIN)"
                    value={form.tax_number}
                    onChange={(v) => setForm((p) => ({ ...p, tax_number: v }))}
                    placeholder="29AAAAA0000A1Z5"
                  />
                </div>
              )}

              {/* Currency & Workspace Lock Callout */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-primary" />
                    Base Financial Currency
                  </p>
                  <p className="text-xs text-muted-foreground">
                    All quotations, deal values, and revenue dashboards calculate in{" "}
                    <strong className="text-foreground">
                      {oData?.currency ?? "INR"} ({oData?.currency_symbol ?? "₹"})
                    </strong>
                    .
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 bg-background shrink-0">
                  {oData?.currency ?? "INR"} · Symbol: {oData?.currency_symbol ?? "₹"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: FINANCE & INVOICING DEFAULTS */}
        <TabsContent value="finance" className="space-y-6 focus-visible:outline-none">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* INVOICE & TAX SETTINGS */}
            <Card className="shadow-xs border rounded-2xl lg:col-span-2">
              <CardHeader className="p-6 pb-4 border-b border-border/40">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Receipt className="size-4.5 text-emerald-600" />
                  Tax & Payment Terms Defaults
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Default parameters applied automatically when generating new customer quotations and tax invoices.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="org-tax-percent" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Percent className="size-3.5 text-primary" />
                      Default Tax / GST Rate (%)
                    </Label>
                    <Input
                      id="org-tax-percent"
                      type="number"
                      step="0.1"
                      value={form.default_tax_percent}
                      onChange={(e) => setForm((p) => ({ ...p, default_tax_percent: e.target.value }))}
                      className="h-9 text-xs font-mono"
                      placeholder="18"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Standard GST rate (e.g. 18% for services and software in India).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="org-terms" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-indigo-500" />
                      Payment Terms (Net Days)
                    </Label>
                    <Input
                      id="org-terms"
                      type="number"
                      value={form.default_payment_terms_days}
                      onChange={(e) => setForm((p) => ({ ...p, default_payment_terms_days: e.target.value }))}
                      className="h-9 text-xs font-mono"
                      placeholder="15"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Number of days before an unpaid invoice automatically shifts to Overdue status.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <HelpCircle className="size-3.5 text-amber-500" />
                    How defaults work
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Changing these defaults will not alter existing invoices or finalized quotations. New records created from this point forward will adopt the configured rate and payment cycle.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* LIVE INVOICE PREVIEW CARD */}
            <Card className="shadow-xs border rounded-2xl bg-gradient-to-br from-card via-card to-muted/20">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText className="size-4 text-primary" />
                  Invoice Preview Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4">
                <div className="rounded-xl border bg-card p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-foreground">Sample Line Item</span>
                    <span className="text-xs font-mono font-bold text-foreground">₹100,000</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Tax ({form.default_tax_percent}%)</span>
                    <span className="font-mono text-foreground">
                      ₹{((100000 * (Number(form.default_tax_percent) || 0)) / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 text-xs font-bold">
                    <span className="text-foreground">Invoice Total</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                      ₹{(100000 + (100000 * (Number(form.default_tax_percent) || 0)) / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-background/80 p-3 text-[11px] text-muted-foreground border space-y-1">
                  <p className="font-semibold text-foreground">Payment Due Policy:</p>
                  <p>
                    Net <strong className="text-foreground">{form.default_payment_terms_days} days</strong> from invoice issue date.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: PIPELINE STAGES & STATUSES */}
        <TabsContent value="pipeline" className="space-y-6 focus-visible:outline-none">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* DEAL PIPELINE STAGES */}
            <Card className="shadow-xs border rounded-2xl">
              <CardHeader className="p-6 pb-4 border-b border-border/40">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <BarChart3 className="size-4.5 text-primary" />
                  Deal Pipeline Stages & Probabilities
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  The sequential sales motion stages used by your Kanban board and weighted forecast engine.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-3">
                {lists.isLoading && <Skeleton className="h-40 w-full rounded-xl" />}

                {(lists.data?.stages ?? []).map((stage, idx) => (
                  <div
                    key={stage.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-card text-xs shadow-2xs hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-bold text-foreground">{stage.name}</p>
                        <p className="text-[10px] text-muted-foreground">Active in pipeline board</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant="outline" className="text-[11px] font-mono font-semibold">
                        {stage.default_probability}% Win Prob
                      </Badge>
                      <Progress value={stage.default_probability} className="h-1.5 w-20 bg-muted/60" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* LEAD STATUSES */}
            <Card className="shadow-xs border rounded-2xl">
              <CardHeader className="p-6 pb-4 border-b border-border/40">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sliders className="size-4.5 text-indigo-500" />
                  Lead Funnel Status Tags
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Lifecycle states assigned to prospective contacts before or during deal conversion.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-3">
                {lists.isLoading && <Skeleton className="h-40 w-full rounded-xl" />}

                <div className="grid grid-cols-2 gap-3">
                  {(lists.data?.statuses ?? []).map((status) => (
                    <div
                      key={status.id}
                      className="p-3.5 rounded-xl border bg-card space-y-1.5 shadow-2xs hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{status.name}</span>
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            status.is_won
                              ? "bg-emerald-500"
                              : status.is_lost
                              ? "bg-rose-500"
                              : "bg-blue-500"
                          )}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {status.is_won
                          ? "✓ Won / Converted State"
                          : status.is_lost
                          ? "✕ Closed Lost State"
                          : "Active In-Progress State"}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: INBOUND CHANNELS & SOURCES */}
        <TabsContent value="channels" className="space-y-6 focus-visible:outline-none">
          <Card className="shadow-xs border rounded-2xl">
            <CardHeader className="p-6 pb-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Layers className="size-4.5 text-purple-600 dark:text-purple-400" />
                  Lead Acquisition Channels & Sources
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Manage the marketing and sales attribution channels for inbound prospects.
                </CardDescription>
              </div>

              {canManageSettings && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    value={newSource}
                    placeholder="e.g. YouTube Ads / Cold Outreach"
                    onChange={(e) => setNewSource(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSource.trim()) {
                        e.preventDefault();
                        addSource.mutate(newSource);
                      }
                    }}
                    className="h-8 text-xs max-w-xs"
                  />
                  <Button
                    size="sm"
                    disabled={addSource.isPending || !newSource.trim()}
                    onClick={() => addSource.mutate(newSource)}
                    className="h-8 text-xs font-semibold gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Source</span>
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {lists.isLoading && <Skeleton className="h-28 w-full rounded-xl" />}

              <div className="flex flex-wrap gap-2.5">
                {(lists.data?.sources ?? []).map((source) => (
                  <div
                    key={source.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-card text-xs font-semibold shadow-2xs hover:border-primary/40 transition-colors"
                  >
                    <span className="size-2 rounded-full bg-primary" />
                    <span className="text-foreground">{source.name}</span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-muted-foreground">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 flex items-center gap-3 text-xs text-muted-foreground">
                <Sparkles className="size-4 text-amber-500 shrink-0" />
                <span>
                  Sources are directly selectable in the Quick Lead modal, full Lead creation forms, and dynamic public forms.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}