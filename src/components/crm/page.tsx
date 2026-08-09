import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="px-6 py-10 text-center text-sm text-muted-foreground">{message}</p>;
}

export function NoAccess({ what }: { what: string }) {
  return (
    <Card className="shadow-card mx-auto mt-10 max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="font-semibold">No access to {what}</p>
        <p className="text-sm text-muted-foreground">
          Your role does not include permission for this module. Ask an owner or admin to grant it.
        </p>
      </CardContent>
    </Card>
  );
}
