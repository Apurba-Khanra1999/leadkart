import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Pencil,
  Send,
  UserRoundPlus,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/crm/page";
import { Timeline, sortEvents, type TimelineEvent } from "@/components/crm/timeline";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatDate, formatDateTime, formatMoneyFull, initials, relativeDay } from "@/lib/crm";
import { fetchProductLines, useProducts } from "@/hooks/use-products";
import { ProductSummary } from "@/components/crm/product-picker";

export type LeadDetailTarget = {
  id: string;
  name: string;
  lead_number: string | null;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-medium break-words">{value ?? "—"}</p>
    </div>
  );
}

export function LeadDetailSheet({
  target,
  onOpenChange,
  statusName,
  sourceName,
  ownerName,
  onEdit,
  onScheduleFollowUp,
  onConvert,
  canConvert,
  canUpdate,
  canFollowUp,
}: {
  target: LeadDetailTarget | null;
  onOpenChange: (open: boolean) => void;
  statusName?: string | null | undefined;
  sourceName?: string | null | undefined;
  ownerName?: string | null | undefined;
  onEdit?: () => void;
  onScheduleFollowUp?: () => void;
  onConvert?: () => void;
  canConvert?: boolean;
  canUpdate?: boolean;
  canFollowUp?: boolean;
}) {
  const { data: ws } = useWorkspace();
  const symbol = ws?.currencySymbol ?? "₹";
  const queryClient = useQueryClient();
  const leadId = target?.id;
  const [comment, setComment] = useState("");
  const products = useProducts(ws?.organizationId);

  const productLines = useQuery({
    queryKey: ["lead-product-lines", leadId],
    enabled: Boolean(leadId),
    queryFn: () => fetchProductLines({ lead_id: leadId! }),
  });

  const detail = useQuery({
    queryKey: ["lead-detail", leadId],
    enabled: Boolean(leadId),
    queryFn: async () => {
      const [lead, activities, followUps] = await Promise.all([
        supabase.from("leads").select("*").eq("id", leadId!).maybeSingle(),
        supabase
          .from("activities")
          .select("id, type, title, description, actor_name, occurred_at, created_at")
          .eq("lead_id", leadId!)
          .order("occurred_at", { ascending: false })
          .limit(100),
        supabase
          .from("follow_ups")
          .select(
            "id, type, subject, notes, due_at, status, priority, outcome, completed_at, created_at",
          )
          .eq("lead_id", leadId!)
          .order("due_at", { ascending: false }),
      ]);
      if (lead.error) throw lead.error;
      return {
        lead: lead.data,
        activities: activities.data ?? [],
        followUps: followUps.data ?? [],
      };
    },
  });

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      if (!ws?.organizationId || !leadId) throw new Error("Workspace not ready");
      const text = body.trim();
      if (!text) throw new Error("Write something first");
      const { error } = await supabase.from("activities").insert({
        organization_id: ws.organizationId,
        lead_id: leadId,
        type: "comment",
        title: text.slice(0, 120),
        description: text,
        actor_member_id: ws.memberId,
        actor_name: ws.fullName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      toast.success("Comment added");
      queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", ws?.organizationId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not comment"),
  });

  const lead = detail.data?.lead;
  const activities = detail.data?.activities ?? [];
  const comments = activities.filter((a) => a.type === "comment");
  const followUpRows = detail.data?.followUps ?? [];

  const timeline = sortEvents([
    ...activities.map<TimelineEvent>((a) => ({
      id: `act-${a.id}`,
      at: a.occurred_at,
      title: a.type === "comment" ? "Comment added" : a.title,
      description: a.description,
      actor: a.actor_name,
      kind: a.type,
    })),
    ...followUpRows.flatMap<TimelineEvent>((f) => {
      const label = f.subject ?? f.type;
      const events: TimelineEvent[] = [
        {
          id: `fu-created-${f.id}`,
          at: f.created_at,
          title: `Follow-up scheduled — ${label}`,
          description: `${f.type.replace(/_/g, " ")} due ${formatDateTime(f.due_at)}${
            f.notes ? ` · ${f.notes}` : ""
          }`,
          kind: "follow_up",
        },
      ];
      if (f.completed_at) {
        events.push({
          id: `fu-done-${f.id}`,
          at: f.completed_at,
          title: `Follow-up completed — ${label}`,
          description: f.outcome,
          kind: "follow_up_completed",
        });
      }
      return events;
    }),
    ...(lead?.converted_at
      ? [
          {
            id: "lead-converted",
            at: lead.converted_at,
            title: "Lead converted to client",
            kind: "conversion",
          } as TimelineEvent,
        ]
      : []),
    ...(lead?.last_contacted_at
      ? [
          {
            id: "lead-contacted",
            at: lead.last_contacted_at,
            title: "Last contacted",
            kind: "contact",
          } as TimelineEvent,
        ]
      : []),
    ...(lead
      ? [
          {
            id: "lead-created",
            at: lead.created_at,
            title: `Lead created${lead.lead_number ? ` — ${lead.lead_number}` : ""}`,
            description: [
              lead.company ? `Company: ${lead.company}` : null,
              sourceName ? `Source: ${sourceName}` : null,
              ownerName ? `Owner: ${ownerName}` : null,
              `Estimated value: ${formatMoneyFull(lead.estimated_value, symbol)}`,
            ]
              .filter(Boolean)
              .join(" · "),
            kind: "created",
          } as TimelineEvent,
        ]
      : []),
  ]);

  return (
    <Sheet open={Boolean(target)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="space-y-1 border-b p-6 pb-4">
          <SheetTitle className="text-xl">{target?.name}</SheetTitle>
          <SheetDescription>
            {target?.lead_number ?? "Lead"}
            {lead?.company ? ` · ${lead.company}` : ""}
          </SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            {statusName && <Badge variant="secondary">{statusName}</Badge>}
            {lead?.priority && <Badge variant="outline">{lead.priority} priority</Badge>}
            {lead?.converted_client_id && <Badge>Converted</Badge>}
          </div>
          <div className="flex flex-wrap gap-2 pt-3">
            {canUpdate && onEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil className="mr-1 size-3.5" /> Edit
              </Button>
            )}
            {canFollowUp && onScheduleFollowUp && (
              <Button size="sm" variant="outline" onClick={onScheduleFollowUp}>
                <CalendarClock className="mr-1 size-3.5" /> Follow-up
              </Button>
            )}
            {canConvert && onConvert && !lead?.converted_client_id && (
              <Button size="sm" onClick={onConvert}>
                <UserRoundPlus className="mr-1 size-3.5" /> Add to clients
              </Button>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="flex-1 p-6 pt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="comments">
              Comments{comments.length ? ` (${comments.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-5">
            {detail.isLoading && <Skeleton className="h-64" />}
            {lead && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Row label="Contact" value={`${lead.first_name} ${lead.last_name ?? ""}`.trim()} />
                  <Row label="Job title" value={lead.job_title ?? "—"} />
                  <Row label="Company" value={lead.company ?? "—"} />
                  <Row label="Industry" value={lead.industry ?? "—"} />
                  <Row label="Phone" value={lead.phone ?? "—"} />
                  <Row label="Alt phone" value={lead.alt_phone ?? "—"} />
                  <Row label="Email" value={lead.email ?? "—"} />
                  <Row label="Website" value={lead.website ?? "—"} />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <Row label="Estimated value" value={formatMoneyFull(lead.estimated_value, symbol)} />
                  <Row label="Owner" value={ownerName ?? "Unassigned"} />
                  <Row label="Source" value={sourceName ?? "—"} />
                  <Row label="Status" value={statusName ?? "—"} />
                  <Row
                    label="Next follow-up"
                    value={
                      lead.next_followup_at
                        ? `${formatDateTime(lead.next_followup_at)} (${relativeDay(lead.next_followup_at)})`
                        : "None scheduled"
                    }
                  />
                  <Row
                    label="Last contacted"
                    value={lead.last_contacted_at ? formatDateTime(lead.last_contacted_at) : "—"}
                  />
                  <Row label="Created" value={formatDate(lead.created_at)} />
                  <Row
                    label="Location"
                    value={[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "—"}
                  />
                </div>
                {lead.address && (
                  <>
                    <Separator />
                    <Row label="Address" value={lead.address} />
                  </>
                )}
                {lead.notes && (
                  <>
                    <Separator />
                    <Row label="Notes" value={lead.notes} />
                  </>
                )}

                <Separator />
                <div className="space-y-2">
                  <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    Interested services / products
                  </p>
                  <ProductSummary
                    lines={productLines.data ?? []}
                    products={products.data ?? []}
                    symbol={symbol}
                  />
                </div>

                <Separator />
                <div className="space-y-2">
                  <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    Follow-ups
                  </p>
                  {(detail.data?.followUps ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No follow-ups yet.</p>
                  )}
                  {(detail.data?.followUps ?? []).map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{f.subject ?? f.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(f.due_at)} · {relativeDay(f.due_at)}
                        </p>
                      </div>
                      <Badge variant={f.status === "pending" ? "outline" : "secondary"}>
                        {f.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            {detail.isLoading && <Skeleton className="h-48" />}
            {!detail.isLoading && timeline.length === 0 && (
              <EmptyState message="No activity recorded for this lead yet." />
            )}
            <Timeline events={timeline} />
          </TabsContent>

          <TabsContent value="comments" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Textarea
                rows={3}
                placeholder="Add a note about this lead — calls, objections, next steps…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                aria-label="New comment"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={addComment.isPending || !comment.trim()}
                  onClick={() => addComment.mutate(comment)}
                >
                  {addComment.isPending ? (
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1 size-3.5" />
                  )}
                  Post comment
                </Button>
              </div>
            </div>
            <Separator />
            {comments.length === 0 && (
              <p className="flex items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <MessageSquare className="size-4" /> No comments yet — start the track record.
              </p>
            )}
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 rounded-lg border p-3">
                  <span className="bg-secondary flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                    {initials(c.actor_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {c.actor_name ?? "Someone"}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {formatDateTime(c.occurred_at)}
                      </span>
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{c.description ?? c.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2 border-t p-4 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5" /> Every comment and status change is kept on this
          lead's record.
        </div>
      </SheetContent>
    </Sheet>
  );
}
