import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  FolderPlus,
  Layers,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, NoAccess, PageHeader } from "@/components/crm/page";
import { AreaField, PickerField, TextField } from "@/components/crm/fields";
import { ALL, FilterBar, NumberFilter, SearchFilter, SelectFilter } from "@/components/crm/filters";
import { can, useWorkspace } from "@/hooks/use-workspace";
import {
  useProductCollections,
  useProducts,
  type CollectionRow,
  type ProductRow,
} from "@/hooks/use-products";
import { formatMoney, formatMoneyFull } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Services & Products — Zenith CRM" },
      {
        name: "description",
        content:
          "Organise your sales catalogue into collections of services and products with pricing, units, tax rates and active status.",
      },
      { property: "og:title", content: "Services & Products — Zenith CRM" },
      {
        property: "og:description",
        content: "Collections and price list of every service and product your team sells.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

const productSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(140),
  code: z.string().trim().max(40).optional(),
  unit: z.string().trim().min(1, "Unit is required").max(30),
  unit_price: z.coerce.number().min(0).max(1_000_000_000),
  cost_price: z.union([z.coerce.number().min(0).max(1_000_000_000), z.literal("")]),
  tax_percent: z.coerce.number().min(0).max(100),
  description: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
});

type ProductValues = z.infer<typeof productSchema>;

type ProductPayload = {
  values: ProductValues;
  kind: string;
  is_active: boolean;
  collection_id: string;
};

type ProductPatch = {
  name?: string;
  code?: string | null;
  category?: string | null;
  collection_id?: string | null;
  unit?: string;
  unit_price?: number;
  cost_price?: number | null;
  tax_percent?: number;
  description?: string | null;
  notes?: string | null;
  kind?: "service" | "product";
  is_active?: boolean;
};

const collectionSchema = z.object({
  name: z.string().trim().min(1, "Collection name is required").max(80),
  description: z.string().trim().max(500).optional(),
});

type CollectionValues = z.infer<typeof collectionSchema>;

const KIND_OPTIONS = [
  { id: "service", name: "Service" },
  { id: "product", name: "Product" },
];

const STATUS_OPTIONS = [
  { id: "active", name: "Active only" },
  { id: "inactive", name: "Inactive only" },
];

const SORTS = [
  { id: "order_asc", name: "Catalogue order" },
  { id: "name_asc", name: "Name A–Z" },
  { id: "price_desc", name: "Highest price" },
  { id: "price_asc", name: "Lowest price" },
  { id: "created_desc", name: "Newest first" },
];

const UNIT_OPTIONS = [
  "unit",
  "hour",
  "day",
  "session",
  "project",
  "room",
  "plan",
  "sq.ft.",
  "month",
  "piece",
].map((name) => ({ id: name, name }));

const UNGROUPED = "__ungrouped__";

function ProductsPage() {
  const { data: ws } = useWorkspace();
  const orgId = ws?.organizationId;
  const symbol = ws?.currencySymbol ?? "₹";
  const queryClient = useQueryClient();

  const canManage = can(ws, "settings.manage");

  const products = useProducts(orgId);
  const collections = useProductCollections(orgId);

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState(ALL);
  const [collectionFilter, setCollectionFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("order_asc");

  const [itemDialog, setItemDialog] = useState<{ collectionId: string } | null>(null);
  const [editItem, setEditItem] = useState<ProductRow | null>(null);
  const [collectionDialog, setCollectionDialog] = useState(false);
  const [editCollection, setEditCollection] = useState<CollectionRow | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["products", orgId] });
    queryClient.invalidateQueries({ queryKey: ["product-collections", orgId] });
  }

  const collectionList = collections.data ?? [];
  const collectionOptions = collectionList.map((c) => ({ id: c.id, name: c.name }));
  const collectionById = useMemo(
    () => new Map(collectionList.map((c) => [c.id, c])),
    [collectionList],
  );

  const createCollection = useMutation({
    mutationFn: async (values: CollectionValues) => {
      if (!orgId) throw new Error("Workspace not ready");
      const { error } = await supabase.from("product_collections").insert({
        organization_id: orgId,
        created_by: ws?.memberId ?? null,
        name: values.name,
        description: values.description || null,
        sort_order: collectionList.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Collection created");
      setCollectionDialog(false);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not create collection"),
  });

  const updateCollection = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { name?: string; description?: string | null; is_active?: boolean };
    }) => {
      const { error } = await supabase.from("product_collections").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditCollection(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Collection deleted — its items moved to Ungrouped");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not delete collection"),
  });

  const createProduct = useMutation({
    mutationFn: async (payload: ProductPayload) => {
      if (!orgId) throw new Error("Workspace not ready");
      const v = payload.values;
      const { error } = await supabase.from("products").insert({
        organization_id: orgId,
        created_by: ws?.memberId ?? null,
        collection_id: payload.collection_id || null,
        category: collectionById.get(payload.collection_id)?.name ?? null,
        name: v.name,
        code: v.code || null,
        unit: v.unit,
        unit_price: v.unit_price,
        cost_price: v.cost_price === "" ? null : Number(v.cost_price),
        tax_percent: v.tax_percent,
        description: v.description || null,
        notes: v.notes || null,
        kind: payload.kind as "service" | "product",
        is_active: payload.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Catalogue item added");
      setItemDialog(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ProductPatch }) => {
      const { error } = await supabase.from("products").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditItem(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Catalogue item removed");
      invalidate();
    },
    onError: () =>
      toast.error(
        "Could not remove — it may be linked to leads or follow-ups. Deactivate it instead.",
      ),
  });

  const filtered = useMemo(() => {
    const rows = (products.data ?? []).filter((p) => {
      if (kindFilter !== ALL && p.kind !== kindFilter) return false;
      if (collectionFilter !== ALL) {
        const key = p.collection_id ?? UNGROUPED;
        if (key !== collectionFilter) return false;
      }
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "inactive" && p.is_active) return false;
      const price = Number(p.unit_price ?? 0);
      if (minPrice.trim() && price < Number(minPrice)) return false;
      if (maxPrice.trim() && price > Number(maxPrice)) return false;
      if (search.trim()) {
        const haystack = [
          p.name,
          p.code,
          p.description,
          p.collection_id ? collectionById.get(p.collection_id)?.name : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });

    return [...rows].sort((a, b) => {
      switch (sort) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "price_desc":
          return Number(b.unit_price ?? 0) - Number(a.unit_price ?? 0);
        case "price_asc":
          return Number(a.unit_price ?? 0) - Number(b.unit_price ?? 0);
        case "created_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
      }
    });
  }, [
    products.data,
    kindFilter,
    collectionFilter,
    statusFilter,
    minPrice,
    maxPrice,
    search,
    sort,
    collectionById,
  ]);

  /** Collections in display order, each with the items that survived filtering. */
  const groups = useMemo(() => {
    const buckets = new Map<string, ProductRow[]>();
    for (const item of filtered) {
      const key = item.collection_id ?? UNGROUPED;
      const list = buckets.get(key);
      if (list) list.push(item);
      else buckets.set(key, [item]);
    }
    const ordered: {
      id: string;
      name: string;
      description: string | null;
      isActive: boolean;
      isUngrouped: boolean;
      items: ProductRow[];
    }[] = collectionList.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isActive: c.is_active,
      isUngrouped: false,
      items: buckets.get(c.id) ?? [],
    }));
    const loose = buckets.get(UNGROUPED);
    if (loose?.length) {
      ordered.push({
        id: UNGROUPED,
        name: "Ungrouped",
        description: "Items that are not part of any collection yet.",
        isActive: true,
        isUngrouped: true,
        items: loose,
      });
    }
    return ordered;
  }, [filtered, collectionList]);

  const activeFilters = [
    search.trim() ? 1 : 0,
    kindFilter !== ALL ? 1 : 0,
    collectionFilter !== ALL ? 1 : 0,
    statusFilter !== ALL ? 1 : 0,
    minPrice.trim() ? 1 : 0,
    maxPrice.trim() ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  function resetFilters() {
    setSearch("");
    setKindFilter(ALL);
    setCollectionFilter(ALL);
    setStatusFilter(ALL);
    setMinPrice("");
    setMaxPrice("");
  }

  if (ws && !ws.organizationId) return <NoAccess what="the catalogue" />;

  const all = products.data ?? [];
  const activeCount = all.filter((p) => p.is_active).length;
  const serviceCount = all.filter((p) => p.kind === "service").length;
  const loading = products.isLoading || collections.isLoading;
  const visibleGroups = groups.filter((g) => g.items.length > 0 || activeFilters === 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services & Products"
        subtitle={`${collectionList.length} collections · ${all.length} items · ${activeCount} active · ${serviceCount} services · ${all.length - serviceCount} products`}
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCollectionDialog(true)}>
                <FolderPlus className="mr-1 size-4" /> New collection
              </Button>
              <Button
                disabled={collectionList.length === 0}
                onClick={() =>
                  setItemDialog({ collectionId: collectionList[0]?.id ?? "" })
                }
              >
                <Plus className="mr-1 size-4" /> New item
              </Button>
            </div>
          ) : null
        }
      />

      <FilterBar onReset={resetFilters} activeCount={activeFilters}>
        <SearchFilter
          id="product-search"
          value={search}
          onChange={setSearch}
          placeholder="Name, code, collection or description"
        />
        <SelectFilter
          id="product-kind-filter"
          label="Type"
          value={kindFilter}
          onChange={setKindFilter}
          options={KIND_OPTIONS}
          allLabel="All types"
          width="w-36"
        />
        <SelectFilter
          id="product-collection-filter"
          label="Collection"
          value={collectionFilter}
          onChange={setCollectionFilter}
          options={[...collectionOptions, { id: UNGROUPED, name: "Ungrouped" }]}
          allLabel="All collections"
        />
        <SelectFilter
          id="product-status-filter"
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
          allLabel="Active & inactive"
        />
        <NumberFilter
          id="product-min-price"
          label="Min price"
          value={minPrice}
          onChange={setMinPrice}
        />
        <NumberFilter
          id="product-max-price"
          label="Max price"
          value={maxPrice}
          onChange={setMaxPrice}
        />
        <div className="w-40 space-y-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="product-sort">
            Sort
          </label>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger id="product-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {loading && <Skeleton className="h-48" />}

      {!loading && collectionList.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Layers className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Start with a collection</p>
              <p className="text-sm text-muted-foreground">
                Collections group your catalogue — for example “Design” or “Modular”. Create one,
                then add services and products inside it.
              </p>
            </div>
            {canManage && (
              <Button onClick={() => setCollectionDialog(true)}>
                <FolderPlus className="mr-1 size-4" /> Create your first collection
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!loading &&
        visibleGroups.map((group) => (
          <Card key={group.id} className="shadow-card">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="size-4 text-muted-foreground" />
                  {group.name}
                  {!group.isActive && <Badge variant="outline">Inactive</Badge>}
                  <Badge variant="secondary">{group.items.length}</Badge>
                </CardTitle>
                {group.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                ) : null}
              </div>
              {canManage && !group.isUngrouped ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItemDialog({ collectionId: group.id })}
                  >
                    <Plus className="mr-1 size-3.5" /> Add item
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${group.name}`}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{group.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => {
                          const row = collectionById.get(group.id);
                          if (row) setEditCollection(row);
                        }}
                      >
                        <Pencil className="mr-2 size-3.5" /> Rename / edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          updateCollection.mutate(
                            { id: group.id, patch: { is_active: !group.isActive } },
                            {
                              onSuccess: () =>
                                toast.success(
                                  `${group.name} ${group.isActive ? "deactivated" : "activated"}`,
                                ),
                            },
                          )
                        }
                      >
                        <Switch className="mr-2 pointer-events-none" checked={group.isActive} />
                        {group.isActive ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => deleteCollection.mutate(group.id)}
                      >
                        <Trash2 className="mr-2 size-3.5" /> Delete collection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="px-0">
              {group.items.length === 0 ? (
                <EmptyState message="No items in this collection yet." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Tax %</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell>
                            <p className="flex items-center gap-2 font-medium">
                              {item.kind === "product" ? (
                                <Package className="size-3.5 text-muted-foreground" />
                              ) : (
                                <Wrench className="size-3.5 text-muted-foreground" />
                              )}
                              {item.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.code ?? "—"} · per {item.unit}
                              {item.description ? ` · ${item.description}` : ""}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {item.kind}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoneyFull(item.unit_price, symbol)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {Number(item.tax_percent ?? 0)}%
                          </TableCell>
                          <TableCell>
                            {canManage ? (
                              <Switch
                                checked={item.is_active}
                                aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${item.name}`}
                                onCheckedChange={(checked) => {
                                  updateProduct.mutate(
                                    { id: item.id, patch: { is_active: checked } },
                                    {
                                      onSuccess: () =>
                                        toast.success(
                                          `${item.name} ${checked ? "activated" : "deactivated"}`,
                                        ),
                                    },
                                  );
                                }}
                              />
                            ) : (
                              <Badge variant={item.is_active ? "secondary" : "outline"}>
                                {item.is_active ? "Active" : "Inactive"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {canManage ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Actions for ${item.name}`}
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>{item.name}</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => setEditItem(item)}>
                                    <Pencil className="mr-2 size-3.5" /> Edit item
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onSelect={() => deleteProduct.mutate(item.id)}
                                  >
                                    <Trash2 className="mr-2 size-3.5" /> Delete item
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

      {!loading && collectionList.length > 0 && filtered.length === 0 && activeFilters > 0 && (
        <EmptyState message="No catalogue items match your filters." />
      )}

      <p className="text-xs text-muted-foreground">
        Catalogue value listed:{" "}
        {formatMoney(
          filtered.reduce((s, p) => s + Number(p.unit_price ?? 0), 0),
          symbol,
        )}
      </p>

      {/* Create item */}
      <Dialog open={Boolean(itemDialog)} onOpenChange={(next) => !next && setItemDialog(null)}>
        {itemDialog && (
          <ProductFormDialog
            title="New service or product"
            description="Items live inside a collection and are available when creating leads and follow-ups."
            collections={collectionOptions}
            defaultCollectionId={itemDialog.collectionId}
            saving={createProduct.isPending}
            onSubmit={(payload) => createProduct.mutate(payload)}
          />
        )}
      </Dialog>

      {/* Edit item */}
      <Dialog open={Boolean(editItem)} onOpenChange={(next) => !next && setEditItem(null)}>
        {editItem && (
          <ProductFormDialog
            title={`Edit ${editItem.name}`}
            description="Changes apply everywhere this item is offered."
            initial={editItem}
            collections={collectionOptions}
            defaultCollectionId={editItem.collection_id ?? collectionOptions[0]?.id ?? ""}
            saving={updateProduct.isPending}
            onSubmit={(payload) => {
              const v = payload.values;
              updateProduct.mutate(
                {
                  id: editItem.id,
                  patch: {
                    name: v.name,
                    code: v.code || null,
                    collection_id: payload.collection_id || null,
                    category: collectionById.get(payload.collection_id)?.name ?? null,
                    unit: v.unit,
                    unit_price: v.unit_price,
                    cost_price: v.cost_price === "" ? null : Number(v.cost_price),
                    tax_percent: v.tax_percent,
                    description: v.description || null,
                    notes: v.notes || null,
                    kind: payload.kind as "service" | "product",
                    is_active: payload.is_active,
                  },
                },
                { onSuccess: () => toast.success("Catalogue item updated") },
              );
            }}
          />
        )}
      </Dialog>

      {/* Create collection */}
      <Dialog open={collectionDialog} onOpenChange={setCollectionDialog}>
        {collectionDialog && (
          <CollectionFormDialog
            title="New collection"
            description="Group related services and products, then add items inside it."
            saving={createCollection.isPending}
            onSubmit={(values) => createCollection.mutate(values)}
          />
        )}
      </Dialog>

      {/* Edit collection */}
      <Dialog
        open={Boolean(editCollection)}
        onOpenChange={(next) => !next && setEditCollection(null)}
      >
        {editCollection && (
          <CollectionFormDialog
            title={`Edit ${editCollection.name}`}
            description="Rename or describe this collection."
            initial={editCollection}
            saving={updateCollection.isPending}
            onSubmit={(values) =>
              updateCollection.mutate(
                {
                  id: editCollection.id,
                  patch: { name: values.name, description: values.description || null },
                },
                { onSuccess: () => toast.success("Collection updated") },
              )
            }
          />
        )}
      </Dialog>
    </div>
  );
}

function CollectionFormDialog({
  title,
  description,
  initial,
  saving,
  onSubmit,
}: {
  title: string;
  description: string;
  initial?: CollectionRow;
  saving: boolean;
  onSubmit: (values: CollectionValues) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");

  function submit() {
    const parsed = collectionSchema.safeParse({ name, description: desc });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    onSubmit(parsed.data);
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <TextField
          id="collection-name"
          label="Collection name"
          value={name}
          onChange={setName}
          placeholder="e.g. Modular Furniture"
        />
        <AreaField
          id="collection-description"
          label="Description"
          value={desc}
          onChange={setDesc}
        />
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Save collection
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ProductFormDialog({
  title,
  description,
  initial,
  collections,
  defaultCollectionId,
  saving,
  onSubmit,
}: {
  title: string;
  description: string;
  initial?: ProductRow;
  collections: { id: string; name: string }[];
  defaultCollectionId: string;
  saving: boolean;
  onSubmit: (payload: ProductPayload) => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    unit: initial?.unit ?? "unit",
    unit_price: String(initial?.unit_price ?? 0),
    cost_price: initial?.cost_price == null ? "" : String(initial.cost_price),
    tax_percent: String(initial?.tax_percent ?? 18),
    description: initial?.description ?? "",
    notes: initial?.notes ?? "",
  });
  const [kind, setKind] = useState<string>(initial?.kind ?? "service");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [collectionId, setCollectionId] = useState(defaultCollectionId);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    const parsed = productSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    if (!collectionId) {
      toast.error("Pick a collection for this item");
      return;
    }
    onSubmit({ values: parsed.data, kind, is_active: isActive, collection_id: collectionId });
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <PickerField
            id="product-collection"
            label="Collection"
            value={collectionId}
            onChange={setCollectionId}
            options={collections}
          />
        </div>
        <div className="sm:col-span-2">
          <TextField
            id="product-name"
            label="Name"
            value={form.name}
            onChange={(v) => set("name", v)}
            placeholder="e.g. 3D Visualisation"
          />
        </div>
        <PickerField
          id="product-kind"
          label="Type"
          value={kind}
          onChange={setKind}
          options={KIND_OPTIONS}
        />
        <TextField
          id="product-code"
          label="Code / SKU"
          value={form.code}
          onChange={(v) => set("code", v)}
        />
        <PickerField
          id="product-unit"
          label="Unit"
          value={form.unit}
          onChange={(v) => set("unit", v)}
          options={UNIT_OPTIONS}
        />
        <TextField
          id="product-price"
          label="Selling price"
          type="number"
          value={form.unit_price}
          onChange={(v) => set("unit_price", v)}
        />
        <TextField
          id="product-cost"
          label="Cost price (optional)"
          type="number"
          value={form.cost_price}
          onChange={(v) => set("cost_price", v)}
        />
        <TextField
          id="product-tax"
          label="Tax %"
          type="number"
          value={form.tax_percent}
          onChange={(v) => set("tax_percent", v)}
        />
        <div className="flex items-center justify-between rounded-lg border px-3 py-2 sm:col-span-1">
          <label htmlFor="product-active" className="text-sm font-medium">
            Active
          </label>
          <Switch id="product-active" checked={isActive} onCheckedChange={setIsActive} />
        </div>
        <div className="sm:col-span-2">
          <AreaField
            id="product-description"
            label="Description"
            value={form.description}
            onChange={(v) => set("description", v)}
          />
        </div>
        <div className="sm:col-span-2">
          <AreaField
            id="product-notes"
            label="Internal notes"
            value={form.notes}
            onChange={(v) => set("notes", v)}
          />
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />} Save item
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
