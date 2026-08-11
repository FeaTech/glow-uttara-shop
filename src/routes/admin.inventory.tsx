import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Boxes, CheckCircle2, Loader2, PackageX, Save, Search, TriangleAlert } from "lucide-react";
import { adminListInventory, adminUpdateInventoryStock } from "@/lib/admin.functions";
import { useRealtimeInvalidate } from "@/hooks/use-realtime";
import { ProductImage } from "@/components/ProductImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { productImage } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Admin — FEA Glam" }] }),
  component: AdminInventory,
});

const LOW_STOCK_THRESHOLD = 10;
const FILTERS = ["all", "in-stock", "low-stock", "sold-out"] as const;
type StockFilter = (typeof FILTERS)[number];
type InventoryRow = Awaited<ReturnType<typeof adminListInventory>>[number];

function getStockStatus(stock: number): Exclude<StockFilter, "all"> {
  if (stock === 0) return "sold-out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low-stock";
  return "in-stock";
}

const statusLabels: Record<Exclude<StockFilter, "all">, string> = {
  "in-stock": "In stock",
  "low-stock": "Low stock",
  "sold-out": "Sold out",
};

function AdminInventory() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const {
    data: inventory,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin", "inventory"],
    queryFn: () => adminListInventory({ data: undefined }),
    retry: false,
  });

  useRealtimeInvalidate({
    channel: "admin-inventory-variants",
    table: "product_variants",
    invalidate: [
      ["admin", "inventory"],
      ["admin", "products"],
      ["admin", "stats"],
    ],
  });
  useRealtimeInvalidate({
    channel: "admin-inventory-products",
    table: "products",
    invalidate: [
      ["admin", "inventory"],
      ["admin", "products"],
      ["admin", "stats"],
    ],
  });

  const updateFn = useServerFn(adminUpdateInventoryStock);
  const updateMutation = useMutation({
    mutationFn: updateFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success("Stock updated");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Stock update failed");
    },
    onSettled: () => setSavingId(null),
  });

  const rows = useMemo(() => inventory ?? [], [inventory]);
  const counts = useMemo(
    () => ({
      all: rows.length,
      "in-stock": rows.filter((row) => getStockStatus(row.stock) === "in-stock").length,
      "low-stock": rows.filter((row) => getStockStatus(row.stock) === "low-stock").length,
      "sold-out": rows.filter((row) => getStockStatus(row.stock) === "sold-out").length,
    }),
    [rows],
  );

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && getStockStatus(row.stock) !== filter) return false;
      if (!needle) return true;
      return [row.productName, row.variantName, row.sku, row.categoryName]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [filter, query, rows]);

  const cards = [
    {
      key: "all" as const,
      label: "Inventory items",
      value: counts.all,
      icon: Boxes,
      className: "text-primary",
    },
    {
      key: "in-stock" as const,
      label: "In stock",
      value: counts["in-stock"],
      icon: CheckCircle2,
      className: "text-emerald-600",
    },
    {
      key: "low-stock" as const,
      label: "Low stock",
      value: counts["low-stock"],
      icon: TriangleAlert,
      className: "text-amber-600",
    },
    {
      key: "sold-out" as const,
      label: "Sold out",
      value: counts["sold-out"],
      icon: PackageX,
      className: "text-destructive",
    },
  ];

  return (
    <div>
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground">Inventory</h1>
        <p className="mt-1 text-muted-foreground">
          Track and update each sellable product or variant.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map(({ key, label, value, icon: Icon, className }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "card-luxe p-4 text-left transition-colors hover:border-primary/40",
              filter === key && "border-primary ring-1 ring-primary/20",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className={cn("h-4 w-4", className)} />
            </div>
            <p className="mt-2 font-serif text-2xl font-medium text-foreground">
              {isLoading ? "—" : value}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product, variant, SKU, or category"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as StockFilter)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All inventory</SelectItem>
            <SelectItem value="in-stock">In stock</SelectItem>
            <SelectItem value="low-stock">Low stock</SelectItem>
            <SelectItem value="sold-out">Sold out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Showing {visibleRows.length} of {rows.length} items · low stock means 1–
        {LOW_STOCK_THRESHOLD} units
      </p>

      <div className="card-luxe mt-3 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-48">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  Loading inventory…
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-destructive">
                  Inventory could not be loaded.
                </TableCell>
              </TableRow>
            ) : visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No inventory items match these filters.
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <InventoryTableRow
                  key={`${row.kind}-${row.id}`}
                  row={row}
                  disabled={updateMutation.isPending}
                  saving={updateMutation.isPending && savingId === row.id}
                  onSave={(stock) => {
                    setSavingId(row.id);
                    updateMutation.mutate({
                      data: { id: row.id, productId: row.productId, kind: row.kind, stock },
                    });
                  }}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function InventoryTableRow({
  row,
  disabled,
  saving,
  onSave,
}: {
  row: InventoryRow;
  disabled: boolean;
  saving: boolean;
  onSave: (stock: number) => void;
}) {
  const status = getStockStatus(row.stock);

  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-52 items-center gap-3">
          <ProductImage
            src={productImage(row.images)}
            alt=""
            className="h-11 w-11 rounded-md object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.productName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.categoryName ?? "Uncategorised"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className={row.variantName ? "font-medium text-foreground" : "text-muted-foreground"}>
          {row.variantName ?? "Standard product"}
        </span>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{row.sku ?? "—"}</TableCell>
      <TableCell>
        <StockStatusBadge status={status} />
      </TableCell>
      <TableCell>
        <StockEditor row={row} disabled={disabled} saving={saving} onSave={onSave} />
      </TableCell>
    </TableRow>
  );
}

function StockStatusBadge({ status }: { status: Exclude<StockFilter, "all"> }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "in-stock" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        status === "low-stock" && "border-amber-200 bg-amber-50 text-amber-700",
        status === "sold-out" && "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {statusLabels[status]}
    </Badge>
  );
}

function StockEditor({
  row,
  disabled,
  saving,
  onSave,
}: {
  row: InventoryRow;
  disabled: boolean;
  saving: boolean;
  onSave: (stock: number) => void;
}) {
  const [value, setValue] = useState(row.stock.toString());

  useEffect(() => {
    setValue(row.stock.toString());
  }, [row.id, row.stock]);

  const stock = Number(value);
  const valid = Number.isInteger(stock) && stock >= 0;
  const dirty = valid && stock !== row.stock;

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty) onSave(stock);
      }}
    >
      <Input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={`Stock for ${row.productName}${row.variantName ? `, ${row.variantName}` : ""}`}
        className="w-24"
      />
      <Button
        type="submit"
        size="icon"
        variant="outline"
        disabled={disabled || !dirty}
        aria-label="Save stock"
        className="h-9 w-9"
      >
        {saving ? <Loader2 className="animate-spin" /> : <Save />}
      </Button>
    </form>
  );
}
