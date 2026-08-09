import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(mode: "signin" | "signup") {
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid details");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
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
        toast.success("Welcome to your workspace");
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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-brand hidden flex-col justify-between p-10 text-primary-foreground lg:flex">
        <Link to="/" className="text-lg font-semibold">
          Zenith CRM
        </Link>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-bold">Every lead, follow-up and rupee in one workspace.</h1>
          <p className="text-sm text-primary-foreground/80">
            Multi-tenant by design: your organisation's data is isolated at the database level, and
            every role sees exactly what it should.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs text-primary-foreground/70">
          <ShieldCheck className="size-4" /> Row-level security enforced on every table
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              New accounts join the seeded demo organisation so you can explore real data instantly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-4 space-y-3">
                <Field id="email" label="Work email" value={email} onChange={setEmail} type="email" />
                <Field
                  id="password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  type="password"
                />
                <Button className="w-full" disabled={busy} onClick={() => submit("signin")}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Sign in
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="mt-4 space-y-3">
                <Field id="name" label="Full name" value={fullName} onChange={setFullName} />
                <Field
                  id="email2"
                  label="Work email"
                  value={email}
                  onChange={setEmail}
                  type="email"
                />
                <Field
                  id="password2"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  type="password"
                />
                <Button className="w-full" disabled={busy} onClick={() => submit("signup")}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Create account
                </Button>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" disabled={busy} onClick={google}>
              Continue with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}