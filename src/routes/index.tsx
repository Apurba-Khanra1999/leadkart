import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  KanbanSquare,
  Layers,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeadKart CRM — Multi-tenant sales CRM for growing teams" },
      {
        name: "description",
        content:
          "Manage leads, pipeline, follow-ups, quotations and invoices in one workspace. Strict tenant isolation and role-based permissions built in.",
      },
      { property: "og:title", content: "LeadKart CRM — Multi-tenant sales CRM for growing teams" },
      {
        property: "og:description",
        content:
          "Manage leads, pipeline, follow-ups, quotations and invoices in one workspace. Strict tenant isolation and role-based permissions built in.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Users,
    title: "Lead management",
    body: "Capture, qualify and assign leads with statuses, sources, priorities and owners you configure per organisation.",
  },
  {
    icon: KanbanSquare,
    title: "Pipeline you can trust",
    body: "Weighted forecasts computed in the database from deal value and probability — never a stale UI number.",
  },
  {
    icon: CalendarClock,
    title: "Follow-ups that surface",
    body: "Overdue and due-today activity lands on the dashboard so nothing slips between calls.",
  },
  {
    icon: Receipt,
    title: "Quotes to cash",
    body: "Quotations, invoices and payments with automatic balances, statuses and overdue transitions.",
  },
  {
    icon: ShieldCheck,
    title: "Tenant isolation",
    body: "Row-level security on every table. Organisation A cannot read Organisation B — enforced by Postgres, not by frontend filters.",
  },
  {
    icon: Layers,
    title: "Real permissions",
    body: "Owner, Admin, Sales Manager, Sales Executive and Accountant map to a granular permission catalogue.",
  },
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold">Zenith CRM</span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <p className="text-sm font-medium text-accent">Multi-tenant sales CRM</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold sm:text-5xl">
          Run your entire sales motion in one disciplined workspace.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Leads, pipeline, follow-ups, quotations and invoices — with strict organisation isolation
          and role-based access enforced at the database layer.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Explore the demo workspace <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Create an account</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          New sign-ups join a seeded organisation with real leads, deals, follow-ups and invoices.
        </p>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border p-5 shadow-card">
              <f.icon className="size-5 text-accent" />
              <h2 className="mt-3 font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">
        Phase 1: foundation, dashboard and lead management. Pipeline, quotations, invoicing and team
        administration follow next.
      </footer>
    </div>
  );
}
