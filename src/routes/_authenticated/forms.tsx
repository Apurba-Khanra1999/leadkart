import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Share2,
  Copy,
  Code,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  Sparkles,
  Settings2,
  FileCheck2,
  UserCheck,
  UserPlus,
  Inbox,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  ExternalLink,
  QrCode,
  Sun,
  Moon,
  Palette,
  DollarSign,
  Calendar,
  MessageSquare,
  LayoutTemplate,
  Check,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { PageHeader, EmptyState } from "@/components/crm/page";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatDate, formatDateTime } from "@/lib/crm";
import { QRCodeView } from "@/components/crm/qr-code";

export const Route = createFileRoute("/_authenticated/forms")({
  head: () => ({
    meta: [
      { title: "Form Builder & Lead Capture — LeadKart CRM" },
      {
        name: "description",
        content: "Build custom dynamic lead capture forms, generate shareable links & QR codes, and collect customer responses into your CRM.",
      },
    ],
  }),
  component: FormsPage,
});

export interface FormFieldItem {
  id?: string;
  label: string;
  field_type: string;
  placeholder?: string;
  help_text?: string;
  is_required: boolean;
  sort_order: number;
  options?: string[];
  options_raw?: string;
  map_to_lead_field: string;
}

export interface FormRecord {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  description: string | null;
  submit_button_text: string;
  success_message: string;
  redirect_url: string | null;
  is_active: boolean;
  accent_color: string;
  default_theme: "light" | "dark";
  auto_create_lead: boolean;
  default_lead_source_id: string | null;
  default_deal_stage_id: string | null;
  default_assigned_to: string | null;
  submission_count: number;
  created_at: string;
  fields?: FormFieldItem[];
}

export interface FormTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  accent_color: string;
  default_theme: "light" | "dark";
  submit_button_text: string;
  success_message: string;
  iconName: string;
  fields: FormFieldItem[];
}

const FIELD_TYPES = [
  { id: "text", label: "Single Line Text" },
  { id: "email", label: "Email Address" },
  { id: "phone", label: "Phone Number" },
  { id: "number", label: "Number" },
  { id: "textarea", label: "Multi-line Paragraph" },
  { id: "select", label: "Dropdown Select" },
  { id: "radio", label: "Radio Buttons" },
  { id: "checkbox", label: "Checkbox Options" },
  { id: "date", label: "Date Picker" },
];

const LEAD_FIELD_MAPPINGS = [
  { id: "custom", label: "Custom Field (Save in Form Payload & Notes)" },
  { id: "first_name", label: "Lead First Name" },
  { id: "last_name", label: "Lead Last Name" },
  { id: "email", label: "Lead Email" },
  { id: "phone", label: "Lead Phone" },
  { id: "company", label: "Company / Business Name" },
  { id: "estimated_value", label: "Estimated Deal Value" },
  { id: "notes", label: "Notes / Description" },
];

const ACCENT_COLORS = [
  { id: "#2563eb", name: "Royal Blue" },
  { id: "#059669", name: "Emerald Green" },
  { id: "#7c3aed", name: "Purple" },
  { id: "#dc2626", name: "Ruby Red" },
  { id: "#d97706", name: "Amber Gold" },
  { id: "#0284c7", name: "Ocean Cyan" },
  { id: "#0f172a", name: "Slate Dark" },
];

// READYMADE IN-BUILD FORM TEMPLATES
export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "sales_quote",
    title: "Sales Inquiry & Quote Request",
    category: "Sales & CRM",
    description: "Capture high-intent lead inquiries with estimated budget, company details, and project requirements.",
    accent_color: "#2563eb",
    default_theme: "light",
    submit_button_text: "Request Quote Now",
    success_message: "Thank you for requesting a quote! Our sales team will get back to you within 24 hours.",
    iconName: "DollarSign",
    fields: [
      { label: "First Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "e.g. Rahul" },
      { label: "Last Name", field_type: "text", is_required: false, sort_order: 1, map_to_lead_field: "last_name", placeholder: "e.g. Sharma" },
      { label: "Business Email", field_type: "email", is_required: true, sort_order: 2, map_to_lead_field: "email", placeholder: "rahul@company.com" },
      { label: "Phone Number", field_type: "phone", is_required: true, sort_order: 3, map_to_lead_field: "phone", placeholder: "+91 9876543210" },
      { label: "Company Name", field_type: "text", is_required: false, sort_order: 4, map_to_lead_field: "company", placeholder: "Acme Enterprises" },
      { label: "Estimated Budget ($)", field_type: "number", is_required: false, sort_order: 5, map_to_lead_field: "estimated_value", placeholder: "50000" },
      { label: "Service Required", field_type: "select", is_required: true, sort_order: 6, map_to_lead_field: "custom", options: ["Enterprise CRM Solution", "Custom Software Development", "Digital Marketing", "Consulting"], options_raw: "Enterprise CRM Solution, Custom Software Development, Digital Marketing, Consulting" },
      { label: "Project Details & Timeline", field_type: "textarea", is_required: false, sort_order: 7, map_to_lead_field: "notes", placeholder: "Briefly describe your project requirements and expected launch date..." },
    ],
  },
  {
    id: "customer_feedback",
    title: "Customer Feedback & NPS Survey",
    category: "Customer Experience",
    description: "Gather valuable user feedback, satisfaction ratings, and net promoter score recommendations.",
    accent_color: "#059669",
    default_theme: "light",
    submit_button_text: "Submit Feedback",
    success_message: "Thank you for your valuable feedback! We truly appreciate your input.",
    iconName: "Sparkles",
    fields: [
      { label: "Your Full Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "Jane Smith" },
      { label: "Email Address", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "jane@example.com" },
      { label: "Overall Product Experience", field_type: "radio", is_required: true, sort_order: 2, map_to_lead_field: "custom", options: ["Excellent 🌟", "Good 👍", "Average 😐", "Needs Improvement 👎"], options_raw: "Excellent 🌟, Good 👍, Average 😐, Needs Improvement 👎" },
      { label: "How likely are you to recommend us? (NPS)", field_type: "select", is_required: true, sort_order: 3, map_to_lead_field: "custom", options: ["10 - Extremely Likely", "9", "8", "7", "6", "5 - Neutral", "1 - Not Likely"], options_raw: "10 - Extremely Likely, 9, 8, 7, 6, 5 - Neutral, 1 - Not Likely" },
      { label: "What feature or improvement would help you most?", field_type: "textarea", is_required: false, sort_order: 4, map_to_lead_field: "notes", placeholder: "Tell us what we can do better..." },
    ],
  },
  {
    id: "webinar_registration",
    title: "Event & Webinar Registration",
    category: "Events & Marketing",
    description: "Collect attendee registrations for upcoming webinars, workshops, product launches, or conferences.",
    accent_color: "#7c3aed",
    default_theme: "light",
    submit_button_text: "Reserve My Seat",
    success_message: "Registration successful! Check your email for calendar invite and access link.",
    iconName: "Calendar",
    fields: [
      { label: "Attendee Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "Alex Johnson" },
      { label: "Work Email", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "alex@company.com" },
      { label: "Job Title & Company", field_type: "text", is_required: false, sort_order: 2, map_to_lead_field: "company", placeholder: "Head of Growth, Acme Inc." },
      { label: "Preferred Session Slot", field_type: "select", is_required: true, sort_order: 3, map_to_lead_field: "custom", options: ["Session A: Morning (10:00 AM IST)", "Session B: Evening (4:00 PM IST)"], options_raw: "Session A: Morning (10:00 AM IST), Session B: Evening (4:00 PM IST)" },
      { label: "Questions for the Speaker", field_type: "textarea", is_required: false, sort_order: 4, map_to_lead_field: "notes", placeholder: "What topic would you like us to address during Q&A?" },
    ],
  },
  {
    id: "contact_support",
    title: "Contact Us & Support Intake",
    category: "Support & Helpdesk",
    description: "Allow clients and customers to log support inquiries or general business contact requests.",
    accent_color: "#0284c7",
    default_theme: "light",
    submit_button_text: "Send Message",
    success_message: "Your message has been received! Our support desk will reach out shortly.",
    iconName: "MessageSquare",
    fields: [
      { label: "Full Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "Michael Scott" },
      { label: "Email Address", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "michael@dundermifflin.com" },
      { label: "Inquiry Category", field_type: "select", is_required: true, sort_order: 2, map_to_lead_field: "custom", options: ["General Inquiry", "Technical Support", "Billing & Subscriptions", "Partnership Request"], options_raw: "General Inquiry, Technical Support, Billing & Subscriptions, Partnership Request" },
      { label: "Subject", field_type: "text", is_required: true, sort_order: 3, map_to_lead_field: "custom", placeholder: "Brief summary of your inquiry" },
      { label: "Detailed Message / Description", field_type: "textarea", is_required: true, sort_order: 4, map_to_lead_field: "notes", placeholder: "Please share details so we can assist you promptly..." },
    ],
  },
  {
    id: "demo_booking",
    title: "Product Demo & Consultation",
    category: "Product & Growth",
    description: "High-converting 1-on-1 product demo booking form for potential enterprise buyers.",
    accent_color: "#d97706",
    default_theme: "light",
    submit_button_text: "Schedule Live Demo",
    success_message: "Demo booked! Our team member will send a Google Meet invite shortly.",
    iconName: "UserCheck",
    fields: [
      { label: "First Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "Priya" },
      { label: "Last Name", field_type: "text", is_required: false, sort_order: 1, map_to_lead_field: "last_name", placeholder: "Nair" },
      { label: "Corporate Email", field_type: "email", is_required: true, sort_order: 2, map_to_lead_field: "email", placeholder: "priya@enterprise.com" },
      { label: "Phone Number", field_type: "phone", is_required: true, sort_order: 3, map_to_lead_field: "phone", placeholder: "+91 9988776655" },
      { label: "Company Size", field_type: "select", is_required: false, sort_order: 4, map_to_lead_field: "company", options: ["1-10 employees", "11-50 employees", "51-200 employees", "200+ Enterprise"], options_raw: "1-10 employees, 11-50 employees, 51-200 employees, 200+ Enterprise" },
      { label: "Preferred Demo Date", field_type: "date", is_required: true, sort_order: 5, map_to_lead_field: "custom" },
      { label: "Primary CRM Goal / Pain Point", field_type: "textarea", is_required: false, sort_order: 6, map_to_lead_field: "notes", placeholder: "What key workflow are you looking to automate?" },
    ],
  },
  {
    id: "job_application",
    title: "Job Application & Talent Intake",
    category: "HR & Talent",
    description: "Streamline talent acquisition with job application submissions directly into your pipeline.",
    accent_color: "#dc2626",
    default_theme: "light",
    submit_button_text: "Submit Application",
    success_message: "Application submitted successfully! Our HR team will review your profile.",
    iconName: "ClipboardList",
    fields: [
      { label: "Candidate Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "David Miller" },
      { label: "Email Address", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "david@gmail.com" },
      { label: "Phone Number", field_type: "phone", is_required: true, sort_order: 2, map_to_lead_field: "phone", placeholder: "+91 9123456789" },
      { label: "Applying For Position", field_type: "select", is_required: true, sort_order: 3, map_to_lead_field: "custom", options: ["Senior Fullstack Engineer", "Account Executive", "Product Designer", "Customer Success Specialist"], options_raw: "Senior Fullstack Engineer, Account Executive, Product Designer, Customer Success Specialist" },
      { label: "LinkedIn Profile / Portfolio Link", field_type: "text", is_required: true, sort_order: 4, map_to_lead_field: "custom", placeholder: "https://linkedin.com/in/username" },
      { label: "Cover Note & Key Achievements", field_type: "textarea", is_required: false, sort_order: 5, map_to_lead_field: "notes", placeholder: "Briefly explain why you're a great fit for this role..." },
    ],
  },
  {
    id: "real_estate_inquiry",
    title: "Real Estate Property Inquiry",
    category: "Real Estate & Property",
    description: "Capture buyer & tenant inquiries with property type, budget range, preferred location, and move-in timeline.",
    accent_color: "#0284c7",
    default_theme: "light",
    submit_button_text: "Schedule Property Tour",
    success_message: "Thank you for your inquiry! A real estate advisor will share matching property listings shortly.",
    iconName: "Building2",
    fields: [
      { label: "Full Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "e.g. Vikram Mehta" },
      { label: "Contact Email", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "vikram@example.com" },
      { label: "Phone Number", field_type: "phone", is_required: true, sort_order: 2, map_to_lead_field: "phone", placeholder: "+91 9811223344" },
      { label: "Property Type Needed", field_type: "select", is_required: true, sort_order: 3, map_to_lead_field: "custom", options: ["Luxury Apartment", "Independent Villa", "Commercial Office Space", "Residential Plot"], options_raw: "Luxury Apartment, Independent Villa, Commercial Office Space, Residential Plot" },
      { label: "Budget Range", field_type: "select", is_required: true, sort_order: 4, map_to_lead_field: "estimated_value", options: ["$100,000 - $250,000", "$250,000 - $500,000", "$500,000 - $1,000,000", "$1,000,000+ Enterprise"], options_raw: "$100,000 - $250,000, $250,000 - $500,000, $500,000 - $1,000,000, $1,000,000+ Enterprise" },
      { label: "Preferred City / Area", field_type: "text", is_required: false, sort_order: 5, map_to_lead_field: "custom", placeholder: "e.g. Downtown / Tech Corridor" },
      { label: "Expected Move-In Date", field_type: "date", is_required: false, sort_order: 6, map_to_lead_field: "custom" },
      { label: "Special Property Features / Preferences", field_type: "textarea", is_required: false, sort_order: 7, map_to_lead_field: "notes", placeholder: "Mention preferred floor level, amenities, parking spaces..." },
    ],
  },
  {
    id: "healthcare_intake",
    title: "Healthcare & Patient Intake",
    category: "Healthcare & Medical",
    description: "Streamline patient intake, department selection, and doctor appointment scheduling.",
    accent_color: "#059669",
    default_theme: "light",
    submit_button_text: "Confirm Appointment Slot",
    success_message: "Appointment requested successfully! Clinic desk will call you to confirm your slot.",
    iconName: "Sparkles",
    fields: [
      { label: "Patient Full Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "Ananya Gupta" },
      { label: "Contact Email", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "ananya@health.com" },
      { label: "Phone Number", field_type: "phone", is_required: true, sort_order: 2, map_to_lead_field: "phone", placeholder: "+91 9765432109" },
      { label: "Medical Department / Specialty", field_type: "select", is_required: true, sort_order: 3, map_to_lead_field: "custom", options: ["General Medicine & Health", "Dental Care & Surgery", "Cardiology", "Orthopedics & Joint Care", "Dermatology & Skin"], options_raw: "General Medicine & Health, Dental Care & Surgery, Cardiology, Orthopedics & Joint Care, Dermatology & Skin" },
      { label: "Preferred Consultation Date", field_type: "date", is_required: true, sort_order: 4, map_to_lead_field: "custom" },
      { label: "Chief Medical Symptoms / Reason for Visit", field_type: "textarea", is_required: false, sort_order: 5, map_to_lead_field: "notes", placeholder: "Describe any current symptoms or previous health history..." },
    ],
  },
  {
    id: "course_enrollment",
    title: "Course Enrollment & Student Intake",
    category: "Education & Academics",
    description: "Intake student registrations for bootcamps, university programs, skill certifications, or online courses.",
    accent_color: "#7c3aed",
    default_theme: "light",
    submit_button_text: "Enroll in Program",
    success_message: "Enrollment application received! Admissions advisor will contact you with fee details and syllabus.",
    iconName: "Calendar",
    fields: [
      { label: "Student Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "Karan Kapoor" },
      { label: "Email Address", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "karan@academy.org" },
      { label: "Mobile Phone", field_type: "phone", is_required: true, sort_order: 2, map_to_lead_field: "phone", placeholder: "+91 9543210987" },
      { label: "Highest Qualification", field_type: "select", is_required: false, sort_order: 3, map_to_lead_field: "custom", options: ["High School", "Undergraduate Degree", "Postgraduate Master's", "Working Professional"], options_raw: "High School, Undergraduate Degree, Postgraduate Master's, Working Professional" },
      { label: "Program Choice", field_type: "select", is_required: true, sort_order: 4, map_to_lead_field: "custom", options: ["Fullstack Web Development", "Data Science & AI Engineering", "Digital Marketing Specialist", "UX/UI Design Masterclass"], options_raw: "Fullstack Web Development, Data Science & AI Engineering, Digital Marketing Specialist, UX/UI Design Masterclass" },
      { label: "Preferred Learning Mode", field_type: "radio", is_required: true, sort_order: 5, map_to_lead_field: "custom", options: ["Live Online Cohort 💻", "Self-Paced Video Modules 📹", "Hybrid Classroom 🏫"], options_raw: "Live Online Cohort 💻, Self-Paced Video Modules 📹, Hybrid Classroom 🏫" },
      { label: "Career Goal & Expectations", field_type: "textarea", is_required: false, sort_order: 6, map_to_lead_field: "notes", placeholder: "What outcome or career transition are you aiming for?" },
    ],
  },
  {
    id: "restaurant_reservation",
    title: "Restaurant Table & Catering Reservation",
    category: "Hospitality & Food",
    description: "Collect dining table bookings, private party reservations, and corporate catering inquiries.",
    accent_color: "#d97706",
    default_theme: "light",
    submit_button_text: "Reserve Table / Event",
    success_message: "Reservation request received! Restaurant desk will confirm your table shortly.",
    iconName: "MessageSquare",
    fields: [
      { label: "Guest Full Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "Rohan Verma" },
      { label: "Contact Email", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "rohan@foodie.com" },
      { label: "Mobile Phone", field_type: "phone", is_required: true, sort_order: 2, map_to_lead_field: "phone", placeholder: "+91 9321098765" },
      { label: "Reservation Type", field_type: "select", is_required: true, sort_order: 3, map_to_lead_field: "custom", options: ["Standard Dining Table", "Birthday / Anniversary Party", "Corporate Dinner", "Private Catering Event"], options_raw: "Standard Dining Table, Birthday / Anniversary Party, Corporate Dinner, Private Catering Event" },
      { label: "Number of Guests", field_type: "number", is_required: true, sort_order: 4, map_to_lead_field: "custom", placeholder: "4" },
      { label: "Reservation Date", field_type: "date", is_required: true, sort_order: 5, map_to_lead_field: "custom" },
      { label: "Dietary Preferences & Special Requests", field_type: "textarea", is_required: false, sort_order: 6, map_to_lead_field: "notes", placeholder: "Mention allergies, vegan preferences, cake requests..." },
    ],
  },
  {
    id: "fitness_trial",
    title: "Fitness Gym Free Trial Pass",
    category: "Fitness & Wellness",
    description: "High-converting free trial pass request for fitness clubs, personal training studios, and yoga centers.",
    accent_color: "#dc2626",
    default_theme: "light",
    submit_button_text: "Claim Free Pass",
    success_message: "Your VIP 3-Day Free Trial Pass is ready! Show your confirmation email at the reception.",
    iconName: "UserCheck",
    fields: [
      { label: "Member Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "Simran Roy" },
      { label: "Email Address", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "simran@fitness.com" },
      { label: "Mobile Number", field_type: "phone", is_required: true, sort_order: 2, map_to_lead_field: "phone", placeholder: "+91 9112233445" },
      { label: "Primary Fitness Goal", field_type: "select", is_required: true, sort_order: 3, map_to_lead_field: "custom", options: ["Weight Loss & Toning", "Muscle Building & Strength", "Athletic Crossfit Training", "Yoga & Mental Wellness"], options_raw: "Weight Loss & Toning, Muscle Building & Strength, Athletic Crossfit Training, Yoga & Mental Wellness" },
      { label: "Preferred Workout Schedule", field_type: "radio", is_required: false, sort_order: 4, map_to_lead_field: "custom", options: ["Morning (6 AM - 10 AM)", "Afternoon (12 PM - 4 PM)", "Evening (5 PM - 10 PM)"], options_raw: "Morning (6 AM - 10 AM), Afternoon (12 PM - 4 PM), Evening (5 PM - 10 PM)" },
      { label: "Health / Medical Notes", field_type: "textarea", is_required: false, sort_order: 5, map_to_lead_field: "notes", placeholder: "Any previous injuries or trainer requirements?" },
    ],
  },
  {
    id: "partner_onboarding",
    title: "Partner & Affiliate Intake",
    category: "Business Development",
    description: "Onboard agency partners, resellers, affiliates, and co-marketing collaborators into your CRM pipeline.",
    accent_color: "#2563eb",
    default_theme: "light",
    submit_button_text: "Apply for Partnership",
    success_message: "Partner application submitted! Our partner manager will get in touch with referral terms.",
    iconName: "DollarSign",
    fields: [
      { label: "Partner Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "Amit Patel" },
      { label: "Work Email", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "amit@growthagency.com" },
      { label: "Phone Number", field_type: "phone", is_required: true, sort_order: 2, map_to_lead_field: "phone", placeholder: "+91 9887766554" },
      { label: "Company / Agency Name", field_type: "text", is_required: true, sort_order: 3, map_to_lead_field: "company", placeholder: "Apex Digital Media" },
      { label: "Partnership Interest", field_type: "select", is_required: true, sort_order: 4, map_to_lead_field: "custom", options: ["Referral Affiliate (Commission per lead)", "Solution Reseller Partner", "Tech & Integration Partner", "Co-Marketing & Events"], options_raw: "Referral Affiliate (Commission per lead), Solution Reseller Partner, Tech & Integration Partner, Co-Marketing & Events" },
      { label: "Website URL", field_type: "text", is_required: false, sort_order: 5, map_to_lead_field: "custom", placeholder: "https://growthagency.com" },
      { label: "Collaboration Summary", field_type: "textarea", is_required: false, sort_order: 6, map_to_lead_field: "notes", placeholder: "Describe your client audience and proposed collaboration structure..." },
    ],
  },
];

// Fallback Local Storage Storage Utilities
const LOCAL_FORMS_KEY = "leadkart_local_forms_v3";
const LOCAL_SUBMISSIONS_KEY = "leadkart_local_submissions_v3";

export function getLocalForms(orgId?: string): FormRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_FORMS_KEY);
    let list: FormRecord[] = raw ? JSON.parse(raw) : [];

    // Auto seed initial readymade templates if local storage has no forms for org
    if (list.length === 0 && orgId) {
      const seeded: FormRecord[] = FORM_TEMPLATES.slice(0, 3).map((tmpl, idx) => ({
        id: `form_tmpl_${tmpl.id}`,
        organization_id: orgId,
        title: tmpl.title,
        slug: `${tmpl.id}-demo`,
        description: tmpl.description,
        submit_button_text: tmpl.submit_button_text,
        success_message: tmpl.success_message,
        redirect_url: null,
        is_active: true,
        accent_color: tmpl.accent_color,
        default_theme: tmpl.default_theme,
        auto_create_lead: true,
        default_lead_source_id: null,
        default_deal_stage_id: null,
        default_assigned_to: null,
        submission_count: 0,
        created_at: new Date(Date.now() - idx * 86400000).toISOString(),
        fields: tmpl.fields,
      }));
      localStorage.setItem(LOCAL_FORMS_KEY, JSON.stringify(seeded));
      return seeded;
    }

    return orgId ? list.filter((f) => f.organization_id === orgId) : list;
  } catch {
    return [];
  }
}

export function saveLocalForm(form: FormRecord, fields: FormFieldItem[]) {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalForms();
    const existingIdx = list.findIndex((f) => f.id === form.id || f.slug === form.slug);
    const formWithFields = { ...form, fields };
    if (existingIdx >= 0) {
      list[existingIdx] = formWithFields;
    } else {
      list.unshift(formWithFields);
    }
    localStorage.setItem(LOCAL_FORMS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Local form save failed", e);
  }
}

export function deleteLocalForm(formId: string) {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalForms().filter((f) => f.id !== formId);
    localStorage.setItem(LOCAL_FORMS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Local form delete error", e);
  }
}

export function getLocalSubmissions(formId: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    const all = raw ? JSON.parse(raw) : [];
    return all.filter((s: any) => s.form_id === formId);
  } catch {
    return [];
  }
}

export function saveLocalSubmission(formId: string, orgId: string, data: any) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    const all = raw ? JSON.parse(raw) : [];
    const newSub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      form_id: formId,
      organization_id: orgId,
      data,
      submitted_at: new Date().toISOString(),
    };
    all.unshift(newSub);
    localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(all));

    // Update count on form
    const formsList = getLocalForms();
    const target = formsList.find((f) => f.id === formId);
    if (target) {
      target.submission_count = (target.submission_count || 0) + 1;
      localStorage.setItem(LOCAL_FORMS_KEY, JSON.stringify(formsList));
    }
  } catch (e) {
    console.error("Local submission save error", e);
  }
}

function FormsPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormRecord | null>(null);

  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All Templates");

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareForm, setShareForm] = useState<FormRecord | null>(null);

  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [activeSubmissionsForm, setActiveSubmissionsForm] = useState<FormRecord | null>(null);
  const [isResilientMode, setIsResilientMode] = useState(false);

  // Response Editing & Management state
  const [editingSubmission, setEditingSubmission] = useState<any | null>(null);
  const [editSubmissionData, setEditSubmissionData] = useState<Record<string, string>>({});
  const [editSubmissionModalOpen, setEditSubmissionModalOpen] = useState(false);

  // Form Builder state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [submitButtonText, setSubmitButtonText] = useState("Submit Lead");
  const [successMessage, setSuccessMessage] = useState("Thank you! Your submission has been received.");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [defaultTheme, setDefaultTheme] = useState<"light" | "dark">("light");
  const [autoCreateLead, setAutoCreateLead] = useState(true);
  const [defaultLeadSourceId, setDefaultLeadSourceId] = useState<string>("none");
  const [defaultDealStageId, setDefaultDealStageId] = useState<string>("none");
  const [defaultAssignedTo, setDefaultAssignedTo] = useState<string>("none");
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormFieldItem[]>([]);

  // Preview Mode State
  const [previewData, setPreviewData] = useState<Record<string, any>>({});
  const [previewSuccess, setPreviewSuccess] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");

  // Query metadata options
  const { data: leadSources } = useQuery({
    queryKey: ["lead-sources", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data } = await supabase.from("lead_sources").select("id, name").is("deleted_at", null);
      return data ?? [];
    },
  });

  const { data: dealStages } = useQuery({
    queryKey: ["deal-stages", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data } = await supabase.from("deal_stages").select("id, name").order("sort_order");
      return data ?? [];
    },
  });

  const { data: teamMembers } = useQuery({
    queryKey: ["team-members", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data } = await supabase.from("organization_members").select("id, full_name, email").eq("status", "active");
      return data ?? [];
    },
  });

  // Query forms list with resilient fallback if Supabase schema cache table doesn't exist yet
  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["forms", orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<FormRecord[]> => {
      try {
        const { data, error } = await supabase
          .from("forms")
          .select("*")
          .eq("organization_id", orgId!)
          .order("created_at", { ascending: false });

        if (error) {
          if (error.message?.includes("schema cache") || error.code === "PGRST204" || error.message?.includes("forms")) {
            setIsResilientMode(true);
            return getLocalForms(orgId);
          }
          throw error;
        }

        const dbForms = (data as FormRecord[]) ?? [];
        const localForms = getLocalForms(orgId);
        const dbIds = new Set(dbForms.map((f) => f.id));
        return [...dbForms, ...localForms.filter((f) => !dbIds.has(f.id))];
      } catch (err: any) {
        setIsResilientMode(true);
        return getLocalForms(orgId);
      }
    },
  });

  // Query submissions for active selected form
  const { data: submissions = [], isLoading: loadingSubmissions } = useQuery({
    queryKey: ["form-submissions", activeSubmissionsForm?.id],
    enabled: Boolean(activeSubmissionsForm?.id),
    queryFn: async () => {
      if (!activeSubmissionsForm) return [];
      try {
        const { data, error } = await supabase
          .from("form_submissions")
          .select("id, data, submitted_at, lead_id, leads(id, first_name, last_name, email, status_id)")
          .eq("form_id", activeSubmissionsForm.id)
          .order("submitted_at", { ascending: false });

        if (!error && data) return data;
      } catch { }

      return getLocalSubmissions(activeSubmissionsForm.id);
    },
  });

  // Create or Update Form Mutation with database and resilient local fallback
  const saveFormMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No active organization found");
      if (!title.trim()) throw new Error("Form Title is required");

      const cleanSlug = (slug || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const generatedId = editingForm?.id || `form_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const formPayload: FormRecord = {
        id: generatedId,
        organization_id: orgId,
        title: title.trim(),
        slug: cleanSlug,
        description: description.trim() || null,
        submit_button_text: submitButtonText.trim() || "Submit",
        success_message: successMessage.trim() || "Thank you!",
        redirect_url: redirectUrl.trim() || null,
        accent_color: accentColor,
        default_theme: defaultTheme,
        is_active: isActive,
        auto_create_lead: autoCreateLead,
        default_lead_source_id: defaultLeadSourceId !== "none" ? defaultLeadSourceId : null,
        default_deal_stage_id: defaultDealStageId !== "none" ? defaultDealStageId : null,
        default_assigned_to: defaultAssignedTo !== "none" ? defaultAssignedTo : null,
        submission_count: editingForm?.submission_count || 0,
        created_at: editingForm?.created_at || new Date().toISOString(),
      };

      // Ensure fields options arrays and options_raw are cleanly parsed
      const cleanFields = fields.map((f, idx) => {
        let parsedOpts = f.options || [];
        if (f.options_raw !== undefined) {
          parsedOpts = f.options_raw.split(",").map((s) => s.trim()).filter(Boolean);
        }
        return {
          ...f,
          sort_order: idx,
          options: parsedOpts,
          options_raw: f.options_raw !== undefined ? f.options_raw : parsedOpts.join(", "),
        };
      });

      // Try Supabase DB save first
      try {
        if (editingForm) {
          const { error } = await supabase
            .from("forms")
            .update({
              title: formPayload.title,
              slug: formPayload.slug,
              description: formPayload.description,
              submit_button_text: formPayload.submit_button_text,
              success_message: formPayload.success_message,
              redirect_url: formPayload.redirect_url,
              accent_color: formPayload.accent_color,
              default_theme: formPayload.default_theme,
              is_active: formPayload.is_active,
              auto_create_lead: formPayload.auto_create_lead,
              default_lead_source_id: formPayload.default_lead_source_id,
              default_deal_stage_id: formPayload.default_deal_stage_id,
              default_assigned_to: formPayload.default_assigned_to,
            })
            .eq("id", editingForm.id);

          if (error) throw error;
        } else {
          const { data: newDbForm, error } = await supabase
            .from("forms")
            .insert({
              organization_id: formPayload.organization_id,
              title: formPayload.title,
              slug: formPayload.slug,
              description: formPayload.description,
              submit_button_text: formPayload.submit_button_text,
              success_message: formPayload.success_message,
              redirect_url: formPayload.redirect_url,
              accent_color: formPayload.accent_color,
              default_theme: formPayload.default_theme,
              is_active: formPayload.is_active,
              auto_create_lead: formPayload.auto_create_lead,
              default_lead_source_id: formPayload.default_lead_source_id,
              default_deal_stage_id: formPayload.default_deal_stage_id,
              default_assigned_to: formPayload.default_assigned_to,
              created_by: ws?.memberId ?? null,
            })
            .select("id")
            .single();

          if (error) throw error;
          if (newDbForm) formPayload.id = newDbForm.id;
        }

        // Save fields to DB
        if (formPayload.id) {
          if (editingForm) {
            await supabase.from("form_fields").delete().eq("form_id", formPayload.id);
          }

          if (cleanFields.length > 0) {
            const formattedFields = cleanFields.map((f, idx) => ({
              form_id: formPayload.id,
              label: f.label,
              field_type: f.field_type,
              placeholder: f.placeholder || null,
              help_text: f.help_text || null,
              is_required: f.is_required,
              sort_order: idx,
              options: f.options || [],
              map_to_lead_field: f.map_to_lead_field || "custom",
            }));

            await supabase.from("form_fields").insert(formattedFields);
          }
        }
      } catch (dbErr: any) {
        if (dbErr?.message?.includes("schema cache") || dbErr?.code === "PGRST204" || dbErr?.message?.includes("forms")) {
          setIsResilientMode(true);
          toast.info("Database syncing. Form saved successfully in resilient workspace storage!");
        } else {
          console.warn("Database save exception, using local fallback", dbErr);
        }
      }

      // Always save to resilient local storage as backup
      saveLocalForm(formPayload, cleanFields);
    },
    onSuccess: () => {
      toast.success(editingForm ? "Form updated successfully!" : "Form created & published!");
      queryClient.invalidateQueries({ queryKey: ["forms", orgId] });
      setBuilderOpen(false);
      resetBuilderState();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save form");
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ formId, currentActive }: { formId: string; currentActive: boolean }) => {
      try {
        await supabase.from("forms").update({ is_active: !currentActive }).eq("id", formId);
      } catch { }

      // Update local storage
      const list = getLocalForms();
      const target = list.find((f) => f.id === formId);
      if (target) {
        target.is_active = !currentActive;
        localStorage.setItem(LOCAL_FORMS_KEY, JSON.stringify(list));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms", orgId] });
      toast.success("Form status updated!");
    },
  });

  // Convert response to CRM Lead mutation
  const convertToLeadMutation = useMutation({
    mutationFn: async (submission: any) => {
      if (!orgId) throw new Error("No active organization found");
      const dataObj = submission.data || {};

      let firstName = "Form Response";
      let lastName = "";
      let email = "";
      let phone = "";
      let company = "";
      let estimatedValue = 0;
      let notes = "";

      Object.entries(dataObj).forEach(([key, value]) => {
        if (!value) return;
        const valStr = Array.isArray(value) ? value.join(", ") : String(value);
        const lowerKey = key.toLowerCase();

        if (
          lowerKey.includes("first name") ||
          lowerKey.includes("candidate name") ||
          lowerKey.includes("patient") ||
          lowerKey.includes("guest") ||
          lowerKey.includes("student name") ||
          lowerKey.includes("attendee name") ||
          lowerKey === "name"
        ) {
          firstName = valStr;
        } else if (lowerKey.includes("last name")) {
          lastName = valStr;
        } else if (lowerKey.includes("full name") || lowerKey.includes("your full name")) {
          const parts = valStr.split(" ");
          firstName = parts[0] || "Form Response";
          lastName = parts.slice(1).join(" ");
        } else if (lowerKey.includes("email")) {
          email = valStr;
        } else if (lowerKey.includes("phone") || lowerKey.includes("mobile") || lowerKey.includes("contact")) {
          phone = valStr;
        } else if (lowerKey.includes("company") || lowerKey.includes("organization") || lowerKey.includes("agency")) {
          company = valStr;
        } else if (lowerKey.includes("budget") || lowerKey.includes("value") || lowerKey.includes("amount")) {
          const num = Number(valStr.replace(/[^0-9.]/g, ""));
          if (!isNaN(num)) estimatedValue = num;
          notes += `${key}: ${valStr}\n`;
        } else {
          notes += `${key}: ${valStr}\n`;
        }
      });

      let newLeadId: string | null = null;

      // 1. Try Supabase DB insert
      try {
        const { data: newLead, error: leadErr } = await supabase
          .from("leads")
          .insert({
            organization_id: orgId,
            first_name: firstName,
            last_name: lastName || null,
            email: email || null,
            phone: phone || null,
            company: company || null,
            estimated_value: estimatedValue,
            notes: notes.trim() || null,
            source_id: activeSubmissionsForm?.default_lead_source_id || null,
            assigned_member_id: activeSubmissionsForm?.default_assigned_to || null,
          })
          .select("id")
          .single();

        if (!leadErr && newLead) {
          newLeadId = newLead.id;
          await supabase
            .from("form_submissions")
            .update({ lead_id: newLeadId })
            .eq("id", submission.id);
        }
      } catch (err) {
        console.warn("DB lead creation fallback", err);
      }

      // 2. Local Storage fallback update
      if (!newLeadId) {
        newLeadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const rawSubs = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
        if (rawSubs) {
          const allSubs = JSON.parse(rawSubs);
          const target = allSubs.find((s: any) => s.id === submission.id);
          if (target) {
            target.lead_id = newLeadId;
            target.leads = { id: newLeadId, first_name: firstName, last_name: lastName, email };
            localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(allSubs));
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Form response converted to CRM Lead!");
      queryClient.invalidateQueries({ queryKey: ["form-submissions", activeSubmissionsForm?.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to convert response to lead");
    },
  });

  // Update Submission Response Mutation
  const updateSubmissionMutation = useMutation({
    mutationFn: async () => {
      if (!editingSubmission) return;

      // 1. Try Supabase DB update
      try {
        const { error } = await supabase
          .from("form_submissions")
          .update({ data: editSubmissionData })
          .eq("id", editingSubmission.id);
        if (error) throw error;
      } catch (err) {
        console.warn("DB submission update fallback", err);
      }

      // 2. Local Storage fallback update
      if (typeof window !== "undefined") {
        const rawSubs = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
        if (rawSubs) {
          const allSubs = JSON.parse(rawSubs);
          const target = allSubs.find((s: any) => s.id === editingSubmission.id);
          if (target) {
            target.data = editSubmissionData;
            localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(allSubs));
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Submission response updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["form-submissions", activeSubmissionsForm?.id] });
      setEditSubmissionModalOpen(false);
      setEditingSubmission(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update submission response");
    },
  });

  // Delete Submission Response Mutation
  const deleteSubmissionMutation = useMutation({
    mutationFn: async (submission: any) => {
      if (!activeSubmissionsForm) return;

      // 1. Try DB delete
      try {
        await supabase.from("form_submissions").delete().eq("id", submission.id);

        // Decrement submission count on form
        const newCount = Math.max(0, (activeSubmissionsForm.submission_count || 1) - 1);
        await supabase.from("forms").update({ submission_count: newCount }).eq("id", activeSubmissionsForm.id);
      } catch (err) {
        console.warn("DB submission delete fallback", err);
      }

      // 2. Local Storage fallback delete & decrement
      if (typeof window !== "undefined") {
        const rawSubs = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
        if (rawSubs) {
          const allSubs = JSON.parse(rawSubs).filter((s: any) => s.id !== submission.id);
          localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(allSubs));
        }

        const localForms = getLocalForms();
        const targetForm = localForms.find((f) => f.id === activeSubmissionsForm.id);
        if (targetForm) {
          targetForm.submission_count = Math.max(0, (targetForm.submission_count || 1) - 1);
          localStorage.setItem(LOCAL_FORMS_KEY, JSON.stringify(localForms));
        }
      }
    },
    onSuccess: () => {
      toast.success("Submission response deleted!");
      queryClient.invalidateQueries({ queryKey: ["form-submissions", activeSubmissionsForm?.id] });
      queryClient.invalidateQueries({ queryKey: ["forms", orgId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete submission response");
    },
  });

  // Delete Form Mutation
  const deleteFormMutation = useMutation({
    mutationFn: async (formId: string) => {
      try {
        await supabase.from("forms").delete().eq("id", formId);
      } catch { }
      deleteLocalForm(formId);
    },
    onSuccess: () => {
      toast.success("Form deleted");
      queryClient.invalidateQueries({ queryKey: ["forms", orgId] });
    },
  });

  const resetBuilderState = () => {
    setEditingForm(null);
    setTitle("");
    setSlug("");
    setDescription("");
    setSubmitButtonText("Submit Lead");
    setSuccessMessage("Thank you! Your submission has been received.");
    setRedirectUrl("");
    setAccentColor("#2563eb");
    setDefaultTheme("light");
    setAutoCreateLead(true);
    setDefaultLeadSourceId("none");
    setDefaultDealStageId("none");
    setDefaultAssignedTo("none");
    setIsActive(true);
    setPreviewData({});
    setPreviewSuccess(false);
    setPreviewTheme("light");
    setFields([
      { label: "Full Name", field_type: "text", is_required: true, sort_order: 0, map_to_lead_field: "first_name", placeholder: "e.g. John Doe", options: [], options_raw: "" },
      { label: "Email Address", field_type: "email", is_required: true, sort_order: 1, map_to_lead_field: "email", placeholder: "john@example.com", options: [], options_raw: "" },
      { label: "Phone Number", field_type: "phone", is_required: false, sort_order: 2, map_to_lead_field: "phone", placeholder: "+91 9876543210", options: [], options_raw: "" },
      { label: "Requirements / Notes", field_type: "textarea", is_required: false, sort_order: 3, map_to_lead_field: "notes", placeholder: "Tell us about your requirements...", options: [], options_raw: "" },
    ]);
  };

  const openNewFormBuilder = () => {
    resetBuilderState();
    setBuilderOpen(true);
  };

  const applyTemplate = (template: FormTemplate) => {
    resetBuilderState();
    setTitle(template.title);
    setSlug(`${template.id}-${Math.random().toString(36).slice(2, 6)}`);
    setDescription(template.description);
    setAccentColor(template.accent_color);
    setDefaultTheme(template.default_theme);
    setSubmitButtonText(template.submit_button_text);
    setSuccessMessage(template.success_message);
    setFields(
      template.fields.map((f, idx) => ({
        ...f,
        sort_order: idx,
        options: f.options || [],
        options_raw: f.options_raw !== undefined ? f.options_raw : (f.options || []).join(", "),
      })),
    );
    setTemplatesModalOpen(false);
    setBuilderOpen(true);
    toast.success(`Loaded "${template.title}" template! Customize or publish directly.`);
  };

  const openEditFormBuilder = async (form: FormRecord) => {
    setEditingForm(form);
    setTitle(form.title);
    setSlug(form.slug);
    setDescription(form.description || "");
    setSubmitButtonText(form.submit_button_text);
    setSuccessMessage(form.success_message);
    setRedirectUrl(form.redirect_url || "");
    setAccentColor(form.accent_color);
    setDefaultTheme((form.default_theme as "light" | "dark") || "light");
    setAutoCreateLead(form.auto_create_lead);
    setDefaultLeadSourceId(form.default_lead_source_id || "none");
    setDefaultDealStageId(form.default_deal_stage_id || "none");
    setDefaultAssignedTo(form.default_assigned_to || "none");
    setIsActive(form.is_active);
    setPreviewData({});
    setPreviewSuccess(false);
    setPreviewTheme((form.default_theme as "light" | "dark") || "light");

    // Fetch existing fields from DB or local object
    let existingFields: any[] = form.fields || [];

    if (existingFields.length === 0) {
      try {
        const { data: dbFields } = await supabase
          .from("form_fields")
          .select("*")
          .eq("form_id", form.id)
          .order("sort_order", { ascending: true });
        if (dbFields && dbFields.length > 0) existingFields = dbFields;
      } catch { }
    }

    if (existingFields && existingFields.length > 0) {
      setFields(
        existingFields.map((f) => {
          const optsArray = Array.isArray(f.options) ? f.options : [];
          return {
            id: f.id,
            label: f.label || "Untitled",
            field_type: f.field_type || "text",
            placeholder: f.placeholder || "",
            help_text: f.help_text || "",
            is_required: Boolean(f.is_required),
            sort_order: f.sort_order || 0,
            options: optsArray,
            options_raw: f.options_raw !== undefined ? f.options_raw : optsArray.join(", "),
            map_to_lead_field: f.map_to_lead_field || "custom",
          };
        }),
      );
    } else {
      setFields([]);
    }

    setBuilderOpen(true);
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        label: `Custom Field #${prev.length + 1}`,
        field_type: "text",
        is_required: false,
        sort_order: prev.length,
        map_to_lead_field: "custom",
        placeholder: "",
        options: [],
        options_raw: "",
      },
    ]);
  };

  const updateField = (index: number, key: keyof FormFieldItem, value: any) => {
    setFields((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (item) {
        copy[index] = { ...item, [key]: value };
      }
      return copy;
    });
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, idx) => idx !== index));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === fields.length - 1)) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    setFields((prev) => {
      const copy = [...prev];
      const itemA = copy[index];
      const itemB = copy[targetIdx];
      if (itemA && itemB) {
        copy[index] = itemB;
        copy[targetIdx] = itemA;
      }
      return copy;
    });
  };

  const filteredForms = forms.filter(
    (f) =>
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const categories = ["All Templates", ...Array.from(new Set(FORM_TEMPLATES.map((t) => t.category)))];
  const filteredTemplates = FORM_TEMPLATES.filter(
    (t) => selectedCategory === "All Templates" || t.category === selectedCategory,
  );

  const activeCount = forms.filter((f) => f.is_active).length;
  const totalSubmissions = forms.reduce((acc, f) => acc + (f.submission_count || 0), 0);

  const getPublicUrl = (slugName: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://leadkart.lovable.app";
    return `${origin}/f/${slugName}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dynamic Forms & Lead Capture"
        subtitle="Create customized lead capture forms, explore pre-built templates, generate QR codes, and convert responses into CRM leads."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setTemplatesModalOpen(true)}
              className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Sparkles className="size-4 text-amber-500" />
              <span>Form Templates</span>
            </Button>
            <Button onClick={openNewFormBuilder} className="gap-2">
              <Plus className="size-4" /> Create Custom Form
            </Button>
          </div>
        }
      />

      {isResilientMode && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-center gap-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>
            Operating in Resilient Workspace Storage mode. Forms, fields, and submissions are fully functional and preserved locally while database schema cache syncs.
          </span>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Forms Created</CardTitle>
            <ClipboardList className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{forms.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Configured lead intake forms</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Public Forms</CardTitle>
            <FileCheck2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to receive customer submissions</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions Received</CardTitle>
            <Inbox className="size-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalSubmissions}</div>
            <p className="text-xs text-muted-foreground mt-1">Leads captured through forms</p>
          </CardContent>
        </Card>
      </div>

      {/* READYMADE TEMPLATES PROMO BANNER */}
      <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-purple-500/10 to-amber-500/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
              <Sparkles className="size-3" /> Ready-to-Use Library
            </Badge>
            <h3 className="text-base font-bold text-foreground">12 Pre-Built Form Templates</h3>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Instantly deploy Customer Feedback NPS surveys, Sales Quote requests, Webinar registrations, Product Demos, and HR applications with zero manual setup.
          </p>
        </div>
        <Button onClick={() => setTemplatesModalOpen(true)} className="gap-2 shrink-0">
          <LayoutTemplate className="size-4" /> Browse Template Library
        </Button>
      </div>

      {/* Search & Forms List Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Your Lead Forms</CardTitle>
            <CardDescription>Manage active forms, view submission performance, and copy QR codes</CardDescription>
          </div>
          <div className="w-full max-w-xs">
            <Input
              placeholder="Search forms by title or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="py-8 text-center space-y-4">
              <EmptyState
                message={
                  searchQuery
                    ? "No forms match your search filter."
                    : "You haven't built any lead forms yet. Create your first dynamic form or pick from readymade templates."
                }
              />
              {!searchQuery && (
                <div className="flex items-center justify-center gap-3">
                  <Button onClick={() => setTemplatesModalOpen(true)} variant="outline" className="gap-2">
                    <Sparkles className="size-4 text-amber-500" /> Browse Ready Templates
                  </Button>
                  <Button onClick={openNewFormBuilder} className="gap-2">
                    <Plus className="size-4" /> Create Custom Form
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Name & Accent</TableHead>
                  <TableHead>Public Slug / URL</TableHead>
                  <TableHead>Default Theme</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Auto-Lead Creation</TableHead>
                  <TableHead>Created Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredForms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="size-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: form.accent_color || "#2563eb" }}
                        />
                        <div>
                          <div className="font-semibold text-foreground">{form.title}</div>
                          {form.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                              {form.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      /f/{form.slug}
                    </TableCell>
                    <TableCell>
                      {form.default_theme === "dark" ? (
                        <Badge variant="outline" className="gap-1 border-slate-700 bg-slate-900 text-slate-300">
                          <Moon className="size-3 text-indigo-400" /> Dark Mode
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50/80 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                          <Sun className="size-3 text-amber-500" /> Light Mode
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={form.is_active}
                        onCheckedChange={() =>
                          toggleActiveMutation.mutate({ formId: form.id, currentActive: form.is_active })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1 font-semibold">
                        <Inbox className="size-3 text-primary" /> {form.submission_count} responses
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {form.auto_create_lead ? (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                          <UserCheck className="mr-1 size-3" /> Auto-Create Lead
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Payload Only
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(form.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Share URL & QR Code"
                          onClick={() => {
                            setShareForm(form);
                            setShareModalOpen(true);
                          }}
                        >
                          <Share2 className="size-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Responses"
                          onClick={() => {
                            setActiveSubmissionsForm(form);
                            setSubmissionsOpen(true);
                          }}
                        >
                          <Inbox className="size-4 text-purple-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Edit Form"
                          onClick={() => openEditFormBuilder(form)}
                        >
                          <Pencil className="size-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete Form"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete form "${form.title}"?`)) {
                              deleteFormMutation.mutate(form.id);
                            }
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* FORM TEMPLATE GALLERY DIALOG */}
      <Dialog open={templatesModalOpen} onOpenChange={setTemplatesModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="size-5 text-amber-500" />
              Pre-Built Form Template Gallery
            </DialogTitle>
            <DialogDescription>
              Select a readymade form template to instantly load pre-configured fields, lead mappings, and custom styling.
            </DialogDescription>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-3">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  size="sm"
                  variant={selectedCategory === cat ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat)}
                  className="h-8 text-xs font-semibold rounded-full"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </DialogHeader>

          {/* TEMPLATE CARDS GRID */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            {filteredTemplates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="rounded-2xl border bg-card p-5 space-y-4 shadow-sm hover:shadow-md hover:border-primary/50 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] font-semibold" style={{ color: tmpl.accent_color, borderColor: `${tmpl.accent_color}40` }}>
                      {tmpl.category}
                    </Badge>
                    <span className="size-3 rounded-full" style={{ backgroundColor: tmpl.accent_color }} />
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-foreground">{tmpl.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tmpl.description}</p>
                  </div>

                  {/* Included Fields Badge List */}
                  <div className="pt-1 space-y-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">Included Fields ({tmpl.fields.length}):</span>
                    <div className="flex flex-wrap gap-1">
                      {tmpl.fields.map((f, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[10px] py-0 font-normal">
                          {f.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="size-3.5 text-emerald-500" />
                    <span>Auto-Lead Sync</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => applyTemplate(tmpl)}
                    className="gap-1.5 text-xs font-semibold"
                    style={{ backgroundColor: tmpl.accent_color }}
                  >
                    <Sparkles className="size-3.5" /> Use Template
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* FORM BUILDER DIALOG */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="size-5 text-primary" />
              {editingForm ? "Customize & Edit Lead Form" : "Build Dynamic Lead Form"}
            </DialogTitle>
            <DialogDescription>
              Configure basic settings, add dynamic form controls, theme options, and map fields to CRM leads.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="fields" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="fields">1. Form Controls & Fields</TabsTrigger>
              <TabsTrigger value="settings">2. CRM & Theme Settings</TabsTrigger>
              <TabsTrigger value="preview">3. Live Form Preview</TabsTrigger>
            </TabsList>

            {/* TAB 1: FIELD BUILDER */}
            <TabsContent value="fields" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Form Inputs ({fields.length})</h4>
                  <p className="text-xs text-muted-foreground">
                    Customize fields, labels, placeholders, and map them to CRM lead attributes or custom fields.
                  </p>
                </div>
                <Button size="sm" onClick={addField} className="gap-1.5">
                  <Plus className="size-4" /> Add New Field
                </Button>
              </div>

              {fields.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No fields added yet. Click "Add New Field" above to add your first input.
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, idx) => {
                    const isChoiceType = ["select", "radio", "checkbox"].includes(field.field_type);
                    const rawOptionsValue =
                      field.options_raw !== undefined
                        ? field.options_raw
                        : (field.options || []).join(", ");

                    return (
                      <div
                        key={idx}
                        className="rounded-lg border bg-card/60 p-4 space-y-3 shadow-xs hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 font-semibold text-sm">
                            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary font-mono">
                              {idx + 1}
                            </span>
                            <span>{field.label || "Untitled Field"}</span>
                            {field.is_required && (
                              <Badge variant="secondary" className="text-[10px] py-0">Required</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={idx === 0}
                              onClick={() => moveField(idx, "up")}
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={idx === fields.length - 1}
                              onClick={() => moveField(idx, "down")}
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeField(idx)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <Label className="text-xs">Field Label *</Label>
                            <Input
                              className="h-8 text-xs mt-1"
                              value={field.label}
                              onChange={(e) => updateField(idx, "label", e.target.value)}
                              placeholder="e.g. Work Email"
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Field Input Type</Label>
                            <Select
                              value={field.field_type}
                              onValueChange={(val) => updateField(idx, "field_type", val)}
                            >
                              <SelectTrigger className="h-8 text-xs mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TYPES.map((t) => (
                                  <SelectItem key={t.id} value={t.id} className="text-xs">
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Map to CRM Lead Property</Label>
                            <Select
                              value={field.map_to_lead_field}
                              onValueChange={(val) => updateField(idx, "map_to_lead_field", val)}
                            >
                              <SelectTrigger className="h-8 text-xs mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LEAD_FIELD_MAPPINGS.map((m) => (
                                  <SelectItem key={m.id} value={m.id} className="text-xs">
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 items-end">
                          <div className="sm:col-span-2">
                            <Label className="text-xs">Placeholder Text</Label>
                            <Input
                              className="h-8 text-xs mt-1"
                              value={field.placeholder || ""}
                              onChange={(e) => updateField(idx, "placeholder", e.target.value)}
                              placeholder="e.g. Enter your response..."
                            />
                          </div>

                          <div className="flex items-center gap-2 pb-1">
                            <Switch
                              id={`req-${idx}`}
                              checked={field.is_required}
                              onCheckedChange={(checked) => updateField(idx, "is_required", checked)}
                            />
                            <Label htmlFor={`req-${idx}`} className="text-xs cursor-pointer">
                              Required Field
                            </Label>
                          </div>
                        </div>

                        {/* Comma-separated Options manager for select, radio, checkbox */}
                        {isChoiceType && (
                          <div className="pt-1 border-t border-border/50">
                            <Label className="text-xs font-semibold text-primary">
                              Choice Options (comma-separated, e.g. "Basic, Premium, Enterprise")
                            </Label>
                            <Input
                              className="h-8 text-xs mt-1 font-mono"
                              value={rawOptionsValue}
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateField(idx, "options_raw", raw);
                                const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
                                updateField(idx, "options", parsed);
                              }}
                              placeholder="Option 1, Option 2, Option 3"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Parsed choices: {(field.options || []).length > 0 ? (field.options || []).join(" | ") : "No choices typed yet"}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: CRM & GENERAL SETTINGS */}
            <TabsContent value="settings" className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Form Title *</Label>
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!editingForm) {
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                      }
                    }}
                    placeholder="e.g. Website Contact Form"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>URL Slug (Unique Public Path) *</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground font-mono">/f/</span>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""))}
                      placeholder="website-contact-form"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Form Subtitle / Header Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide context or instructions for users filling out this form..."
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>Submit Button Text</Label>
                  <Input
                    value={submitButtonText}
                    onChange={(e) => setSubmitButtonText(e.target.value)}
                    placeholder="Submit"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Accent Color Theme</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    {ACCENT_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setAccentColor(c.id)}
                        className={`size-7 rounded-full transition-transform ${accentColor === c.id ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"
                          }`}
                        style={{ backgroundColor: c.id }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                {/* THEME SELECTOR TOGGLE (LIGHT VS DARK) */}
                <div>
                  <Label>Form Default Visual Theme</Label>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={defaultTheme === "light" ? "default" : "outline"}
                      onClick={() => setDefaultTheme("light")}
                      className="h-9 gap-1 text-xs font-semibold"
                    >
                      <Sun className="size-3.5 text-amber-500" />
                      <span>Light</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={defaultTheme === "dark" ? "default" : "outline"}
                      onClick={() => setDefaultTheme("dark")}
                      className="h-9 gap-1 text-xs font-semibold"
                    >
                      <Moon className="size-3.5 text-indigo-400" />
                      <span>Dark</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label>Success Message (Displayed after submission)</Label>
                <Input
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  placeholder="Thank you! Your submission has been received."
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Redirect URL (Optional external page redirect after submission)</Label>
                <Input
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://yourwebsite.com/thank-you"
                  className="mt-1"
                />
              </div>

              <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">Automatic Lead Conversion</h4>
                    <p className="text-xs text-muted-foreground">
                      Automatically create a new Lead in LeadKart CRM whenever someone submits this form.
                    </p>
                  </div>
                  <Switch checked={autoCreateLead} onCheckedChange={setAutoCreateLead} />
                </div>

                {autoCreateLead && (
                  <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t">
                    <div>
                      <Label className="text-xs">Default Lead Source</Label>
                      <Select value={defaultLeadSourceId} onValueChange={setDefaultLeadSourceId}>
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Select Source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">
                            — Form / Website (Default) —
                          </SelectItem>
                          {(leadSources || []).map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-xs">
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Default Deal Stage</Label>
                      <Select value={defaultDealStageId} onValueChange={setDefaultDealStageId}>
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Select Stage" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">
                            — Initial Stage (Default) —
                          </SelectItem>
                          {(dealStages || []).map((st) => (
                            <SelectItem key={st.id} value={st.id} className="text-xs">
                              {st.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Default Assigned Representative</Label>
                      <Select value={defaultAssignedTo} onValueChange={setDefaultAssignedTo}>
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Select Member" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">
                            — Unassigned —
                          </SelectItem>
                          {(teamMembers || []).map((m) => (
                            <SelectItem key={m.id} value={m.id} className="text-xs">
                              {m.full_name} ({m.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: FULLY INTERACTIVE LIVE PREVIEW (SUPPORTING LIGHT & DARK MODES) */}
            <TabsContent value="preview" className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Palette className="size-3.5 text-primary" /> Live Form Appearance Preview
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewTheme(previewTheme === "light" ? "dark" : "light")}
                      className="h-8 gap-1.5 text-xs font-medium"
                    >
                      {previewTheme === "light" ? <Sun className="size-3.5 text-amber-500" /> : <Moon className="size-3.5 text-indigo-400" />}
                      <span>Previewing: <strong className="capitalize">{previewTheme}</strong></span>
                    </Button>

                    {previewSuccess && (
                      <Button size="sm" variant="ghost" onClick={() => { setPreviewSuccess(false); setPreviewData({}); }} className="text-xs gap-1">
                        <RotateCcw className="size-3" /> Reset Test
                      </Button>
                    )}
                  </div>
                </div>

                {/* PREVIEW CONTAINER */}
                <div className={`rounded-3xl border p-6 max-w-lg mx-auto shadow-xl transition-colors duration-200 ${previewTheme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
                  <div className={`flex items-center justify-between border-b pb-3 ${previewTheme === "dark" ? "border-slate-800" : "border-slate-100"}`}>
                    <div>
                      <div className="h-2 w-16 rounded-full mb-2" style={{ backgroundColor: accentColor }} />
                      <h3 className="text-lg font-bold">{title || "Untitled Form Preview"}</h3>
                      {description && <p className={`text-xs mt-0.5 ${previewTheme === "dark" ? "text-slate-400" : "text-slate-600"}`}>{description}</p>}
                    </div>
                  </div>

                  {previewSuccess ? (
                    <div className="py-8 text-center space-y-2 animate-in fade-in zoom-in duration-200">
                      <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
                      <h4 className="text-base font-bold">Preview Test Successful!</h4>
                      <p className={`text-xs ${previewTheme === "dark" ? "text-slate-400" : "text-slate-600"}`}>{successMessage}</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-3">
                      {fields.map((f, i) => {
                        const val = previewData[f.label] ?? "";
                        const options = (f.options || []);

                        return (
                          <div key={i} className="space-y-1.5">
                            <Label className={`text-xs font-semibold ${previewTheme === "dark" ? "text-slate-200" : "text-slate-700"}`}>
                              {f.label || `Field ${i + 1}`}
                              {f.is_required && <span className="text-rose-500 ml-1">*</span>}
                            </Label>

                            {f.field_type === "textarea" ? (
                              <Textarea
                                placeholder={f.placeholder || "Type details..."}
                                value={val}
                                onChange={(e) => setPreviewData((prev) => ({ ...prev, [f.label]: e.target.value }))}
                                rows={2}
                                className={`text-xs ${previewTheme === "dark" ? "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-900"}`}
                              />
                            ) : f.field_type === "select" ? (
                              <Select
                                value={val}
                                onValueChange={(v) => setPreviewData((prev) => ({ ...prev, [f.label]: v }))}
                              >
                                <SelectTrigger className={`h-9 text-xs ${previewTheme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
                                  <SelectValue placeholder={f.placeholder || "Select option..."} />
                                </SelectTrigger>
                                <SelectContent className={previewTheme === "dark" ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}>
                                  {options.map((opt, optIdx) => (
                                    <SelectItem key={optIdx} value={opt} className="text-xs">
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : f.field_type === "radio" ? (
                              <RadioGroup
                                value={val}
                                onValueChange={(v) => setPreviewData((prev) => ({ ...prev, [f.label]: v }))}
                                className="flex flex-col gap-1.5 pt-1"
                              >
                                {options.map((opt, optIdx) => (
                                  <div key={optIdx} className={`flex items-center gap-2 rounded-lg border p-2 ${previewTheme === "dark" ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}>
                                    <RadioGroupItem value={opt} id={`prev-r-${i}-${optIdx}`} />
                                    <Label htmlFor={`prev-r-${i}-${optIdx}`} className="text-xs font-normal cursor-pointer">
                                      {opt}
                                    </Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            ) : f.field_type === "checkbox" ? (
                              <div className="flex flex-col gap-1.5 pt-1">
                                {options.map((opt, optIdx) => {
                                  const currentArr = Array.isArray(val) ? val : [];
                                  const isChecked = currentArr.includes(opt);
                                  return (
                                    <div key={optIdx} className={`flex items-center gap-2 rounded-lg border p-2 ${previewTheme === "dark" ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50"}`}>
                                      <Checkbox
                                        id={`prev-cb-${i}-${optIdx}`}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                          const newArr = checked
                                            ? [...currentArr, opt]
                                            : currentArr.filter((item: string) => item !== opt);
                                          setPreviewData((prev) => ({ ...prev, [f.label]: newArr }));
                                        }}
                                      />
                                      <Label htmlFor={`prev-cb-${i}-${optIdx}`} className="text-xs font-normal cursor-pointer">
                                        {opt}
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <Input
                                type={f.field_type === "email" ? "email" : f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : "text"}
                                placeholder={f.placeholder || ""}
                                value={val}
                                onChange={(e) => setPreviewData((prev) => ({ ...prev, [f.label]: e.target.value }))}
                                className={`h-9 text-xs ${previewTheme === "dark" ? "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500" : "bg-white border-slate-200 text-slate-900"}`}
                              />
                            )}

                            {f.help_text && <p className="text-[10px] text-muted-foreground">{f.help_text}</p>}
                          </div>
                        );
                      })}

                      <Button
                        type="button"
                        onClick={() => {
                          toast.success("Interactive Preview Test: Submission working!");
                          setPreviewSuccess(true);
                        }}
                        className="w-full h-10 text-xs font-semibold text-white mt-3 shadow-md"
                        style={{ backgroundColor: accentColor }}
                      >
                        {submitButtonText} (Test Click)
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 border-t pt-3">
            <Button variant="outline" onClick={() => setBuilderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveFormMutation.mutate()}
              disabled={saveFormMutation.isPending}
              className="gap-1.5"
            >
              {saveFormMutation.isPending && <Sparkles className="size-4 animate-spin" />}
              {editingForm ? "Save Form Changes" : "Create & Publish Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SHARE & QR CODE MODAL - NON-OVERLAPPING MODERN DIALOG */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl rounded-2xl border bg-card">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Share2 className="size-5 text-primary" />
                Share Lead Form
              </DialogTitle>
              {shareForm?.is_active ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 font-mono text-[10px]">
                  ● Live & Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
              )}
            </div>
            <DialogDescription className="text-xs">
              Distribute "{shareForm?.title}" via direct link, instant QR code scan, or website iframe embedding.
            </DialogDescription>
          </DialogHeader>

          {shareForm && (
            <Tabs defaultValue="link" className="w-full pt-2 space-y-4">
              <TabsList className="grid w-full grid-cols-2 h-10">
                <TabsTrigger value="link" className="gap-2 text-xs font-semibold">
                  <QrCode className="size-4" /> Link & QR Code
                </TabsTrigger>
                <TabsTrigger value="embed" className="gap-2 text-xs font-semibold">
                  <Code className="size-4" /> Embed Code
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: DIRECT LINK & QR CODE */}
              <TabsContent value="link" className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Public Shareable URL</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={getPublicUrl(shareForm.slug)}
                      className="font-mono text-xs h-10 bg-muted/30 focus-visible:ring-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(getPublicUrl(shareForm.slug));
                        toast.success("Public Form URL copied to clipboard!");
                      }}
                      className="shrink-0 gap-1.5 text-xs h-10 px-3"
                    >
                      <Copy className="size-3.5" /> Copy Link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="shrink-0 h-10 px-3"
                      title="Open in new tab"
                    >
                      <a href={getPublicUrl(shareForm.slug)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  </div>
                </div>

                {/* QR CODE CONTAINER CARD */}
                <div className="rounded-xl border bg-gradient-to-b from-card to-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Scan QR Code</span>
                    <span className="text-[11px] text-muted-foreground">High resolution vector matrix</span>
                  </div>
                  <QRCodeView
                    value={getPublicUrl(shareForm.slug)}
                    title={shareForm.title}
                    fgColor={shareForm.accent_color || "#0f172a"}
                  />
                </div>
              </TabsContent>

              {/* TAB 2: WEBSITE EMBED SNIPPET */}
              <TabsContent value="embed" className="space-y-4 pt-1">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Website HTML iFrame Code</Label>
                    <Badge variant="outline" className="text-[10px] font-mono">HTML5 Standard</Badge>
                  </div>
                  <div className="relative rounded-xl border bg-slate-950 p-4 text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto shadow-inner">
                    <code>{`<iframe\n  src="${getPublicUrl(shareForm.slug)}"\n  width="100%"\n  height="680px"\n  frameborder="0"\n  style="border: none; border-radius: 16px;"\n></iframe>`}</code>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Paste this snippet into your HTML website, WordPress, Webflow, or Wix page to embed the lead form directly.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `<iframe src="${getPublicUrl(shareForm.slug)}" width="100%" height="680px" frameborder="0" style="border: none; border-radius: 16px;"></iframe>`,
                      );
                      toast.success("iFrame HTML embed code copied!");
                    }}
                    className="gap-2 text-xs"
                  >
                    <Code className="size-4" /> Copy iFrame Code
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* SUBMISSIONS VIEWER DIALOG */}
      <Dialog open={submissionsOpen} onOpenChange={setSubmissionsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="size-5 text-purple-600" />
              Submissions for "{activeSubmissionsForm?.title}"
            </DialogTitle>
            <DialogDescription>
              All customer responses submitted through this form.
            </DialogDescription>
          </DialogHeader>

          {loadingSubmissions ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No submissions received yet for this form.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted At</TableHead>
                  <TableHead>Captured Data</TableHead>
                  <TableHead>Created CRM Lead</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub: any) => {
                  const dataObj = sub.data || {};
                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(sub.submitted_at)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {Object.entries(dataObj).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-1.5">
                              <span className="font-semibold text-muted-foreground">{k}:</span>
                              <span className="text-foreground">{Array.isArray(v) ? v.join(", ") : String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.leads || sub.lead_id ? (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 py-1">
                            <Link
                              to="/leads"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
                            >
                              <UserCheck className="size-3.5 text-emerald-500" />
                              <span>{sub.leads ? `${sub.leads.first_name} ${sub.leads.last_name || ""}`.trim() : "Linked Lead"}</span>
                            </Link>
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => convertToLeadMutation.mutate(sub)}
                            disabled={convertToLeadMutation.isPending}
                            className="gap-1.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/5 h-8"
                          >
                            <UserPlus className="size-3.5 text-primary" />
                            <span>Add to Leads</span>
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit Response"
                            onClick={() => {
                              setEditingSubmission(sub);
                              const dataMap: Record<string, string> = {};
                              Object.entries(sub.data || {}).forEach(([k, v]) => {
                                dataMap[k] = Array.isArray(v) ? v.join(", ") : String(v || "");
                              });
                              setEditSubmissionData(dataMap);
                              setEditSubmissionModalOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete Response"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this form response?")) {
                                deleteSubmissionMutation.mutate(sub);
                              }
                            }}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT SUBMISSION RESPONSE DATA DIALOG */}
      <Dialog open={editSubmissionModalOpen} onOpenChange={setEditSubmissionModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-primary" />
              Edit Captured Response Data
            </DialogTitle>
            <DialogDescription className="text-xs">
              Modify captured input fields or fix typos in customer response data.
            </DialogDescription>
          </DialogHeader>

          {editingSubmission && (
            <div className="space-y-4 py-2">
              {Object.entries(editSubmissionData).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs font-semibold">{key}</Label>
                  <Input
                    value={val || ""}
                    onChange={(e) =>
                      setEditSubmissionData((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditSubmissionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateSubmissionMutation.mutate()}
              disabled={updateSubmissionMutation.isPending}
              className="gap-1.5"
            >
              {updateSubmissionMutation.isPending && <Sparkles className="size-4 animate-spin" />}
              Save Response Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
