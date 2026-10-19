import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CalendarClock,
  IndianRupee,
  Target,
  TrendingUp,
  Users,
  Plus,
  ClipboardList,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Inbox,
  ArrowRight,
  ChevronRight,
  Clock,
  DollarSign,
  Building2,
  ExternalLink,
  Award,
  Zap,
  BarChart3,
  UserCheck,
  Briefcase,
  Layers,
  PhoneCall,
  Mail,
  Video,
  PieChart,
  UserPlus,
  User,
  ShieldCheck,
  Filter,
  Flame,
  Check,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatMoney, formatDateTime, relativeDay } from "@/lib/crm";

const LOCAL_FORMS_KEY = "leadflow_local_forms_v1";
const LOCAL_SUBMISSIONS_KEY = "leadflow_local_submissions_v1";

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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const queryClient = useQueryClient();

  const [timeRange, setTimeRange] = useState<"month" | "quarter" | "year" | "all">("month");
  const [quickLeadModalOpen, setQuickLeadModalOpen] = useState(false);

  // Quick Lead Form State
  const [leadFirstName, setLeadFirstName] = useState("");
  const [leadLastName, setLeadLastName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadEstimatedValue, setLeadEstimatedValue] = useState("");
  const [leadIndustry, setLeadIndustry] = useState("");

  const stats = useQuery({
    queryKey: ["dashboard", orgId, timeRange],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const today = new Date();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const [leads, deals, followups, invoices, formsRes, membersRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, status_id, estimated_value, created_at, source_id, lead_sources(name), assigned_member_id")
          .is("deleted_at", null),
        supabase
          .from("deals")
          .select("id, value, weighted_value, status, stage_id, created_at, deal_stages(name), assigned_member_id")
          .is("deleted_at", null),
        supabase
          .from("follow_ups")
          .select("id, subject, type, due_at, status, priority, leads(first_name, last_name)")
          .neq("status", "completed")
          .lte("due_at", endOfDay.toISOString())
          .order("due_at", { ascending: true })
          .limit(6),
        supabase.from("invoices").select("id, total, paid_amount, outstanding_amount, status, created_at"),
        supabase.from("forms").select("id, title, submission_count, is_active"),
        supabase.from("organization_members").select("id, full_name, email, role"),
      ]);

      const openDeals = (deals.data ?? []).filter((d) => d.status === "open");
      const won = (deals.data ?? []).filter((d) => d.status === "won");

      // Group deals by stage
      const byStage = new Map<string, { name: string; count: number; value: number }>();
      for (const d of openDeals) {
        const name = (d.deal_stages as unknown as { name: string } | null)?.name ?? "Unstaged";
        const row = byStage.get(name) ?? { name, count: 0, value: 0 };
        row.count += 1;
        row.value += Number(d.value ?? 0);
        byStage.set(name, row);
      }

      // Group leads by Lead Source
      const bySource = new Map<string, number>();
      (leads.data ?? []).forEach((l) => {
        const srcName = (l.lead_sources as unknown as { name: string } | null)?.name ?? "Direct / Manual";
        bySource.set(srcName, (bySource.get(srcName) || 0) + 1);
      });

      const topSources = [...bySource.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Team Performance Leaderboard
      const members = membersRes.data ?? [];
      const teamPerformance = members.map((m) => {
        const mLeads = (leads.data ?? []).filter((l) => l.assigned_member_id === m.id).length;
        const mDealsWon = won.filter((d) => d.assigned_member_id === m.id);
        const mWonVal = mDealsWon.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
        return {
          id: m.id,
          name: m.full_name,
          role: m.role,
          leadCount: mLeads,
          wonCount: mDealsWon.length,
          wonValue: mWonVal,
        };
      }).sort((a, b) => b.wonValue - a.wonValue);

      // Monthly Revenue Trend Data (Past 6 Months)
      const monthlyTrendMap = new Map<string, { month: string; won: number; pipeline: number }>();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
        monthlyTrendMap.set(key, { month: key, won: 0, pipeline: 0 });
      }

      (deals.data ?? []).forEach((d) => {
        if (!d.created_at) return;
        const dt = new Date(d.created_at);
        const key = `${monthNames[dt.getMonth()]} ${dt.getFullYear().toString().slice(2)}`;
        if (monthlyTrendMap.has(key)) {
          const entry = monthlyTrendMap.get(key)!;
          if (d.status === "won") entry.won += Number(d.value ?? 0);
          else if (d.status === "open") entry.pipeline += Number(d.value ?? 0);
        }
      });

      // Form metrics with local storage fallback
      const dbForms = formsRes.data ?? [];
      let localForms: any[] = [];
      let localSubs: any[] = [];
      if (typeof window !== "undefined") {
        try {
          const fRaw = localStorage.getItem(LOCAL_FORMS_KEY);
          if (fRaw) localForms = JSON.parse(fRaw);
          const sRaw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
          if (sRaw) localSubs = JSON.parse(sRaw);
        } catch (e) {
          console.error("Dashboard local storage query error", e);
        }
      }

      const totalFormCount = Math.max(dbForms.length, localForms.length);
      const activeFormCount = Math.max(
        dbForms.filter((f) => f.is_active).length,
        localForms.filter((f) => f.is_active).length,
      );

      const dbSubsCount = dbForms.reduce((acc, f) => acc + (f.submission_count || 0), 0);
      const totalSubmissionsCount = Math.max(dbSubsCount, localSubs.length);

      const closedDeals = deals.data ? deals.data.filter((d) => d.status !== "open") : [];
      const winRateCalc = closedDeals.length > 0 ? Math.round((won.length / closedDeals.length) * 100) : 0;
      const pipelineSum = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
      const avgDealVal = openDeals.length > 0 ? Math.round(pipelineSum / openDeals.length) : 0;

      return {
        leadCount: leads.data?.length ?? 0,
        leadValue: (leads.data ?? []).reduce((s, l) => s + Number(l.estimated_value ?? 0), 0),
        openDealCount: openDeals.length,
        pipelineValue: pipelineSum,
        weighted: openDeals.reduce((s, d) => s + Number(d.weighted_value ?? 0), 0),
        wonValue: won.reduce((s, d) => s + Number(d.value ?? 0), 0),
        winRate: winRateCalc,
        avgDealValue: avgDealVal,
        dueFollowUps: followups.data ?? [],
        outstanding: (invoices.data ?? []).reduce((s, i) => s + Number(i.outstanding_amount ?? 0), 0),
        overdueCount: (invoices.data ?? []).filter((i) => i.status === "overdue").length,
        stages: [...byStage.values()].sort((a, b) => b.value - a.value),
        sources: topSources,
        teamLeaderboard: teamPerformance,
        monthlyTrend: [...monthlyTrendMap.values()],
        totalForms: totalFormCount,
        activeForms: activeFormCount,
        totalSubmissions: totalSubmissionsCount,
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

  // Create Quick Lead Mutation
  const createQuickLeadMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No active organization found");
      if (!leadFirstName.trim()) throw new Error("First Name is required");

      const numVal = Number(leadEstimatedValue.replace(/[^0-9.]/g, "")) || 0;

      const { data, error } = await supabase
        .from("leads")
        .insert({
          organization_id: orgId,
          first_name: leadFirstName.trim(),
          last_name: leadLastName.trim() || null,
          email: leadEmail.trim() || null,
          phone: leadPhone.trim() || null,
          company: leadCompany.trim() || null,
          industry: leadIndustry.trim() || null,
          estimated_value: numVal,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Quick Lead created successfully!");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setQuickLeadModalOpen(false);
      setLeadFirstName("");
      setLeadLastName("");
      setLeadEmail("");
      setLeadPhone("");
      setLeadCompany("");
      setLeadEstimatedValue("");
      setLeadIndustry("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create lead");
    },
  });

  const symbol = ws?.currencySymbol ?? "₹";
  const greeting = getGreeting();
  const firstName = ws?.fullName ? ws.fullName.split(" ")[0] : "Team";
  const maxStage = Math.max(1, ...(stats.data?.stages ?? []).map((s) => s.value));

  const chartData = (stats.data?.stages ?? []).map((s) => ({
    name: s.name,
    value: s.value,
    count: s.count,
  }));

  return (
    <div className="space-y-6">
      {/* HERO WELCOME HEADER & QUICK ACTIONS */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-primary/10 via-purple-500/10 to-emerald-500/10 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="gap-1.5 bg-background/80 backdrop-blur-xs text-xs font-semibold px-2.5 py-0.5 border shadow-2xs">
                <Sparkles className="size-3.5 text-amber-500" />
                <span>Live Sales Command Center</span>
              </Badge>
              <Badge variant="outline" className="text-xs text-muted-foreground bg-background/50">
                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </Badge>
              <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                <ShieldCheck className="size-3 mr-1" /> Health: 98% Optimal
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {greeting}, {firstName}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Real-time sales revenue, forecast analytics, follow-ups, and intake feeds for <span className="font-semibold text-foreground">{ws?.orgName ?? "your workspace"}</span>.
            </p>
          </div>

          {/* QUICK ACTION BAR */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              size="sm"
              onClick={() => setQuickLeadModalOpen(true)}
              className="gap-1.5 shadow-sm font-semibold text-xs"
            >
              <UserPlus className="size-4" />
              <span>+ Quick Lead</span>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5 bg-background/80 backdrop-blur-xs shadow-2xs text-xs font-medium">
              <Link to="/forms">
                <ClipboardList className="size-4 text-purple-600 dark:text-purple-400" />
                <span>Build Form</span>
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5 bg-background/80 backdrop-blur-xs shadow-2xs text-xs font-medium">
              <Link to="/follow-ups">
                <CalendarClock className="size-4 text-amber-600 dark:text-amber-400" />
                <span>Follow-ups</span>
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5 bg-background/80 backdrop-blur-xs shadow-2xs text-xs font-medium">
              <Link to="/invoices">
                <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Invoices</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* TOP 4 KEY PERFORMANCE METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Open Leads"
          value={stats.data ? String(stats.data.leadCount) : undefined}
          hint={stats.data ? `${formatMoney(stats.data.leadValue, symbol)} estimated gross` : ""}
          icon={Users}
          gradient="from-blue-500/10 to-indigo-500/10"
          iconColor="text-blue-600 dark:text-blue-400"
          badge="Active Funnel"
        />
        <KpiCard
          label="Weighted Forecast"
          value={stats.data ? formatMoney(stats.data.weighted, symbol) : undefined}
          hint={stats.data ? `${formatMoney(stats.data.pipelineValue, symbol)} pipeline value` : ""}
          icon={TrendingUp}
          gradient="from-emerald-500/10 to-teal-500/10"
          iconColor="text-emerald-600 dark:text-emerald-400"
          badge="Pipeline Value"
        />
        <KpiCard
          label="Follow-ups Pending"
          value={stats.data ? String(stats.data.dueFollowUps.length) : undefined}
          hint={stats.data && stats.data.dueFollowUps.length > 0 ? "Requires action today" : "All clear today"}
          icon={CalendarClock}
          gradient="from-amber-500/10 to-orange-500/10"
          iconColor="text-amber-600 dark:text-amber-400"
          tone={stats.data && stats.data.dueFollowUps.length > 0 ? "warning" : "default"}
          badge="Action Center"
        />
        <KpiCard
          label="Outstanding Receivables"
          value={stats.data ? formatMoney(stats.data.outstanding, symbol) : undefined}
          hint={stats.data ? `${stats.data.overdueCount} overdue invoices` : ""}
          icon={IndianRupee}
          gradient="from-purple-500/10 to-rose-500/10"
          iconColor="text-purple-600 dark:text-purple-400"
          tone={stats.data && stats.data.overdueCount > 0 ? "danger" : "default"}
          badge="Invoicing"
        />
      </div>

      {/* MAIN DASHBOARD ANALYTICS GRID */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* PIPELINE BREAKDOWN & MONTHLY TREND (2 COLS) */}
        <Card className="shadow-sm border lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" />
                Pipeline & Revenue Performance
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time stage distribution and 6-month revenue forecasting.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-primary">
              <Link to="/pipeline">
                <span>Open Board</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <Tabs defaultValue="stages" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="stages" className="text-xs gap-1.5 font-medium">
                  <BarChart3 className="size-3.5" /> Stage Breakdown
                </TabsTrigger>
                <TabsTrigger value="trend" className="text-xs gap-1.5 font-medium">
                  <TrendingUp className="size-3.5" /> Revenue Velocity Trend
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stages" className="space-y-4">
                {!stats.data ? (
                  <Skeleton className="h-48 w-full" />
                ) : stats.data.stages.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm border border-dashed rounded-xl">
                    <Briefcase className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p>No open deals currently in the pipeline.</p>
                    <Button asChild size="sm" variant="outline" className="mt-3 text-xs gap-1.5">
                      <Link to="/pipeline">
                        <Plus className="size-3.5" /> Create First Deal
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="w-full h-48 pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-[11px] fill-muted-foreground" />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            className="text-[11px] fill-muted-foreground"
                            tickFormatter={(v) => `${symbol}${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                          />
                          <Tooltip content={<CustomTooltip symbol={symbol} />} />
                          <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} className="fill-primary/80 hover:fill-primary transition-all" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-3 pt-2">
                      {stats.data.stages.map((stage) => {
                        const pct = Math.max(4, Math.round((stage.value / maxStage) * 100));
                        return (
                          <div key={stage.name} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{stage.name}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  {stage.count} {stage.count === 1 ? "deal" : "deals"}
                                </Badge>
                              </div>
                              <span className="font-bold text-foreground font-mono">
                                {formatMoney(stage.value, symbol)}
                              </span>
                            </div>
                            <Progress value={pct} className="h-2 bg-muted/60" />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="trend" className="space-y-4">
                {!stats.data ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="w-full h-56 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.data.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorPipeline" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-[11px] fill-muted-foreground" />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          className="text-[11px] fill-muted-foreground"
                          tickFormatter={(v) => `${symbol}${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                        />
                        <Tooltip content={<CustomTooltip symbol={symbol} />} />
                        <Area type="monotone" dataKey="won" name="Won Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorWon)" />
                        <Area type="monotone" dataKey="pipeline" name="Pipeline" stroke="#6366f1" fillOpacity={1} fill="url(#colorPipeline)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* PIPELINE SUMMARY KPI PILLS */}
            {stats.data && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t pt-4 text-xs">
                <div className="rounded-xl border bg-card p-3 space-y-1 shadow-2xs">
                  <p className="text-[11px] text-muted-foreground">Open Deals</p>
                  <p className="text-base font-extrabold text-foreground">{stats.data.openDealCount}</p>
                </div>
                <div className="rounded-xl border bg-card p-3 space-y-1 shadow-2xs">
                  <p className="text-[11px] text-muted-foreground">Won Value</p>
                  <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(stats.data.wonValue, symbol)}
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-3 space-y-1 shadow-2xs">
                  <p className="text-[11px] text-muted-foreground">Win Rate</p>
                  <p className="text-base font-extrabold text-purple-600 dark:text-purple-400">
                    {Number.isFinite(stats.data.winRate) ? stats.data.winRate : 0}%
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-3 space-y-1 shadow-2xs">
                  <p className="text-[11px] text-muted-foreground">Avg Deal Size</p>
                  <p className="text-base font-extrabold text-foreground">
                    {formatMoney(stats.data.avgDealValue, symbol)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* NEEDS ATTENTION & FOLLOW-UPS (1 COL) */}
        <Card className="shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarClock className="size-4 text-amber-500" />
                Needs Attention
              </CardTitle>
              <CardDescription className="text-xs">Follow-ups due today or overdue</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-primary p-0 h-auto">
              <Link to="/follow-ups">View All</Link>
            </Button>
          </CardHeader>

          <CardContent className="space-y-3 pt-2">
            {!stats.data ? (
              <Skeleton className="h-44 w-full" />
            ) : stats.data.dueFollowUps.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-xs space-y-2 border border-dashed rounded-xl">
                <CheckCircle2 className="size-8 text-emerald-500/60 mx-auto" />
                <p className="font-semibold text-foreground">All caught up!</p>
                <p className="text-muted-foreground">No pending follow-ups due today.</p>
              </div>
            ) : (
              stats.data.dueFollowUps.map((f) => {
                const lead = f.leads as unknown as { first_name: string; last_name: string | null } | null;
                const overdue = new Date(f.due_at).getTime() < Date.now();

                return (
                  <div
                    key={f.id}
                    className="rounded-xl border bg-card p-3.5 space-y-2 transition-transform hover:translate-x-0.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {f.type === "call" ? (
                          <PhoneCall className="size-3.5 text-blue-500 shrink-0" />
                        ) : f.type === "meeting" || f.type === "demo" ? (
                          <Video className="size-3.5 text-purple-500 shrink-0" />
                        ) : (
                          <Mail className="size-3.5 text-emerald-500 shrink-0" />
                        )}
                        <p className="text-xs font-semibold text-foreground line-clamp-1">
                          {f.subject ?? f.type}
                        </p>
                      </div>
                      <Badge
                        variant={overdue ? "destructive" : "secondary"}
                        className="text-[10px] shrink-0 font-semibold px-2"
                      >
                        {relativeDay(f.due_at)}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                      <span className="font-medium text-foreground">
                        {lead ? `${lead.first_name} ${lead.last_name ?? ""}`.trim() : "General Lead"}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="size-3" />
                        {formatDateTime(f.due_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* LEAD SOURCE & TEAM LEADERBOARD GRID */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* TOP LEAD SOURCES CHANNEL BREAKDOWN */}
        <Card className="shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <PieChart className="size-4 text-indigo-500" />
                Top Lead Sources & Channels
              </CardTitle>
              <CardDescription className="text-xs">
                Inbound lead volume breakdown by channel.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-primary p-0 h-auto">
              <Link to="/leads">View Leads</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {!stats.data ? (
              <Skeleton className="h-36 w-full" />
            ) : stats.data.sources.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No lead source metrics available.</p>
            ) : (
              stats.data.sources.map((src) => {
                const totalL = stats.data?.leadCount || 1;
                const pct = Math.round((src.count / totalL) * 100);
                return (
                  <div key={src.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{src.name}</span>
                      <span className="font-bold text-foreground font-mono">
                        {src.count} leads ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5 bg-muted/60" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* TEAM SALES LEADERBOARD */}
        <Card className="shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Award className="size-4 text-amber-500" />
                Team Sales Rep Leaderboard
              </CardTitle>
              <CardDescription className="text-xs">
                Won revenue and lead assignment breakdown.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-primary p-0 h-auto">
              <Link to="/team">Team Members</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {!stats.data ? (
              <Skeleton className="h-36 w-full" />
            ) : stats.data.teamLeaderboard.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No team performance metrics recorded.</p>
            ) : (
              stats.data.teamLeaderboard.slice(0, 4).map((member, idx) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border bg-card text-xs shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{member.role.replace("_", " ")}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatMoney(member.wonValue, symbol)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {member.wonCount} won · {member.leadCount} assigned
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* BOTTOM GRID: FORM INTAKE SUMMARY & WORKSPACE ACTIVITIES */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* DYNAMIC FORM INTAKE WIDGET */}
        <Card className="shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ClipboardList className="size-4 text-purple-600 dark:text-purple-400" />
                Form Lead Intake Summary
              </CardTitle>
              <CardDescription className="text-xs">
                Performance metrics for dynamic lead generation forms.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-medium h-8">
              <Link to="/forms">
                <Plus className="size-3.5" />
                <span>Build Form</span>
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {!stats.data ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border bg-gradient-to-br from-purple-500/5 to-indigo-500/5 p-3.5 text-center space-y-1">
                    <p className="text-[11px] text-muted-foreground font-medium">Total Forms</p>
                    <p className="text-xl font-black text-foreground">{stats.data.totalForms}</p>
                  </div>
                  <div className="rounded-xl border bg-gradient-to-br from-emerald-500/5 to-teal-500/5 p-3.5 text-center space-y-1">
                    <p className="text-[11px] text-muted-foreground font-medium">Active Live</p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {stats.data.activeForms}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-gradient-to-br from-blue-500/5 to-sky-500/5 p-3.5 text-center space-y-1">
                    <p className="text-[11px] text-muted-foreground font-medium">Responses</p>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400">
                      {stats.data.totalSubmissions}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-amber-500" />
                      Readymade Form Templates
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Deploy 12 pre-built templates for Feedback, Sales Quotes, NPS, and Demos in 1 click.
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary" className="shrink-0 text-xs gap-1 font-semibold">
                    <Link to="/forms">
                      <span>Explore</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* WORKSPACE ACTIVITY FEED */}
        <Card className="shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="size-4 text-emerald-500" />
                Live Activity Timeline
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time stream of team actions, lead changes, and deals.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            {!timeline.data ? (
              <Skeleton className="h-40 w-full" />
            ) : timeline.data.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No recent activities logged.</p>
            ) : (
              <ol className="relative border-l border-border/60 ml-2 space-y-4 my-1">
                {timeline.data.map((a) => (
                  <li key={a.id} className="ml-4 space-y-1">
                    <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-background bg-primary" />
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">{a.title}</p>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatDateTime(a.occurred_at)}
                      </span>
                    </div>
                    {a.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{a.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/80 font-medium">
                      By {a.actor_name ?? "System"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QUICK LEAD CREATION MODAL DIALOG */}
      <Dialog open={quickLeadModalOpen} onOpenChange={setQuickLeadModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Quick Create New Lead
            </DialogTitle>
            <DialogDescription className="text-xs">
              Instantly capture a lead directly from your sales dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">First Name *</Label>
                <Input
                  placeholder="Rahul"
                  value={leadFirstName}
                  onChange={(e) => setLeadFirstName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Last Name</Label>
                <Input
                  placeholder="Sharma"
                  value={leadLastName}
                  onChange={(e) => setLeadLastName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Email Address</Label>
                <Input
                  placeholder="rahul@company.com"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  placeholder="+91 98765 43210"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Company Name</Label>
                <Input
                  placeholder="Acme Tech Pvt Ltd"
                  value={leadCompany}
                  onChange={(e) => setLeadCompany(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Estimated Value ({symbol})</Label>
                <Input
                  placeholder="500000"
                  value={leadEstimatedValue}
                  onChange={(e) => setLeadEstimatedValue(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setQuickLeadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createQuickLeadMutation.mutate()}
              disabled={createQuickLeadMutation.isPending}
              className="gap-1.5"
            >
              {createQuickLeadMutation.isPending && <Sparkles className="size-4 animate-spin" />}
              <span>Create Lead</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  gradient,
  iconColor,
  tone = "default",
  badge,
}: {
  label: string;
  value: string | undefined;
  hint: string;
  icon: typeof Target;
  gradient: string;
  iconColor: string;
  tone?: "default" | "warning" | "danger";
  badge?: string;
}) {
  return (
    <Card className="shadow-sm border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <div className={`p-2 rounded-xl bg-gradient-to-br ${gradient} border shadow-2xs`}>
            <Icon className={`size-4.5 ${iconColor}`} />
          </div>
        </div>

        <div>
          {value === undefined ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="text-2xl font-black tracking-tight text-foreground">{value}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
          <span className="text-muted-foreground flex items-center gap-1 font-medium">
            <ArrowUpRight className="size-3 text-emerald-500 shrink-0" />
            {hint}
          </span>
          {badge && (
            <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 bg-background/50">
              {badge}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label, symbol }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border bg-popover p-3 text-popover-foreground shadow-md text-xs space-y-1">
        <p className="font-bold text-foreground">{label}</p>
        <p className="text-primary font-semibold">
          Value: {formatMoney(data.value || data.won || 0, symbol)}
        </p>
        {data.count !== undefined && (
          <p className="text-muted-foreground text-[11px]">
            Open Deals: {data.count}
          </p>
        )}
      </div>
    );
  }
  return null;
}