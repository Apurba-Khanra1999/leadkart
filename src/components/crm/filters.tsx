import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ALL = "all";

export function FilterBar({
  children,
  onReset,
  activeCount,
}: {
  children: ReactNode;
  onReset?: () => void;
  activeCount?: number;
}) {
  return (
    <div className="shadow-card flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
      {children}
      {onReset ? (
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onReset}>
          <X className="mr-1 size-3.5" />
          Clear{activeCount ? ` (${activeCount})` : ""}
        </Button>
      ) : null}
    </div>
  );
}

export function SearchFilter({
  id,
  value,
  onChange,
  placeholder = "Search",
  label = "Search",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className="min-w-56 flex-1 space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          id={id}
          className="pl-9"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export function SelectFilter({
  id,
  label,
  value,
  onChange,
  options,
  allLabel = "All",
  width = "w-44",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  allLabel?: string;
  width?: string;
}) {
  return (
    <div className={`${width} space-y-1.5`}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function NumberFilter({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="w-32 space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function DateFilter({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="w-40 space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export const PRIORITY_FILTER_OPTIONS = [
  { id: "urgent", name: "Urgent" },
  { id: "high", name: "High" },
  { id: "medium", name: "Medium" },
  { id: "low", name: "Low" },
];
