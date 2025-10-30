import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { searchTPOSProductByCode, getTPOSProductFullDetails, type TPOSProductFullDetails } from "@/lib/tpos-api";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchProductForTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductSelected: (productDetails: TPOSProductFullDetails) => void;
}

export function SearchProductForTransferDialog({
  open,
  onOpenChange,
  onProductSelected,
}: SearchProductForTransferDialogProps) {
  const [productCode, setProductCode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Fetch parent products with variants from local database
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["parent-products-with-variants", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .not("variant", "is", null)
        .neq("variant", "");

      // Filter for parent products only (product_code === base_product_code)
      if (debouncedSearch) {
        query = query.or(
          `product_code.ilike.%${debouncedSearch}%,product_name.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Filter to only parent products
      return (data || []).filter(
        (p) => p.product_code === p.base_product_code && p.tpos_product_id
      );
    },
    enabled: open,
  });

  const handleSearch = async () => {
    const trimmedCode = productCode.trim();
    
    if (!trimmedCode) {
      toast.error("Vui lòng nhập mã sản phẩm");
      return;
    }

    setIsSearching(true);

    try {
      console.log(`🔍 [Step 1] Searching product by code: ${trimmedCode}`);
      
      // Search product by code
      const searchResult = await searchTPOSProductByCode(trimmedCode);
      
      if (!searchResult) {
        toast.error("Không tìm thấy sản phẩm với mã này trên TPOS");
        setIsSearching(false);
        return;
      }

      console.log(`✅ [Step 1] Product found, ID: ${searchResult.Id}`);

      // Fetch full details including variants
      const fullDetails = await getTPOSProductFullDetails(searchResult.Id);

      if (!fullDetails.ProductVariants || fullDetails.ProductVariants.length === 0) {
        toast.error("Sản phẩm này không có biến thể để chuyển đổi");
        setIsSearching(false);
        return;
      }

      console.log(`✅ [Step 1] Full details fetched with ${fullDetails.ProductVariants.length} variants`);

      toast.success(`Đã tìm thấy sản phẩm: ${fullDetails.Name}`);
      onProductSelected(fullDetails);
      onOpenChange(false);
      setProductCode("");
      setSearchTerm("");
    } catch (error: any) {
      console.error("❌ [Step 1] Search failed:", error);
      toast.error(error.message || "Lỗi khi tìm kiếm sản phẩm từ TPOS");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleRowClick = (product: any) => {
    setProductCode(product.product_code);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tìm sản phẩm để đổi size</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="productCode">Nhập mã sản phẩm:</Label>
            <div className="flex gap-2">
              <Input
                id="productCode"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ví dụ: SP001"
                disabled={isSearching}
                autoFocus
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Search className="mr-2 h-4 w-4" />
                Chọn
              </Button>
            </div>
          </div>

          {/* Filter Table */}
          <div className="space-y-2">
            <Label htmlFor="searchTable">Hoặc tìm từ danh sách sản phẩm cha:</Label>
            <Input
              id="searchTable"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo mã hoặc tên sản phẩm..."
              disabled={isSearching}
            />
          </div>

          {/* Products Table */}
          <div className="border rounded-lg max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã SP</TableHead>
                  <TableHead>Tên sản phẩm</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Nhà cung cấp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Không tìm thấy sản phẩm cha có biến thể
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(product)}
                    >
                      <TableCell className="font-medium">{product.product_code}</TableCell>
                      <TableCell>{product.product_name}</TableCell>
                      <TableCell>{product.variant}</TableCell>
                      <TableCell>{product.supplier_name || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
            💡 <strong>Gợi ý:</strong> Click vào dòng sản phẩm trong bảng để tự động điền mã, 
            sau đó nhấn nút "Chọn" để lấy thông tin chi tiết từ TPOS.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
