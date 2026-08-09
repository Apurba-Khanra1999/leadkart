import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoneyFull } from "@/lib/crm";

export interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
  tax_percent: string;
}

export const emptyItem = (): LineItem => ({
  description: "",
  quantity: "1",
  unit_price: "0",
  tax_percent: "18",
});

export function useLineItems() {
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);

  const update = (index: number, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const add = () => setItems((prev) => [...prev, emptyItem()]);
  const remove = (index: number) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  const reset = () => setItems([emptyItem()]);

  const rows = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const taxPercent = Number(item.tax_percent) || 0;
    const base = quantity * price;
    const tax = (base * taxPercent) / 100;
    return { ...item, quantity, price, taxPercent, base, tax, total: base + tax };
  });

  const subtotal = rows.reduce((sum, r) => sum + r.base, 0);
  const taxTotal = rows.reduce((sum, r) => sum + r.tax, 0);

  return {
    items,
    rows,
    subtotal,
    taxTotal,
    total: subtotal + taxTotal,
    update,
    add,
    remove,
    reset,
  };
}

export function LineItemsEditor({
  editor,
  symbol,
}: {
  editor: ReturnType<typeof useLineItems>;
  symbol: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Line items</Label>
        <Button type="button" variant="outline" size="sm" onClick={editor.add}>
          <Plus className="mr-1 size-3.5" /> Add item
        </Button>
      </div>

      <div className="space-y-2">
        {editor.items.map((item, index) => (
          <div key={index} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-2">
            <div className="col-span-12 space-y-1 sm:col-span-5">
              <Label htmlFor={`item-desc-${index}`} className="text-xs text-muted-foreground">
                Description
              </Label>
              <Input
                id={`item-desc-${index}`}
                value={item.description}
                onChange={(e) => editor.update(index, { description: e.target.value })}
              />
            </div>
            <div className="col-span-3 space-y-1 sm:col-span-2">
              <Label htmlFor={`item-qty-${index}`} className="text-xs text-muted-foreground">
                Qty
              </Label>
              <Input
                id={`item-qty-${index}`}
                type="number"
                min="0"
                value={item.quantity}
                onChange={(e) => editor.update(index, { quantity: e.target.value })}
              />
            </div>
            <div className="col-span-5 space-y-1 sm:col-span-2">
              <Label htmlFor={`item-price-${index}`} className="text-xs text-muted-foreground">
                Unit price
              </Label>
              <Input
                id={`item-price-${index}`}
                type="number"
                min="0"
                value={item.unit_price}
                onChange={(e) => editor.update(index, { unit_price: e.target.value })}
              />
            </div>
            <div className="col-span-3 space-y-1 sm:col-span-2">
              <Label htmlFor={`item-tax-${index}`} className="text-xs text-muted-foreground">
                Tax %
              </Label>
              <Input
                id={`item-tax-${index}`}
                type="number"
                min="0"
                value={item.tax_percent}
                onChange={(e) => editor.update(index, { tax_percent: e.target.value })}
              />
            </div>
            <div className="col-span-1 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove item ${index + 1}`}
                onClick={() => editor.remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-end gap-1 text-sm">
        <span className="text-muted-foreground">
          Subtotal {formatMoneyFull(editor.subtotal, symbol)}
        </span>
        <span className="text-muted-foreground">Tax {formatMoneyFull(editor.taxTotal, symbol)}</span>
        <span className="font-semibold">Total {formatMoneyFull(editor.total, symbol)}</span>
      </div>
    </div>
  );
}