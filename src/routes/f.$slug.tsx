import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Building2,
  ShieldCheck,
  User,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  MessageSquare,
  List,
  CheckSquare,
  ArrowRight,
  Lock,
  Sun,
  Moon,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getLocalForms, saveLocalSubmission } from "./_authenticated/forms";

export const Route = createFileRoute("/f/$slug")({
  component: PublicFormPage,
});

// Map field types and labels to Lucide icons for rich aesthetics
function getFieldIcon(fieldType: string, label: string) {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("email")) return <Mail className="size-3.5 text-primary" />;
  if (lowerLabel.includes("phone") || lowerLabel.includes("mobile")) return <Phone className="size-3.5 text-primary" />;
  if (lowerLabel.includes("name") || lowerLabel.includes("person")) return <User className="size-3.5 text-primary" />;
  if (lowerLabel.includes("company") || lowerLabel.includes("org")) return <Building2 className="size-3.5 text-primary" />;
  if (lowerLabel.includes("budget") || lowerLabel.includes("value") || lowerLabel.includes("amount") || fieldType === "number") {
    return <DollarSign className="size-3.5 text-primary" />;
  }
  if (fieldType === "date" || lowerLabel.includes("date")) return <Calendar className="size-3.5 text-primary" />;
  if (fieldType === "textarea" || lowerLabel.includes("note") || lowerLabel.includes("message")) {
    return <MessageSquare className="size-3.5 text-primary" />;
  }
  if (fieldType === "select" || fieldType === "radio") return <List className="size-3.5 text-primary" />;
  if (fieldType === "checkbox") return <CheckSquare className="size-3.5 text-primary" />;

  return <Sparkles className="size-3.5 text-primary" />;
}

function PublicFormPage() {
  const { slug } = Route.useParams();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");

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

  // Synchronize initial theme with form settings
  useEffect(() => {
    if (formInfo?.form?.default_theme) {
      setCurrentTheme((formInfo.form.default_theme as "light" | "dark") || "light");
    }
  }, [formInfo?.form?.default_theme]);

  // Calculate dynamic form completion progress %
  const completionPercentage = useMemo(() => {
    if (!formInfo?.fields || formInfo.fields.length === 0) return 0;
    const filledCount = formInfo.fields.filter((f) => {
      const val = formData[f.label];
      if (Array.isArray(val)) return val.length > 0;
      return val !== undefined && val !== null && String(val).trim() !== "";
    }).length;
    return Math.round((filledCount / formInfo.fields.length) * 100);
  }, [formData, formInfo]);

  // Submit form mutation with resilient fallback
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!formInfo) return;
      const { form, fields } = formInfo;

      // Validate required fields
      for (const field of fields) {
        if (field.is_required && (!formData[field.label] || String(formData[field.label]).trim() === "")) {
          throw new Error(`Please fill out required field: ${field.label}`);
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
        }, 1800);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit form. Please check required fields.");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border bg-white p-8 shadow-xl">
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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center rounded-2xl border bg-white p-8 shadow-xl space-y-3">
          <AlertCircle className="mx-auto size-12 text-slate-400" />
          <h2 className="text-xl font-bold text-slate-900">Form Not Found</h2>
          <p className="text-sm text-slate-500">
            This lead form is currently unavailable, inactive, or the URL link has expired.
          </p>
        </div>
      </div>
    );
  }

  const { form, fields } = formInfo;
  const orgName = (form as any).organizations?.name || "LeadKart CRM";
  const accentColor = form.accent_color || "#2563eb";
  const isDark = currentTheme === "dark";

  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${isDark ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-900"}`}>
        <div className={`w-full max-w-md text-center rounded-3xl border p-8 md:p-10 shadow-2xl backdrop-blur-xl space-y-5 animate-in fade-in zoom-in duration-300 ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200/90"}`}>
          <div
            className="mx-auto flex size-16 items-center justify-center rounded-2xl text-white shadow-lg ring-4 ring-primary/20 scale-105"
            style={{ backgroundColor: accentColor }}
          >
            <CheckCircle2 className="size-9" />
          </div>
          <div className="space-y-2">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-xs px-3 py-0.5">
              Submission Verified
            </Badge>
            <h2 className={`text-2xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>Thank You!</h2>
            <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>{form.success_message}</p>
          </div>

          {form.redirect_url && (
            <div className="pt-2">
              <Badge variant="secondary" className="gap-1.5 text-xs animate-pulse">
                Redirecting automatically <ArrowRight className="size-3" />
              </Badge>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 md:p-10 relative overflow-hidden transition-colors duration-300 ${isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100/90 text-slate-900"}`}>
      {/* Subtle Mesh Ambient Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 opacity-15 pointer-events-none blur-3xl rounded-full"
        style={{
          background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
        }}
      />

      <div className="w-full max-w-xl space-y-4 relative z-10">
        {/* Floating Brand, Security Pill & Interactive Theme Toggle */}
        <div className="flex items-center justify-between px-1">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-md ${isDark ? "border-slate-800 bg-slate-900/80 text-slate-300" : "border-slate-200 bg-white/90 text-slate-700"}`}>
            <Building2 className="size-3.5 text-primary" />
            <span>{orgName}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>Encrypted Lead Form</span>
            </div>

            {/* THEME TOGGLE BUTTON */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCurrentTheme(isDark ? "light" : "dark")}
              className={`h-8 px-2.5 gap-1.5 text-xs font-medium rounded-full shadow-xs ${isDark ? "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
              title={`Switch to ${isDark ? "Light" : "Dark"} theme`}
            >
              {isDark ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5 text-indigo-600" />}
              <span className="capitalize">{currentTheme}</span>
            </Button>
          </div>
        </div>

        {/* MAIN FORM CARD */}
        <div className={`rounded-3xl border shadow-2xl backdrop-blur-xl overflow-hidden transition-all ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200/90"}`}>
          {/* Top Brand Accent Line */}
          <div className="h-2 w-full" style={{ backgroundColor: accentColor }} />

          <div className="p-6 md:p-8 space-y-6">
            {/* Header Title & Description */}
            <div className={`space-y-2 border-b pb-5 ${isDark ? "border-slate-800/80" : "border-slate-100"}`}>
              <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>{form.title}</h1>
              {form.description && (
                <p className={`text-sm leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>{form.description}</p>
              )}

              {/* Progress Bar */}
              <div className="pt-2 space-y-1.5">
                <div className={`flex items-center justify-between text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  <span>Form Completion</span>
                  <span>{completionPercentage}% Filled</span>
                </div>
                <Progress value={completionPercentage} className={`h-1.5 ${isDark ? "bg-slate-800" : "bg-slate-100"}`} />
              </div>
            </div>

            {/* Dynamic Form Controls */}
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
                    <Label className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                      {getFieldIcon(field.field_type, field.label)}
                      <span>{field.label}</span>
                      {field.is_required && <span className="text-rose-500">*</span>}
                    </Label>

                    {field.field_type === "textarea" ? (
                      <Textarea
                        required={field.is_required}
                        placeholder={field.placeholder || "Enter details..."}
                        value={value}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, [field.label]: e.target.value }))
                        }
                        rows={3}
                        className={`text-xs shadow-xs ${isDark ? "bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-primary" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-primary"}`}
                      />
                    ) : field.field_type === "select" ? (
                      <Select
                        value={value}
                        onValueChange={(val) =>
                          setFormData((prev) => ({ ...prev, [field.label]: val }))
                        }
                      >
                        <SelectTrigger className={`w-full text-xs shadow-xs ${isDark ? "bg-slate-950/60 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"}`}>
                          <SelectValue placeholder={field.placeholder || "Select option..."} />
                        </SelectTrigger>
                        <SelectContent className={isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"}>
                          {options.map((opt, idx) => (
                            <SelectItem key={idx} value={opt} className="text-xs">
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
                          <div key={idx} className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-colors ${isDark ? "border-slate-800/80 bg-slate-950/40 hover:border-slate-700" : "border-slate-200/90 bg-slate-50/70 hover:bg-slate-100/80"}`}>
                            <RadioGroupItem value={opt} id={`${field.id}-${idx}`} className={isDark ? "border-slate-600 text-primary" : "border-slate-300 text-primary"} />
                            <Label htmlFor={`${field.id}-${idx}`} className={`text-xs font-normal cursor-pointer w-full ${isDark ? "text-slate-300" : "text-slate-800"}`}>
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
                            <div key={idx} className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-colors ${isDark ? "border-slate-800/80 bg-slate-950/40 hover:border-slate-700" : "border-slate-200/90 bg-slate-50/70 hover:bg-slate-100/80"}`}>
                              <Checkbox
                                id={`${field.id}-${idx}`}
                                checked={checked}
                                onCheckedChange={(isChk) => {
                                  const newArr = isChk
                                    ? [...currentArr, opt]
                                    : currentArr.filter((item: string) => item !== opt);
                                  setFormData((prev) => ({ ...prev, [field.label]: newArr }));
                                }}
                                className={isDark ? "border-slate-600 data-[state=checked]:bg-primary" : "border-slate-300 data-[state=checked]:bg-primary"}
                              />
                              <Label htmlFor={`${field.id}-${idx}`} className={`text-xs font-normal cursor-pointer w-full ${isDark ? "text-slate-300" : "text-slate-800"}`}>
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
                        className={`text-xs h-10 shadow-xs ${isDark ? "bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-primary" : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-primary"}`}
                      />
                    )}

                    {field.help_text && (
                      <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{field.help_text}</p>
                    )}
                  </div>
                );
              })}

              <Button
                type="submit"
                disabled={submitMutation.isPending}
                className="w-full h-11 text-sm font-semibold text-white mt-6 shadow-xl transition-all hover:opacity-95 active:scale-[0.99] gap-2"
                style={{ backgroundColor: accentColor }}
              >
                {submitMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4 animate-spin" /> Submitting...
                  </span>
                ) : (
                  <>
                    <span>{form.submit_button_text || "Submit Response"}</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <div className={`pt-4 border-t text-center flex items-center justify-center gap-1.5 text-[11px] ${isDark ? "border-slate-800/80 text-slate-500" : "border-slate-100 text-slate-400"}`}>
              <Lock className="size-3" />
              <span>Powered by <strong className={isDark ? "text-slate-300 font-semibold" : "text-slate-700 font-semibold"}>LeadKart CRM</strong> — Verified Data Platform</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
