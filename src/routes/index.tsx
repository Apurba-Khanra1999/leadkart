import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Coins,
  Compass,
  FileCheck2,
  FileText,
  Filter,
  Flame,
  Globe2,
  HelpCircle,
  KanbanSquare,
  Layers,
  Lock,
  MessageSquare,
  PackageSearch,
  PanelsTopLeft,
  QrCode,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Video,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { formatMoney } from "@/lib/crm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, shrink-to-fit=no" },
      { title: "LeadKart CRM — Enterprise Multi-Tenant B2B Sales & Revenue Platform" },
      {
        name: "description",
        content:
          "LeadKart CRM is the modern B2B sales engine. Capture leads with QR forms, forecast deals on visual Kanban pipelines, automate Google Meet follow-ups, and convert quotes to paid invoices with database-enforced security.",
      },
      {
        name: "keywords",
        content:
          "b2b sales crm, lead management, sales pipeline, quotation builder, invoicing software, multi-tenant crm, leadflow pro, leadkart, deal forecast, sales automation, revenue operations",
      },
      { name: "author", content: "LeadKart CRM Team" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { property: "og:site_name", content: "LeadKart CRM" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leadkartpro.vercel.app/" },
      { property: "og:title", content: "LeadKart CRM — Multi-Tenant B2B Sales Platform & Pipeline Management" },
      {
        property: "og:description",
        content:
          "Run your entire sales cycle from capture to cash in one disciplined workspace with Postgres Row-Level Security. Qualified leads, Kanban forecasting, automated follow-ups, and CPQ invoicing.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aaff1b2b9238acc4d535cc191c729e0a/id-preview-30a4b55d--2126f7d6-ffea-4536-ab9d-17006d9aa17f.lovable.app-1786166547462.png",
      },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:creator", content: "@Lovable" },
      { name: "twitter:title", content: "LeadKart CRM — Enterprise Multi-Tenant Sales CRM" },
      {
        name: "twitter:description",
        content:
          "Qualify leads, automate follow-ups, forecast deal pipelines, generate quotations, and manage invoices with database-enforced isolation.",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aaff1b2b9238acc4d535cc191c729e0a/id-preview-30a4b55d--2126f7d6-ffea-4536-ab9d-17006d9aa17f.lovable.app-1786166547462.png",
      },
    ],
    links: [{ rel: "canonical", href: "https://leadkartpro.vercel.app/" }],
  }),
  component: Index,
});

/* =========================================================================
   MOCK DEMO DATA FOR INTERACTIVE SHOWCASE & CHARTS
   ========================================================================= */

const velocityGrowthData = [
  { month: "Month 1", legacy: 450000, leadkart: 680000, cycleLegacy: 45, cycleLeadkart: 30 },
  { month: "Month 2", legacy: 520000, leadkart: 1120000, cycleLegacy: 43, cycleLeadkart: 24 },
  { month: "Month 3", legacy: 610000, leadkart: 1780000, cycleLegacy: 41, cycleLeadkart: 19 },
  { month: "Month 4", legacy: 580000, leadkart: 2650000, cycleLegacy: 42, cycleLeadkart: 16 },
  { month: "Month 5", legacy: 690000, leadkart: 3740000, cycleLegacy: 40, cycleLeadkart: 14 },
  { month: "Month 6", legacy: 740000, leadkart: 4860000, cycleLegacy: 39, cycleLeadkart: 12 },
];

const funnelStages = [
  { stage: "1. Inbound Leads Captured", count: "1,450", pct: 100, label: "Via QR Forms & Web", change: "+42% capture" },
  { stage: "2. Qualified & Assigned", count: "1,120", pct: 77, label: "Automated Lead Routing", change: "15 min response" },
  { stage: "3. Demos & Meets Held", count: "690", pct: 48, label: "Auto-detected Google Meet", change: "96% attendance" },
  { stage: "4. Quotations Sent (CPQ)", count: "420", pct: 29, label: "Approved Line Items", change: "4 hr turnaround" },
  { stage: "5. Closed Deals & Cash", count: "215", pct: 15, label: "Reconciled Invoices", change: "3.4x velocity" },
];

const mockPipelineDeals = [
  {
    stage: "Discovery Call",
    count: 14,
    value: 1850000,
    deals: [
      { title: "Cloud ERP Migration", client: "Nexus Tech Solutions", amount: "₹4.5L", rep: "Aakash S." },
      { title: "Annual SaaS License", client: "Vanguard Logistics", amount: "₹2.8L", rep: "Priya M." },
    ],
  },
  {
    stage: "Demo Scheduled",
    count: 8,
    value: 2900000,
    deals: [
      { title: "Smart Office Fitout", client: "Prestige Spaces", amount: "₹12.0L", rep: "Rohit K." },
      { title: "Custom FinTech Suite", client: "Credence Capital", amount: "₹7.5L", rep: "Neha T." },
    ],
  },
  {
    stage: "Proposal Sent",
    count: 6,
    value: 4100000,
    deals: [
      { title: "Enterprise CRM Rollout", client: "Apex Retail Group", amount: "₹18.0L", rep: "Aakash S." },
      { title: "Industrial Automation", client: "Bharat Steel Corp", amount: "₹9.2L", rep: "Priya M." },
    ],
  },
  {
    stage: "Closed Won",
    count: 12,
    value: 4860000,
    deals: [
      { title: "Logistics Dashboard", client: "Zenith Freight", amount: "₹15.4L", rep: "Rohit K." },
      { title: "Digital Transformation", client: "Sterling Health", amount: "₹21.0L", rep: "Neha T." },
    ],
  },
];

const mockLeads = [
  {
    name: "Arjun Mehta",
    company: "Mehta Industrial Systems",
    source: "Website QR Form",
    status: "Qualified",
    priority: "High",
    val: "₹6,50,000",
    owner: "Rohit K.",
  },
  {
    name: "Shreya Sen",
    company: "UrbanNest Interiors",
    source: "LinkedIn Outbound",
    status: "Contacted",
    priority: "High",
    val: "₹14,20,000",
    owner: "Priya M.",
  },
  {
    name: "Vikram Singhania",
    company: "Singhania Auto Components",
    source: "Referral",
    status: "Demo Scheduled",
    priority: "Medium",
    val: "₹8,00,000",
    owner: "Aakash S.",
  },
  {
    name: "Divya Kapoor",
    company: "OmniCare Labs",
    source: "Trade Expo 2026",
    status: "Proposal Sent",
    priority: "High",
    val: "₹22,50,000",
    owner: "Neha T.",
  },
];

/* =========================================================================
   VIRAL HOOKS: THE 4 DEADLY LEAKS IN B2B SALES
   ========================================================================= */

const deadlyLeaks = [
  {
    icon: CalendarClock,
    title: "The Sinking Follow-Up",
    stat: "44% Reps Drop After 1 Call",
    leak: "₹18.4 Lakhs Lost / Year",
    desc: "When leads aren't reminded within 24 hours, close probability drops by 391%. LeadKart highlights overdue calls right on the morning dashboard with 1-click Google Meet links.",
    color: "from-rose-500/20 to-rose-500/5 text-rose-500 border-rose-500/30",
  },
  {
    icon: FileText,
    title: "The Stale Excel Pipeline",
    stat: "Zero Weighted Accuracy",
    leak: "₹12.0 Lakhs Forecast Error",
    desc: "Spreadsheets don't calculate real-time probability weightings. LeadKart computes weighted pipeline directly inside PostgreSQL so leadership makes decisions on real math.",
    color: "from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/30",
  },
  {
    icon: Clock,
    title: "The 96-Hour Quote Delay",
    stat: "4 Days to Send Proposals",
    leak: "28% Buyer Drop-Off",
    desc: "Drafting quotes manually with custom Excel formulas slows down deal momentum. Our CPQ engine drafts approved PDF quotes with itemized taxes and discounts in 3 minutes.",
    color: "from-blue-500/20 to-blue-500/5 text-blue-500 border-blue-500/30",
  },
  {
    icon: Receipt,
    title: "Uncollected Overdue Invoices",
    stat: "Aging Overdue Balances",
    leak: "₹14.2 Lakhs Trapped Cash",
    desc: "Without automated invoice balance tracking, closed deals sit unpaid for months. Convert won quotations into tracked invoices with partial payments and automated alerts.",
    color: "from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/30",
  },
];

/* =========================================================================
   FEATURES CATALOGUE
   ========================================================================= */

const coreFeatures = [
  {
    icon: ClipboardList,
    tag: "Lead Capture",
    title: "Instant QR Forms & Web Ingestion",
    description:
      "Generate customizable lead capture forms with unique shareable slugs (/f/:slug) and scannable QR codes. Submissions flow directly into qualified pipelines without lost CSVs.",
    badge: "Zero Manual Entry",
  },
  {
    icon: KanbanSquare,
    tag: "Visual Pipeline",
    title: "Postgres-Weighted Kanban Pipeline",
    description:
      "Track deals across customizable stages with real-time probability weightings. Revenue forecasts are calculated directly inside PostgreSQL for zero stale UI numbers.",
    badge: "Real-time Math",
  },
  {
    icon: CalendarClock,
    tag: "Activity Engine",
    title: "Smart Follow-ups & Meet Scheduler",
    description:
      "Never let high-intent deals slip. Overdue and due-today tasks trigger dashboard alerts with automated Google Meet, Zoom, and Teams link recognition.",
    badge: "1-Click Meeting Launch",
  },
  {
    icon: Receipt,
    tag: "Billing & CPQ",
    title: "Integrated Quotes to Paid Invoices",
    description:
      "Draft itemized quotations with tiered product pricing, line discounts, and automated tax calculations. Convert approved quotes into invoices with automated balance tracking.",
    badge: "Quotes to Cash",
  },
  {
    icon: ShieldCheck,
    tag: "Security",
    title: "Database-Level Row Isolation",
    description:
      "Enterprise multi-tenancy backed by Postgres Row-Level Security (RLS). Tenant A cannot access Tenant B under any circumstance—enforced by the DB engine, not frontend logic.",
    badge: "RLS Guaranteed",
  },
  {
    icon: Layers,
    tag: "Governance",
    title: "Granular 5-Tier RBAC Permission Catalog",
    description:
      "Deploy custom permissions across Owner, Admin, Sales Manager, Sales Executive, and Accountant roles. Control who views, edits, discounts, or exports sensitive records.",
    badge: "Role-Based Access",
  },
];

/* =========================================================================
   REAL-LIFE USE CASES
   ========================================================================= */

const industryUseCases = [
  {
    id: "tech-saas",
    title: "B2B SaaS & Tech Agencies",
    subtitle: "Accelerate software deal cycles from inbound demo to recurring billing.",
    stats: "3.2x faster deal velocity",
    points: [
      "Embed QR demo forms on website, landing pages, and pitch decks",
      "Automated Google Meet link generation inside sales follow-up tasks",
      "Tiered SaaS license and consulting add-ons in standardized product catalog",
      "Monthly and annual milestone invoicing with payment tracking",
    ],
  },
  {
    id: "interior-realestate",
    title: "Interior Design & Real Estate",
    subtitle: "Coordinate high-ticket property visits, client revisions, and vendor quotes.",
    stats: "44% less follow-up leakage",
    points: [
      "Capture site-visit leads instantly from showroom QR stands",
      "Track stakeholder contacts (Architect, Owner, Contractor) under single client",
      "Detailed itemized proposals with material specs and room-wise discounts",
      "Payment stage milestones linked to construction and design delivery",
    ],
  },
  {
    id: "consulting",
    title: "Professional Services & Advisory",
    subtitle: "Manage client retainers, high-trust proposals, and team deliverables.",
    stats: "100% audit compliance",
    points: [
      "Role-based confidentiality: keep financial books restricted to Accountant role",
      "Comprehensive activity timelines across every client phone call and meeting",
      "Multi-currency support with custom tax and terms formatting",
      "Real-time pipeline weighted forecasting for quarterly partner reviews",
    ],
  },
  {
    id: "manufacturing",
    title: "Manufacturing & Distribution",
    subtitle: "Manage wholesale distributor networks, custom SKUs, and credit terms.",
    stats: "₹2.4Cr average pipeline visibility",
    points: [
      "Extensive product line library with SKU codes, tax brackets, and bulk pricing",
      "Regional sales executive assignment with regional manager oversight",
      "Credit terms, partial payment receipts, and automated overdue aging alerts",
      "Exportable data for warehouse reconciliation and tax filings",
    ],
  },
];

/* =========================================================================
   TESTIMONIALS
   ========================================================================= */

const testimonials = [
  {
    quote:
      "LeadKart CRM transformed our 12-person sales team. We replaced three disconnected tools—a spreadsheet for leads, another app for follow-ups, and a billing software. Having everything from QR capture to paid invoices in one place recovered ₹28 Lakhs in pipeline within 60 days.",
    author: "Karan Singhal",
    role: "VP of Sales & Revenue",
    company: "Apex Dynamics Pvt Ltd",
    metric: "Recovered ₹28L in lost deals",
    avatar: "KS",
  },
  {
    quote:
      "The database-level row security gave us the confidence to put all our enterprise client records on the platform. The automated Google Meet detection in follow-ups alone saves our account managers 45 minutes every morning.",
    author: "Dr. Ananya Roy",
    role: "Managing Director",
    company: "OmniHealth Solutions",
    metric: "45 mins saved daily per rep",
    avatar: "AR",
  },
  {
    quote:
      "We run high-ticket interior turnkey projects. Being able to generate a quotation with line-item discounts, get client approval, and instantly turn it into a staged invoice has cut our cash collection cycle in half.",
    author: "Rohan Deshmukh",
    role: "Principal Architect & Founder",
    company: "Studio Canvas Design",
    metric: "50% faster cash collection",
    avatar: "RD",
  },
];

/* =========================================================================
   PRICING TIERS
   ========================================================================= */

const pricingPlans = [
  {
    name: "Free",
    code: "free",
    priceMonthly: 0,
    priceAnnual: 0,
    description: "Ideal for solo consultants and founders testing their initial sales motion.",
    features: [
      "Up to 2 team members",
      "100 Active leads & clients",
      "Visual Kanban deal pipeline",
      "Basic follow-up scheduler",
      "Standard lead capture forms",
      "Database-enforced isolation",
    ],
    ctaText: "Start Free Sandbox",
    popular: false,
  },
  {
    name: "Starter",
    code: "starter",
    priceMonthly: 1499,
    priceAnnual: 1199,
    description: "For small, aggressive sales teams scaling their pipeline velocity.",
    features: [
      "Up to 5 team members",
      "1,000 Active leads & clients",
      "Interactive weighted forecasting",
      "Quotations & PDF generation",
      "Invoices & payment tracking",
      "Smart Google Meet link parsing",
      "Executive dashboard analytics",
    ],
    ctaText: "Launch Starter Team",
    popular: false,
  },
  {
    name: "Professional",
    code: "professional",
    priceMonthly: 3999,
    priceAnnual: 3199,
    description: "The complete revenue operations machine for fast-scaling organizations.",
    features: [
      "Up to 15 team members",
      "Unlimited leads & opportunities",
      "Full 5-tier RBAC permission matrix",
      "Public QR code form generator",
      "Automated overdue payment tracking",
      "Multi-product catalog & bundles",
      "Team activity audit logs",
      "Priority onboarding & support",
    ],
    ctaText: "Deploy Professional",
    popular: true,
  },
  {
    name: "Enterprise",
    code: "enterprise",
    priceMonthly: 8999,
    priceAnnual: 7199,
    description: "Bespoke controls, custom SLAs, and high-volume multi-team governance.",
    features: [
      "Unlimited team members",
      "Unlimited organizations/tenants",
      "Custom Postgres schema migration",
      "Dedicated account manager",
      "Custom integrations & webhook rules",
      "99.99% Uptime SLA agreement",
      "24/7 Priority phone & Slack support",
    ],
    ctaText: "Contact Sales",
    popular: false,
  },
];

/* =========================================================================
   FAQ ITEMS
   ========================================================================= */

const faqs = [
  {
    q: "How does LeadKart CRM guarantee tenant data isolation?",
    a: "LeadKart CRM utilizes PostgreSQL Row-Level Security (RLS) directly at the database engine level. Every single query is strictly authenticated and filtered by the tenant's organization_id. Organization A can never query or mutate Organization B's data, regardless of client-side code.",
  },
  {
    q: "Can I explore the platform without entering credit card details or signing up?",
    a: "Yes! When you click 'Explore the Demo Workspace', you are instantly provisioned into an interactive demo sandbox seeded with real B2B leads, deals, follow-up calls, quotations, and invoices. You can test all features right in your browser.",
  },
  {
    q: "How does the public QR Form Builder work?",
    a: "Under the Forms module, you can create customized lead capture pages with tailored input fields (Budget, Industry, Email, Phone, Project Details). LeadKart generates a public URL (e.g. /f/summer-expo) and a printable high-resolution QR code. When leads submit the form, they are automatically parsed and inserted into your CRM leads pipeline in real time.",
  },
  {
    q: "How does the quotation and invoicing flow work?",
    a: "You can select products and services from your catalog, specify quantities, add unit discounts, and set taxes. Once a quotation is approved, you can convert it into an official invoice with one click. Payment entries automatically decrement remaining balances and transition the invoice status to Paid or Overdue.",
  },
  {
    q: "What roles and permissions are supported?",
    a: "We support 5 built-in roles: Owner (full workspace & billing control), Admin (team management and configuration), Sales Manager (team-wide leads & pipeline access), Sales Executive (restricted to assigned opportunities), and Accountant (quotations, invoices, payments, and financial analytics).",
  },
  {
    q: "Can we export our data at any time?",
    a: "Yes. All leads, client accounts, deals, quotations, and invoice reports can be exported to standard CSV or JSON formats at any time by authorized team roles.",
  },
];

/* =========================================================================
   LIVE FLOATING SOCIAL PROOF TICKER
   ========================================================================= */

const liveSocialTickerItems = [
  { text: "Rohan D. closed a ₹14.5L deal", sub: "Studio Canvas • 3 mins ago", icon: Flame, color: "text-rose-500" },
  { text: "New lead captured via QR Form", sub: "OmniCare Labs • Just now", icon: QrCode, color: "text-primary" },
  { text: "Google Meet Demo completed", sub: "Prestige Spaces • 8 mins ago", icon: Video, color: "text-emerald-500" },
  { text: "Invoice #INV-2026-042 paid in full (₹5.13L)", sub: "Nexus Tech • 14 mins ago", icon: CheckCircle2, color: "text-amber-500" },
];

/* =========================================================================
   MAIN COMPONENT
   ========================================================================= */

function Index() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [activeIndustry, setActiveIndustry] = useState("tech-saas");
  const [chartMetric, setChartMetric] = useState<"revenue" | "velocity">("revenue");

  // Floating Ticker Notification
  const [tickerIndex, setTickerIndex] = useState(0);
  const [showTicker, setShowTicker] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % liveSocialTickerItems.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Interactive ROI Calculator State
  const [leadsCount, setLeadsCount] = useState<number>(120);
  const [avgDealSize, setAvgDealSize] = useState<number>(150000);
  const [closeRate, setCloseRate] = useState<number>(20);

  // Dynamic calculations
  const totalPipeline = useMemo(() => leadsCount * avgDealSize, [leadsCount, avgDealSize]);
  const currentRevenue = useMemo(
    () => totalPipeline * (closeRate / 100),
    [totalPipeline, closeRate],
  );
  // Estimated 18% lift from eliminated follow-up slippage & faster quotes
  const recoveredRevenue = useMemo(() => currentRevenue * 0.18, [currentRevenue]);
  const hoursSavedPerRep = useMemo(() => Math.round((leadsCount / 20) * 1.5 + 4), [leadsCount]);

  const activeTicker = liveSocialTickerItems[tickerIndex] ?? liveSocialTickerItems[0]!;

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* ===================================================================
          STICKY TOPBAR NAVIGATION
          =================================================================== */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="group flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-accent shadow-md shadow-primary/20 text-white font-bold text-lg">
                LK
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
                  LeadKart <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">CRM</span>
                </span>
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Multi-Tenant Sales Engine
                </span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#growth-charts" className="hover:text-foreground transition-colors">Growth Analytics</a>
            <a href="#interactive-preview" className="hover:text-foreground transition-colors">Platform Tour</a>
            <a href="#pipeline-infographic" className="hover:text-foreground transition-colors">Sales Motion</a>
            <a href="#calculator" className="hover:text-foreground transition-colors">ROI Calculator</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm shadow-primary/25 rounded-lg px-4"
            >
              <Link to="/auth">
                Live Demo <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ===================================================================
          HERO SECTION
          =================================================================== */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
        {/* Subtle background glow effects */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />
        <div className="pointer-events-none absolute top-1/3 right-10 -z-10 h-64 w-64 rounded-full bg-accent/10 blur-[100px]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Pill Announcement */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary shadow-sm backdrop-blur-sm transition-all hover:bg-primary/10 mb-6">
            <Sparkles className="size-3.5 text-primary animate-pulse" />
            <span>The Modern Multi-Tenant Sales Engine</span>
            <span className="text-border">|</span>
            <span className="hidden sm:inline text-muted-foreground">Powered by Neon Postgres RLS</span>
            <ChevronRight className="size-3 text-primary" />
          </div>

          {/* Main Headline */}
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl md:text-6xl lg:leading-[1.15]">
            Convert High-Intent Leads into{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Closed Deals & Recurring Cash
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            Run your entire B2B sales motion in one disciplined workspace. Capture leads with dynamic QR forms,
            forecast deals on weighted Kanban pipelines, automate Google Meet follow-ups, and convert quotes to paid
            invoices with database-level isolation.
          </p>

          {/* Hero CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Button
              asChild
              size="lg"
              className="h-12 px-7 text-base font-semibold bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl transition-all hover:scale-[1.02]"
            >
              <Link to="/auth">
                Launch Live Demo Sandbox <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 px-6 text-base font-medium rounded-xl border-border/80 hover:bg-accent/5 transition-all"
            >
              <a href="#growth-charts">
                <BarChart3 className="mr-2 size-4 text-primary" /> View Growth Infographics
              </a>
            </Button>
          </div>

          {/* Micro Trust Indicators */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" /> Instant demo with pre-seeded data
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-primary" /> 100% Database Row-Level Security
            </span>
            <span className="flex items-center gap-1.5">
              <Coins className="size-4 text-amber-500" /> Multi-Currency (₹ INR default)
            </span>
          </div>

          {/* ===============================================================
              INTERACTIVE HERO CRM MOCKUP / PREVIEW
              =============================================================== */}
          <div id="interactive-preview" className="mt-14 relative mx-auto max-w-5xl rounded-2xl border border-border/80 bg-card/60 p-2 sm:p-4 shadow-2xl shadow-primary/10 backdrop-blur-md">
            {/* Window titlebar */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3 px-2 sm:px-3">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="size-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="size-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Lock className="size-3 text-emerald-500" /> app.leadkart.com/dashboard • Enterprise Tenant (Zenith Corp)
                </span>
              </div>
              <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/20">
                Live Interactive Sandbox
              </Badge>
            </div>

            {/* Quick Metrics Bar inside Preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3 text-left">
              <div className="rounded-xl border border-border/50 bg-background/80 p-3 shadow-xs">
                <p className="text-[11px] font-medium text-muted-foreground uppercase">Won Revenue (MTD)</p>
                <p className="text-xl font-bold text-foreground mt-0.5">₹48.60 L</p>
                <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                  <TrendingUp className="size-3" /> +24% vs last month
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/80 p-3 shadow-xs">
                <p className="text-[11px] font-medium text-muted-foreground uppercase">Active Pipeline</p>
                <p className="text-xl font-bold text-foreground mt-0.5">₹1.35 Cr</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-1">Weighted: ₹68.4 L</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/80 p-3 shadow-xs">
                <p className="text-[11px] font-medium text-muted-foreground uppercase">Qualified Leads</p>
                <p className="text-xl font-bold text-foreground mt-0.5">142 Leads</p>
                <p className="text-[10px] text-primary font-medium mt-1">38 via Public QR forms</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/80 p-3 shadow-xs">
                <p className="text-[11px] font-medium text-muted-foreground uppercase">Follow-up SLA</p>
                <p className="text-xl font-bold text-foreground mt-0.5">96.8%</p>
                <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-1">
                  <Clock className="size-3" /> 2 due today
                </p>
              </div>
            </div>

            {/* Interactive Showcase Tabs */}
            <Tabs defaultValue="pipeline" className="w-full text-left">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <TabsList className="bg-muted/60 p-1">
                  <TabsTrigger value="pipeline" className="text-xs sm:text-sm flex items-center gap-1.5">
                    <KanbanSquare className="size-3.5" /> Pipeline Kanban
                  </TabsTrigger>
                  <TabsTrigger value="leads" className="text-xs sm:text-sm flex items-center gap-1.5">
                    <Users className="size-3.5" /> Qualified Leads
                  </TabsTrigger>
                  <TabsTrigger value="forms" className="text-xs sm:text-sm flex items-center gap-1.5">
                    <QrCode className="size-3.5" /> QR Form Engine
                  </TabsTrigger>
                  <TabsTrigger value="quotes" className="text-xs sm:text-sm flex items-center gap-1.5">
                    <Receipt className="size-3.5" /> Quotes to Invoices
                  </TabsTrigger>
                </TabsList>
                <Button asChild size="sm" variant="ghost" className="text-xs text-primary hover:text-primary">
                  <Link to="/auth">Full Screen App →</Link>
                </Button>
              </div>

              {/* Tab 1: Pipeline Kanban */}
              <TabsContent value="pipeline" className="mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {mockPipelineDeals.map((stage) => (
                    <div key={stage.stage} className="rounded-xl border border-border/60 bg-muted/30 p-2.5 flex flex-col">
                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <div>
                          <p className="text-xs font-semibold text-foreground">{stage.stage}</p>
                          <p className="text-[10px] text-muted-foreground">{stage.count} deals • {formatMoney(stage.value)}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {stage.count}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-2">
                        {stage.deals.map((deal) => (
                          <div key={deal.title} className="rounded-lg border border-border/70 bg-card p-2.5 shadow-xs hover:border-primary/50 transition-colors">
                            <p className="text-xs font-semibold text-foreground truncate">{deal.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{deal.client}</p>
                            <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-border/40 text-[10px]">
                              <span className="font-bold text-foreground text-xs">{deal.amount}</span>
                              <span className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                                {deal.rep}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Tab 2: Leads Table */}
              <TabsContent value="leads" className="mt-3">
                <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                      <tr>
                        <th className="p-3">Lead Contact</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Priority</th>
                        <th className="p-3">Estimated Value</th>
                        <th className="p-3">Owner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {mockLeads.map((lead) => (
                        <tr key={lead.name} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3">
                            <p className="font-semibold text-foreground">{lead.name}</p>
                            <p className="text-[11px] text-muted-foreground">{lead.company}</p>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {lead.source}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600">
                              {lead.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-rose-500 flex items-center gap-1">
                              <Flame className="size-3" /> {lead.priority}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-foreground">{lead.val}</td>
                          <td className="p-3 text-muted-foreground">{lead.owner}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* Tab 3: QR Form Engine */}
              <TabsContent value="forms" className="mt-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-border/60 bg-card p-4">
                  <div className="md:col-span-2 space-y-3">
                    <Badge variant="secondary" className="text-xs">Live Slug: /f/inbound-consultation</Badge>
                    <h3 className="text-base font-bold text-foreground">
                      Instant Lead Capture & QR Ingestion
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Place high-resolution QR codes at exhibitions, print catalogs, or share your vanity link on LinkedIn. Prospective clients fill out budgets, required services, and contact info. Submissions immediately trigger alerts to your team.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-muted px-2 py-1 rounded text-muted-foreground">✓ Auto-detect mobile devices</span>
                      <span className="bg-muted px-2 py-1 rounded text-muted-foreground">✓ Automatic Lead Assignment</span>
                      <span className="bg-muted px-2 py-1 rounded text-muted-foreground">✓ Zero Zapier/Third-Party Cost</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center border-l border-border/60 pl-2 text-center">
                    <div className="p-3 rounded-xl border border-border bg-white shadow-xs">
                      <QrCode className="size-20 text-slate-900" />
                    </div>
                    <p className="mt-2 text-[11px] font-medium text-foreground">Scan to Test Public Form</p>
                    <p className="text-[10px] text-muted-foreground">Direct ingestion into database</p>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 4: Quotes to Invoices */}
              <TabsContent value="quotes" className="mt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-primary/10 text-primary border-primary/20">Quote #QT-2026-089</Badge>
                      <span className="text-xs text-emerald-600 font-semibold">Approved by Client</span>
                    </div>
                    <p className="text-xs font-bold text-foreground">Turnkey Software Architecture & Implementation</p>
                    <div className="text-xs space-y-1 text-muted-foreground border-y border-border/50 py-2">
                      <div className="flex justify-between">
                        <span>Core Cloud Platform (30 Users)</span>
                        <span className="text-foreground font-medium">₹4,50,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Database Migration & RLS Setup</span>
                        <span className="text-foreground font-medium">₹1,20,000</span>
                      </div>
                      <div className="flex justify-between text-rose-500">
                        <span>Volume Discount (10%)</span>
                        <span>- ₹57,000</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-1">
                      <span>Total Quote Value:</span>
                      <span className="text-primary">₹5,13,000</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/5">Invoice #INV-2026-042</Badge>
                      <span className="text-xs text-amber-600 font-semibold">Partially Paid</span>
                    </div>
                    <p className="text-xs font-bold text-foreground">Milestone 1 Payment — Due in 3 days</p>
                    <div className="space-y-1.5 text-xs border-y border-border/50 py-2">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Invoice Total</span>
                        <span className="text-foreground font-medium">₹5,13,000</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span>Paid to Date</span>
                        <span>₹2,50,000</span>
                      </div>
                      <div className="flex justify-between text-rose-600 font-bold">
                        <span>Remaining Balance</span>
                        <span>₹2,63,000</span>
                      </div>
                    </div>
                    <Button asChild size="sm" className="w-full text-xs">
                      <Link to="/auth">Record Payment in App →</Link>
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* ===================================================================
          VIRAL HOOK: THE 4 DEADLY B2B SALES LEAKS INFOGRAPHIC
          =================================================================== */}
      <section className="border-y border-border/60 bg-gradient-to-b from-muted/30 to-background py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <Badge variant="outline" className="border-rose-500/30 text-rose-500 bg-rose-500/5 mb-3">
              <ShieldAlert className="size-3.5 mr-1" /> Revenue Bleed Audit
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              The 4 Costly Leaks Silently Draining Your Pipeline
            </h2>
            <p className="mt-3.5 text-base text-muted-foreground">
              Most sales organizations don't have a lead problem—they have a leakage problem. Here is how much manual spreadsheets and forgotten follow-ups cost average B2B teams every year:
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {deadlyLeaks.map((leak) => (
              <div
                key={leak.title}
                className={`rounded-2xl border bg-gradient-to-b p-6 shadow-sm flex flex-col justify-between transition-transform hover:-translate-y-1 ${leak.color}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-background shadow-xs">
                      <leak.icon className="size-5" />
                    </div>
                    <Badge variant="destructive" className="text-[10px] font-bold">
                      {leak.stat}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{leak.title}</h3>
                  <p className="mt-1 text-xs font-extrabold tracking-wide uppercase">{leak.leak}</p>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{leak.desc}</p>
                </div>
                <div className="mt-6 pt-3 border-t border-border/40 text-[11px] font-semibold text-foreground flex items-center justify-between">
                  <span>LeadKart Fix:</span>
                  <span className="text-emerald-600 font-bold">Solved 100% ✓</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================
          LIVE GROWTH CHARTS & VELOCITY ACCELERATION INFOGRAPHIC
          =================================================================== */}
      <section id="growth-charts" className="py-20 md:py-28 bg-card/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-3">
              Data-Backed Performance
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Visualizing the LeadKart Velocity Multiplier
            </h2>
            <p className="mt-3.5 text-base text-muted-foreground">
              Real-world telemetry from 140+ sales teams transitioning from manual spreadsheets to LeadKart's automated Kanban and CPQ engine.
            </p>

            <div className="mt-6 inline-flex rounded-xl border border-border bg-muted/40 p-1 text-xs">
              <button
                onClick={() => setChartMetric("revenue")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${chartMetric === "revenue"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Closed Revenue Growth (₹)
              </button>
              <button
                onClick={() => setChartMetric("velocity")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${chartMetric === "velocity"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Deal Cycle Compression (Days)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto">
            {/* Chart Container */}
            <div className="lg:col-span-8 rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-border/60 gap-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {chartMetric === "revenue" ? "Cumulative Closed Revenue Trajectory" : "Sales Cycle Duration (Days to Close)"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {chartMetric === "revenue"
                      ? "Monthly closed-won revenue: Spreadsheets vs LeadKart CRM"
                      : "Average days elapsed from lead capture to invoice settlement"}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-primary">
                    <span className="size-2.5 rounded-full bg-primary" /> LeadKart CRM
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2.5 rounded-full bg-muted-foreground/40" /> Legacy / Spreadsheets
                  </span>
                </div>
              </div>

              <div className="mt-6 h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartMetric === "revenue" ? (
                    <AreaChart data={velocityGrowthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorLeadkart" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorLegacy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                        formatter={(val: any) => formatMoney(val)}
                      />
                      <Area
                        type="monotone"
                        dataKey="leadkart"
                        stroke="var(--primary)"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorLeadkart)"
                        name="LeadKart CRM"
                      />
                      <Area
                        type="monotone"
                        dataKey="legacy"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fillOpacity={1}
                        fill="url(#colorLegacy)"
                        name="Spreadsheets"
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={velocityGrowthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit=" d" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                        }}
                        formatter={(val: any) => `${val} days`}
                      />
                      <Bar dataKey="cycleLegacy" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Spreadsheets (Days)" />
                      <Bar dataKey="cycleLeadkart" fill="var(--primary)" radius={[4, 4, 0, 0]} name="LeadKart (Days)" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Infographic Conversion Funnel Breakdown */}
            <div className="lg:col-span-4 rounded-2xl border border-border/80 bg-card p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Filter className="size-4 text-primary" /> End-to-End Funnel Health
                  </h3>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                    +48% Benchmark
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Real-time conversion progression from cold inquiry to reconciled bank receipt.
                </p>

                <div className="mt-5 space-y-3.5">
                  {funnelStages.map((stg) => (
                    <div key={stg.stage} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">{stg.stage}</span>
                        <span className="font-bold text-foreground">{stg.count}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                          style={{ width: `${stg.pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground pt-0.5">
                        <span>{stg.label}</span>
                        <span className="text-emerald-600 font-semibold">{stg.change}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border/50">
                <Button asChild size="sm" className="w-full text-xs font-semibold rounded-xl">
                  <Link to="/auth">Inspect Live Funnel Data →</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          INFOGRAPHIC: THE 5-STAGE CLOSED-LOOP SALES MOTION
          =================================================================== */}
      <section id="pipeline-infographic" className="py-20 md:py-28 border-y border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-3">
              End-to-End Architecture
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              How Deals Move from Capture to Cash in 5 Steps
            </h2>
            <p className="mt-3.5 text-base text-muted-foreground">
              Every stage is synchronized with PostgreSQL triggers. Zero manual data copy-pasting, zero lost leads.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            {/* Step 1 */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm relative group hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-primary/30">01</span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <QrCode className="size-4" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-foreground">Public QR Capture</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Leads scan your QR badge or fill /f/:slug. Ingested directly into leads table without third-party webhooks.
              </p>
              <div className="mt-4 pt-3 border-t border-border/50 text-[10px] font-semibold text-primary">
                → Instant SLA Timer Started
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm relative group hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-primary/30">02</span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <UserCheck className="size-4" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-foreground">Auto-Assignment</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Rules assign leads to specific sales executives based on region or service. Scored as Hot, Warm, or Cold.
              </p>
              <div className="mt-4 pt-3 border-t border-border/50 text-[10px] font-semibold text-primary">
                → Assigned to Rep Queue
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm relative group hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-primary/30">03</span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Video className="size-4" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-foreground">Google Meet Sync</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Follow-ups auto-extract Google Meet/Zoom links. Overdue alerts surface on morning dashboards.
              </p>
              <div className="mt-4 pt-3 border-t border-border/50 text-[10px] font-semibold text-primary">
                → 1-Click Meeting Launch
              </div>
            </div>

            {/* Step 4 */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm relative group hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-primary/30">04</span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <KanbanSquare className="size-4" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-foreground">Weighted Kanban</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Deals progress across stages. Stage probability automatically computes weighted forecasts in Postgres.
              </p>
              <div className="mt-4 pt-3 border-t border-border/50 text-[10px] font-semibold text-primary">
                → Real-Time Math Forecast
              </div>
            </div>

            {/* Step 5 */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm relative group hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-primary/30">05</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Receipt className="size-4" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-foreground">CPQ to Cash</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Approved quotations convert to invoices with 1 click. Payments update remaining balances in real time.
              </p>
              <div className="mt-4 pt-3 border-t border-border/50 text-[10px] font-semibold text-emerald-600">
                → Reconciled Bank Receipt
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          SIDE-BY-SIDE BATTLE CARD (COMPETITIVE MATRIX)
          =================================================================== */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-3">
              Unfair Advantage
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Why High-Growth Sales Teams Pick LeadKart CRM
            </h2>
            <p className="mt-3.5 text-base text-muted-foreground">
              Compare the true total cost and operational friction of spreadsheets, bloated legacy enterprise CRMs, and LeadKart.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-lg max-w-5xl mx-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <tr>
                  <th className="p-4 sm:p-5">Capability / Feature</th>
                  <th className="p-4 sm:p-5">Spreadsheets & Notion</th>
                  <th className="p-4 sm:p-5">Bloated Legacy CRMs ($150+/mo)</th>
                  <th className="p-4 sm:p-5 text-primary font-bold bg-primary/5">LeadKart CRM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr>
                  <td className="p-4 font-semibold text-foreground">Tenant Database Row Security (RLS)</td>
                  <td className="p-4 text-rose-500">❌ None (Accidental leak)</td>
                  <td className="p-4 text-muted-foreground">Requires Enterprise Add-on</td>
                  <td className="p-4 font-bold text-emerald-600 bg-primary/5">✅ Native Postgres RLS</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">Public QR Lead Forms (`/f/:slug`)</td>
                  <td className="p-4 text-rose-500">❌ Third-party forms (Zapier)</td>
                  <td className="p-4 text-muted-foreground">Extra Hubspot Marketing tier</td>
                  <td className="p-4 font-bold text-emerald-600 bg-primary/5">✅ Built-in QR Engine</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">Google Meet & Zoom Auto-Detection</td>
                  <td className="p-4 text-rose-500">❌ Manual copy-pasting</td>
                  <td className="p-4 text-muted-foreground">Requires plugin setup</td>
                  <td className="p-4 font-bold text-emerald-600 bg-primary/5">✅ 1-Click Launch Built-in</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">Itemized Quotation CPQ to Invoice</td>
                  <td className="p-4 text-rose-500">❌ Separate Word/Excel template</td>
                  <td className="p-4 text-muted-foreground">Requires CPQ add-on license</td>
                  <td className="p-4 font-bold text-emerald-600 bg-primary/5">✅ Integrated Line Items</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">Real-Time Weighted Pipeline Math</td>
                  <td className="p-4 text-rose-500">❌ Stale broken formulas</td>
                  <td className="p-4 text-muted-foreground">Complex custom reports</td>
                  <td className="p-4 font-bold text-emerald-600 bg-primary/5">✅ Computed in PostgreSQL</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-foreground">Instant Demo Sandbox without Signup</td>
                  <td className="p-4 text-muted-foreground">N/A</td>
                  <td className="p-4 text-rose-500">❌ Talk to Sales rep first</td>
                  <td className="p-4 font-bold text-emerald-600 bg-primary/5">✅ 10-Second Instant Sandbox</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===================================================================
          CORE FEATURES GRID & BENEFITS
          =================================================================== */}
      <section id="features" className="py-20 md:py-28 border-t border-border/60 bg-muted/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-3">
              Comprehensive Feature Architecture
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Everything Your Sales Team Needs to Close Deals Without Chaos
            </h2>
            <p className="mt-3.5 text-base text-muted-foreground">
              Replace multiple disjointed subscriptions. LeadKart provides a complete, cohesive sales machine designed from first principles.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {coreFeatures.map((f) => (
              <Card key={f.title} className="group relative overflow-hidden border-border/70 bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                      <f.icon className="size-5" />
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-semibold tracking-wide uppercase">
                      {f.badge}
                    </Badge>
                  </div>
                  <p className="mt-4 text-xs font-semibold text-primary uppercase tracking-wider">{f.tag}</p>
                  <h3 className="mt-1 text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================
          REAL LIFE INDUSTRY USE CASES & SOLUTIONS
          =================================================================== */}
      <section id="use-cases" className="border-t border-border/60 bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="outline" className="border-accent/30 text-accent bg-accent/5 mb-3">
              Industry Workflows
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Tailored for Real-World High-Stakes Sales Teams
            </h2>
            <p className="mt-3.5 text-base text-muted-foreground">
              Whether you are negotiating enterprise software licenses or managing luxury interior design turnkeys, LeadKart adapts to your sales rhythm.
            </p>
          </div>

          <div className="mt-12">
            {/* Industry Selector Pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {industryUseCases.map((ind) => (
                <button
                  key={ind.id}
                  onClick={() => setActiveIndustry(ind.id)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${activeIndustry === ind.id
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-card border border-border/80 text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {ind.title}
                </button>
              ))}
            </div>

            {/* Selected Industry Card */}
            {(() => {
              const current = industryUseCases.find((i) => i.id === activeIndustry) ?? industryUseCases[0]!;
              if (!current) return null;
              return (
                <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-10 shadow-xl max-w-4xl mx-auto">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">{current.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{current.subtitle}</p>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs py-1 px-3 self-start sm:self-center">
                      Impact: {current.stats}
                    </Badge>
                  </div>
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {current.points.map((pt, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                        <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-foreground font-medium leading-relaxed">{pt}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 flex justify-end">
                    <Button asChild size="sm" className="rounded-lg">
                      <Link to="/auth">
                        Explore {current.title} in Demo <ArrowRight className="ml-1 size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* ===================================================================
          INTERACTIVE PIPELINE ROI & REVENUE CALCULATOR
          =================================================================== */}
      <section id="calculator" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/5 mb-3">
              Interactive ROI Model
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Calculate Your Revenue Leaks & Recovery
            </h2>
            <p className="mt-3.5 text-base text-muted-foreground">
              See how much trapped revenue you can recover by eliminating forgotten follow-ups and speeding up quote approvals.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
            {/* Input Controls */}
            <div className="lg:col-span-7 rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-6">
              {/* Slider 1: Leads */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-foreground">Monthly Inbound Leads</span>
                  <span className="text-base font-bold text-primary">{leadsCount} leads</span>
                </div>
                <Slider
                  value={[leadsCount]}
                  min={20}
                  max={500}
                  step={10}
                  onValueChange={(val) => {
                    const next = val[0];
                    if (typeof next === "number") setLeadsCount(next);
                  }}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>20 leads</span>
                  <span>500 leads</span>
                </div>
              </div>

              {/* Slider 2: Average Deal Value */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-foreground">Average Deal Value</span>
                  <span className="text-base font-bold text-primary">{formatMoney(avgDealSize)}</span>
                </div>
                <Slider
                  value={[avgDealSize]}
                  min={25000}
                  max={1000000}
                  step={25000}
                  onValueChange={(val) => {
                    const next = val[0];
                    if (typeof next === "number") setAvgDealSize(next);
                  }}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>₹25,000</span>
                  <span>₹10,00,000</span>
                </div>
              </div>

              {/* Slider 3: Close Rate */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-foreground">Current Win / Close Rate</span>
                  <span className="text-base font-bold text-primary">{closeRate}%</span>
                </div>
                <Slider
                  value={[closeRate]}
                  min={5}
                  max={50}
                  step={1}
                  onValueChange={(val) => {
                    const next = val[0];
                    if (typeof next === "number") setCloseRate(next);
                  }}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>5% (Low)</span>
                  <span>50% (High Velocity)</span>
                </div>
              </div>
            </div>

            {/* Calculated Output Card */}
            <div className="lg:col-span-5 rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/10 via-background to-card p-6 sm:p-8 shadow-xl text-center">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Estimated Revenue Recovery</p>
              <h3 className="mt-2 text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
                {formatMoney(recoveredRevenue)}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">projected additional revenue per year</p>

              <div className="mt-6 border-t border-border/60 pt-4 space-y-3 text-left text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Gross Pipeline:</span>
                  <span className="font-semibold text-foreground">{formatMoney(totalPipeline)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Closed Revenue Baseline:</span>
                  <span className="font-semibold text-foreground">{formatMoney(currentRevenue)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Rep Time Saved / Week:</span>
                  <span>~{hoursSavedPerRep} hours / rep</span>
                </div>
              </div>

              <Button asChild size="lg" className="w-full mt-6 font-semibold shadow-md shadow-primary/20 rounded-xl">
                <Link to="/auth">Start Capturing Lost Revenue →</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          CUSTOMER TESTIMONIALS
          =================================================================== */}
      <section className="border-t border-border/60 bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-3">
              Customer Impact
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Proven by Sales Leaders Managing Scaled Revenue
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.author} className="border-border/70 bg-card flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center gap-1 text-amber-500 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="size-4 fill-amber-500" />
                      ))}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed italic">
                      "{t.quote}"
                    </p>
                  </div>
                  <div className="mt-6 border-t border-border/50 pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {t.avatar}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{t.author}</p>
                        <p className="text-[11px] text-muted-foreground">{t.role}, {t.company}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================
          TRANSPARENT PRICING PLANS
          =================================================================== */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-3">
              Simple, Predictable Plans
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Fair Pricing that Scales With Your Revenue
            </h2>
            <p className="mt-3.5 text-base text-muted-foreground">
              No hidden fees. Every plan includes Postgres Row-Level Security, multi-tenant isolation, and real-time activity logs.
            </p>

            {/* Billing Toggle */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 p-1 text-xs">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${billingCycle === "monthly" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer flex items-center gap-1.5 ${billingCycle === "annual" ? "bg-primary text-primary-foreground shadow-xs font-semibold" : "text-muted-foreground"
                  }`}
              >
                <span>Annual Billing</span>
                <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.2">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pricingPlans.map((plan) => {
              const price = billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
              return (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-6 flex flex-col justify-between transition-all ${plan.popular
                      ? "border-primary bg-card shadow-xl shadow-primary/10 relative ring-2 ring-primary/20"
                      : "border-border/70 bg-card/60 hover:border-border"
                    }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground font-semibold text-[10px] tracking-wide uppercase px-3">
                        Most Popular for Teams
                      </Badge>
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground min-h-[32px]">{plan.description}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-extrabold text-foreground">
                        {price === 0 ? "₹0" : `₹${price.toLocaleString("en-IN")}`}
                      </span>
                      <span className="text-xs text-muted-foreground">/ month</span>
                    </div>
                    {billingCycle === "annual" && price > 0 && (
                      <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Billed annually (₹{(price * 12).toLocaleString("en-IN")}/yr)</p>
                    )}

                    <div className="mt-6 border-t border-border/50 pt-4 space-y-2.5">
                      <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">What's included:</p>
                      {plan.features.map((feat) => (
                        <div key={feat} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Check className="size-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8">
                    <Button
                      asChild
                      className={`w-full text-xs font-semibold rounded-xl ${plan.popular ? "bg-primary text-primary-foreground" : "variant-outline"
                        }`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      <Link to="/auth">{plan.ctaText}</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================================================================
          FREQUENTLY ASKED QUESTIONS
          =================================================================== */}
      <section id="faq" className="border-t border-border/60 bg-muted/20 py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 mb-3">
              Answers & Assurance
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Frequently Asked Questions
            </h2>
            <p className="mt-3.5 text-base text-muted-foreground">
              Have questions about security, data migration, or tenant isolation? We've got you covered.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border/70 rounded-xl bg-card px-4">
                <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-4 text-left">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ===================================================================
          HIGH-CONVERSION BOTTOM CTA BANNER
          =================================================================== */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-tr from-primary/15 via-accent/10 to-transparent blur-2xl" />

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-3xl border border-primary/30 bg-gradient-to-b from-card to-background p-8 sm:p-14 shadow-2xl relative overflow-hidden">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Zap className="size-3.5" /> Instant 10-Second Setup
            </div>
            <h2 className="text-3xl font-extrabold sm:text-5xl text-foreground tracking-tight max-w-2xl mx-auto">
              Ready to Accelerate Your Sales Velocity?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed">
              Join forward-thinking sales organizations. Explore our pre-seeded live sandbox or launch your own multi-tenant team workspace in seconds.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3.5">
              <Button
                asChild
                size="lg"
                className="h-12 px-8 text-base font-semibold bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl transition-all hover:scale-[1.02]"
              >
                <Link to="/auth">
                  Explore Live Demo Sandbox <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-7 text-base font-medium rounded-xl border-border"
              >
                <Link to="/auth">Create Free Organization</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          FOOTER
          =================================================================== */}
      <footer className="border-t border-border/60 bg-card py-12 text-sm text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">
                  LK
                </div>
                <span className="text-base font-bold text-foreground">LeadKart CRM</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground max-w-sm leading-relaxed">
                The enterprise-grade multi-tenant B2B sales operations platform. From QR lead capture to automated follow-ups, weighted Kanban pipelines, and cash collection.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 font-medium">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                All Systems Operational • Neon Postgres Connected
              </div>
            </div>

            <div>
              <p className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Product</p>
              <ul className="space-y-2 text-xs">
                <li><a href="#features" className="hover:text-foreground transition-colors">Lead Management</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Kanban Pipeline</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Follow-up Scheduler</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Quotation Builder</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Invoicing & Cash</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">QR Forms Engine</a></li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Solutions</p>
              <ul className="space-y-2 text-xs">
                <li><a href="#use-cases" className="hover:text-foreground transition-colors">B2B SaaS & Tech</a></li>
                <li><a href="#use-cases" className="hover:text-foreground transition-colors">Interior Design</a></li>
                <li><a href="#use-cases" className="hover:text-foreground transition-colors">Real Estate Agencies</a></li>
                <li><a href="#use-cases" className="hover:text-foreground transition-colors">Professional Services</a></li>
                <li><a href="#use-cases" className="hover:text-foreground transition-colors">Manufacturing & Distribution</a></li>
              </ul>
            </div>

            <div>
              <p className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Security & Trust</p>
              <ul className="space-y-2 text-xs">
                <li><span className="text-muted-foreground">Postgres Row-Level Security</span></li>
                <li><span className="text-muted-foreground">5-Tier Granular RBAC</span></li>
                <li><span className="text-muted-foreground">Audit Log Tracking</span></li>
                <li><span className="text-muted-foreground">Daily Encrypted Backups</span></li>
                <li><Link to="/auth" className="text-primary hover:underline">Instant Sandbox Access</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <p>© {new Date().getFullYear()} LeadKart CRM | Developed by Inktagon.</p>
            <div className="flex gap-4">
              <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
              <Link to="/auth" className="hover:text-foreground transition-colors">Live Demo</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ===================================================================
          VIRAL HOOK: LIVE FLOATING RECENT SALES ACTIVITY TICKER
          =================================================================== */}
      {showTicker && (
        <div className="fixed bottom-5 left-5 z-40 hidden sm:flex items-center gap-3 rounded-2xl border border-border/80 bg-card/95 p-3.5 shadow-xl backdrop-blur-md transition-all duration-300 max-w-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <activeTicker.icon className={`size-4.5 ${activeTicker.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-foreground">{activeTicker.text}</p>
            <p className="truncate text-[10px] text-muted-foreground">{activeTicker.sub}</p>
          </div>
          <button
            onClick={() => setShowTicker(false)}
            className="text-muted-foreground/60 hover:text-foreground transition-colors ml-1 cursor-pointer"
            aria-label="Close notification"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
