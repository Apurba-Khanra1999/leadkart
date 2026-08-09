import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccess, PageHeader } from "@/components/crm/page";
import { TextField } from "@/components/crm/fields";
import { can, useWorkspace } from "@/hooks/use-workspace";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Workspace settings — Zenith CRM" },
      {
        name: "description",
        content:
          "Company profile, currency, numbering prefixes, tax defaults and the lead sources, statuses and pipeline stages your team works with.",
      },
      { property: "og:title", content: "Workspace settings — Zenith CRM" },
      { property: "og:description", content: "Tune your CRM to how your business actually sells." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const queryClient = useQueryClient();
  const canManageOrg = can(ws, "org.manage");
  const canManageSettings = can(ws, "settings.manage");

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
      toast.success("Workspace saved");
      queryClient.invalidateQueries({ queryKey: ["org-settings", orgId] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  const addSource = useMutation({
    mutationFn: async (name: string) => {
      if (!orgId) throw new Error("Workspace not ready");
      if (!name.trim()) throw new Error("Enter a name");
      const { error } = await supabase.from("lead_sources").insert({
        organization_id: orgId,
        name: name.trim(),
        sort_order: (lists.data?.sources.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead source added");
      queryClient.invalidateQueries({ queryKey: ["config-lists", orgId] });
      queryClient.invalidateQueries({ queryKey: ["lead-meta", orgId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add"),
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

  if (ws && !canManageOrg && !canManageSettings) return <NoAccess what="workspace settings" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace settings"
        subtitle="Company profile, finance defaults and the lists your pipeline runs on"
      />

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Company profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {org.isLoading && <Skeleton className="h-40" />}
          {org.data && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="org-name"
                  label="Organization name"
                  value={form.name}
                  onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                />
                <TextField
                  id="org-type"
                  label="Business type"
                  value={form.business_type}
                  onChange={(v) => setForm((p) => ({ ...p, business_type: v }))}
                />
                <TextField
                  id="org-email"
                  label="Billing email"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                />
                <TextField
                  id="org-phone"
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                />
                <TextField
                  id="org-city"
                  label="City"
                  value={form.city}
                  onChange={(v) => setForm((p) => ({ ...p, city: v }))}
                />
                <TextField
                  id="org-tax"
                  label="Tax / GST number"
                  value={form.tax_number}
                  onChange={(v) => setForm((p) => ({ ...p, tax_number: v }))}
                />
                <TextField
                  id="org-tax-percent"
                  label="Default tax %"
                  type="number"
                  value={form.default_tax_percent}
                  onChange={(v) => setForm((p) => ({ ...p, default_tax_percent: v }))}
                />
                <TextField
                  id="org-terms"
                  label="Payment terms (days)"
                  type="number"
                  value={form.default_payment_terms_days}
                  onChange={(v) => setForm((p) => ({ ...p, default_payment_terms_days: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Currency {org.data.organization.currency} ({org.data.organization.currency_symbol})
                </p>
                <Button
                  disabled={!canManageOrg || saveOrg.isPending}
                  onClick={() =>
                    saveOrg.mutate({
                      ...form,
                      default_tax_percent: Number(form.default_tax_percent) || 0,
                      default_payment_terms_days: Number(form.default_payment_terms_days) || 0,
                    })
                  }
                >
                  {saveOrg.isPending ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-1 size-4" />
                  )}
                  Save changes
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lead sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(lists.data?.sources ?? []).map((source) => (
                <Badge key={source.id} variant={source.is_active ? "secondary" : "outline"}>
                  {source.name}
                </Badge>
              ))}
            </div>
            {canManageSettings && (
              <div className="space-y-2">
                <Label htmlFor="new-source">Add a source</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-source"
                    value={newSource}
                    placeholder="e.g. LinkedIn"
                    onChange={(event) => setNewSource(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={addSource.isPending}
                    onClick={() =>
                      addSource.mutate(newSource, { onSuccess: () => setNewSource("") })
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lead statuses</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(lists.data?.statuses ?? []).map((status) => (
              <Badge
                key={status.id}
                variant={status.is_won ? "default" : status.is_lost ? "destructive" : "secondary"}
              >
                {status.name}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline stages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(lists.data?.stages ?? []).map((stage) => (
              <div key={stage.id} className="flex items-center justify-between text-sm">
                <span>{stage.name}</span>
                <span className="text-muted-foreground">{stage.default_probability}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}