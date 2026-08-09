import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ProductRow = {
  id: string;
  name: string;
  code: string | null;
  kind: "service" | "product";
  category: string | null;
  collection_id: string | null;
  description: string | null;
  unit: string;
  unit_price: number | null;
  cost_price: number | null;
  tax_percent: number | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
};

export type ProductLine = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

const PRODUCT_COLUMNS =
  "id, name, code, kind, category, collection_id, description, unit, unit_price, cost_price, tax_percent, is_active, sort_order, notes, created_at";

export type CollectionRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

/** Collections group the catalogue — items always live inside one. */
export function useProductCollections(orgId: string | undefined) {
  return useQuery({
    queryKey: ["product-collections", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_collections")
        .select("id, name, description, sort_order, is_active, created_at")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CollectionRow[];
    },
  });
}

/** Full catalogue (active + inactive) for management screens. */
export function useProducts(orgId: string | undefined) {
  return useQuery({
    queryKey: ["products", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });
}

/** Catalogue items linked to a lead or follow-up. */
export function useRecordProducts(
  orgId: string | undefined,
  target: { leadId?: string | null; followUpId?: string | null },
) {
  const leadId = target.leadId ?? null;
  const followUpId = target.followUpId ?? null;
  return useQuery({
    queryKey: ["record-products", orgId, leadId, followUpId],
    enabled: Boolean(orgId) && Boolean(leadId || followUpId),
    queryFn: async () => {
      let query = supabase
        .from("record_products")
        .select(
          "id, product_id, quantity, unit_price, note, created_at, products(name, code, unit, kind)",
        )
        .order("created_at");
      query = followUpId ? query.eq("follow_up_id", followUpId) : query.eq("lead_id", leadId!);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Replaces the catalogue lines attached to a lead or follow-up. */
export async function saveRecordProducts(
  orgId: string,
  target: { lead_id?: string | null; follow_up_id?: string | null },
  lines: ProductLine[],
) {
  const del = supabase.from("record_products").delete();
  const { error: delError } = target.follow_up_id
    ? await del.eq("follow_up_id", target.follow_up_id)
    : await del.eq("lead_id", target.lead_id!);
  if (delError) throw delError;

  const rows = lines
    .filter((l) => l.product_id)
    .map((l) => ({
      organization_id: orgId,
      product_id: l.product_id,
      lead_id: target.lead_id ?? null,
      follow_up_id: target.follow_up_id ?? null,
      quantity: l.quantity,
      unit_price: l.unit_price,
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("record_products").insert(rows);
  if (error) throw error;
}

export async function fetchProductLines(target: {
  lead_id?: string | null;
  follow_up_id?: string | null;
}): Promise<ProductLine[]> {
  let query = supabase.from("record_products").select("product_id, quantity, unit_price");
  query = target.follow_up_id
    ? query.eq("follow_up_id", target.follow_up_id)
    : query.eq("lead_id", target.lead_id!);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    product_id: r.product_id,
    quantity: Number(r.quantity ?? 1),
    unit_price: Number(r.unit_price ?? 0),
  }));
}