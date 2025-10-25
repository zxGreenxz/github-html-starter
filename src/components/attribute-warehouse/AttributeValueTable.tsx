import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { useProductAttributes, type ProductAttributeValue } from "@/hooks/use-product-attributes";
import { formatVND } from "@/lib/currency-utils";

interface EnrichedAttributeValue extends ProductAttributeValue {
  attributeName: string;
}

interface AttributeValueTableProps {
  values: EnrichedAttributeValue[];
  isLoading: boolean;
  onEdit: (value: EnrichedAttributeValue) => void;
}

type SortColumn = 'attributeName' | 'value' | 'code' | 'created_at';
type SortDirection = 'asc' | 'desc';

export function AttributeValueTable({ values, isLoading, onEdit }: AttributeValueTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { deleteAttributeValue } = useProductAttributes();

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedValues = [...values].sort((a, b) => {
    let aVal: any = a[sortColumn];
    let bVal: any = b[sortColumn];

    if (sortColumn === 'created_at') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' 
        ? aVal - bVal
        : bVal - aVal;
    }

    return 0;
  });

  const handleDelete = () => {
    if (deleteId) {
      deleteAttributeValue.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4 inline ml-1" />
      : <ChevronDown className="h-4 w-4 inline ml-1" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Đang tải...</div>
      </div>
    );
  }

  if (values.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-muted-foreground">Không tìm thấy giá trị nào</p>
        <p className="text-sm text-muted-foreground mt-1">
          Thử thay đổi bộ lọc hoặc thêm giá trị mới
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                onClick={() => handleSort('attributeName')} 
                className="cursor-pointer hover:bg-muted/50"
              >
                Thuộc tính <SortIcon column="attributeName" />
              </TableHead>
              <TableHead 
                onClick={() => handleSort('value')} 
                className="cursor-pointer hover:bg-muted/50"
              >
                Giá trị <SortIcon column="value" />
              </TableHead>
              <TableHead 
                onClick={() => handleSort('code')} 
                className="cursor-pointer hover:bg-muted/50"
              >
                Mã <SortIcon column="code" />
              </TableHead>
              <TableHead>Phụ thu</TableHead>
              <TableHead 
                onClick={() => handleSort('created_at')} 
                className="cursor-pointer hover:bg-muted/50"
              >
                Ngày tạo <SortIcon column="created_at" />
              </TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedValues.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.attributeName}</TableCell>
                <TableCell>{item.value}</TableCell>
                <TableCell className="text-muted-foreground">
                  {item.code || '-'}
                </TableCell>
                <TableCell>
                  {item.price_extra && item.price_extra > 0 
                    ? `+${formatVND(item.price_extra)}` 
                    : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => onEdit(item)}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => setDeleteId(item.id)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa giá trị thuộc tính này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
