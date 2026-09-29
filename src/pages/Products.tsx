import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useMaximizedState } from '@/hooks/use-maximize-preference';
import { useKeyboardShortcut, useSaveShortcut } from "@/hooks/use-keyboard-shortcut";
import { useTransactionAction } from "@/hooks/use-transaction-action";
import { useTableSort } from "@/hooks/use-table-sort";
import { useColumnVisibility, ColumnDefinition } from "@/hooks/use-column-visibility";
import { PRODUCT_COLUMNS } from '@/config/column-layouts';
import { ColumnToggle } from "@/components/ColumnToggle";
import { useVendorSources } from "@/hooks/use-vendor-sources";
import { useImportExportSettings } from "@/hooks/use-import-export-settings";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useStatusBar } from "@/contexts/StatusBarContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead } from "@/components/SortableTableHead";
import { SearchableSelect, SearchableSelectOption } from "@/components/SearchableSelect";
import {
  ArrowLeft,
  Plus,
  Package,
  Pencil,
  Trash2,
  AlertCircle,
  X,
  Check,
  ChevronsUpDown,
  Wand2,
  Loader2,
  MoreHorizontal,
  Eye,
  Upload,
  ImageIcon,
  Maximize2,
  Minimize2,
  Search,
  Printer,
} from "lucide-react";
import { Plug } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { Badge } from "@/components/ui/badge";
import { CopyFromIdDialog } from "@/components/CopyFromIdDialog";
import { InterconnectProductPicker } from "@/components/products/InterconnectProductPicker";
import { SafetyStockTab } from "@/components/products/SafetyStockTab";
import { toast } from '@/lib/toast';
import { useExcel } from "@/hooks/use-excel";
import { useReduceAppLoad } from "@/hooks/use-reduce-app-load";
import { AppLoadQueryDialog, QueryField } from "@/components/AppLoadQueryDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PRODUCT_QUERY_FIELDS: QueryField[] = [
  { key: "product_id", label: "Product ID", placeholder: "Search by product ID..." },
  { key: "name", label: "Name", placeholder: "Search by name..." },
  { key: "sku", label: "SKU", placeholder: "Search by SKU..." },
  { key: "category", label: "Category", placeholder: "e.g. Raw Materials..." },
];

interface SafetyStock {
  id?: string;
  location_id: string;
  location_name: string;
  location_code: string;
  safety_stock_quantity: number;
}

type ProductStatus = "active" | "do_not_buy" | "discontinued";

interface Product {
  id: string;
  product_id: string;
  vendor_id: string | null;
  vendor_part_number: string | null;
  sku: string | null;
  upc: string | null;
  name: string;
  description: string | null;
  link: string | null;
  category: string | null;
  price: number | null;
  unit: string | null;
  is_batched: boolean;
  min_shelf_life_days: number | null;
  keep_inventory: boolean;
  is_consumable: boolean;
  width: number | null;
  length: number | null;
  height: number | null;
  weight: number | null;
  width_uom: string | null;
  length_uom: string | null;
  height_uom: string | null;
  weight_uom: string | null;
  status: string;
  image_url: string | null;
  transport_time_days: number | null;
  manufacture_time_days: number | null;
  lead_time_days: number | null;
  vendors?: { name: string; vendor_id: string } | null;
}

const PRODUCT_STATUSES: { value: ProductStatus; label: string; color: string }[] = [
  { value: "active", label: "Active", color: "bg-success" },
  { value: "do_not_buy", label: "Do Not Buy", color: "bg-yellow-500" },
  { value: "discontinued", label: "Discontinued", color: "bg-destructive" },
];

interface ProductUom {
  id?: string;
  name: string;
  abbreviation: string;
  conversion_factor: string;
  lower_uom?: string; // For display purposes
}

interface ProductComponent {
  id?: string;
  component_product_id: string;
  quantity: string;
  uom_id?: string | null;
  available_uoms?: { id: string; name: string; abbreviation: string | null; conversion_factor: number }[];
  product?: {
    product_id: string;
    name: string;
    price: number | null;
    unit: string | null;
    is_consumable?: boolean;
  };
}

interface Vendor {
  id: string;
  vendor_id: string;
  name: string;
}

const PRODUCT_CATEGORIES = [
  "Raw Materials",
  "Components",
  "Finished Goods",
  "Packaging",
  "Equipment",
  "Supplies",
  "Services",
];

// Base UOM options - shared with UoMs tab abbreviation selector
const BASE_UOM_OPTIONS = [
  { value: "EA", label: "EA - Each" },
  { value: "PC", label: "PC - Piece" },
  { value: "CS", label: "CS - Case" },
  { value: "CTN", label: "CTN - Carton" },
  { value: "BX", label: "BX - Box" },
  { value: "PK", label: "PK - Pack" },
  { value: "PLA", label: "PLA - Pallet" },
  { value: "DZ", label: "DZ - Dozen" },
  { value: "KG", label: "KG - Kilogram" },
  { value: "LB", label: "LB - Pound" },
  { value: "OZ", label: "OZ - Ounce" },
  { value: "G", label: "G - Gram" },
  { value: "L", label: "L - Liter" },
  { value: "ML", label: "ML - Milliliter" },
  { value: "GAL", label: "GAL - Gallon" },
  { value: "QT", label: "QT - Quart" },
  { value: "FT", label: "FT - Foot" },
  { value: "IN", label: "IN - Inch" },
  { value: "M", label: "M - Meter" },
  { value: "CM", label: "CM - Centimeter" },
  { value: "RL", label: "RL - Roll" },
  { value: "SET", label: "SET - Set" },
  { value: "BAG", label: "BAG - Bag" },
  { value: "BTL", label: "BTL - Bottle" },
  { value: "CAN", label: "CAN - Can" },
  { value: "JAR", label: "JAR - Jar" },
  { value: "TUB", label: "TUB - Tub" },
  { value: "BDL", label: "BDL - Bundle" },
  { value: "PR", label: "PR - Pair" },
];

// Dimension UoM options
const DIMENSION_UOMS = [
  { value: "in", label: "in - Inches" },
  { value: "ft", label: "ft - Feet" },
  { value: "cm", label: "cm - Centimeters" },
  { value: "m", label: "m - Meters" },
  { value: "mm", label: "mm - Millimeters" },
  { value: "yd", label: "yd - Yards" },
];

const WEIGHT_UOMS = [
  { value: "lb", label: "lb - Pounds" },
  { value: "oz", label: "oz - Ounces" },
  { value: "kg", label: "kg - Kilograms" },
  { value: "g", label: "g - Grams" },
  { value: "mg", label: "mg - Milligrams" },
  { value: "ton", label: "ton - Tons" },
];

// Column definitions for Products table

// Separated table component with sorting/filtering
const ProductTable = ({
  products,
  onEdit,
  onDelete,
  onView,
  onStatusChange,
  onFilteredDataChange,
  isColumnVisible,
  showImages,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onView: (product: Product) => void;
  onStatusChange: (product: Product, newStatus: ProductStatus) => void;
  onFilteredDataChange?: (data: Product[]) => void;
  isColumnVisible: (key: string) => boolean;
  showImages?: boolean;
}) => {
  const { sortConfig, filters, handleSort, setFilter, clearAllFilters, sortedAndFilteredData } = useTableSort(
    products,
    "product_id",
    "asc",
  );

  // Notify parent of filtered data changes
  useEffect(() => {
    onFilteredDataChange?.(sortedAndFilteredData);
  }, [sortedAndFilteredData, onFilteredDataChange]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const visibleColumnCount = PRODUCT_COLUMNS.filter((c) => isColumnVisible(c.key)).length + (showImages ? 1 : 0);

  return (
    <div className="space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-muted-foreground">
            Showing {sortedAndFilteredData.length} of {products.length} products
          </span>
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
            <X className="w-3 h-3 mr-1" />
            Clear filters
          </Button>
          {Object.entries(filters).map(
            ([key, value]) =>
              value && (
                <Badge key={key} variant="secondary" className="text-xs">
                  {key}: {value}
                  <button onClick={() => setFilter(key, "")} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ),
          )}
        </div>
      )}
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
             <TableRow>
              {showImages && <TableHead className="w-12" />}
              {isColumnVisible("product_id") && (
                <SortableTableHead
                  label="ID"
                  sortKey="product_id"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["product_id"]}
                  onFilter={(value) => setFilter("product_id", value)}
                  className="w-24"
                />
              )}
              {isColumnVisible("name") && (
                <SortableTableHead
                  label="Name"
                  sortKey="name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["name"]}
                  onFilter={(value) => setFilter("name", value)}
                />
              )}
              {isColumnVisible("sku") && (
                <SortableTableHead
                  label="SKU"
                  sortKey="sku"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["sku"]}
                  onFilter={(value) => setFilter("sku", value)}
                />
              )}
              {isColumnVisible("upc") && (
                <SortableTableHead
                  label="UPC"
                  sortKey="upc"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["upc"]}
                  onFilter={(value) => setFilter("upc", value)}
                />
              )}
              {isColumnVisible("category") && (
                <SortableTableHead
                  label="Category"
                  sortKey="category"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["category"]}
                  onFilter={(value) => setFilter("category", value)}
                />
              )}
              {isColumnVisible("vendor_id") && (
                <SortableTableHead
                  label="Vendor ID"
                  sortKey="vendor_id"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["vendor_id"]}
                  onFilter={(value) => setFilter("vendor_id", value)}
                />
              )}
              {isColumnVisible("vendor") && (
                <SortableTableHead
                  label="Vendor"
                  sortKey="vendors.name"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["vendors.name"]}
                  onFilter={(value) => setFilter("vendors.name", value)}
                />
              )}
              {isColumnVisible("vendor_part_number") && (
                <SortableTableHead
                  label="Vendor Part #"
                  sortKey="vendor_part_number"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["vendor_part_number"]}
                  onFilter={(value) => setFilter("vendor_part_number", value)}
                />
              )}
              {isColumnVisible("price") && (
                <SortableTableHead
                  label="Price"
                  sortKey="price"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["price"]}
                  onFilter={(value) => setFilter("price", value)}
                  className="text-right"
                />
              )}
              {isColumnVisible("unit") && (
                <SortableTableHead
                  label="Unit"
                  sortKey="unit"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["unit"]}
                  onFilter={(value) => setFilter("unit", value)}
                />
              )}
              {isColumnVisible("width") && (
                <SortableTableHead
                  label="Width"
                  sortKey="width"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["width"]}
                  onFilter={(value) => setFilter("width", value)}
                  className="text-right"
                />
              )}
              {isColumnVisible("length") && (
                <SortableTableHead
                  label="Length"
                  sortKey="length"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["length"]}
                  onFilter={(value) => setFilter("length", value)}
                  className="text-right"
                />
              )}
              {isColumnVisible("height") && (
                <SortableTableHead
                  label="Height"
                  sortKey="height"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["height"]}
                  onFilter={(value) => setFilter("height", value)}
                  className="text-right"
                />
              )}
              {isColumnVisible("weight") && (
                <SortableTableHead
                  label="Weight"
                  sortKey="weight"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["weight"]}
                  onFilter={(value) => setFilter("weight", value)}
                  className="text-right"
                />
              )}
              {isColumnVisible("status") && (
                <SortableTableHead
                  label="Status"
                  sortKey="status"
                  currentSortKey={sortConfig.key}
                  currentSortDirection={sortConfig.direction}
                  onSort={handleSort}
                  filterValue={filters["status"]}
                  onFilter={(value) => setFilter("status", value)}
                />
              )}
              {isColumnVisible("serialized") && (
                <SortableTableHead label="Serialized" sortKey="serialized" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
              )}
              {isColumnVisible("is_batched") && (
                <SortableTableHead label="Batched" sortKey="is_batched" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
              )}
              {isColumnVisible("hazardous") && (
                <SortableTableHead label="Hazardous" sortKey="hazardous" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
              )}
              {isColumnVisible("keep_inventory") && (
                <SortableTableHead label="Keep Inv." sortKey="keep_inventory" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
              )}
              {isColumnVisible("is_consumable") && (
                <SortableTableHead label="Consumable" sortKey="is_consumable" currentSortKey={sortConfig.key} currentSortDirection={sortConfig.direction} onSort={handleSort} filterable={false} />
              )}
              {isColumnVisible("actions") && (
                <SortableTableHead
                  label="Actions"
                  sortKey=""
                  currentSortKey=""
                  currentSortDirection={null}
                  onSort={() => {}}
                  filterable={false}
                  className="w-24"
                />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="text-center py-8 text-muted-foreground">
                  No products match your filters
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((product) => {
                const statusConfig = PRODUCT_STATUSES.find((s) => s.value === product.status) || PRODUCT_STATUSES[0];
                return (
                  <TableRow key={product.id}>
                    {showImages && (
                      <TableCell className="w-12 p-1">
                        <Avatar className="h-8 w-8 rounded">
                          {product.image_url ? (
                            <AvatarImage src={product.image_url} alt={product.name} className="object-cover" />
                          ) : (
                            <AvatarFallback className="rounded bg-muted text-muted-foreground text-xs">
                              <Package className="h-4 w-4" />
                            </AvatarFallback>
                          )}
                        </Avatar>
                      </TableCell>
                    )}
                    {isColumnVisible("product_id") && (
                      <TableCell className="font-mono text-sm">
                        <button
                          onClick={() => onView(product)}
                          className="text-primary hover:underline focus:outline-none"
                        >
                          {product.product_id}
                        </button>
                      </TableCell>
                    )}
                    {isColumnVisible("name") && <TableCell className="font-medium">{product.name}</TableCell>}
                    {isColumnVisible("sku") && <TableCell>{product.sku || "-"}</TableCell>}
                    {isColumnVisible("upc") && <TableCell>{product.upc || "-"}</TableCell>}
                    {isColumnVisible("category") && <TableCell>{product.category || "-"}</TableCell>}
                    {isColumnVisible("vendor_id") && (
                      <TableCell className="font-mono text-sm">{product.vendors?.vendor_id || "-"}</TableCell>
                    )}
                    {isColumnVisible("vendor") && <TableCell>{product.vendors?.name || "-"}</TableCell>}
                    {isColumnVisible("vendor_part_number") && <TableCell>{product.vendor_part_number || "-"}</TableCell>}
                    {isColumnVisible("price") && (
                      <TableCell className="text-right">
                        {product.price ? `$${product.price.toFixed(2)}` : "-"}
                      </TableCell>
                    )}
                    {isColumnVisible("unit") && <TableCell>{product.unit || "-"}</TableCell>}
                    {isColumnVisible("width") && (
                      <TableCell className="text-right">
                        {product.width ? `${product.width} ${product.width_uom || ""}`.trim() : "-"}
                      </TableCell>
                    )}
                    {isColumnVisible("length") && (
                      <TableCell className="text-right">
                        {product.length ? `${product.length} ${product.length_uom || ""}`.trim() : "-"}
                      </TableCell>
                    )}
                    {isColumnVisible("height") && (
                      <TableCell className="text-right">
                        {product.height ? `${product.height} ${product.height_uom || ""}`.trim() : "-"}
                      </TableCell>
                    )}
                    {isColumnVisible("weight") && (
                      <TableCell className="text-right">
                        {product.weight ? `${product.weight} ${product.weight_uom || ""}`.trim() : "-"}
                      </TableCell>
                    )}
                    {isColumnVisible("status") && (
                      <TableCell>
                        <Badge className={`${statusConfig.color} text-white`}>{statusConfig.label}</Badge>
                      </TableCell>
                    )}
                    {isColumnVisible("serialized") && (
                      <TableCell>{(product as any).serialized ? "Yes" : "No"}</TableCell>
                    )}
                    {isColumnVisible("is_batched") && (
                      <TableCell>{product.is_batched ? "Yes" : "No"}</TableCell>
                    )}
                    {isColumnVisible("hazardous") && (
                      <TableCell>{(product as any).hazardous ? "Yes" : "No"}</TableCell>
                    )}
                    {isColumnVisible("keep_inventory") && (
                      <TableCell>{product.keep_inventory ? "Yes" : "No"}</TableCell>
                    )}
                    {isColumnVisible("is_consumable") && (
                      <TableCell>{product.is_consumable ? "Yes" : "No"}</TableCell>
                    )}
                    {isColumnVisible("actions") && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => onView(product)} title="View product">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEdit(product)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onView(product)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              {PRODUCT_STATUSES.filter(s => s.value !== product.status).map(s => (
                                <DropdownMenuItem key={s.value} onClick={() => onStatusChange(product, s.value)}>
                                  <Check className="w-4 h-4 mr-2" />
                                  Set status: {s.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem
                                onClick={() => onDelete(product.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const Products = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { setTransaction } = useStatusBar();
  const formRef = useRef<HTMLFormElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showProductImages, setShowProductImages] = useState(false);
  const { reduceAppLoad, loading: reduceAppLoadLoading } = useReduceAppLoad();
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isMaximized, setIsMaximized] = useMaximizedState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [nextProductId, setNextProductId] = useState("0001");
  const [activeTab, setActiveTab] = useState("general");
  const [uoms, setUoms] = useState<ProductUom[]>([]);
  const [newUom, setNewUom] = useState<ProductUom>({
    name: "",
    abbreviation: "",
    conversion_factor: "1",
    lower_uom: "",
  });
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [newComponent, setNewComponent] = useState<{ product_id: string; quantity: string; uom_id: string }>({
    product_id: "",
    quantity: "1",
    uom_id: "",
  });
  const [newComponentUoms, setNewComponentUoms] = useState<{ id: string; name: string; abbreviation: string | null; conversion_factor: number }[]>([]);
  // UoMs cache keyed by product id for restriction entries
  const [restrictionUomsCache, setRestrictionUomsCache] = useState<Record<string, { id: string; name: string; abbreviation: string | null; conversion_factor: number }[]>>({});

  // Derive all available UoMs including sub-units from lower_uom references
  const deriveAllUoms = (
    uomRecords: { id: string; product_id?: string; name: string; abbreviation: string | null; conversion_factor: number; lower_uom?: string | null }[],
    baseUnit: string
  ) => {
    const result: { id: string; name: string; abbreviation: string | null; conversion_factor: number }[] = [];
    const seen = new Set<string>();

    // Add existing product_uom records (skip if same as base unit)
    for (const uom of uomRecords) {
      const label = uom.abbreviation || uom.name;
      if (label.toUpperCase() === baseUnit.toUpperCase()) continue;
      if (seen.has(label.toUpperCase())) continue;
      seen.add(label.toUpperCase());
      result.push({ id: uom.id, name: uom.name, abbreviation: uom.abbreviation, conversion_factor: uom.conversion_factor });
    }

    // Derive sub-units from lower_uom references
    for (const uom of uomRecords) {
      if (!uom.lower_uom) continue;
      const lowerLabel = uom.lower_uom.toUpperCase();
      if (lowerLabel === baseUnit.toUpperCase()) continue;
      if (seen.has(lowerLabel)) continue;
      // Check if lower_uom is already a product_uom record
      const existsAsRecord = uomRecords.some(r => (r.abbreviation || r.name).toUpperCase() === lowerLabel);
      if (existsAsRecord) continue;
      seen.add(lowerLabel);
      // The conversion factor for a sub-unit: if 1 CS = 1000 EA and base is CS, then EA factor = 1/1000
      // But if base is EA and CS has conversion_factor 1000 with lower_uom EA, then EA IS the base
      // Since lower_uom means "1 [this_uom] = conversion_factor × [lower_uom]"
      // The effective factor for the lower_uom relative to base = 1/conversion_factor (if this_uom IS the base)
      // Or more precisely: the sub-unit price = base_price / conversion_factor
      result.push({
        id: `_lower:${uom.lower_uom}`,
        name: uom.lower_uom,
        abbreviation: uom.lower_uom,
        conversion_factor: uom.conversion_factor, // same factor, but price divides by this
      });
    }

    return result;
  };
  const [newComponentBaseUnit, setNewComponentBaseUnit] = useState<string>("");
  const [newComponentConsumable, setNewComponentConsumable] = useState<boolean>(false);
  const [availableComponents, setAvailableComponents] = useState<SearchableSelectOption[]>([]);
  const [formData, setFormData] = useState({
    product_id: "",
    vendor_id: "",
    vendor_part_number: "",
    sku: "",
    upc: "",
    name: "",
    description: "",
    link: "",
    category: "",
    price: "",
    unit: "EA",
    is_batched: false,
    min_shelf_life_days: "",
    keep_inventory: true,
    is_consumable: false,
    width: "",
    length: "",
    height: "",
    weight: "",
    width_uom: "in",
    length_uom: "in",
    height_uom: "in",
    weight_uom: "lb",
    status: "active",
    image_url: "",
    transport_time_days: "",
    manufacture_time_days: "",
    lead_time_days: "",
    hazardous: false,
    serialized: false,
    is_pos_available: true,
    is_interconnect_available: false,
    allow_modifications: false,
    restrict_modifications: false,
    restricted_products: [] as { product_id: string; quantity: string; uom_id: string }[],
  });
  const [interconnectLink, setInterconnectLink] = useState<{ id: string; productId: string | null; label: string } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [aiPopoverOpen, setAiPopoverOpen] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [safetyStocks, setSafetyStocks] = useState<SafetyStock[]>([]);

  // Column visibility
  const { visibleColumns, isColumnVisible, toggleColumn, resetToDefaults, showAll, hideAll } = useColumnVisibility(
    "products",
    PRODUCT_COLUMNS,
  );

  const { plainVendorOptions } = useVendorSources(companyId);
  const { exportToExcel, readExcel } = useExcel();

  // Import/Export settings
  const { isImportEnabled, isExportEnabled } = useImportExportSettings(companyId);

  // Handle filtered data from table
  const handleFilteredDataChange = useCallback((data: Product[]) => {
    setFilteredProducts(data);
  }, []);

  // Export columns definition
  const EXPORT_COLUMNS = [
    "product_id",
    "name",
    "sku",
    "description",
    "category",
    "price",
    "unit",
    "vendor_name",
    "is_batched",
    "min_shelf_life_days",
    "keep_inventory",
    "is_consumable",
    "width",
    "width_uom",
    "length",
    "length_uom",
    "height",
    "height_uom",
    "weight",
    "weight_uom",
  ];

  // Export products to XLSX
  const handleExport = useCallback(async () => {
    const dataToExport = filteredProducts.length > 0 ? filteredProducts : products;

    if (dataToExport.length === 0) {
      toast.error("No products to export");
      return;
    }

    const exportData = dataToExport.map((p) => ({
      product_id: p.product_id,
      name: p.name,
      sku: p.sku || "",
      description: p.description || "",
      category: p.category || "",
      price: p.price ?? "",
      unit: p.unit || "",
      vendor_name: p.vendors?.name || "",
      is_batched: p.is_batched ? "Yes" : "No",
      min_shelf_life_days: p.min_shelf_life_days ?? "",
      keep_inventory: p.keep_inventory ? "Yes" : "No",
      is_consumable: p.is_consumable ? "Yes" : "No",
      width: p.width ?? "",
      width_uom: p.width_uom || "in",
      length: p.length ?? "",
      length_uom: p.length_uom || "in",
      height: p.height ?? "",
      height_uom: p.height_uom || "in",
      weight: p.weight ?? "",
      weight_uom: p.weight_uom || "lb",
    }));

    await exportToExcel(exportData, `products_export_${new Date().toISOString().split("T")[0]}.xlsx`, "Products");
    toast.success(`Exported ${exportData.length} products`);
  }, [products, filteredProducts, exportToExcel]);

  // Download import template
  const handleDownloadTemplate = useCallback(async () => {
    const templateData = [
      {
        product_id: "PROD-001",
        name: "Example Product",
        sku: "SKU-001",
        description: "Product description here",
        category: "Raw Materials",
        price: 19.99,
        unit: "each",
        vendor_id: "",
        is_batched: "No",
        min_shelf_life_days: "",
        keep_inventory: "Yes",
        is_consumable: "No",
        width: "",
        width_uom: "in",
        length: "",
        length_uom: "in",
        height: "",
        height_uom: "in",
        weight: "",
        weight_uom: "lb",
      },
    ];

    await exportToExcel(templateData, "products_import_template.xlsx", "Products Template");
    toast.success("Template downloaded");
  }, [exportToExcel]);

  // Handle file import
  const handleImport = useCallback(
    async (file: File) => {
      try {
        const jsonData = await readExcel(file);

        if (jsonData.length === 0) {
          toast.error("No data found in file");
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const row of jsonData) {
          try {
            let productId = row.product_id?.toString() || "";

            // Auto-generate product_id if not provided
            if (!productId && companyId) {
              const { data: nextId, error: idError } = await supabase.rpc("get_next_product_id", {
                p_company_id: companyId,
              });

              if (idError || !nextId) {
                console.error("Error generating product ID:", idError);
                errorCount++;
                continue;
              }
              productId = nextId;
            }

            const productData = {
              company_id: companyId!,
              product_id: productId,
              name: row.name?.toString() || "",
              sku: row.sku?.toString() || null,
              description: row.description?.toString() || null,
              category: row.category?.toString() || null,
              price: row.price ? parseFloat(row.price) : null,
              unit: row.unit?.toString() || "each",
              vendor_id: row.vendor_id?.toString() || null,
              is_batched: row.is_batched?.toString().toLowerCase() === "yes",
              min_shelf_life_days: row.min_shelf_life_days ? parseInt(row.min_shelf_life_days) : null,
              keep_inventory: row.keep_inventory?.toString().toLowerCase() !== "no",
              is_consumable: row.is_consumable?.toString().toLowerCase() === "yes",
              width: row.width ? parseFloat(row.width) : null,
              width_uom: row.width_uom?.toString() || "in",
              length: row.length ? parseFloat(row.length) : null,
              length_uom: row.length_uom?.toString() || "in",
              height: row.height ? parseFloat(row.height) : null,
              height_uom: row.height_uom?.toString() || "in",
              weight: row.weight ? parseFloat(row.weight) : null,
              weight_uom: row.weight_uom?.toString() || "lb",
            };

            if (!productData.name) {
              errorCount++;
              continue;
            }

            // Check if product exists
            const existing = products.find((p) => p.product_id === productData.product_id);

            if (existing) {
              await supabase.from("products").update(productData).eq("id", existing.id);
            } else {
              await supabase.from("products").insert(productData);
            }
            successCount++;
          } catch (err) {
            console.error("Error importing row:", err);
            errorCount++;
          }
        }

        toast.success(`Imported ${successCount} products${errorCount > 0 ? `, ${errorCount} errors` : ""}`);

        // Refetch products
        const { data: refreshedData } = await supabase
          .from("products")
          .select("*, vendors(name, vendor_id)")
          .eq("company_id", companyId!)
          .order("product_id");
        setProducts(refreshedData || []);
      } catch (error) {
        console.error("Import error:", error);
        toast.error("Failed to import file");
      }
    },
    [companyId, products, readExcel],
  );
  // Set transaction based on dialog state
  useEffect(() => {
    if (isDialogOpen) {
      setTransaction(isEditing ? "prod/edit" : "prod/new");
    } else {
      setTransaction("prod");
    }
  }, [isDialogOpen, isEditing, setTransaction]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowQueryDialog(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Ctrl+S to save
  useSaveShortcut(() => {
    if (isDialogOpen && formRef.current) {
      formRef.current.requestSubmit();
    }
  }, isDialogOpen);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCompanyId();
    }
  }, [user]);

  useEffect(() => {
    if (companyId && !reduceAppLoadLoading) {
      if (reduceAppLoad) {
        setShowQueryDialog(true);
      } else {
        fetchProducts();
      }
      fetchNextProductId();
    }
  }, [companyId, reduceAppLoad, reduceAppLoadLoading]);

  const fetchCompanyId = async () => {
    const { data } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();

    if (data?.company_id) {
      setCompanyId(data.company_id);
      // Fetch show_product_images setting
      const { data: settingData } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", data.company_id)
        .eq("setting_key", "process_controls")
        .maybeSingle();
      if (settingData?.setting_value && typeof settingData.setting_value === "object" && !Array.isArray(settingData.setting_value)) {
        const val = settingData.setting_value as Record<string, unknown>;
        setShowProductImages((val.show_product_images as boolean) ?? false);
      }
    }
  };

  const fetchProducts = async (filters?: Record<string, string>) => {
    let query = supabase
      .from("products")
      .select("*, vendors(name, vendor_id)")
      .eq("company_id", companyId!);

    if (filters?.product_id) query = query.ilike("product_id", `%${filters.product_id}%`);
    if (filters?.name) query = query.ilike("name", `%${filters.name}%`);
    if (filters?.sku) query = query.ilike("sku", `%${filters.sku}%`);
    if (filters?.category) query = query.ilike("category", `%${filters.category}%`);

    const { data, error } = await query.order("product_id");

    if (error) {
      toast.error("Failed to load products");
      return;
    }

    setProducts(data || []);
  };

  const handleQueryDialogQuery = async (filters: Record<string, string>) => {
    setQueryLoading(true);
    await fetchProducts(filters);
    setQueryLoading(false);
    setShowQueryDialog(false);
  };

  const handleQueryDialogLoadAll = async () => {
    setQueryLoading(true);
    await fetchProducts();
    setQueryLoading(false);
    setShowQueryDialog(false);
  };

  // fetchVendors removed - using useVendorSources hook instead

  const fetchNextProductId = async () => {
    const { data, error } = await supabase.rpc("get_next_product_id", {
      p_company_id: companyId!,
    });

    if (!error && data) {
      setNextProductId(data);
    }
  };

  const fetchProductUoms = async (productId: string) => {
    const { data, error } = await supabase.from("product_uoms").select("*").eq("product_id", productId).order("name");

    if (error) {
      console.error("Failed to load UOMs:", error);
      return;
    }

    setUoms(
      data?.map((u: any) => ({
        id: u.id,
        name: u.name,
        abbreviation: u.abbreviation || "",
        conversion_factor: u.conversion_factor?.toString() || "1",
        lower_uom: u.lower_uom || "",
      })) || [],
    );
  };

  const fetchProductComponents = async (productId: string) => {
    const { data, error } = await supabase
      .from("product_components")
      .select(
        "id, component_product_id, quantity, uom_id, uom_name, component_product:products!product_components_component_product_id_fkey(product_id, name, price, unit, is_consumable)",
      )
      .eq("parent_product_id", productId);

    if (error) {
      console.error("Failed to load components:", error);
      return;
    }

    // Fetch UoMs for each unique component product (include lower_uom for deriving sub-units)
    const uniqueProductIds = [...new Set(data?.map(c => c.component_product_id) || [])];
    const uomsByProduct: Record<string, { id: string; name: string; abbreviation: string | null; conversion_factor: number }[]> = {};
    
    if (uniqueProductIds.length > 0) {
      const { data: uomData } = await supabase
        .from("product_uoms")
        .select("id, product_id, name, abbreviation, conversion_factor, lower_uom")
        .in("product_id", uniqueProductIds);
      
      // Group raw UoM data by product
      const rawByProduct: Record<string, typeof uomData> = {};
      uomData?.forEach(u => {
        if (!rawByProduct[u.product_id]) rawByProduct[u.product_id] = [];
        rawByProduct[u.product_id]!.push(u);
      });

      // Derive all UoMs (including sub-units) for each product
      for (const comp of data || []) {
        const pid = comp.component_product_id;
        if (uomsByProduct[pid]) continue;
        const baseUnit = (comp.component_product as any)?.unit || "";
        uomsByProduct[pid] = deriveAllUoms(rawByProduct[pid] || [], baseUnit);
      }
    }

    setComponents(
      data?.map((c) => {
        const availUoms = uomsByProduct[c.component_product_id] || [];
        // Re-match virtual lower UoM by name if uom_id is null but uom_name is set
        let effectiveUomId = (c as any).uom_id || null;
        if (!effectiveUomId && (c as any).uom_name) {
          const matched = availUoms.find(u => (u.abbreviation || u.name).toUpperCase() === ((c as any).uom_name as string).toUpperCase());
          if (matched) effectiveUomId = matched.id;
        }
        return {
          id: c.id,
          component_product_id: c.component_product_id,
          quantity: c.quantity?.toString() || "1",
          uom_id: effectiveUomId,
          available_uoms: availUoms,
          product: c.component_product as ProductComponent["product"],
        };
      }) || [],
    );
  };

  const fetchAvailableComponents = async (excludeProductId?: string) => {
    const { data, error } = await supabase
      .from("products")
      .select("id, product_id, name")
      .eq("company_id", companyId!)
      .order("name");

    if (error) {
      console.error("Failed to load available components:", error);
      return;
    }

    const options =
      data
        ?.filter((p) => p.id !== excludeProductId)
        .map((p) => ({
          value: p.id,
          label: p.name,
          sublabel: p.product_id,
        })) || [];

    setAvailableComponents(options);
  };

  const resetForm = () => {
    setFormData({
      product_id: nextProductId,
    vendor_id: "",
    vendor_part_number: "",
    sku: "",
    upc: "",
    name: "",
      description: "",
      link: "",
      category: "",
      price: "",
      unit: "EA",
      is_batched: false,
      min_shelf_life_days: "",
      keep_inventory: true,
      is_consumable: false,
      width: "",
      length: "",
      height: "",
      weight: "",
      width_uom: "in",
      length_uom: "in",
      height_uom: "in",
      weight_uom: "lb",
      status: "active",
      image_url: "",
      transport_time_days: "",
      manufacture_time_days: "",
      lead_time_days: "",
      hazardous: false,
      serialized: false,
      is_pos_available: true,
      is_interconnect_available: false,
      allow_modifications: false,
      restrict_modifications: false,
      restricted_products: [],
    });
    setImageFile(null);
    setImagePreview(null);
    setUoms([]);
    setInterconnectLink(null);
    setNewUom({ name: "", abbreviation: "", conversion_factor: "1" });
    setComponents([]);
    setNewComponent({ product_id: "", quantity: "1", uom_id: "" });
    setNewComponentUoms([]);
    setNewComponentBaseUnit("");
    setSafetyStocks([]);
    setActiveTab("general");
    setIsEditing(false);
    setEditingId(null);
  };

  const handleOpenDialog = async () => {
    resetForm();
    setFormData((prev) => ({ ...prev, product_id: nextProductId }));
    await fetchAvailableComponents();
    setIsDialogOpen(true);
  };

  // Keyboard shortcut for adding new product
  useKeyboardShortcut("n", handleOpenDialog);
  useTransactionAction('new', handleOpenDialog);

  const handleEdit = async (product: Product) => {
    const icId = (product as any).interconnect_id as string | null;
    if (icId) {
      const { data: ic } = await supabase
        .from("interconnects")
        .select("interconnect_id, name")
        .eq("id", icId)
        .maybeSingle();
      setInterconnectLink({
        id: icId,
        productId: (product as any).interconnect_product_id || null,
        label: ic ? `${ic.name || ""} · ${ic.interconnect_id}` : "Linked",
      });
    } else {
      setInterconnectLink(null);
    }
    setFormData({
      product_id: product.product_id,
      vendor_id: product.vendor_id || "",
      vendor_part_number: (product as any).vendor_part_number || "",
      sku: product.sku || "",
      upc: product.upc || "",
      name: product.name,
      description: product.description || "",
      link: product.link || "",
      category: product.category || "",
      price: product.price?.toString() || "",
      unit: product.unit || "each",
      is_batched: product.is_batched || false,
      min_shelf_life_days: product.min_shelf_life_days?.toString() || "",
      keep_inventory: product.keep_inventory ?? true,
      is_consumable: product.is_consumable || false,
      width: product.width?.toString() || "",
      length: product.length?.toString() || "",
      height: product.height?.toString() || "",
      weight: product.weight?.toString() || "",
      width_uom: product.width_uom || "in",
      length_uom: product.length_uom || "in",
      height_uom: product.height_uom || "in",
      weight_uom: product.weight_uom || "lb",
      status: product.status || "active",
      image_url: product.image_url || "",
      transport_time_days: product.transport_time_days?.toString() || "",
      manufacture_time_days: product.manufacture_time_days?.toString() || "",
      lead_time_days: product.lead_time_days?.toString() || "",
      hazardous: (product as any).hazardous || false,
      serialized: (product as any).serialized || false,
      is_pos_available: (product as any).is_pos_available !== false,
      is_interconnect_available: (product as any).is_interconnect_available || false,
      allow_modifications: (product as any).allow_modifications || false,
      restrict_modifications: (product as any).restrict_modifications || false,
      restricted_products: (product as any).restricted_products || [],
    });
    setImagePreview(product.image_url || null);
    setImageFile(null);
    setIsEditing(true);
    setEditingId(product.id);
    setActiveTab("general");
    const existingRestrictions: { product_id: string }[] = (product as any).restricted_products || [];
    await Promise.all([
      fetchProductUoms(product.id),
      fetchProductComponents(product.id),
      fetchAvailableComponents(product.id),
      fetchSafetyStocks(product.id),
      // Pre-fetch UoMs for all already-restricted products
      ...(existingRestrictions.length > 0
        ? [
            (async () => {
              const uniqueIds = [...new Set(existingRestrictions.map((r) => r.product_id))];
              const { data: uomData } = await supabase
                .from("product_uoms")
                .select("id, product_id, name, abbreviation, conversion_factor, lower_uom")
                .in("product_id", uniqueIds);
              const cache: Record<string, { id: string; name: string; abbreviation: string | null; conversion_factor: number }[]> = {};
              for (const pid of uniqueIds) {
                const recs = (uomData || []).filter((u: any) => u.product_id === pid);
                const prod = products.find((p) => p.id === pid);
                cache[pid] = deriveAllUoms(recs, prod?.unit || "");
              }
              setRestrictionUomsCache((prev) => ({ ...prev, ...cache }));
            })(),
          ]
        : []),
    ]);
    setIsDialogOpen(true);
  };

  // Deep link: open the window for a product referenced via ?ref=<product_id>
  const openProductByRef = useCallback(async (productId: string) => {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("company_id", companyId!)
      .eq("product_id", productId)
      .maybeSingle();
    if (data) {
      const { data: full } = await supabase
        .from("products")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      if (full) {
        await handleEdit(full as Product);
        return;
      }
    }
    toast.error(`Product ${productId} not found`);
  }, [companyId]);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref || !companyId || isDialogOpen) return;
    setSearchParams({}, { replace: true });
    openProductByRef(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, companyId]);

  const fetchSafetyStocks = async (productId: string) => {
    const { data, error } = await supabase
      .from("product_safety_stock")
      .select("id, location_id, safety_stock_quantity, location:locations(name, location_id)")
      .eq("product_id", productId);

    if (error) {
      console.error("Failed to load safety stocks:", error);
      return;
    }

    setSafetyStocks(
      (data || []).map((s: any) => ({
        id: s.id,
        location_id: s.location_id,
        location_name: s.location?.name || "",
        location_code: s.location?.location_id || "",
        safety_stock_quantity: s.safety_stock_quantity,
      })),
    );
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete product");
      return;
    }

    toast.success("Product deleted");
    fetchProducts();
    fetchNextProductId();
  };

  const [statusChangeTarget, setStatusChangeTarget] = useState<{ product: Product; newStatus: ProductStatus } | null>(null);

  const requestStatusChange = (product: Product, newStatus: ProductStatus) => {
    setStatusChangeTarget({ product, newStatus });
  };

  const confirmStatusChange = async () => {
    if (!statusChangeTarget) return;
    const { product, newStatus } = statusChangeTarget;
    const { error } = await supabase.from("products").update({ status: newStatus }).eq("id", product.id);
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Status updated to ${PRODUCT_STATUSES.find(s => s.value === newStatus)?.label}`);
      fetchProducts();
    }
    setStatusChangeTarget(null);
  };

  const handleAddUom = () => {
    if (!newUom.abbreviation) {
      toast.error("Please select a UOM");
      return;
    }
    if (uoms.some((u) => u.abbreviation === newUom.abbreviation)) {
      toast.error("This UOM already exists");
      return;
    }

    const factor = parseFloat(newUom.conversion_factor) || 1;
    if (factor <= 0) {
      toast.error("Conversion factor must be greater than 0");
      return;
    }

    // Get the name from the selected abbreviation
    const selectedUomOption = BASE_UOM_OPTIONS.find((o) => o.value === newUom.abbreviation);
    const name = selectedUomOption?.label.split(" - ")[1] || newUom.abbreviation;

    // Calculate conversion factor relative to the base unit
    // The user enters: 1 [new UoM] = [factor] × [lower UoM]
    // We need to compute: 1 [new UoM] = ? × [base unit]
    const lowerUom = newUom.lower_uom || formData.unit;
    let lowerUomBaseConversion = 1; // default: lower UoM IS the base unit

    if (lowerUom !== formData.unit) {
      const lowerUomEntry = uoms.find((u) => u.abbreviation === lowerUom);
      if (lowerUomEntry) {
        lowerUomBaseConversion = parseFloat(lowerUomEntry.conversion_factor) || 1;
      }
      // If lower UoM is from BASE_UOM_OPTIONS but not yet a product UoM, treat its base conversion as 1
    }

    const finalConversionFactor = factor * lowerUomBaseConversion;

    setUoms([
      ...uoms,
      {
        name,
        abbreviation: newUom.abbreviation,
        conversion_factor: finalConversionFactor.toString(),
        lower_uom: lowerUom,
      },
    ]);
    setNewUom({ name: "", abbreviation: "", conversion_factor: "1", lower_uom: "" });
  };

  const handleRemoveUom = (index: number) => {
    setUoms(uoms.filter((_, i) => i !== index));
  };

  const handleAddComponent = async () => {
    if (!newComponent.product_id) {
      toast.error("Please select a component product");
      return;
    }
    if (components.some((c) => c.component_product_id === newComponent.product_id)) {
      toast.error("This component is already added");
      return;
    }

    // Fetch the product details
    const { data: productData } = await supabase
      .from("products")
      .select("product_id, name, price, unit, is_consumable")
      .eq("id", newComponent.product_id)
      .single();

    if (productData) {
      setComponents([
        ...components,
        {
          component_product_id: newComponent.product_id,
          quantity: newComponent.quantity || "1",
          uom_id: newComponent.uom_id || null,
          available_uoms: newComponentUoms,
          product: productData,
        },
      ]);
    }
    setNewComponent({ product_id: "", quantity: "1", uom_id: "" });
    setNewComponentUoms([]);
    setNewComponentBaseUnit("");
    setNewComponentConsumable(false);
  };

  const handleRemoveComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const getComponentUnitPrice = (comp: ProductComponent) => {
    const basePrice = comp.product?.price || 0;
    const selectedUom = comp.uom_id ? comp.available_uoms.find(u => u.id === comp.uom_id) : null;
    const conversionFactor = selectedUom?.conversion_factor || 1;
    return basePrice / conversionFactor;
  };

  const handleAdoptPrice = () => {
    const total = components.reduce((sum, comp) => {
      const qty = parseFloat(comp.quantity) || 0;
      return sum + qty * getComponentUnitPrice(comp);
    }, 0);
    setFormData((prev) => ({ ...prev, price: total.toFixed(2) }));
    toast.success(`Price updated to $${total.toFixed(2)}`);
  };

  const calculateComponentsTotal = () => {
    return components.reduce((sum, comp) => {
      const qty = parseFloat(comp.quantity) || 0;
      return sum + qty * getComponentUnitPrice(comp);
    }, 0);
  };

  // Image handling functions
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = async () => {
    if (isEditing && formData.image_url) {
      setUploadingImage(true);
      try {
        // Extract file path from URL
        const url = new URL(formData.image_url);
        const pathParts = url.pathname.split("/product-images/");
        if (pathParts.length > 1) {
          await supabase.storage.from("product-images").remove([pathParts[1]]);
        }

        await supabase
          .from("products")
          .update({ image_url: null } as any)
          .eq("id", editingId);

        toast.success("Image removed");
      } catch (error) {
        toast.error("Failed to remove image");
      } finally {
        setUploadingImage(false);
      }
    }
    setImageFile(null);
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, image_url: "" }));
  };

  const uploadProductImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return formData.image_url || null;

    const fileExt = imageFile.name.split(".").pop();
    const fileName = `product-${Date.now()}.${fileExt}`;
    const filePath = `${companyId}/${productId}/${fileName}`;

    // Remove old image if exists
    if (formData.image_url) {
      try {
        const url = new URL(formData.image_url);
        const pathParts = url.pathname.split("/product-images/");
        if (pathParts.length > 1) {
          await supabase.storage.from("product-images").remove([pathParts[1]]);
        }
      } catch (e) {
        console.error("Failed to remove old image:", e);
      }
    }

    const { error } = await supabase.storage.from("product-images").upload(filePath, imageFile);

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from("product-images").getPublicUrl(filePath);

    return publicUrl;
  };

  const handleAiAutofill = async () => {
    if (!aiDescription.trim()) {
      toast.error("Please enter a product description");
      return;
    }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-product-description", {
        body: { description: aiDescription },
      });

      if (error) throw error;

      if (data?.product) {
        const product = data.product;
        setFormData((prev) => ({
          ...prev,
          name: product.name || prev.name,
          description: product.description || prev.description,
          category: product.category || prev.category,
          price: product.price?.toString() || prev.price,
          unit: product.unit || prev.unit,
          sku: product.sku || prev.sku,
          width: product.width?.toString() || prev.width,
          length: product.length?.toString() || prev.length,
          height: product.height?.toString() || prev.height,
          weight: product.weight?.toString() || prev.weight,
          is_batched: product.is_batched ?? prev.is_batched,
          min_shelf_life_days: product.min_shelf_life_days?.toString() || prev.min_shelf_life_days,
        }));
        toast.success("Product details populated from description");
        setAiPopoverOpen(false);
        setAiDescription("");
      }
    } catch (error) {
      console.error("AI autofill error:", error);
      toast.error("Failed to parse product description");
    } finally {
      setAiLoading(false);
    }
  };

  const isProductIdInUse = products.some(
    (p) => p.product_id === formData.product_id && (!isEditing || p.id !== editingId),
  );
  const isSkuInUse = formData.sku && products.some((p) => p.sku === formData.sku && (!isEditing || p.id !== editingId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let productId = editingId;

    if (isEditing && editingId) {
      // Upload image first if there's a new one
      let imageUrl = formData.image_url || null;
      if (imageFile) {
        try {
          imageUrl = await uploadProductImage(editingId);
        } catch (error) {
          console.error("Failed to upload image:", error);
          toast.error("Failed to upload image");
        }
      }

      const { error } = await supabase
        .from("products")
        .update({
          vendor_id: formData.vendor_id || null,
          vendor_part_number: formData.vendor_part_number || null,
          sku: formData.sku || null,
          upc: formData.upc || null,
          name: formData.name,
          description: formData.description || null,
          link: formData.link || null,
          category: formData.category || null,
          price: formData.price ? parseFloat(formData.price) : null,
          unit: formData.unit || null,
          is_batched: formData.is_batched,
          min_shelf_life_days:
            formData.is_batched && formData.min_shelf_life_days ? parseInt(formData.min_shelf_life_days) : null,
          keep_inventory: formData.keep_inventory,
          is_consumable: formData.is_consumable,
          width: formData.width ? parseFloat(formData.width) : null,
          length: formData.length ? parseFloat(formData.length) : null,
          height: formData.height ? parseFloat(formData.height) : null,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          width_uom: formData.width_uom || "in",
          length_uom: formData.length_uom || "in",
          height_uom: formData.height_uom || "in",
          weight_uom: formData.weight_uom || "lb",
          status: formData.status,
          image_url: imageUrl,
          transport_time_days: formData.transport_time_days ? parseInt(formData.transport_time_days) : null,
          manufacture_time_days: formData.manufacture_time_days ? parseInt(formData.manufacture_time_days) : null,
          lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
          hazardous: formData.hazardous,
          serialized: formData.serialized,
          is_pos_available: formData.is_pos_available,
          is_interconnect_available: formData.is_interconnect_available,
          allow_modifications: formData.allow_modifications,
          restrict_modifications: formData.restrict_modifications,
          restricted_products: formData.restricted_products,
          interconnect_id: interconnectLink?.id || null,
          interconnect_product_id: interconnectLink?.productId || null,
        } as any)
        .eq("id", editingId);

      if (error) {
        console.error("Failed to update product:", error);
        toast.error(`Failed to update product: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({
          company_id: companyId!,
          product_id: formData.product_id,
          vendor_id: formData.vendor_id || null,
          vendor_part_number: formData.vendor_part_number || null,
          sku: formData.sku || null,
          upc: formData.upc || null,
          name: formData.name,
          description: formData.description || null,
          link: formData.link || null,
          category: formData.category || null,
          price: formData.price ? parseFloat(formData.price) : null,
          unit: formData.unit || null,
          is_batched: formData.is_batched,
          min_shelf_life_days:
            formData.is_batched && formData.min_shelf_life_days ? parseInt(formData.min_shelf_life_days) : null,
          keep_inventory: formData.keep_inventory,
          is_consumable: formData.is_consumable,
          width: formData.width ? parseFloat(formData.width) : null,
          length: formData.length ? parseFloat(formData.length) : null,
          height: formData.height ? parseFloat(formData.height) : null,
          weight: formData.weight ? parseFloat(formData.weight) : null,
          width_uom: formData.width_uom || "in",
          length_uom: formData.length_uom || "in",
          height_uom: formData.height_uom || "in",
          weight_uom: formData.weight_uom || "lb",
          status: formData.status,
          transport_time_days: formData.transport_time_days ? parseInt(formData.transport_time_days) : null,
          manufacture_time_days: formData.manufacture_time_days ? parseInt(formData.manufacture_time_days) : null,
          lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
          hazardous: formData.hazardous,
          serialized: formData.serialized,
          is_pos_available: formData.is_pos_available,
          is_interconnect_available: formData.is_interconnect_available,
          allow_modifications: formData.allow_modifications,
          restrict_modifications: formData.restrict_modifications,
          restricted_products: formData.restricted_products,
          interconnect_id: interconnectLink?.id || null,
          interconnect_product_id: interconnectLink?.productId || null,
        } as any)
        .select("id")
        .single();

      if (error || !data) {
        toast.error("Failed to create product");
        return;
      }

      productId = data.id;

      // Upload image for new product
      if (imageFile && productId) {
        try {
          const imageUrl = await uploadProductImage(productId);
          if (imageUrl) {
            await supabase
              .from("products")
              .update({ image_url: imageUrl } as any)
              .eq("id", productId);
          }
        } catch (error) {
          console.error("Failed to upload image:", error);
          toast.error("Product saved but failed to upload image");
        }
      }
    }

    // Save UOMs
    if (productId) {
      // Delete existing UOMs and re-insert
      await supabase.from("product_uoms").delete().eq("product_id", productId);

      if (uoms.length > 0) {
        const uomInserts = uoms.map((u) => ({
          product_id: productId,
          name: u.name,
          abbreviation: u.abbreviation || null,
          conversion_factor: parseFloat(u.conversion_factor) || 1,
          lower_uom: u.lower_uom || null,
        }));

        const { error: uomError } = await supabase.from("product_uoms").insert(uomInserts);

        if (uomError) {
          console.error("Failed to save UOMs:", uomError);
          toast.error("Product saved but failed to save some UOMs");
        }
      }

      // Save Components (only for Finished Goods)
      if (formData.category === "Finished Goods") {
        await supabase.from("product_components").delete().eq("parent_product_id", productId);

        if (components.length > 0) {
          const componentInserts = components.map((c) => {
            const isVirtual = c.uom_id?.startsWith("_lower:");
            const selectedUom = c.uom_id ? c.available_uoms.find(u => u.id === c.uom_id) : null;
            return {
              parent_product_id: productId,
              component_product_id: c.component_product_id,
              quantity: parseFloat(c.quantity) || 1,
              uom_id: c.uom_id && !isVirtual ? c.uom_id : null,
              uom_name: selectedUom ? (selectedUom.abbreviation || selectedUom.name) : null,
            };
          });

          const { error: compError } = await supabase.from("product_components").insert(componentInserts);

          if (compError) {
            console.error("Failed to save components:", compError);
            toast.error("Product saved but failed to save some components");
          }
        }
      }

      // Save Safety Stocks
      await supabase.from("product_safety_stock").delete().eq("product_id", productId);

      if (safetyStocks.length > 0) {
        const safetyStockInserts = safetyStocks.map((s) => ({
          product_id: productId,
          location_id: s.location_id,
          safety_stock_quantity: s.safety_stock_quantity,
        }));

        const { error: ssError } = await supabase.from("product_safety_stock").insert(safetyStockInserts);

        if (ssError) {
          console.error("Failed to save safety stocks:", ssError);
          toast.error("Product saved but failed to save some safety stock levels");
        }
      }
    }

    toast.success(isEditing ? "Product updated" : "Product created");
    setIsDialogOpen(false);
    await fetchProducts();
    fetchNextProductId();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="relative">
                <ArrowLeft className="w-5 h-5" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">F1</Kbd>
              </Button>
              <div className="flex items-center gap-3">
                <Package className="w-7 h-7 text-amber-500" />
                <h1 className="text-xl font-display font-bold text-foreground">Products</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={() => setShowQueryDialog(true)} title="Search products">
                <Search className="w-4 h-4" />
                <Kbd className="absolute -bottom-1 -right-1 scale-75">⌘F</Kbd>
              </Button>
              <ColumnToggle
                columns={PRODUCT_COLUMNS}
                visibleColumns={visibleColumns}
                onToggleColumn={toggleColumn}
                onResetToDefaults={resetToDefaults}
                onShowAll={showAll}
                onHideAll={hideAll}
              />
              <ImportExportButtons
                importEnabled={isImportEnabled("product")}
                exportEnabled={isExportEnabled("product")}
                entityName="Products"
                onExport={handleExport}
                onImport={handleImport}
                onDownloadTemplate={handleDownloadTemplate}
              />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleOpenDialog} size="icon" className="relative">
                    <Plus className="w-4 h-4" />
                    <Kbd className="absolute -bottom-1 -right-1 scale-75">N</Kbd>
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className={`flex flex-col overflow-hidden transition-all duration-200 ${isMaximized ? "!max-w-none !w-screen !h-screen !max-h-screen !rounded-none !translate-x-[-50%] !translate-y-[-50%]" : "sm:max-w-[900px] max-h-[85vh]"}`}
                >
                  {isEditing && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="absolute right-[4.5rem] top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
                          title="Print Barcode Label"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {formData.upc && (
                          <DropdownMenuItem onClick={() => {
                            import('@/lib/print-label').then(({ printInventoryLabels }) => {
                              printInventoryLabels([{ productId: formData.product_id, productName: formData.name, sku: null, bin: null, area: null, quantity: 0, puNumber: formData.upc }]);
                            });
                          }}>
                            UPC: {formData.upc}
                          </DropdownMenuItem>
                        )}
                        {formData.sku && (
                          <DropdownMenuItem onClick={() => {
                            import('@/lib/print-label').then(({ printInventoryLabels }) => {
                              printInventoryLabels([{ productId: formData.product_id, productName: formData.name, sku: formData.sku, bin: null, area: null, quantity: 0, puNumber: formData.sku }]);
                            });
                          }}>
                            SKU: {formData.sku}
                          </DropdownMenuItem>
                        )}
                        {formData.vendor_id && (
                          <DropdownMenuItem onClick={() => {
                            import('@/lib/print-label').then(({ printInventoryLabels }) => {
                              printInventoryLabels([{ productId: formData.product_id, productName: formData.name, sku: null, bin: null, area: null, quantity: 0, puNumber: formData.vendor_id }]);
                            });
                          }}>
                            Vendor ID: {(() => { const v = plainVendorOptions.find(o => o.value === formData.vendor_id); return v?.sublabel || formData.vendor_id; })()}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => {
                          import('@/lib/print-label').then(({ printInventoryLabels }) => {
                            printInventoryLabels([{ productId: formData.product_id, productName: formData.name, sku: null, bin: null, area: null, quantity: 0, puNumber: formData.product_id }]);
                          });
                        }}>
                          Product ID: {formData.product_id}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="absolute right-10 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
                  >
                    {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                  {!isEditing && (
                    <div className="flex items-start gap-3 absolute top-4 right-[4.5rem] z-10">
                      <Popover open={aiPopoverOpen} onOpenChange={setAiPopoverOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            title="AI Autofill"
                          >
                            <Wand2 className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <h4 className="font-medium text-sm">AI Autofill</h4>
                              <p className="text-xs text-muted-foreground">
                                Describe the product and AI will populate the form fields.
                              </p>
                            </div>
                            <Textarea
                              placeholder="e.g., Industrial steel bolts, M10 x 50mm, sold in boxes of 100, weight 2kg per box..."
                              value={aiDescription}
                              onChange={(e) => setAiDescription(e.target.value)}
                              rows={4}
                            />
                            <Button
                              onClick={handleAiAutofill}
                              disabled={aiLoading || !aiDescription.trim()}
                              className="w-full"
                            >
                              {aiLoading ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Wand2 className="w-4 h-4 mr-2" />
                                  Generate
                                </>
                              )}
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <CopyFromIdDialog<Product>
                        idLabel="Product ID"
                        onFetch={async (id) => {
                          const { data } = await supabase
                            .from("products")
                            .select("*, vendors(name, vendor_id)")
                            .eq("company_id", companyId!)
                            .eq("product_id", id)
                            .maybeSingle();
                          return data;
                        }}
                        onApply={async (product) => {
                          setFormData((prev) => ({
                            ...prev,
                            vendor_id: product.vendor_id || "",
                            vendor_part_number: (product as any).vendor_part_number || "",
                            sku: "", // Don't copy SKU as it should be unique
                            upc: "", // Don't copy UPC as it should be unique
                            name: product.name,
                            description: product.description || "",
                            link: product.link || "",
                            category: product.category || "",
                            price: product.price?.toString() || "",
                            unit: product.unit || "each",
                            is_batched: product.is_batched || false,
                            min_shelf_life_days: product.min_shelf_life_days?.toString() || "",
                            keep_inventory: product.keep_inventory ?? true,
                            is_consumable: product.is_consumable || false,
                            width: product.width?.toString() || "",
                            length: product.length?.toString() || "",
                            height: product.height?.toString() || "",
                            weight: product.weight?.toString() || "",
                            width_uom: product.width_uom || "in",
                            length_uom: product.length_uom || "in",
                            height_uom: product.height_uom || "in",
                            weight_uom: product.weight_uom || "lb",
                          }));

                          // Also copy components if this is a Finished Goods product
                          if (product.category === "Finished Goods") {
                            const { data: componentData } = await supabase
                              .from("product_components")
                              .select(
                                "component_product_id, quantity, uom_id, component_product:products!product_components_component_product_id_fkey(product_id, name, price, unit)",
                              )
                              .eq("parent_product_id", product.id);

                            if (componentData && componentData.length > 0) {
                              // Fetch UoMs for copied components
                              const uniqueIds = [...new Set(componentData.map(c => c.component_product_id))];
                              const uomsByProd: Record<string, { id: string; name: string; abbreviation: string | null; conversion_factor: number }[]> = {};
                              if (uniqueIds.length > 0) {
                                const { data: uomData } = await supabase
                                  .from("product_uoms")
                                  .select("id, product_id, name, abbreviation, conversion_factor")
                                  .in("product_id", uniqueIds);
                                uomData?.forEach(u => {
                                  if (!uomsByProd[u.product_id]) uomsByProd[u.product_id] = [];
                                  uomsByProd[u.product_id].push(u);
                                });
                              }
                              setComponents(
                                componentData.map((c) => ({
                                  component_product_id: c.component_product_id,
                                  quantity: c.quantity?.toString() || "1",
                                  uom_id: (c as any).uom_id || null,
                                  available_uoms: uomsByProd[c.component_product_id] || [],
                                  product: c.component_product as ProductComponent["product"],
                                })),
                              );
                              toast.success(`Copied ${componentData.length} component(s)`);
                            }
                          }
                        }}
                      />
                      <InterconnectProductPicker
                        companyId={companyId}
                        onSelect={(p) => {
                          setFormData((prev) => ({
                            ...prev,
                            vendor_id: p.vendor_id,
                            vendor_part_number: p.product_code,
                            name: p.name,
                            description: p.description || "",
                            link: p.link || "",
                            category: p.category || "",
                            price: p.price?.toString() || "",
                            unit: p.unit || prev.unit,
                            is_batched: p.is_batched ?? false,
                            min_shelf_life_days: p.min_shelf_life_days?.toString() || "",
                            keep_inventory: p.keep_inventory ?? true,
                            is_consumable: p.is_consumable ?? false,
                            width: p.width?.toString() || "",
                            length: p.length?.toString() || "",
                            height: p.height?.toString() || "",
                            weight: p.weight?.toString() || "",
                            width_uom: p.width_uom || "in",
                            length_uom: p.length_uom || "in",
                            height_uom: p.height_uom || "in",
                            weight_uom: p.weight_uom || "lb",
                            transport_time_days: p.transport_time_days?.toString() || "",
                            manufacture_time_days: p.manufacture_time_days?.toString() || "",
                            lead_time_days: p.lead_time_days?.toString() || "",
                            hazardous: p.hazardous ?? false,
                            serialized: p.serialized ?? false,
                            is_pos_available: p.is_pos_available ?? true,
                          }));
                          setUoms(
                            (p.uoms || []).map((u) => ({
                              name: u.name,
                              abbreviation: u.abbreviation || "",
                              conversion_factor: u.conversion_factor?.toString() || "1",
                              lower_uom: u.lower_uom || "",
                            })),
                          );
                          setInterconnectLink({
                            id: p.interconnect_uuid,
                            productId: p.source_product_id,
                            label: `${p.vendor_name} · ${p.product_code}`,
                          });
                          toast.success("Filled from interconnected vendor product");
                        }}
                      />
                    </div>
                  )}
                  <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <DialogHeader className="shrink-0">
                      <DialogTitle>{isEditing ? "Edit Product" : "Add Product"}</DialogTitle>
                      <DialogDescription>
                        {isEditing ? "Update product details." : "Add a new product to your catalog."}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
                      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                        <TabsList
                          className={`grid w-full ${formData.category === "Finished Goods" ? "grid-cols-7" : "grid-cols-6"}`}
                        >
                          <TabsTrigger value="general">General</TabsTrigger>
                          <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
                          <TabsTrigger value="uom">UoM</TabsTrigger>
                          {formData.category === "Finished Goods" && (
                            <TabsTrigger value="components">Components</TabsTrigger>
                          )}
                          <TabsTrigger value="safety-stock">Safety Stock</TabsTrigger>
                          <TabsTrigger value="modifications">Modifications</TabsTrigger>
                          <TabsTrigger value="controls">Controls</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>Product Image</Label>
                            <div className="flex items-center gap-4">
                              <Avatar className="h-20 w-20 rounded-lg border-2 border-border">
                                {imagePreview ? (
                                  <AvatarImage src={imagePreview} alt="Product image" className="object-cover" />
                                ) : (
                                  <AvatarFallback className="rounded-lg bg-muted">
                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => document.getElementById("product-image-upload")?.click()}
                                    disabled={uploadingImage}
                                  >
                                    <Upload className="w-4 h-4 mr-2" />
                                    {imagePreview ? "Change" : "Upload"}
                                  </Button>
                                  {imagePreview && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleRemoveImage}
                                      disabled={uploadingImage}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <X className="w-4 h-4 mr-1" />
                                      Remove
                                    </Button>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Max 5MB.</p>
                              </div>
                              <input
                                id="product-image-upload"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleImageChange}
                                className="hidden"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="product_id">Product ID</Label>
                              <Input
                                id="product_id"
                                value={formData.product_id}
                                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                                disabled={isEditing}
                                className={`${isEditing ? "bg-muted" : ""} ${!isEditing && isProductIdInUse ? "border-destructive border-2" : ""}`}
                                required
                              />
                              {!isEditing && isProductIdInUse && (
                                <p className="text-sm text-destructive flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  This ID is already in use
                                </p>
                              )}
                              {!isEditing && !isProductIdInUse && formData.product_id && (
                                <p className="text-sm text-amber-600 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  ID cannot be changed after creation
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="sku">SKU</Label>
                              <Input
                                id="sku"
                                value={formData.sku}
                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                placeholder="ABC-12345"
                                className={isSkuInUse ? "border-destructive border-2" : ""}
                              />
                              {isSkuInUse && (
                                <p className="text-sm text-destructive flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  This SKU is already in use
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="upc">UPC</Label>
                              <Input
                                id="upc"
                                value={formData.upc}
                                onChange={(e) => setFormData({ ...formData, upc: e.target.value })}
                                placeholder="012345678901"
                              />
                            </div>
                            <div />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="name">Product Name *</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="Widget Pro 3000"
                              required
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-md border px-3 py-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Plug className={`w-4 h-4 ${interconnectLink ? "text-primary" : "text-muted-foreground"}`} />
                              <span className="font-medium">Interconnect</span>
                              <span className="text-muted-foreground">
                                {interconnectLink ? interconnectLink.label : "Not linked"}
                              </span>
                            </div>
                            {interconnectLink && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => setInterconnectLink(null)}>
                                Unlink
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="vendor_id">Vendor (Supplier)</Label>
                              <SearchableSelect
                                options={plainVendorOptions}
                                value={formData.vendor_id}
                                onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
                                placeholder="Select a vendor..."
                                allowClear
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="vendor_part_number">Vendor Part Number</Label>
                              <Input
                                id="vendor_part_number"
                                value={formData.vendor_part_number}
                                onChange={(e) => setFormData({ ...formData, vendor_part_number: e.target.value })}
                                placeholder="Vendor's part/catalog #"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="category">Category</Label>
                              <Select
                                value={formData.category || "none"}
                                onValueChange={(value) =>
                                  setFormData({ ...formData, category: value === "none" ? "" : value })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {PRODUCT_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="unit">Base Unit of Measure</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between font-normal"
                                  >
                                    {formData.unit
                                      ? BASE_UOM_OPTIONS.find((u) => u.value === formData.unit)?.label || formData.unit
                                      : "Select UOM..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search UOM..." />
                                    <CommandList>
                                      <CommandEmpty>No UOM found.</CommandEmpty>
                                      <CommandGroup>
                                        {BASE_UOM_OPTIONS.map((uom) => (
                                          <CommandItem
                                            key={uom.value}
                                            value={uom.label}
                                            onSelect={() => setFormData({ ...formData, unit: uom.value })}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                formData.unit === uom.value ? "opacity-100" : "opacity-0",
                                              )}
                                            />
                                            {uom.label}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="price">Price (per {formData.unit})</Label>
                            <Input
                              id="price"
                              type="number"
                              step="0.01"
                              min="0"
                              value={formData.price}
                              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                              value={formData.status}
                              onValueChange={(value) => setFormData({ ...formData, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PRODUCT_STATUSES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                              id="description"
                              value={formData.description}
                              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                              placeholder="Product description..."
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="link">Link</Label>
                            <Input
                              id="link"
                              type="url"
                              value={formData.link}
                              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                              placeholder="https://..."
                            />
                          </div>
                        </TabsContent>

                        <TabsContent value="dimensions" className="space-y-4 mt-4">
                          <div className="bg-muted/50 rounded-lg p-4 mb-4">
                            <p className="text-sm text-muted-foreground">
                              Enter product dimensions and weight. Volume and surface area are calculated automatically.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="width">Width</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="width"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.width}
                                  onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                                  placeholder="0.00"
                                  className="flex-1"
                                />
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-20 justify-between px-2">
                                      {formData.width_uom}
                                      <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[180px] p-0" align="end">
                                    <Command>
                                      <CommandInput placeholder="Search UoM..." />
                                      <CommandList>
                                        <CommandEmpty>No UoM found.</CommandEmpty>
                                        <CommandGroup>
                                          {DIMENSION_UOMS.map((uom) => (
                                            <CommandItem
                                              key={uom.value}
                                              value={uom.value}
                                              onSelect={() => setFormData({ ...formData, width_uom: uom.value })}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  formData.width_uom === uom.value ? "opacity-100" : "opacity-0",
                                                )}
                                              />
                                              {uom.label}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="length">Length</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="length"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.length}
                                  onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                                  placeholder="0.00"
                                  className="flex-1"
                                />
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-20 justify-between px-2">
                                      {formData.length_uom}
                                      <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[180px] p-0" align="end">
                                    <Command>
                                      <CommandInput placeholder="Search UoM..." />
                                      <CommandList>
                                        <CommandEmpty>No UoM found.</CommandEmpty>
                                        <CommandGroup>
                                          {DIMENSION_UOMS.map((uom) => (
                                            <CommandItem
                                              key={uom.value}
                                              value={uom.value}
                                              onSelect={() => setFormData({ ...formData, length_uom: uom.value })}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  formData.length_uom === uom.value ? "opacity-100" : "opacity-0",
                                                )}
                                              />
                                              {uom.label}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="height">Height</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="height"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.height}
                                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                                  placeholder="0.00"
                                  className="flex-1"
                                />
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-20 justify-between px-2">
                                      {formData.height_uom}
                                      <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[180px] p-0" align="end">
                                    <Command>
                                      <CommandInput placeholder="Search UoM..." />
                                      <CommandList>
                                        <CommandEmpty>No UoM found.</CommandEmpty>
                                        <CommandGroup>
                                          {DIMENSION_UOMS.map((uom) => (
                                            <CommandItem
                                              key={uom.value}
                                              value={uom.value}
                                              onSelect={() => setFormData({ ...formData, height_uom: uom.value })}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  formData.height_uom === uom.value ? "opacity-100" : "opacity-0",
                                                )}
                                              />
                                              {uom.label}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="weight">Weight</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="weight"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={formData.weight}
                                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                  placeholder="0.00"
                                  className="flex-1"
                                />
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-20 justify-between px-2">
                                      {formData.weight_uom}
                                      <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[180px] p-0" align="end">
                                    <Command>
                                      <CommandInput placeholder="Search UoM..." />
                                      <CommandList>
                                        <CommandEmpty>No UoM found.</CommandEmpty>
                                        <CommandGroup>
                                          {WEIGHT_UOMS.map((uom) => (
                                            <CommandItem
                                              key={uom.value}
                                              value={uom.value}
                                              onSelect={() => setFormData({ ...formData, weight_uom: uom.value })}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  formData.weight_uom === uom.value ? "opacity-100" : "opacity-0",
                                                )}
                                              />
                                              {uom.label}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          </div>

                          {formData.width && formData.length && formData.height && (
                            <div className="border rounded-lg p-4 space-y-3">
                              <h4 className="font-medium text-sm">Calculated Values</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">Volume</p>
                                  <p className="text-lg font-semibold">
                                    {(
                                      parseFloat(formData.width) *
                                      parseFloat(formData.length) *
                                      parseFloat(formData.height)
                                    ).toFixed(2)}{" "}
                                    {formData.width_uom}³
                                  </p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground">Surface Area</p>
                                  <p className="text-lg font-semibold">
                                    {(
                                      2 *
                                      (parseFloat(formData.width) * parseFloat(formData.length) +
                                        parseFloat(formData.length) * parseFloat(formData.height) +
                                        parseFloat(formData.height) * parseFloat(formData.width))
                                    ).toFixed(2)}{" "}
                                    {formData.width_uom}²
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="uom" className="space-y-4 mt-4">
                          <div className="bg-muted/50 rounded-lg p-4 mb-4">
                            <p className="text-sm text-muted-foreground">
                              <strong>Base Unit:</strong> {formData.unit}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Add additional units of measure and specify how many base units ({formData.unit}) are in
                              each.
                            </p>
                          </div>

                          {uoms.length > 0 && (
                            <div className="border rounded-lg overflow-hidden mb-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>UOM</TableHead>
                                    <TableHead>Conversion</TableHead>
                                    <TableHead>Base Quantity</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {uoms.map((uom, index) => {
                                    const baseFactor = parseFloat(uom.conversion_factor) || 1;
                                    const lowerLabel = uom.lower_uom || formData.unit;
                                    const lowerEntry = uom.lower_uom && uom.lower_uom !== formData.unit
                                      ? uoms.find((u) => u.abbreviation === uom.lower_uom)
                                      : null;
                                    const lowerBaseFactor = lowerEntry ? (parseFloat(lowerEntry.conversion_factor) || 1) : 1;
                                    const displayFactor = baseFactor / lowerBaseFactor;
                                    return (
                                      <TableRow key={index}>
                                        <TableCell className="font-medium">
                                          {uom.abbreviation} - {uom.name}
                                        </TableCell>
                                        <TableCell>
                                          1 {uom.abbreviation} = {Number.isInteger(displayFactor) ? displayFactor : displayFactor.toFixed(4)} {lowerLabel}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                          {baseFactor} {formData.unit}
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveUom(index)}
                                          >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          <div className="border rounded-lg p-4 space-y-4">
                            <h4 className="font-medium text-sm">Add Unit of Measure</h4>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">UOM *</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="w-full justify-between font-normal"
                                    >
                                      {newUom.abbreviation
                                        ? BASE_UOM_OPTIONS.find((o) => o.value === newUom.abbreviation)?.label ||
                                          newUom.abbreviation
                                        : "Select UOM..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[200px] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Search UOM..." />
                                      <CommandList>
                                        <CommandEmpty>No UOM found.</CommandEmpty>
                                        <CommandGroup>
                                          {BASE_UOM_OPTIONS.map((uom) => (
                                            <CommandItem
                                              key={uom.value}
                                              value={uom.label}
                                              onSelect={() => setNewUom({ ...newUom, abbreviation: uom.value })}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  newUom.abbreviation === uom.value ? "opacity-100" : "opacity-0",
                                                )}
                                              />
                                              {uom.label}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="uom_factor" className="text-xs">
                                  Quantity in lower UOM *
                                </Label>
                                <Input
                                  id="uom_factor"
                                  type="number"
                                  step="0.0001"
                                  min="0.0001"
                                  value={newUom.conversion_factor}
                                  onChange={(e) => setNewUom({ ...newUom, conversion_factor: e.target.value })}
                                  placeholder="e.g., 1000 or 0.001"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Lower UOM</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      className="w-full justify-between font-normal"
                                    >
                                      {newUom.lower_uom
                                        ? uoms.find((u) => u.abbreviation === newUom.lower_uom)?.name ||
                                          BASE_UOM_OPTIONS.find((o) => o.value === newUom.lower_uom)?.label ||
                                          newUom.lower_uom
                                        : formData.unit || "Base UOM"}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[200px] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Search UOM..." />
                                      <CommandList>
                                        <CommandEmpty>No UOM found.</CommandEmpty>
                                        <CommandGroup heading="Product UOMs">
                                          {/* Product's base unit */}
                                          <CommandItem
                                            value={formData.unit || "base"}
                                            onSelect={() => setNewUom({ ...newUom, lower_uom: formData.unit || "" })}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                (newUom.lower_uom === formData.unit || !newUom.lower_uom) ? "opacity-100" : "opacity-0",
                                              )}
                                            />
                                            {formData.unit} - Base Unit
                                          </CommandItem>
                                          {/* Existing product UOMs */}
                                          {uoms.map((uom) => (
                                            <CommandItem
                                              key={uom.abbreviation}
                                              value={uom.name + " " + uom.abbreviation}
                                              onSelect={() => setNewUom({ ...newUom, lower_uom: uom.abbreviation })}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  newUom.lower_uom === uom.abbreviation ? "opacity-100" : "opacity-0",
                                                )}
                                              />
                                              {uom.abbreviation} - {uom.name}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                        <CommandGroup heading="All UOMs">
                                          {BASE_UOM_OPTIONS
                                            .filter((o) => o.value !== formData.unit && !uoms.some((u) => u.abbreviation === o.value))
                                            .map((uom) => (
                                              <CommandItem
                                                key={uom.value}
                                                value={uom.label}
                                                onSelect={() => setNewUom({ ...newUom, lower_uom: uom.value })}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    newUom.lower_uom === uom.value ? "opacity-100" : "opacity-0",
                                                  )}
                                                />
                                                {uom.label}
                                              </CommandItem>
                                            ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {newUom.abbreviation && newUom.conversion_factor ? (
                                <>
                                  1{" "}
                                  {BASE_UOM_OPTIONS.find((o) => o.value === newUom.abbreviation)?.label.split(
                                    " - ",
                                  )[1] || newUom.abbreviation}{" "}
                                  = {newUom.conversion_factor}{" "}
                                  {newUom.lower_uom
                                    ? uoms.find((u) => u.abbreviation === newUom.lower_uom)?.name || newUom.lower_uom
                                    : formData.unit}
                                </>
                              ) : (
                                <>Example: 1 Case = 12 {formData.unit || "Each"}</>
                              )}
                            </p>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddUom}>
                              <Plus className="w-4 h-4 mr-1" />
                              Add UOM
                            </Button>
                          </div>
                        </TabsContent>

                        {formData.category === "Finished Goods" && (
                          <TabsContent value="components" className="space-y-4 mt-4">
                            <div className="bg-muted/50 rounded-lg p-4 mb-4">
                              <p className="text-sm text-muted-foreground">
                                Add component products that make up this finished good.
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Use "Adopt Price" to calculate the total cost based on component quantities and prices.
                              </p>
                            </div>

                            {components.length > 0 && (
                              <div className="border rounded-lg overflow-hidden mb-4">
                                <Table>
                                   <TableHeader>
                                    <TableRow>
                                      <TableHead>Product ID</TableHead>
                                      <TableHead>Name</TableHead>
                                      <TableHead className="text-right">Qty</TableHead>
                                      <TableHead>UoM</TableHead>
                                      <TableHead className="text-right">Unit Price</TableHead>
                                      <TableHead className="text-right">Total</TableHead>
                                      <TableHead className="w-16"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {components.map((comp, index) => {
                                      const qty = parseFloat(comp.quantity) || 0;
                                      const basePrice = comp.product?.price || 0;
                                      const selectedUom = comp.uom_id ? comp.available_uoms.find(u => u.id === comp.uom_id) : null;
                                      const conversionFactor = selectedUom?.conversion_factor || 1;
                                      const price = basePrice / conversionFactor;
                                      const lineTotal = qty * price;
                                      return (
                                        <TableRow key={index}>
                                          <TableCell className="font-mono text-sm">
                                            {comp.product?.product_id || "-"}
                                          </TableCell>
                                          <TableCell className="font-medium">{comp.product?.name || "-"}</TableCell>
                                          <TableCell className="text-right">
                                            <Input
                                              type="number"
                                              step={comp.product?.is_consumable ? "any" : "0.01"}
                                              min={comp.product?.is_consumable ? "0" : "0.01"}
                                              value={comp.quantity}
                                              onChange={(e) => {
                                                const updated = [...components];
                                                updated[index] = { ...updated[index], quantity: e.target.value };
                                                setComponents(updated);
                                              }}
                                              className="w-20 text-right ml-auto"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            {comp.available_uoms && comp.available_uoms.length > 0 ? (
                                              <Select
                                                value={comp.uom_id || "_base"}
                                                onValueChange={(value) => {
                                                  const updated = [...components];
                                                  updated[index] = { ...updated[index], uom_id: value === "_base" ? null : value };
                                                  setComponents(updated);
                                                }}
                                              >
                                                <SelectTrigger className="w-24">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="_base">{comp.product?.unit || "Base"}</SelectItem>
                                                  {comp.available_uoms.map((uom) => (
                                                    <SelectItem key={uom.id} value={uom.id}>
                                                      {uom.abbreviation || uom.name}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <span className="text-sm text-muted-foreground">{comp.product?.unit || "—"}</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            {price ? `$${price.toFixed(2)}` : "-"}
                                          </TableCell>
                                          <TableCell className="text-right font-medium">
                                            ${lineTotal.toFixed(2)}
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleRemoveComponent(index)}
                                            >
                                              <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                    <TableRow className="bg-muted/50">
                                      <TableCell colSpan={5} className="text-right font-medium">
                                        Total:
                                      </TableCell>
                                      <TableCell className="text-right font-bold">
                                        ${calculateComponentsTotal().toFixed(2)}
                                      </TableCell>
                                      <TableCell></TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>
                            )}

                            <div className="border rounded-lg p-4 space-y-4">
                              <h4 className="font-medium text-sm">Add Component</h4>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <Label htmlFor="component_product" className="text-xs">
                                    Product *
                                  </Label>
                                  <SearchableSelect
                                    options={availableComponents.filter(
                                      (opt) => !components.some((c) => c.component_product_id === opt.value),
                                    )}
                                    value={newComponent.product_id}
                                    onValueChange={async (value) => {
                                      setNewComponent({ ...newComponent, product_id: value, uom_id: "" });
                                      if (value) {
                                        const [{ data: uomData }, { data: prodData }] = await Promise.all([
                                          supabase
                                            .from("product_uoms")
                                            .select("id, product_id, name, abbreviation, conversion_factor, lower_uom")
                                            .eq("product_id", value),
                                          supabase
                                            .from("products")
                                            .select("unit, is_consumable")
                                            .eq("id", value)
                                            .single(),
                                        ]);
                                        const baseUnit = prodData?.unit || "";
                                        setNewComponentUoms(deriveAllUoms(uomData || [], baseUnit));
                                        setNewComponentBaseUnit(baseUnit);
                                        setNewComponentConsumable(!!prodData?.is_consumable);
                                      } else {
                                        setNewComponentUoms([]);
                                        setNewComponentBaseUnit("");
                                        setNewComponentConsumable(false);
                                      }
                                    }}
                                    placeholder="Select component product..."
                                    allowClear
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor="component_qty" className="text-xs">
                                    Quantity *
                                  </Label>
                                  <Input
                                    id="component_qty"
                                    type="number"
                                    step={newComponentConsumable ? "any" : "0.01"}
                                    min={newComponentConsumable ? "0" : "0.01"}
                                    value={newComponent.quantity}
                                    onChange={(e) => setNewComponent({ ...newComponent, quantity: e.target.value })}
                                    placeholder="e.g., 2"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor="component_uom" className="text-xs">
                                    UoM
                                  </Label>
                                  <Select
                                    value={newComponent.uom_id || "_base"}
                                    onValueChange={(value) => setNewComponent({ ...newComponent, uom_id: value === "_base" ? "" : value })}
                                    disabled={!newComponent.product_id}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Base unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="_base">{newComponentBaseUnit || "Base unit"}</SelectItem>
                                      {newComponentUoms.map((uom) => (
                                        <SelectItem key={uom.id} value={uom.id}>
                                          {uom.abbreviation || uom.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <Button type="button" variant="outline" size="sm" onClick={handleAddComponent}>
                                <Plus className="w-4 h-4 mr-1" />
                                Add Component
                              </Button>
                            </div>

                            {components.length > 0 && (
                              <div className="flex justify-end">
                                <Button type="button" variant="secondary" onClick={handleAdoptPrice}>
                                  Adopt Price (${calculateComponentsTotal().toFixed(2)})
                                </Button>
                              </div>
                            )}
                          </TabsContent>
                        )}

                        <TabsContent value="modifications" className="space-y-4 mt-4">
                          <div className="bg-muted/50 rounded-lg p-4 mb-4">
                            <p className="text-sm text-muted-foreground">
                              Control whether this product can be modified after creation, and optionally restrict modifications to specific products.
                            </p>
                          </div>

                          <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="allow_modifications" className="text-base">
                                  Allow Modifications
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  Allow this product to be modified after creation
                                </p>
                              </div>
                              <Switch
                                id="allow_modifications"
                                checked={formData.allow_modifications}
                                onCheckedChange={(checked) =>
                                  setFormData({
                                    ...formData,
                                    allow_modifications: checked,
                                    restrict_modifications: checked ? formData.restrict_modifications : false,
                                    restricted_products: checked ? formData.restricted_products : [],
                                  })
                                }
                              />
                            </div>

                            {formData.allow_modifications && (
                              <div className="space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <Label htmlFor="restrict_modifications" className="text-base">
                                      Restrict Products
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                      Limit modifications to specific products only
                                    </p>
                                  </div>
                                  <Switch
                                    id="restrict_modifications"
                                    checked={formData.restrict_modifications}
                                    onCheckedChange={(checked) =>
                                      setFormData({
                                        ...formData,
                                        restrict_modifications: checked,
                                        restricted_products: checked ? formData.restricted_products : [],
                                      })
                                    }
                                  />
                                </div>

                                {formData.restrict_modifications && (
                                  <div className="space-y-3 border-t pt-3">
                                    <Label className="text-sm font-medium">Restricted to Products</Label>
                                    <SearchableSelect
                                      options={products
                                        .filter((p) => !formData.restricted_products.some((r) => r.product_id === p.id))
                                        .map((p) => ({
                                          value: p.id,
                                          label: p.name,
                                          sublabel: p.product_id,
                                        }))}
                                      value=""
                                      onValueChange={async (val) => {
                                        if (!val) return;
                                        // Fetch UoMs for this product if not cached
                                        if (!restrictionUomsCache[val]) {
                                          const { data: uomData } = await supabase
                                            .from("product_uoms")
                                            .select("id, name, abbreviation, conversion_factor, lower_uom")
                                            .eq("product_id", val);
                                          const selectedProduct = products.find((p) => p.id === val);
                                          const derived = deriveAllUoms(uomData || [], selectedProduct?.unit || "");
                                          setRestrictionUomsCache((prev) => ({ ...prev, [val]: derived }));
                                        }
                                        setFormData((prev) => {
                                          if (prev.restricted_products.some((r) => r.product_id === val)) return prev;
                                          return {
                                            ...prev,
                                            restricted_products: [
                                              ...prev.restricted_products,
                                              { product_id: val, quantity: "1", uom_id: "" },
                                            ],
                                          };
                                        });
                                      }}
                                      placeholder="Search and add a product..."
                                      emptyMessage="No products found."
                                    />
                                    {formData.restricted_products.length > 0 && (
                                      <div className="space-y-2 mt-2">
                                        {formData.restricted_products.map((entry, idx) => {
                                          const p = products.find((x) => x.id === entry.product_id);
                                          const entryUoms = restrictionUomsCache[entry.product_id] || [];
                                          return p ? (
                                            <div key={entry.product_id} className="flex items-center gap-2 border rounded-md p-2">
                                              <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                                              <Input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={entry.quantity}
                                                onChange={(e) => {
                                                  const updated = [...formData.restricted_products];
                                                  updated[idx] = { ...updated[idx], quantity: e.target.value };
                                                  setFormData({ ...formData, restricted_products: updated });
                                                }}
                                                className="w-20 h-8 text-sm"
                                                placeholder="Qty"
                                              />
                                               <Select
                                                  value={entry.uom_id || "base"}
                                                  onValueChange={(val) => {
                                                    const updated = [...formData.restricted_products];
                                                    updated[idx] = { ...updated[idx], uom_id: val === "base" ? "" : val };
                                                    setFormData({ ...formData, restricted_products: updated });
                                                  }}
                                                >
                                                  <SelectTrigger className="w-28 h-8 text-sm">
                                                    <SelectValue placeholder={p.unit || "Unit"} />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="base">{p.unit || "Base"}</SelectItem>
                                                    {entryUoms.map((u) => (
                                                      <SelectItem key={u.id} value={u.id}>
                                                        {u.abbreviation || u.name}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setFormData({
                                                    ...formData,
                                                    restricted_products: formData.restricted_products.filter(
                                                      (r) => r.product_id !== entry.product_id,
                                                    ),
                                                  })
                                                }
                                                className="text-muted-foreground hover:text-destructive"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                            </div>
                                          ) : null;
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="controls" className="space-y-4 mt-4">

                          <div className="bg-muted/50 rounded-lg p-4 mb-4">
                            <p className="text-sm text-muted-foreground">
                              Configure lead times and inventory controls for this product.
                            </p>
                          </div>

                          {/* Lead Times */}
                          <div className="border rounded-lg p-4 space-y-4">
                            <h4 className="font-medium text-sm">Lead Times (days)</h4>
                            <div className="grid grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="transport_time_days">Transport Time</Label>
                                <Input
                                  id="transport_time_days"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={formData.transport_time_days}
                                  onChange={(e) => setFormData({ ...formData, transport_time_days: e.target.value })}
                                  placeholder="0"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="manufacture_time_days">Manufacture Time</Label>
                                <Input
                                  id="manufacture_time_days"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={formData.manufacture_time_days}
                                  onChange={(e) => setFormData({ ...formData, manufacture_time_days: e.target.value })}
                                  placeholder="0"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="lead_time_days">General Lead Time</Label>
                                <Input
                                  id="lead_time_days"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={formData.lead_time_days}
                                  onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="keep_inventory" className="text-base">
                                  Keep Inventory
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  Track this product in inventory when received
                                </p>
                              </div>
                              <Switch
                                id="keep_inventory"
                                checked={formData.keep_inventory}
                                onCheckedChange={(checked) => setFormData({ ...formData, keep_inventory: checked })}
                              />
                            </div>

                            {!formData.keep_inventory && (
                              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                                When disabled, receiving this product will not create a Goods Receipt or add to
                                inventory. The delivery/PO will simply be marked as delivered.
                              </p>
                            )}
                          </div>

                          <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="is_consumable" className="text-base">
                                  Consumable
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  Allow partial/fractional quantities for orders and withdrawals
                                </p>
                              </div>
                              <Switch
                                id="is_consumable"
                                checked={formData.is_consumable}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_consumable: checked })}
                              />
                            </div>

                            {formData.is_consumable && (
                              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                Useful for raw materials like fabric, liquids, or bulk goods that can be ordered and
                                issued in partial quantities (e.g., 2.5 meters, 0.75 liters).
                              </p>
                            )}
                          </div>

                          <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="hazardous" className="text-base">
                                  Hazardous
                                </Label>
                                <p className="text-sm text-muted-foreground">Mark this product as hazardous material</p>
                              </div>
                              <Switch
                                id="hazardous"
                                checked={formData.hazardous}
                                onCheckedChange={(checked) => setFormData({ ...formData, hazardous: checked })}
                              />
                            </div>

                            {formData.hazardous && (
                              <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                                This product will be flagged as hazardous material. Special handling and documentation
                                may be required.
                              </p>
                            )}
                          </div>

                          <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="serialized" className="text-base">
                                  Serialized
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  Track individual serial numbers at the base unit of measure
                                </p>
                              </div>
                              <Switch
                                id="serialized"
                                checked={formData.serialized}
                                onCheckedChange={(checked) => setFormData({ ...formData, serialized: checked })}
                              />
                            </div>

                            {formData.serialized && (
                              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                Each unit of this product will require a unique serial number for tracking through
                                receiving, inventory, and issuing.
                              </p>
                            )}
                          </div>

                          <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="is_pos_available" className="text-base">
                                  Available in POS
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  Show this product in Point of Sale terminals
                                </p>
                              </div>
                              <Switch
                                id="is_pos_available"
                                checked={formData.is_pos_available}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_pos_available: checked })}
                              />
                            </div>

                            {!formData.is_pos_available && (
                              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                This product will be hidden from all POS terminals regardless of location settings.
                              </p>
                            )}
                          </div>

                          <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="is_interconnect_available" className="text-base">
                                  Available in Interconnect
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  Let interconnected companies add this product from their side
                                </p>
                              </div>
                              <Switch
                                id="is_interconnect_available"
                                checked={formData.is_interconnect_available}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_interconnect_available: checked })}
                              />
                            </div>

                            {!formData.is_interconnect_available && (
                              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                This product will not appear in interconnect product searches for connected companies.
                              </p>
                            )}
                          </div>

                          <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="is_batched" className="text-base">
                                  Batched
                                </Label>
                                <p className="text-sm text-muted-foreground">Enable batch tracking for this product</p>
                              </div>
                              <Switch
                                id="is_batched"
                                checked={formData.is_batched}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_batched: checked })}
                              />
                            </div>

                            {formData.is_batched && (
                              <div className="pt-4 border-t space-y-2">
                                <Label htmlFor="min_shelf_life_days">Minimum Shelf Life (days)</Label>
                                <Input
                                  id="min_shelf_life_days"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={formData.min_shelf_life_days}
                                  onChange={(e) => setFormData({ ...formData, min_shelf_life_days: e.target.value })}
                                  placeholder="e.g., 30"
                                  className="w-40"
                                />
                                <p className="text-xs text-muted-foreground">
                                  The minimum number of days of remaining shelf life required for this product.
                                </p>
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="safety-stock">
                          <SafetyStockTab
                            productId={editingId}
                            companyId={companyId!}
                            isEditing={isEditing}
                            safetyStocks={safetyStocks}
                            setSafetyStocks={setSafetyStocks}
                          />
                        </TabsContent>
                      </Tabs>
                    </div>

                    <DialogFooter className="shrink-0 px-6 sticky bottom-0 pt-4">
                      <Button type="submit" disabled={isProductIdInUse || !!isSkuInUse}>
                        {isEditing ? "Update" : "Create"}
                        <Kbd className="ml-2">⌘S</Kbd>
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-4">Add your first product to get started.</p>
            <Button onClick={handleOpenDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        ) : (
          <ProductTable
            products={products}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleEdit}
            onStatusChange={requestStatusChange}
            onFilteredDataChange={handleFilteredDataChange}
            isColumnVisible={isColumnVisible}
            showImages={showProductImages}
          />
        )}
      </main>
      <AppLoadQueryDialog
        open={showQueryDialog}
        onClose={() => setShowQueryDialog(false)}
        onQuery={handleQueryDialogQuery}
        onLoadAll={handleQueryDialogLoadAll}
        fields={PRODUCT_QUERY_FIELDS}
        title="Load Products"
        loading={queryLoading}
      />
      <AlertDialog open={!!statusChangeTarget} onOpenChange={(o) => !o && setStatusChangeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Product Status</AlertDialogTitle>
            <AlertDialogDescription>
              {statusChangeTarget && (
                <>
                  Change status of <strong>{statusChangeTarget.product.name}</strong> from{" "}
                  <strong>{PRODUCT_STATUSES.find(s => s.value === statusChangeTarget.product.status)?.label}</strong> to{" "}
                  <strong>{PRODUCT_STATUSES.find(s => s.value === statusChangeTarget.newStatus)?.label}</strong>?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
