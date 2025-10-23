import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, ChevronUp, Loader2, Search, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FacebookComment } from "@/types/facebook";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { toVietnamTime, nowVietnamISO } from "@/lib/date-utils";
import { applyMultiKeywordSearch } from "@/lib/search-utils";
import { ZoomableImage } from "@/components/products/ZoomableImage";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ScannedBarcode {
  code: string;
  timestamp: string;
  productInfo?: {
    id: string;
    name: string;
    image_url?: string;
    product_code: string;
  };
}

interface InlineProductSelectorProps {
  comment: FacebookComment;
  scannedBarcodes: ScannedBarcode[];
  onProductSelect: (product: ScannedBarcode) => void;
  onRemoveProduct?: (productCode: string) => void;
  onAddToScannedList?: (product: ScannedBarcode) => Promise<void>;
  onClose: () => void;
  isMobile?: boolean;
}

const formatTimeDiff = (commentTime: string, scanTime: string): string => {
  // Convert both times to GMT+7 before calculating difference
  const commentVN = toVietnamTime(commentTime);
  const scanVN = toVietnamTime(scanTime);
  
  const diff = Math.abs(commentVN.getTime() - scanVN.getTime());
  const seconds = Math.floor(diff / 1000);
  
  if (seconds === 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}p`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h${minutes % 60}p`;
};

// ============================================================================
// SORTABLE PRODUCT ITEM
// ============================================================================

interface SortableProductItemProps {
  product: ScannedBarcode;
  index: number;
  onProductSelect: (product: ScannedBarcode) => void;
  onRemoveProduct?: (productCode: string) => void;
  commentTime: string;
  isMobile: boolean;
}

function SortableProductItem({
  product,
  index,
  onProductSelect,
  onRemoveProduct,
  commentTime,
  isMobile,
}: SortableProductItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.code });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded border hover:border-purple-300 dark:hover:border-purple-700 transition-all",
        index < 3 && "border-purple-200 dark:border-purple-800",
        isDragging && "shadow-lg z-50"
      )}
    >
      {/* Select Button - First for easy access */}
      <Button 
        size="sm"
        className={cn(
          "flex-shrink-0 bg-purple-600 hover:bg-purple-700 text-white",
          isMobile ? "h-7 text-xs px-2" : "h-8 text-xs px-3"
        )}
        onClick={() => onProductSelect(product)}
      >
        Chọn
      </Button>

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded p-1 transition-colors flex-shrink-0"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Suggestion badge for top 3 */}
      {index < 3 && (
        <Badge className={cn(
          "bg-amber-500 text-white px-1.5 py-0 flex-shrink-0",
          isMobile ? "text-[9px]" : "text-xs"
        )}>
          ✨
        </Badge>
      )}
      
      {/* Product thumbnail */}
      <ZoomableImage
        src={product.productInfo?.image_url}
        alt={product.productInfo?.name || "Product"}
        size="sm"
      />
      
      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-semibold truncate text-foreground",
          isMobile ? "text-xs" : "text-sm"
        )}>
          {product.productInfo?.name}
        </p>
        <p className={cn(
          "text-muted-foreground truncate",
          isMobile ? "text-[10px]" : "text-xs"
        )}>
          {product.productInfo?.product_code} • {formatTimeDiff(commentTime, product.timestamp)}
        </p>
      </div>
      
      {/* Remove button */}
      {onRemoveProduct && (
        <Button 
          size="sm"
          variant="ghost"
          className={cn(
            "flex-shrink-0 hover:bg-red-100 hover:text-red-600",
            isMobile ? "h-7 w-7 p-0" : "h-8 w-8 p-0"
          )}
          onClick={() => onRemoveProduct(product.code)}
          aria-label="Xóa sản phẩm"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function InlineProductSelector({
  comment,
  scannedBarcodes,
  onProductSelect,
  onRemoveProduct,
  onAddToScannedList,
  onClose,
  isMobile = false,
}: InlineProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [sortedProducts, setSortedProducts] = useState<ScannedBarcode[]>([]);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Long press for mobile
        tolerance: 5,
      },
    })
  );

  // Filter and sort scannedBarcodes based on search query
  const filteredAndSortedProducts = useMemo(() => {
    const commentTime = new Date(comment.created_time).getTime();
    
    let filtered = [...scannedBarcodes].filter(b => b.productInfo);
    
    // Apply search filter
    if (debouncedSearchQuery) {
      const search = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.productInfo?.product_code.toLowerCase().includes(search) ||
        b.productInfo?.name.toLowerCase().includes(search)
      );
    }
    
    // Sort by time difference from comment (closest first)
    return filtered.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      
      const aDiff = Math.abs(commentTime - aTime);
      const bDiff = Math.abs(commentTime - bTime);
      
      return aDiff - bDiff;
    });
  }, [scannedBarcodes, comment.created_time, debouncedSearchQuery]);

  // Use sorted products if available, otherwise use filtered products
  const displayProducts = sortedProducts.length > 0 ? sortedProducts : filteredAndSortedProducts;

  // Reset sorted products when search query changes
  useEffect(() => {
    setSortedProducts([]);
  }, [debouncedSearchQuery]);

  // Initialize sortedProducts when filteredAndSortedProducts changes
  useEffect(() => {
    if (filteredAndSortedProducts.length > 0 && sortedProducts.length === 0) {
      setSortedProducts(filteredAndSortedProducts);
    }
  }, [filteredAndSortedProducts]);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    setSortedProducts((items) => {
      const oldIndex = items.findIndex((item) => item.code === active.id);
      const newIndex = items.findIndex((item) => item.code === over.id);
      
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  // Fetch from inventory when search is active and no results in scannedBarcodes
  const { data: inventoryProducts, isLoading: isInventoryLoading } = useQuery({
    queryKey: ["inline-inventory-search", debouncedSearchQuery],
    queryFn: async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.trim().length < 2) {
        return [];
      }
      
      const searchTerm = debouncedSearchQuery.trim();
      let query = supabase
        .from("products")
        .select("id, product_code, product_name, product_images, tpos_image_url, barcode, created_at");
      
      // Apply multi-keyword search: product_name (primary), product_code, barcode
      query = applyMultiKeywordSearch(query, searchTerm, ['product_name', 'product_code', 'barcode']);
      
      // Sort by created_at descending (newest first)
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedSearchQuery.length >= 2 && filteredAndSortedProducts.length === 0,
  });

  const handleSelectInventoryProduct = async (product: any) => {
    if (onAddToScannedList) {
      const scannedProduct: ScannedBarcode = {
        code: product.product_code,
        timestamp: nowVietnamISO(),
        productInfo: {
          id: product.id,
          name: product.product_name,
          image_url: product.tpos_image_url || (product.product_images && product.product_images[0]),
          product_code: product.product_code,
        },
      };
      
      await onAddToScannedList(scannedProduct);
      // Tự động chọn sản phẩm cho comment luôn
      onProductSelect(scannedProduct);
      setSearchQuery("");
    }
  };

  const hasScannedProducts = scannedBarcodes.some(b => b.productInfo);
  const showInventoryResults = debouncedSearchQuery.length >= 2 && 
                               filteredAndSortedProducts.length === 0 && 
                               inventoryProducts && 
                               inventoryProducts.length > 0;

  return (
    <div className="border-t border-l-4 border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20 p-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span className={cn(
            "font-semibold text-purple-900 dark:text-purple-100",
            isMobile ? "text-xs" : "text-sm"
          )}>
            Chọn sản phẩm {hasScannedProducts && `(${filteredAndSortedProducts.length})`}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose}
          className="h-6 w-6 p-0 hover:bg-purple-100 dark:hover:bg-purple-900"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm sản phẩm..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-9 text-sm"
        />
      </div>

      {/* Products List */}
      <ScrollArea className="h-[300px] w-full">
        <div className="space-y-2 pr-4">
          {/* Scanned Products Section - Draggable */}
          {displayProducts.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayProducts.map(p => p.code)}
                strategy={verticalListSortingStrategy}
              >
                {displayProducts.map((product, index) => (
                  <SortableProductItem
                    key={product.code}
                    product={product}
                    index={index}
                    onProductSelect={onProductSelect}
                    onRemoveProduct={onRemoveProduct}
                    commentTime={comment.created_time}
                    isMobile={isMobile}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {/* Inventory Products Section */}
          {showInventoryResults && (
            <>
              {inventoryProducts.map((product) => (
                <div 
                  key={product.id}
                  className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded border border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  {/* Inventory badge */}
                  <Badge className={cn(
                    "bg-blue-500 text-white px-1.5 py-0 flex-shrink-0",
                    isMobile ? "text-[9px]" : "text-xs"
                  )}>
                    Kho
                  </Badge>
                  
                  {/* Product thumbnail */}
                  <ZoomableImage
                    src={product.tpos_image_url || (product.product_images && product.product_images[0])}
                    alt={product.product_name}
                    size="sm"
                  />
                  
                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-semibold truncate text-foreground",
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      {product.product_name}
                    </p>
                    <p className={cn(
                      "text-muted-foreground truncate",
                      isMobile ? "text-[10px]" : "text-xs"
                    )}>
                      {product.product_code}
                    </p>
                  </div>
                  
                  {/* Action button */}
                  <Button 
                    size="sm"
                    className={cn(
                      "flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white",
                      isMobile ? "h-7 text-xs px-2" : "h-8 text-xs px-3"
                    )}
                    onClick={() => handleSelectInventoryProduct(product)}
                  >
                    Chọn
                  </Button>
                </div>
              ))}
            </>
          )}

          {/* Empty States */}
          {!hasScannedProducts && !debouncedSearchQuery && (
            <div className="text-center py-6 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Chưa có sản phẩm nào được scan</p>
              <p className="text-xs">Quét barcode hoặc tìm kiếm để thêm sản phẩm</p>
            </div>
          )}

          {debouncedSearchQuery && filteredAndSortedProducts.length === 0 && !showInventoryResults && (
            <div className="text-center py-6 text-muted-foreground">
              {isInventoryLoading ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : (
                <>
                  <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Không tìm thấy sản phẩm</p>
                  <p className="text-xs">Thử từ khóa khác</p>
                </>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
