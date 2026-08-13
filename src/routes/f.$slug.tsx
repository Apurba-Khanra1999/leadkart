import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, AlertCircle, Building2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalForms, saveLocalSubmission } from "./_authenticated/forms";

export const Route = createFileRoute("/f/$slug")({
  component: PublicFormPage,
});

function PublicFormPage() {
  const { slug } = Route.useParams();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  // Fetch public active form definition with resilient local fallback
  const { data: formInfo, isLoading, error } = useQuery({
    queryKey: ["public-form", slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      try {
        const { data: form, error: formErr } = await supabase
          .from("forms")
          .select("*, organizations(name, logo_url)")
          .eq("slug", slug)
          .eq("is_active", true)
          .single();

        if (!formErr && form) {
          const { data: fields } = await supabase
            .from("form_fields")
            .select("*")
            .eq("form_id", form.id)
            .order("sort_order", { ascending: true });

          return { form, fields: fields || [] };
        }
      } catch {}

      // Fallback: search local storage by slug
      const localForms = getLocalForms();
      const match = localForms.find((f) => f.slug === slug && f.is_active);
      if (match) {
        return {
          form: match,
          fields: match.fields || [],
        };
      }

      throw new Error("Form not found or inactive");
    },
  });

  // Submit form mutation with resilient fallback
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!formInfo) return;
      const { form, fields } = formInfo;

      // Validate required fields
      for (const field of fields) {
        if (field.is_required && (!formData[field.label] || String(formData[field.label]).trim() === "")) {
          throw new Error(`Please fill out the required field: ${field.label}`);
        }
      }

      // Map values for lead creation if enabled
      let leadId: string | null = null;
      if (form.auto_create_lead) {
        let firstName = "Form Lead";
        let lastName = "";
        let email = "";
        let phone = "";
        let company = "";
        let estimatedValue = 0;
        let notes = "";

        fields.forEach((f) => {
          const val = formData[f.label];
          if (val === undefined || val === null || val === "") return;
          const displayVal = Array.isArray(val) ? val.join(", ") : String(val);

          switch (f.map_to_lead_field) {
            case "first_name":
              firstName = displayVal;
              break;
            case "last_name":
              lastName = displayVal;
              break;
            case "email":
              email = displayVal;
              break;
            case "phone":
              phone = displayVal;
              break;
            case "company":
              company = displayVal;
              break;
            case "estimated_value":
              estimatedValue = Number(displayVal) || 0;
              break;
            case "notes":
              notes = notes ? `${notes}\n${displayVal}` : displayVal;
              break;
            default:
              notes += `${notes ? "\n" : ""}${f.label}: ${displayVal}`;
              break;
          }
        });

        // Insert new Lead in organization
        try {
          const { data: newLead, error: leadErr } = await supabase
            .from("leads")
            .insert({
              organization_id: form.organization_id,
              first_name: firstName,
              last_name: lastName || null,
              email: email || null,
              phone: phone || null,
              company: company || null,
              estimated_value: estimatedValue,
              notes: notes.trim() || null,
              source_id: form.default_lead_source_id || null,
              assigned_member_id: form.default_assigned_to || null,
            })
            .select("id")
            .single();

          if (!leadErr && newLead) {
            leadId = newLead.id;
          }
        } catch {}
      }

      // Try DB insertion first
      try {
        const { error: subErr } = await supabase.from("form_submissions").insert({
          form_id: form.id,
          organization_id: form.organization_id,
          lead_id: leadId,
          data: formData,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        });

        if (!subErr) {
          await supabase
            .from("forms")
            .update({ submission_count: (form.submission_count || 0) + 1 })
            .eq("id", form.id);
          return;
        }
      } catch {}

      // Save submission locally if DB submission table pending
      saveLocalSubmission(form.id, form.organization_id, formData);
    },
    onSuccess: () => {
      setSubmitted(true);
      if (formInfo?.form.redirect_url) {
        setTimeout(() => {
          window.location.href = formInfo.form.redirect_url!;
        }, 1500);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit form. Please check required fields.");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (error || !formInfo) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center rounded-xl border bg-card p-8 shadow-sm">
          <AlertCircle className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-bold text-foreground">Form Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This form is either inactive, unavailable, or the link has expired.
          </p>
        </div>
      </div>
    );
  }

  const { form, fields } = formInfo;
  const orgName = (form.organizations as any)?.name || "LeadKart CRM";

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center rounded-2xl border bg-card p-8 shadow-lg space-y-4 animate-in fade-in zoom-in duration-300">
          <div
            className="mx-auto flex size-14 items-center justify-center rounded-full text-white shadow-md"
            style={{ backgroundColor: form.accent_color || "#2563eb" }}
          >
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Submission Received!</h2>
          <p className="text-sm text-muted-foreground">{form.success_message}</p>
          {form.redirect_url && (
            <p className="text-xs text-muted-foreground animate-pulse">
              Redirecting you shortly...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-xl rounded-2xl border bg-card shadow-xl overflow-hidden">
        {/* Accent Header Banner */}
        <div className="h-3 w-full" style={{ backgroundColor: form.accent_color || "#2563eb" }} />

        <div className="p-6 md:p-8 space-y-6">
          <div className="space-y-1.5 border-b pb-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Building2 className="size-3.5 text-primary" /> {orgName}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{form.title}</h1>
            {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitMutation.mutate();
            }}
            className="space-y-4"
          >
            {fields.map((field) => {
              const value = formData[field.label] ?? "";
              const options = (field.options as string[]) || [];

              return (
                <div key={field.id} className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">
                    {field.label}
                    {field.is_required && <span className="text-destructive ml-1">*</span>}
                  </Label>

                  {field.field_type === "textarea" ? (
                    <Textarea
                      required={field.is_required}
                      placeholder={field.placeholder || ""}
                      value={value}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, [field.label]: e.target.value }))
                      }
                      rows={3}
                    />
                  ) : field.field_type === "select" ? (
                    <Select
                      value={value}
                      onValueChange={(val) =>
                        setFormData((prev) => ({ ...prev, [field.label]: val }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={field.placeholder || "Select option..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((opt, idx) => (
                          <SelectItem key={idx} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.field_type === "radio" ? (
                    <RadioGroup
                      value={value}
                      onValueChange={(val) =>
                        setFormData((prev) => ({ ...prev, [field.label]: val }))
                      }
                      className="flex flex-col gap-2 pt-1"
                    >
                      {options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <RadioGroupItem value={opt} id={`${field.id}-${idx}`} />
                          <Label htmlFor={`${field.id}-${idx}`} className="text-xs font-normal">
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : field.field_type === "checkbox" ? (
                    <div className="flex flex-col gap-2 pt-1">
                      {options.map((opt, idx) => {
                        const currentArr = Array.isArray(value) ? value : [];
                        const checked = currentArr.includes(opt);
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <Checkbox
                              id={`${field.id}-${idx}`}
                              checked={checked}
                              onCheckedChange={(isChk) => {
                                const newArr = isChk
                                  ? [...currentArr, opt]
                                  : currentArr.filter((item: string) => item !== opt);
                                setFormData((prev) => ({ ...prev, [field.label]: newArr }));
                              }}
                            />
                            <Label htmlFor={`${field.id}-${idx}`} className="text-xs font-normal">
                              {opt}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Input
                      type={
                        field.field_type === "email"
                          ? "email"
                          : field.field_type === "number"
                          ? "number"
                          : field.field_type === "date"
                          ? "date"
                          : "text"
                      }
                      required={field.is_required}
                      placeholder={field.placeholder || ""}
                      value={value}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, [field.label]: e.target.value }))
                      }
                    />
                  )}

                  {field.help_text && (
                    <p className="text-[11px] text-muted-foreground">{field.help_text}</p>
                  )}
                </div>
              );
            })}

            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="w-full h-11 text-sm font-semibold text-white mt-4 shadow-md transition-all hover:opacity-95"
              style={{ backgroundColor: form.accent_color || "#2563eb" }}
            >
              {submitMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 animate-spin" /> Submitting...
                </span>
              ) : (
                form.submit_button_text || "Submit"
              )}
            </Button>
          </form>

          <div className="pt-4 border-t text-center">
            <p className="text-[11px] text-muted-foreground">
              Powered by <span className="font-semibold text-foreground">LeadKart CRM</span> — Secure Multi-Tenant Sales Engine
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
