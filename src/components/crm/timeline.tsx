import { Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/crm";

export type TimelineEvent = {
  id: string;
  at: string;
  title: string;
  description?: string | null;
  actor?: string | null;
  kind: string;
};

export function sortEvents(events: TimelineEvent[]) {
  return events
    .filter((e) => Boolean(e.at))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-4 border-l pl-6">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="bg-primary absolute top-1.5 -left-[1.6rem] flex size-3 items-center justify-center rounded-full" />
          <p className="text-sm font-medium">{e.title}</p>
          {e.description ? (
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{e.description}</p>
          ) : null}
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {formatDateTime(e.at)}
            {e.actor ? ` · ${e.actor}` : ""}
            <Badge variant="outline" className="ml-1 text-[10px]">
              {e.kind.replace(/_/g, " ")}
            </Badge>
          </p>
        </li>
      ))}
    </ol>
  );
}