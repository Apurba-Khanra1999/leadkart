import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarClock,
  IndianRupee,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatMoney, formatDateTime, relativeDay } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Sales Dashboard & Live KPIs — LeadKart CRM" },
      {
        name: "description",
        content:
          "Real-time sales dashboard: monitor open leads, weighted pipeline forecasts, follow-ups due today, and outstanding invoice balances.",
      },
      { property: "og:title", content: "Sales Dashboard & Live KPIs — LeadKart CRM" },
      { property: "og:description", content: "Live sales KPIs, weighted pipeline, and activity feeds for your organisation." },
      { property: "og:url", content: "https://leadkart.lovable.app/dashboard" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sales Dashboard — LeadKart CRM" },
    ],
    links: [{ rel: "canonical", href: "https://leadkart.lovable.app/dashboard" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;

  const stats = useQuery({
    queryKey: ["dashboard", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const today = new Date();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const [leads, deals, followups, invoices] = await Promise.all([
        supabase.from("leads").select("id, status_id, estimated_value").is("deleted_at", null),
        supabase
          .from("deals")
          .select("id, value, weighted_value, status, stage_id, deal_stages(name)")
          .is("deleted_at", null),
        supabase
          .from("follow_ups")
          .select("id, subject, type, due_at, status, priority, leads(first_name, last_name)")
          .neq("status", "completed")
          .lte("due_at", endOfDay.toISOString())
          .order("due_at", { ascending: true })
          .limit(6),
        supabase.from("invoices").select("id, total, paid_amount, outstanding_amount, status"),
      ]);

      const openDeals = (deals.data ?? []).filter((d) => d.status === "open");
      const won = (deals.data ?? []).filter((d) => d.status === "won");

      const byStage = new Map<string, { name: string; count: number; value: number }>();
      for (const d of openDeals) {
        const name = (d.deal_stages as unknown as { name: string } | null)?.name ?? "Unstaged";
        const row = byStage.get(name) ?? { name, count: 0, value: 0 };
        row.count += 1;
        row.value += Number(d.value ?? 0);
        byStage.set(name, row);
      }

      return {
        leadCount: leads.data?.length ?? 0,
        leadValue: (leads.data ?? []).reduce((s, l) => s + Number(l.estimated_value ?? 0), 0),
        openDealCount: openDeals.length,
        pipelineValue: openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0),
        weighted: openDeals.reduce((s, d) => s + Number(d.weighted_value ?? 0), 0),
        wonValue: won.reduce((s, d) => s + Number(d.value ?? 0), 0),
        winRate:
          deals.data && deals.data.length > 0
            ? Math.round((won.length / deals.data.filter((d) => d.status !== "open").length || 0) * 100)
            : 0,
        dueFollowUps: followups.data ?? [],
        outstanding: (invoices.data ?? []).reduce((s, i) => s + Number(i.outstanding_amount ?? 0), 0),
        overdueCount: (invoices.data ?? []).filter((i) => i.status === "overdue").length,
        stages: [...byStage.values()].sort((a, b) => b.value - a.value),
      };
    },
  });

  const timeline = useQuery({
    queryKey: ["dashboard-activities", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, title, description, type, actor_name, occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const symbol = ws?.currencySymbol ?? "₹";
  const maxStage = Math.max(1, ...(stats.data?.stages ?? []).map((s) => s.value));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Good to see you, {ws?.fullName?.split(" ")[0] ?? "there"}</h1>
        <p className="text-sm text-muted-foreground">
          Here's what needs your attention across {ws?.orgName ?? "your workspace"} today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Open leads"
          value={stats.data ? String(stats.data.leadCount) : undefined}
          hint={stats.data ? `${formatMoney(stats.data.leadValue, symbol)} estimated` : ""}
          icon={Users}
        />
        <Kpi
          label="Weighted pipeline"
          value={stats.data ? formatMoney(stats.data.weighted, symbol) : undefined}
          hint={stats.data ? `${formatMoney(stats.data.pipelineValue, symbol)} gross` : ""}
          icon={TrendingUp}
        />
        <Kpi
          label="Follow-ups due"
          value={stats.data ? String(stats.data.dueFollowUps.length) : undefined}
          hint="Today or overdue"
          icon={CalendarClock}
          tone={stats.data && stats.data.dueFollowUps.length > 0 ? "warning" : "default"}
        />
        <Kpi
          label="Outstanding"
          value={stats.data ? formatMoney(stats.data.outstanding, symbol) : undefined}
          hint={stats.data ? `${stats.data.overdueCount} invoices overdue` : ""}
          icon={IndianRupee}
          tone={stats.data && stats.data.overdueCount > 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pipeline by stage</CardTitle>
            <CardDescription>Open deals only, ordered by value</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!stats.data && <Skeleton className="h-40 w-full" />}
            {stats.data?.stages.length === 0 && (
              <p className="text-sm text-muted-foreground">No open deals yet.</p>
            )}
            {stats.data?.stages.map((stage) => (
              <div key={stage.name} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{stage.name}</span>
                  <span className="text-muted-foreground">
                    {stage.count} · {formatMoney(stage.value, symbol)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="bg-brand h-full rounded-full"
                    style={{ width: `${Math.max(4, (stage.value / maxStage) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {stats.data && (
              <div className="flex flex-wrap gap-4 border-t pt-4 text-sm">
                <Metric label="Open deals" value={String(stats.data.openDealCount)} />
                <Metric label="Won value" value={formatMoney(stats.data.wonValue, symbol)} />
                <Metric label="Win rate" value={`${Number.isFinite(stats.data.winRate) ? stats.data.winRate : 0}%`} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Needs action</CardTitle>
            <CardDescription>Follow-ups due today or overdue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!stats.data && <Skeleton className="h-32 w-full" />}
            {stats.data?.dueFollowUps.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing pending. Well played.</p>
            )}
            {stats.data?.dueFollowUps.map((f) => {
              const lead = f.leads as unknown as { first_name: string; last_name: string | null } | null;
              const overdue = new Date(f.due_at).getTime() < Date.now();
              return (
                <div key={f.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{f.subject ?? f.type}</p>
                    <Badge variant={overdue ? "destructive" : "secondary"}>{relativeDay(f.due_at)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lead ? `${lead.first_name} ${lead.last_name ?? ""}`.trim() : "General"} ·{" "}
                    {formatDateTime(f.due_at)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Activity timeline</CardTitle>
          <CardDescription>Everything happening across the workspace</CardDescription>
        </CardHeader>
        <CardContent>
          {!timeline.data && <Skeleton className="h-32 w-full" />}
          <ol className="space-y-4">
            {timeline.data?.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  {a.description && (
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.actor_name ?? "System"} · {formatDateTime(a.occurred_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | undefined;
  hint: string;
  icon: typeof Target;
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}