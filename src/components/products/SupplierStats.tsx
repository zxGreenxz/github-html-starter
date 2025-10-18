import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  RefreshCw,
  Store,
  Package,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatVND } from "@/lib/currency-utils";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface SupplierStat {
  supplier_name: string;
  total_products: number;
  total_inventory_value: number;
  out_of_stock_count: number;
  low_stock_count: number;
  avg_stock: number;
}

type SortField = 'supplier_name' | 'total_products' | 'total_inventory_value' | 'avg_stock';
type SortDirection = 'asc' | 'desc';

interface SupplierStatsProps {
  onSupplierClick?: (supplierName: string) => void;
}

export function SupplierStats({ onSupplierClick }: SupplierStatsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>('supplier_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Fetch supplier stats
  const { data: supplierStats, isLoading, refetch } = useQuery({
    queryKey: ["supplier-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_supplier_stats");
      if (error) throw error;
      return (data || []) as SupplierStat[];
    },
  });

  // Update missing suppliers mutation
  const updateMissingSuppliersMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("update_missing_suppliers");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (updatedCount) => {
      toast({
        title: "Cập nhật thành công",
        description: `Đã cập nhật ${updatedCount} sản phẩm với thông tin nhà bán hàng.`,
      });
      queryClient.invalidateQueries({ queryKey: ["supplier-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: `Không thể cập nhật: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Filter and sort stats
  const filteredStats = (supplierStats || [])
    .filter((stat) =>
      stat.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const direction = sortDirection === 'asc' ? 1 : -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * direction;
      }
      return ((aValue as number) - (bValue as number)) * direction;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  // Mobile Card View
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Tìm nhà bán hàng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => updateMissingSuppliersMutation.mutate()}
            disabled={updateMissingSuppliersMutation.isPending}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${updateMissingSuppliersMutation.isPending ? 'animate-spin' : ''}`} />
            Cập nhật NCC thiếu
          </Button>
        </div>

        <div className="space-y-3">
          {filteredStats.map((stat) => (
            <Card
              key={stat.supplier_name}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSupplierClick?.(stat.supplier_name)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{stat.supplier_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {stat.total_products} sản phẩm
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Giá trị tồn</p>
                  <p className="font-semibold">{formatVND(stat.total_inventory_value)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tồn TB</p>
                  <p className="font-semibold">{stat.avg_stock.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hết hàng</p>
                  <Badge variant="outline" className="text-orange-600">
                    {stat.out_of_stock_count}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Sắp hết</p>
                  <Badge variant="outline" className="text-yellow-600">
                    {stat.low_stock_count}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredStats.length === 0 && (
          <div className="text-center py-12">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {searchTerm ? "Không tìm thấy nhà bán hàng" : "Chưa có dữ liệu"}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Desktop Table View
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Tìm nhà bán hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => updateMissingSuppliersMutation.mutate()}
          disabled={updateMissingSuppliersMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${updateMissingSuppliersMutation.isPending ? 'animate-spin' : ''}`} />
          Cập nhật NCC thiếu
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('supplier_name')}
              >
                <div className="flex items-center">
                  <Store className="h-4 w-4 mr-2" />
                  Nhà bán hàng
                  <SortIcon field="supplier_name" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('total_products')}
              >
                <div className="flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Số SP
                  <SortIcon field="total_products" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('total_inventory_value')}
              >
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Giá trị tồn kho
                  <SortIcon field="total_inventory_value" />
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Hết hàng
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Sắp hết
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('avg_stock')}
              >
                <div className="flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Tồn TB
                  <SortIcon field="avg_stock" />
                </div>
              </TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStats.map((stat) => (
              <TableRow 
                key={stat.supplier_name}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSupplierClick?.(stat.supplier_name)}
              >
                <TableCell className="font-medium">
                  <Badge variant="outline" className="text-base">
                    {stat.supplier_name}
                  </Badge>
                </TableCell>
                <TableCell>{stat.total_products}</TableCell>
                <TableCell className="font-semibold">
                  {formatVND(stat.total_inventory_value)}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={stat.out_of_stock_count > 0 ? "destructive" : "outline"}
                  >
                    {stat.out_of_stock_count}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={stat.low_stock_count > 0 ? "outline" : "outline"}
                    className={stat.low_stock_count > 0 ? "text-yellow-600" : ""}
                  >
                    {stat.low_stock_count}
                  </Badge>
                </TableCell>
                <TableCell>{stat.avg_stock.toFixed(1)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSupplierClick?.(stat.supplier_name);
                    }}
                  >
                    Xem SP
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredStats.length === 0 && (
          <div className="text-center py-12">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {searchTerm ? "Không tìm thấy nhà bán hàng" : "Chưa có dữ liệu"}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
