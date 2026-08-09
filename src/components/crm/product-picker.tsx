import { Package, Plus, Trash2, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { formatMoneyFull } from "@/lib/crm";
import type { ProductLine, ProductRow } from "@/hooks/use-products";

export function lineTotal(line: ProductLine) {
  return (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
}

export function linesTotal(lines: ProductLine[]) {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

/** Attach catalogue services / products to a lead or follow-up. */
export function ProductPicker({
  products,
  lines,
  onChange,
  symbol = "₹",
  label = "Services / products",
}: {
  products: ProductRow[];
  lines: ProductLine[];
  onChange: (lines: ProductLine[]) => void;
  symbol?: string;
  label?: string;
}) {
  const available = products.filter(
    (p) => p.is_active || lines.some((l) => l.product_id === p.id),
  );
  const byId = new Map(products.map((p) => [p.id, p]));

  function add(productId: string) {
    if (!productId || lines.some((l) => l.product_id === productId)) return;
    const product = byId.get(productId);
    onChange([
      ...lines,
      { product_id: productId, quantity: 1, unit_price: Number(product?.unit_price ?? 0) },
    ]);
  }

  function update(productId: string, patch: Partial<ProductLine>) {
    onChange(lines.map((l) => (l.product_id === productId ? { ...l, ...patch } : l)));
  }

  const unpicked = available.filter((p) => !lines.some((l) => l.product_id === p.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="product-picker-add">{label}</Label>
        {lines.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {lines.length} selected · {formatMoneyFull(linesTotal(lines), symbol)}
          </span>
        ) : null}
      </div>

      <Select value="" onValueChange={add} disabled={unpicked.length === 0}>
        <SelectTrigger id="product-picker-add">
          <SelectValue
            placeholder={
              available.length === 0
                ? "No catalogue items yet — add them under Services / Products"
                : unpicked.length === 0
                  ? "All catalogue items added"
                  : "Add a service or product"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {unpicked.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name} · {formatMoneyFull(p.unit_price, symbol)}/{p.unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {lines.length > 0 && (
        <div className="space-y-2 rounded-lg border p-2">
          {lines.map((line) => {
            const product = byId.get(line.product_id);
            return (
              <div key={line.product_id} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {product?.kind === "product" ? (
                      <Package className="size-3.5 text-muted-foreground" />
                    ) : (
                      <Wrench className="size-3.5 text-muted-foreground" />
                    )}
                    {product?.name ?? "Item"}
                    {product && !product.is_active ? (
                      <Badge variant="outline" className="text-[10px]">
                        Inactive
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {product?.code ?? "—"} · per {product?.unit ?? "unit"}
                  </p>
                </div>
                <div className="col-span-4 space-y-1 sm:col-span-3">
                  <Label
                    htmlFor={`pp-qty-${line.product_id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Qty
                  </Label>
                  <Input
                    id={`pp-qty-${line.product_id}`}
                    type="number"
                    min="0"
                    value={String(line.quantity)}
                    onChange={(e) => update(line.product_id, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-6 space-y-1 sm:col-span-3">
                  <Label
                    htmlFor={`pp-price-${line.product_id}`}
                    className="text-xs text-muted-foreground"
                  >
                    Unit price
                  </Label>
                  <Input
                    id={`pp-price-${line.product_id}`}
                    type="number"
                    min="0"
                    value={String(line.unit_price)}
                    onChange={(e) => update(line.product_id, { unit_price: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-2 flex justify-end sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${product?.name ?? "item"}`}
                    onClick={() =>
                      onChange(lines.filter((l) => l.product_id !== line.product_id))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Read-only list of catalogue items attached to a record. */
export function ProductSummary({
  lines,
  products,
  symbol = "₹",
  emptyMessage = "No services or products linked yet.",
}: {
  lines: ProductLine[];
  products: ProductRow[];
  symbol?: string;
  emptyMessage?: string;
}) {
  if (lines.length === 0)
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  const byId = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="space-y-1.5">
      {lines.map((line) => {
        const product = byId.get(line.product_id);
        return (
          <div
            key={line.product_id}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              {product?.kind === "product" ? (
                <Package className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{product?.name ?? "Item"}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                × {line.quantity} {product?.unit ?? ""}
              </span>
            </span>
            <span className="shrink-0 font-medium">
              {formatMoneyFull(lineTotal(line), symbol)}
            </span>
          </div>
        );
      })}
      <div className="flex justify-between px-3 pt-1 text-sm font-semibold">
        <span>Total</span>
        <span>{formatMoneyFull(linesTotal(lines), symbol)}</span>
      </div>
    </div>
  );
}

export function AddProductHint() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Plus className="size-3" /> Manage your catalogue under Services / Products.
    </p>
  );
}