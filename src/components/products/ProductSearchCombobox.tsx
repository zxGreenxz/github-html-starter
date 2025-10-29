import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";
import { applyMultiKeywordSearch } from "@/lib/search-utils";
import { ProductImage } from "./ProductImage";

interface Product {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  product_images?: string[];
  tpos_image_url?: string;
  tpos_product_id?: number;
  base_product_code?: string;
}

interface ProductSearchComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ProductSearchCombobox({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Nhập mã sản phẩm (DefaultCode)"
}: ProductSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-search", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, product_code, product_name, variant, product_images, tpos_image_url, tpos_product_id, base_product_code")
        .order("created_at", { ascending: false })
        .limit(20);

      // Nếu có search query, filter theo keyword
      if (debouncedSearch.trim().length > 0) {
        query = applyMultiKeywordSearch(
          query,
          debouncedSearch,
          ['product_code', 'product_name', 'variant', 'barcode']
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: open, // Load khi dropdown mở
  });

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setSearchQuery(""); // Clear search sau khi chọn
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <input
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={placeholder}
              value={value}
              onChange={(e) => {
                onValueChange(e.target.value);
                setSearchQuery(e.target.value);
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              disabled={disabled}
            />
            <ChevronsUpDown className="absolute right-3 top-3 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[600px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandList>
              <CommandEmpty>
                {isLoading
                  ? "Đang tìm kiếm..."
                  : "Không tìm thấy sản phẩm trong kho"}
              </CommandEmpty>
              <CommandGroup>
                {products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.product_code}
                    onSelect={() => handleSelect(product.product_code)}
                    className="flex items-center gap-3 py-2"
                  >
                    <div className="h-10 w-10 flex-shrink-0">
                      <ProductImage
                        productId={product.id}
                        productCode={product.product_code}
                        productImages={product.product_images}
                        tposImageUrl={product.tpos_image_url}
                        tposProductId={product.tpos_product_id}
                        baseProductCode={product.base_product_code}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{product.product_code}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {product.product_name}
                        {product.variant && ` - ${product.variant}`}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4 flex-shrink-0",
                        value === product.product_code ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
