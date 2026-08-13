import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  KanbanSquare,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Video,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In & Access Demo — LeadKart CRM" },
      {
        name: "description",
        content:
          "Sign in to LeadKart CRM or launch an instant demo sandbox. Manage leads, pipeline, follow-ups, quotations and invoices with enterprise security.",
      },
      { property: "og:title", content: "Sign In & Access Demo — LeadKart CRM" },
      {
        property: "og:description",
        content: "Access your multi-tenant sales workspace: leads, pipeline, follow-ups and billing.",
      },
      { property: "og:url", content: "https://leadkart.lovable.app/auth" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sign In — LeadKart CRM" },
      { name: "twitter:description", content: "Access your multi-tenant sales CRM workspace." },
    ],
    links: [{ rel: "canonical", href: "https://leadkart.lovable.app/auth" }],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

const highlights = [
  { icon: Users, text: "Lead & Pipeline Management" },
  { icon: KanbanSquare, text: "Kanban Deal Tracking" },
  { icon: Video, text: "Google Meet Demos Scheduler" },
  { icon: BarChart3, text: "Revenue Forecasting" },
  { icon: ShieldCheck, text: "Row-level Database Security" },
  { icon: Zap, text: "Real-time Collaboration" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit() {
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid details");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        let { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error && error.message.toLowerCase().includes("invalid login credentials")) {
          // Fallback: Attempt sign up in case Auth user was not pre-registered in auth.users.
          // Database trigger handle_new_user() will automatically link their pre-added team member record!
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
            data: { full_name: fullName.trim().slice(0, 100) },
          },
        });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        toast.success("Welcome to LeadKart CRM");
        navigate({ to: "/dashboard", replace: true });
      } else {
        toast.success("Check your email to confirm your account");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    /* Root: exactly viewport height, no scroll */
    <div className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row">

      {/* ── Left Hero Panel (desktop only) ── */}
      <div className="relative hidden lg:flex lg:flex-col lg:w-[52%] xl:w-[54%] overflow-hidden bg-brand">
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />
        {/* Glow blobs */}
        <div className="absolute -top-28 -left-28 w-[440px] h-[440px] rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.18 240 / 20%) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.22 270 / 18%) 0%, transparent 70%)" }} />

        <div className="relative z-10 flex flex-col h-full px-10 py-8 xl:px-14 xl:py-10">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 w-fit shrink-0">
            <div className="flex size-8 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 text-white font-bold text-sm shadow-lg">
              LK
            </div>
            <span className="text-lg font-bold text-white tracking-tight">LeadKart</span>
            <span className="ml-0.5 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold text-white/90 uppercase tracking-widest border border-white/20">
              CRM
            </span>
          </Link>

          {/* Hero — centred vertically between logo and footer */}
          <div className="flex flex-col justify-center flex-1 min-h-0">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 border border-white/20 px-3 py-1 mb-5 w-fit backdrop-blur-sm">
              <Sparkles className="size-3 text-sky-200" />
              <span className="text-[11px] font-medium text-white/90">Enterprise-grade Sales Intelligence</span>
            </div>

            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-[1.14] tracking-tight max-w-md">
              Run your entire
              <br />
              <span className="text-sky-200">sales motion</span>
              <br />
              in one workspace.
            </h1>

            <p className="mt-3 text-sm text-white/65 max-w-xs leading-relaxed">
              Leads, pipeline, demos, quotations and invoices — secured by row-level database isolation and real role-based permissions.
            </p>

            {/* Feature highlights — 2-col compact grid */}
            <div className="mt-6 grid grid-cols-2 gap-y-3 gap-x-4 max-w-sm">
              {highlights.map((h) => (
                <div key={h.text} className="flex items-center gap-2">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white/12 border border-white/15">
                    <h.icon className="size-3 text-sky-200" />
                  </div>
                  <span className="text-xs text-white/80 font-medium leading-tight">{h.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer trust strip */}
          <div className="flex items-center gap-2 pt-4 border-t border-white/15 shrink-0">
            <CheckCircle2 className="size-3.5 text-emerald-300 shrink-0" />
            <p className="text-[11px] text-white/55 leading-snug">
              Multi-tenant · Row-level security on every table · GDPR-ready isolation
            </p>
          </div>
        </div>
      </div>

      {/* ── Right Auth Panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 sm:px-8 bg-background overflow-hidden">
        {/* Mobile logo (shown only on small screens) */}
        <Link to="/" className="flex items-center gap-2 mb-5 lg:hidden shrink-0">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
            LK
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">LeadKart</span>
        </Link>

        {/* Card container — fixed max-width, compact gap */}
        <div className="w-full max-w-[380px] flex flex-col gap-4">

          {/* Header */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {mode === "signin"
                ? "Sign in to your LeadKart workspace to continue."
                : "New accounts join the demo org — explore real data instantly."}
            </p>
          </div>

          {/* Google OAuth */}
          <Button
            variant="outline"
            className="w-full h-10 text-sm font-semibold gap-2.5 border-border hover:bg-secondary transition-all shrink-0 hover:text-gray-800"
            disabled={busy}
            onClick={google}
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-muted-foreground font-medium">or continue with email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* Form fields */}
          <div className="flex flex-col gap-3">
            {mode === "signup" && (
              <AuthField
                id="auth-name"
                label="Full name"
                type="text"
                icon={User}
                value={fullName}
                onChange={setFullName}
                placeholder="Jane Smith"
                autoComplete="name"
              />
            )}
            <AuthField
              id="auth-email"
              label="Work email"
              type="email"
              icon={Mail}
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
              autoComplete="email"
            />
            {/* Password with visibility toggle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="auth-password" className="text-xs font-medium">Password</Label>
                {mode === "signin" && (
                  <button type="button" className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Minimum 8 characters" : "Enter your password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="h-9 pl-9 pr-9 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <Button
            className="w-full h-10 text-sm font-semibold gap-2 shadow-md hover:shadow-lg transition-all shrink-0"
            disabled={busy}
            onClick={submit}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                {mode === "signin" ? "Sign in to workspace" : "Create account"}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>

          {/* Mode toggle */}
          <p className="text-center text-xs text-muted-foreground shrink-0">
            {mode === "signin" ? (
              <>
                No account yet?{" "}
                <button
                  type="button"
                  className="text-primary hover:text-primary/80 font-semibold transition-colors"
                  onClick={() => setMode("signup")}
                >
                  Create one free
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary hover:text-primary/80 font-semibold transition-colors"
                  onClick={() => setMode("signin")}
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-border shrink-0">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3 text-emerald-500" /> Secure & encrypted
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCircle2 className="size-3 text-primary" /> Free to explore
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthField({
  id,
  label,
  type,
  icon: Icon,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-9 pl-9 text-sm"
        />
      </div>
    </div>
  );
}