import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Send,
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
import { formatDateTime, initials, relativeDay } from "@/lib/crm";
import { fetchProductLines, useProducts } from "@/hooks/use-products";
import { ProductSummary } from "@/components/crm/product-picker";

export type FollowUpDetailTarget = { id: string; subject: string };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-medium break-words">{value ?? "—"}</p>
    </div>
  );
}

export function FollowUpDetailSheet({
  target,
  onOpenChange,
  leadName,
  ownerName,
  typeLabel,
  onEdit,
  onComplete,
  onReopen,
  canManage,
}: {
  target: FollowUpDetailTarget | null;
  onOpenChange: (open: boolean) => void;
  leadName?: string | null;
  ownerName?: string | null;
  typeLabel?: string | null;
  onEdit?: () => void;
  onComplete?: () => void;
  onReopen?: () => void;
  canManage?: boolean;
}) {
  const { data: ws } = useWorkspace();
  const queryClient = useQueryClient();
  const id = target?.id;
  const [comment, setComment] = useState("");
  const products = useProducts(ws?.organizationId);
  const productLines = useQuery({
    queryKey: ["followup-product-lines", id],
    enabled: Boolean(id),
    queryFn: () => fetchProductLines({ follow_up_id: id! }),
  });

  const detail = useQuery({
    queryKey: ["follow-up-detail", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const followUp = await supabase.from("follow_ups").select("*").eq("id", id!).maybeSingle();
      if (followUp.error) throw followUp.error;
      const activities = await supabase
        .from("activities")
        .select("id, type, title, description, actor_name, occurred_at")
        .eq("follow_up_id", id!)
        .order("occurred_at", { ascending: false })
        .limit(100);
      return { followUp: followUp.data, activities: activities.data ?? [] };
    },
  });

  const followUp = detail.data?.followUp;
  const activities = detail.data?.activities ?? [];
  const comments = activities.filter((a) => a.type === "comment");

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      if (!ws?.organizationId || !id) throw new Error("Workspace not ready");
      const text = body.trim();
      if (!text) throw new Error("Write something first");
      const { error } = await supabase.from("activities").insert({
        organization_id: ws.organizationId,
        follow_up_id: id,
        lead_id: followUp?.lead_id ?? null,
        client_id: followUp?.client_id ?? null,
        deal_id: followUp?.deal_id ?? null,
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
      queryClient.invalidateQueries({ queryKey: ["follow-up-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["lead-detail"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", ws?.organizationId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not comment"),
  });

  const timeline = sortEvents([
    ...activities.map<TimelineEvent>((a) => ({
      id: `act-${a.id}`,
      at: a.occurred_at,
      title: a.type === "comment" ? "Comment added" : a.title,
      description: a.description,
      actor: a.actor_name,
      kind: a.type,
    })),
    ...(followUp
      ? [
          {
            id: "fu-created",
            at: followUp.created_at,
            title: "Follow-up scheduled",
            description: [
              typeLabel ? `Type: ${typeLabel}` : null,
              `Due ${formatDateTime(followUp.due_at)}`,
              leadName ? `Lead: ${leadName}` : null,
              ownerName ? `Owner: ${ownerName}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
            kind: "created",
          } as TimelineEvent,
        ]
      : []),
    ...(followUp?.rescheduled_from
      ? [
          {
            id: "fu-resched",
            at: followUp.updated_at,
            title: "Follow-up rescheduled",
            description: `Moved from ${formatDateTime(followUp.rescheduled_from)}`,
            kind: "rescheduled",
          } as TimelineEvent,
        ]
      : []),
    ...(followUp?.completed_at
      ? [
          {
            id: "fu-done",
            at: followUp.completed_at,
            title: "Follow-up completed",
            description: followUp.outcome,
            kind: "completed",
          } as TimelineEvent,
        ]
      : []),
  ]);

  return (
    <Sheet open={Boolean(target)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="space-y-1 border-b p-6 pb-4">
          <SheetTitle className="text-xl">{target?.subject}</SheetTitle>
          <SheetDescription>
            {typeLabel ?? "Follow-up"}
            {followUp ? ` · due ${formatDateTime(followUp.due_at)} (${relativeDay(followUp.due_at)})` : ""}
          </SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            {followUp?.status && <Badge variant="secondary">{followUp.status}</Badge>}
            {followUp?.priority && <Badge variant="outline">{followUp.priority} priority</Badge>}
            {leadName && <Badge variant="outline">{leadName}</Badge>}
          </div>
          <div className="flex flex-wrap gap-2 pt-3">
            {canManage && onEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil className="mr-1 size-3.5" /> Edit
              </Button>
            )}
            {canManage && followUp?.status === "pending" && onComplete && (
              <Button size="sm" onClick={onComplete}>
                <CheckCircle2 className="mr-1 size-3.5" /> Mark complete
              </Button>
            )}
            {canManage && followUp && followUp.status !== "pending" && onReopen && (
              <Button size="sm" variant="outline" onClick={onReopen}>
                <RotateCcw className="mr-1 size-3.5" /> Reopen
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
            {detail.isLoading && <Skeleton className="h-56" />}
            {followUp && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Row label="Type" value={typeLabel ?? followUp.type} />
                  <Row label="Priority" value={followUp.priority} />
                  <Row label="Due at" value={formatDateTime(followUp.due_at)} />
                  <Row label="Status" value={followUp.status} />
                  <Row label="Owner" value={ownerName ?? "Unassigned"} />
                  <Row label="Linked lead" value={leadName ?? "None"} />
                  <Row label="Created" value={formatDateTime(followUp.created_at)} />
                  <Row
                    label="Completed"
                    value={followUp.completed_at ? formatDateTime(followUp.completed_at) : "—"}
                  />
                </div>
                {followUp.notes && (
                  <>
                    <Separator />
                    <Row label="Notes" value={followUp.notes} />
                  </>
                )}
                <Separator />
                <div className="space-y-2">
                  <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    Services / products discussed
                  </p>
                  <ProductSummary
                    lines={productLines.data ?? []}
                    products={products.data ?? []}
                    symbol={ws?.currencySymbol ?? "₹"}
                  />
                </div>
                {followUp.outcome && (
                  <>
                    <Separator />
                    <Row label="Outcome" value={followUp.outcome} />
                  </>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            {detail.isLoading && <Skeleton className="h-48" />}
            {!detail.isLoading && timeline.length === 0 && (
              <EmptyState message="Nothing recorded on this follow-up yet." />
            )}
            <Timeline events={timeline} />
          </TabsContent>

          <TabsContent value="comments" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Textarea
                rows={3}
                placeholder="What happened on this follow-up — outcome, objections, next steps…"
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
              <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <MessageSquare className="size-4" /> No comments yet.
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
          <CheckCircle2 className="size-3.5" /> Comments here also show on the linked lead's
          timeline.
        </div>
      </SheetContent>
    </Sheet>
  );
}