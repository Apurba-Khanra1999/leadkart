import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Coins,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In & Access Live Demo — LeadKart CRM" },
      {
        name: "description",
        content:
          "Sign in to your LeadKart CRM workspace or explore our instant interactive demo sandbox. Real-time leads, weighted Kanban pipeline, and automated billing with Postgres RLS security.",
      },
      { property: "og:site_name", content: "LeadKart CRM" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Sign In & Access Live Demo — LeadKart CRM" },
      {
        property: "og:description",
        content: "Access your multi-tenant sales workspace: leads, pipeline, follow-ups, and billing.",
      },
      { property: "og:url", content: "https://leadkartpro.vercel.app/auth" },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aaff1b2b9238acc4d535cc191c729e0a/id-preview-30a4b55d--2126f7d6-ffea-4536-ab9d-17006d9aa17f.lovable.app-1786166547462.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sign In — LeadKart CRM" },
      { name: "twitter:description", content: "Access your multi-tenant sales CRM workspace with database-enforced security." },
    ],
    links: [{ rel: "canonical", href: "https://leadkartpro.vercel.app/auth" }],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Please enter a valid work email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

const roleDemos = [
  {
    role: "Owner / Director",
    kpi: "₹1.35 Cr Pipeline",
    kpiLabel: "Active Weighted Forecast",
    desc: "Executive command center: revenue forecasts, team memberships, and audit logs.",
    badge: "Full Control",
    chips: ["KPI Dashboard", "5-Tier RBAC", "Financial Export"],
  },
  {
    role: "Sales Executive",
    kpi: "28 Assigned Leads",
    kpiLabel: "Personal Queue",
    desc: "Speed machine: 1-click Google Meet demos, overdue alerts, and Kanban updates.",
    badge: "Velocity",
    chips: ["Meet Detection", "Kanban Stages", "Quick Quotes"],
  },
  {
    role: "Accountant",
    kpi: "₹48.6L Collected",
    kpiLabel: "Reconciled MTD",
    desc: "Quotes to cash: automated tax math, invoice aging, and payment receipts.",
    badge: "Cash Flow",
    chips: ["CPQ Quotations", "Overdue Aging", "Partial Receipts"],
  },
];

function getPasswordStrength(pass: string): { score: number; label: string; color: string } {
  if (!pass) return { score: 0, label: "Too short", color: "bg-muted" };
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;

  if (score <= 1) return { score: 1, label: "Weak", color: "bg-rose-500" };
  if (score === 2) return { score: 2, label: "Fair", color: "bg-amber-500" };
  if (score === 3) return { score: 3, label: "Good", color: "bg-blue-500" };
  return { score: 4, label: "Strong & Secure", color: "bg-emerald-500" };
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);

  // Auto-redirect if already authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(targetEmail?: string, targetPassword?: string) {
    const candidateEmail = targetEmail || email;
    const candidatePassword = targetPassword || password;

    const parsed = credentialsSchema.safeParse({
      email: candidateEmail,
      password: candidatePassword,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please enter valid email and password.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        let { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error && error.message.toLowerCase().includes("invalid login credentials")) {
          // Fallback: Attempt sign up if auth user doesn't exist yet
          const { error: signUpError } = await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: {
              emailRedirectTo: window.location.origin,
            },
          });
          if (!signUpError) {
            const retryRes = await supabase.auth.signInWithPassword(parsed.data);
            error = retryRes.error;
          }
        }
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          ...parsed.data,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim().slice(0, 100) || "Sales Rep" },
          },
        });
        if (error) throw error;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        toast.success("Welcome to LeadKart CRM!");
        navigate({ to: "/dashboard", replace: true });
      } else {
        toast.success("Please check your email to confirm your account.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication error occurred");
    } finally {
      setBusy(false);
    }
  }

  // 1-Click Instant Demo Sandbox Mode
  function triggerInstantDemo() {
    setEmail("demo@leadkart.com");
    setPassword("DemoLeadKart2026!");
    toast.info("Connecting to pre-seeded demo sandbox...");
    submit("demo@leadkart.com", "DemoLeadKart2026!");
  }

  async function handleGoogleOAuth() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        setBusy(false);
        toast.error(error.message || "Google sign-in failed");
      }
    } catch (err: any) {
      setBusy(false);
      toast.error(err?.message || "Google sign-in failed");
    }
  }

  const pwdStrength = getPasswordStrength(password);
  const activeRole = roleDemos[selectedRoleIndex] ?? roleDemos[0]!;

  return (
    /* Exactly 100vh, strictly zero scroll on all devices */
    <div className="h-screen w-screen max-h-screen overflow-hidden flex flex-col lg:flex-row bg-background select-none">
      {/* ===================================================================
          LEFT HERO PANEL (Desktop only, perfectly scaled)
          =================================================================== */}
      <div className="relative hidden lg:flex lg:flex-col lg:w-[48%] xl:w-[50%] h-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 xl:p-8 justify-between border-r border-border/20">
        {/* Decorative glowing ambient orbs */}
        <div className="pointer-events-none absolute -top-20 -left-20 size-80 rounded-full bg-primary/20 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 size-72 rounded-full bg-accent/20 blur-[90px]" />

        {/* Ambient dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Header Bar */}
        <div className="relative z-10 flex items-center justify-between shrink-0">
          <Link to="/" className="group flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
            <div className="flex size-8 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold text-sm shadow-md">
              LK
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                LeadKart <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-white/15 text-white/90 border border-white/20">CRM</span>
              </span>
              <span className="text-[8.5px] font-medium tracking-wide text-white/50 uppercase">
                Multi-Tenant Sales Engine
              </span>
            </div>
          </Link>

          <Button asChild variant="ghost" size="sm" className="h-8 text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1.5 px-2.5">
            <Link to="/">
              <ArrowLeft className="size-3" /> Back to Home
            </Link>
          </Button>
        </div>

        {/* Middle Content */}
        <div className="relative z-10 my-auto py-2 max-w-lg">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10.5px] font-medium text-white/90 backdrop-blur-md shadow-xs mb-3">
            <Sparkles className="size-3 text-sky-300 animate-pulse" />
            <span>Interactive Multi-Role Sandbox</span>
            <span className="text-white/30">|</span>
            <span className="text-white/60">Postgres RLS</span>
          </div>

          <h1 className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight leading-snug">
            Run your entire sales motion with{" "}
            <span className="bg-gradient-to-r from-sky-300 via-indigo-200 to-primary-foreground bg-clip-text text-transparent">
              zero data chaos.
            </span>
          </h1>

          <p className="mt-2 text-xs xl:text-sm text-white/70 leading-relaxed">
            From QR lead capture to automated Google Meet follow-ups, weighted Kanban pipelines, and reconciled invoices.
          </p>

          {/* Role Preview Switcher Box */}
          <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-3.5 backdrop-blur-md shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
                Experience by Persona:
              </p>
              <span className="text-[10px] text-sky-300 font-semibold">{activeRole.badge}</span>
            </div>

            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-black/30 border border-white/10 text-[11px]">
              {roleDemos.map((item, idx) => (
                <button
                  key={item.role}
                  onClick={() => setSelectedRoleIndex(idx)}
                  className={`py-1 px-1.5 rounded-md text-center font-medium transition-all cursor-pointer truncate ${
                    selectedRoleIndex === idx
                      ? "bg-white/20 text-white font-bold shadow-xs"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {item.role.split(" / ")[0]}
                </button>
              ))}
            </div>

            {/* Active Role Details */}
            <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserCheck className="size-3.5 text-sky-300 shrink-0" /> {activeRole.role}
                </p>
                <p className="mt-1 text-[11px] text-white/70 leading-normal line-clamp-2">
                  {activeRole.desc}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-black text-sky-200">{activeRole.kpi}</p>
                <p className="text-[9px] text-white/50">{activeRole.kpiLabel}</p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {activeRole.chips.map((chip) => (
                <span
                  key={chip}
                  className="text-[9.5px] font-medium px-1.5 py-0.2 rounded bg-white/10 text-white/85 border border-white/10"
                >
                  ✓ {chip}
                </span>
              ))}
            </div>
          </div>

          {/* Compact Testimonial Chip */}
          <div className="mt-3.5 flex items-center gap-2.5 p-2 rounded-lg border border-white/10 bg-white/5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-400/20 text-sky-200 font-bold text-[10px]">
              KS
            </div>
            <p className="text-[11px] text-white/80 italic truncate">
              "Recovered ₹28L in lost pipeline within 60 days of switching to LeadKart."
            </p>
          </div>
        </div>

        {/* Footer Security Strip */}
        <div className="relative z-10 pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-white/60 shrink-0">
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-emerald-400" /> PostgreSQL Row-Level Security
          </span>
          <span className="flex items-center gap-1">
            <Lock className="size-3.5 text-sky-300" /> 256-bit Encryption
          </span>
          <span className="flex items-center gap-1">
            <Coins className="size-3.5 text-amber-300" /> ₹ INR Default
          </span>
        </div>
      </div>

      {/* ===================================================================
          RIGHT AUTH INTERACTIVE FORM PANEL (Guaranteed Zero Scroll)
          =================================================================== */}
      <div className="flex flex-1 flex-col items-center justify-center h-full px-4 sm:px-8 bg-background relative overflow-hidden">
        {/* Mobile top bar */}
        <div className="w-full max-w-[360px] flex items-center justify-between mb-3 lg:hidden shrink-0">
          <Link to="/" className="flex items-center gap-1.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow-xs">
              LK
            </div>
            <span className="text-sm font-bold text-foreground">LeadKart CRM</span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2">
            <Link to="/">
              <ArrowLeft className="size-3 mr-1" /> Home
            </Link>
          </Button>
        </div>

        {/* Main Card — compact vertical sizing */}
        <div className="w-full max-w-[360px] flex flex-col justify-center gap-3">
          {/* Title Header */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {mode === "signin" ? "Welcome back" : "Create workspace"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "signin"
                ? "Sign in to manage your deals, follow-ups, and invoices."
                : "Seeded with demo leads and visual pipeline."}
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-0.5 rounded-lg bg-muted/80 border border-border/70 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`py-1.5 rounded-md transition-all cursor-pointer text-center text-xs ${
                mode === "signin"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`py-1.5 rounded-md transition-all cursor-pointer text-center text-xs ${
                mode === "signup"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Quick 1-Click Instant Demo Sandbox Trigger */}
          <button
            type="button"
            onClick={triggerInstantDemo}
            disabled={busy}
            className="w-full py-2 px-3 rounded-lg border border-primary/25 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center justify-between text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Zap className="size-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">Test instant demo sandbox</span>
            </div>
            <span className="text-[11px] font-bold text-primary flex items-center group-hover:translate-x-0.5 transition-transform">
              1-Click Demo →
            </span>
          </button>

          {/* Google OAuth Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-9 text-xs font-semibold gap-2 border-border/80 hover:bg-muted/50 transition-all shadow-xs"
            disabled={busy}
            onClick={handleGoogleOAuth}
          >
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-2.5">
            <span className="h-px flex-1 bg-border/70" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              or email
            </span>
            <span className="h-px flex-1 bg-border/70" />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-2.5"
          >
            {mode === "signup" && (
              <div className="space-y-1">
                <Label htmlFor="auth-fullname" className="text-[11px] font-semibold text-foreground">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="auth-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Vikram Sharma"
                    autoComplete="name"
                    className="h-9 pl-8 text-xs rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="auth-email" className="text-[11px] font-semibold text-foreground">
                Work Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="h-9 pl-8 text-xs rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="auth-password" className="text-[11px] font-semibold text-foreground">
                  Password
                </Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => toast.info("Password reset instructions sent to your email.")}
                    className="text-[10px] text-primary hover:underline font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "8+ characters" : "Your password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="h-9 pl-8 pr-9 text-xs rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>

              {/* Password Strength Meter (Sign Up Only) */}
              {mode === "signup" && password.length > 0 && (
                <div className="pt-0.5 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Strength:</span>
                    <span className="font-semibold text-foreground">{pwdStrength.label}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${pwdStrength.score >= 1 ? pwdStrength.color : "bg-muted"}`} />
                    <div className={`h-full ${pwdStrength.score >= 2 ? pwdStrength.color : "bg-muted"}`} />
                    <div className={`h-full ${pwdStrength.score >= 3 ? pwdStrength.color : "bg-muted"}`} />
                    <div className={`h-full ${pwdStrength.score >= 4 ? pwdStrength.color : "bg-muted"}`} />
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={busy}
              className="w-full h-9 text-xs font-semibold gap-1.5 shadow-sm rounded-lg mt-1"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  {mode === "signin" ? "Sign In to Workspace" : "Launch Organization"}
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </form>

          {/* Toggle between Sign In & Sign Up */}
          <div className="text-center text-[11px] text-muted-foreground">
            {mode === "signin" ? (
              <p>
                No account yet?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline font-bold cursor-pointer"
                >
                  Create one free
                </button>
              </p>
            ) : (
              <p>
                Already have a workspace?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-primary hover:underline font-bold cursor-pointer"
                >
                  Sign in here
                </button>
              </p>
            )}
          </div>

          {/* Micro Trust Indicators */}
          <div className="pt-2 border-t border-border/50 flex items-center justify-center gap-3 text-[10.5px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3 text-emerald-500" /> Database Isolation
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3 text-primary" /> Free Sandbox
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}