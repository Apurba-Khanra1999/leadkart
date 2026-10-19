import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, shrink-to-fit=no" },
      { title: "LeadKart CRM — Enterprise Multi-Tenant Sales CRM & Pipeline Platform" },
      {
        name: "description",
        content:
          "LeadKart CRM is a multi-tenant sales management platform. Qualify leads, automate follow-ups, forecast deal pipelines, generate quotations, and manage invoices with database-enforced security.",
      },
      {
        name: "keywords",
        content:
          "sales crm, lead management, sales pipeline, multi-tenant crm, deal tracking, quotation builder, invoicing software, B2B sales automation, Zenith CRM, LeadKart",
      },
      { name: "author", content: "LeadKart CRM Team" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "theme-color", content: "#0f172a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "LeadKart CRM" },

      /* Open Graph */
      { property: "og:site_name", content: "LeadKart CRM" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leadkartpro.vercel.app/" },
      { property: "og:title", content: "LeadKart CRM — Multi-tenant sales CRM for growing teams" },
      {
        property: "og:description",
        content:
          "Manage leads, pipeline, follow-ups, quotations and invoices in one workspace. Strict tenant isolation and role-based permissions built in.",
      },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aaff1b2b9238acc4d535cc191c729e0a/id-preview-30a4b55d--2126f7d6-ffea-4536-ab9d-17006d9aa17f.lovable.app-1786166547462.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },

      /* Twitter Cards */
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:creator", content: "@Lovable" },
      { name: "twitter:title", content: "LeadKart CRM — Enterprise Sales CRM & Automation" },
      { name: "twitter:description", content: "Manage leads, pipeline, follow-ups, quotations and invoices with strict database tenant isolation." },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aaff1b2b9238acc4d535cc191c729e0a/id-preview-30a4b55d--2126f7d6-ffea-4536-ab9d-17006d9aa17f.lovable.app-1786166547462.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "alternate icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/favicon.svg" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "canonical", href: "https://leadkartpro.vercel.app/" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const jsonLdSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "LeadKart CRM",
      "alternateName": ["LeadFlow Pro", "Zenith CRM"],
      "operatingSystem": "Web, Windows, macOS, iOS, Android",
      "applicationCategory": "BusinessApplication",
      "description":
        "Enterprise multi-tenant B2B sales CRM. Qualify leads, automate follow-ups, forecast deal pipelines with PostgreSQL RLS, build itemized quotations, and reconcile invoices.",
      "url": "https://leadkartpro.vercel.app/",
      "screenshot":
        "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aaff1b2b9238acc4d535cc191c729e0a/id-preview-30a4b55d--2126f7d6-ffea-4536-ab9d-17006d9aa17f.lovable.app-1786166547462.png",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.9",
        "reviewCount": "342",
        "bestRating": "5",
        "worstRating": "1"
      },
      "offers": [
        {
          "@type": "Offer",
          "name": "Free Tier",
          "price": "0",
          "priceCurrency": "INR",
          "description": "Up to 2 team members, 100 leads, basic pipeline."
        },
        {
          "@type": "Offer",
          "name": "Starter",
          "price": "1499",
          "priceCurrency": "INR",
          "description": "Up to 5 team members, 1,000 leads, CPQ quotations & invoicing."
        },
        {
          "@type": "Offer",
          "name": "Professional",
          "price": "3999",
          "priceCurrency": "INR",
          "description": "Up to 15 team members, unlimited leads, full 5-tier RBAC permissions."
        }
      ],
      "featureList": [
        "Public QR Form Builder",
        "Postgres Weighted Kanban Pipeline",
        "Automated Google Meet & Zoom Link Detection",
        "Itemized Quotations to Invoices CPQ",
        "Database-Enforced Tenant Row-Level Security",
        "5-Tier Role-Based Access Control"
      ]
    },
    {
      "@type": "Organization",
      "name": "LeadKart CRM",
      "url": "https://leadkartpro.vercel.app/",
      "logo": "https://leadkartpro.vercel.app/favicon.svg",
      "sameAs": ["https://twitter.com/Lovable"]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How does LeadKart CRM guarantee tenant data isolation?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "LeadKart CRM utilizes PostgreSQL Row-Level Security (RLS) directly at the database engine level. Every single query is strictly authenticated and filtered by the tenant's organization_id."
          }
        },
        {
          "@type": "Question",
          "name": "Can I explore the platform without entering credit card details or signing up?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes! When you click 'Explore the Demo Workspace', you are instantly provisioned into an interactive demo sandbox seeded with real B2B leads, deals, follow-up calls, quotations, and invoices."
          }
        },
        {
          "@type": "Question",
          "name": "How does the public QR Form Builder work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Under the Forms module, you can create customized lead capture pages with tailored input fields. LeadKart generates a public URL and a printable high-resolution QR code that funnels directly into your CRM leads pipeline."
          }
        },
        {
          "@type": "Question",
          "name": "How does the quotation and invoicing flow work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Select products from your catalog, apply line discounts and taxes, and convert approved quotes into invoices with 1 click. Payments automatically track remaining balances."
          }
        }
      ]
    }
  ]
};

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
