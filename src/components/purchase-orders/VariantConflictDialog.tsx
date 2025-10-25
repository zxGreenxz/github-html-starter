import { useState, useEffect, Fragment } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export interface VariantConflict {
  product_code: string;
  variant_name: string;
  old_data: Record<string, any>;
  new_data: Record<string, any>;
  diff_fields: string[];
}

export interface ResolvedUpdate {
  product_code: string;
  fields_to_update: string[];
}

interface VariantConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: VariantConflict[];
  onResolve: (selectedUpdates: ResolvedUpdate[]) => void;
}

const FIELD_LABELS: Record<string, string> = {
  selling_price: "Giá bán",
  purchase_price: "Giá nhập",
  barcode: "Mã vạch",
  stock_quantity: "Tồn kho",
  product_name: "Tên sản phẩm",
  variant: "Biến thể"
};

export function VariantConflictDialog({ 
  open, 
  onOpenChange, 
  conflicts,
  onResolve 
}: VariantConflictDialogProps) {
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Map<string, Set<string>>>(new Map());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Initialize: tick all variants and all diff fields
  useEffect(() => {
    if (open && conflicts.length > 0) {
      const allCodes = new Set(conflicts.map(c => c.product_code));
      setSelectedVariants(allCodes);
      
      const allFields = new Map();
      conflicts.forEach(conflict => {
        allFields.set(conflict.product_code, new Set(conflict.diff_fields));
      });
      setSelectedFields(allFields);
    }
  }, [open, conflicts]);
  
  const handleUpdateAll = () => {
    const allCodes = new Set(conflicts.map(c => c.product_code));
    setSelectedVariants(allCodes);
    
    const allFields = new Map();
    conflicts.forEach(conflict => {
      allFields.set(conflict.product_code, new Set(conflict.diff_fields));
    });
    setSelectedFields(allFields);
  };
  
  const handleSkipAll = () => {
    onOpenChange(false);
  };
  
  const handleConfirm = () => {
    const resolved: ResolvedUpdate[] = [];
    
    for (const variantCode of selectedVariants) {
      const fields = selectedFields.get(variantCode);
      if (fields && fields.size > 0) {
        resolved.push({
          product_code: variantCode,
          fields_to_update: Array.from(fields)
        });
      }
    }
    
    onResolve(resolved);
    onOpenChange(false);
  };
  
  const formatValue = (field: string, value: any): string => {
    if (value === null || value === undefined) return "-";
    
    if (field === "selling_price" || field === "purchase_price") {
      return `${Number(value).toLocaleString('vi-VN')}₫`;
    }
    
    if (field === "stock_quantity") {
      return value.toString();
    }
    
    return String(value);
  };
  
  const toggleVariant = (productCode: string, checked: boolean) => {
    const newSet = new Set(selectedVariants);
    if (checked) {
      newSet.add(productCode);
    } else {
      newSet.delete(productCode);
    }
    setSelectedVariants(newSet);
  };
  
  const toggleField = (productCode: string, field: string, checked: boolean) => {
    const variantFields = selectedFields.get(productCode) || new Set();
    if (checked) {
      variantFields.add(field);
    } else {
      variantFields.delete(field);
    }
    setSelectedFields(new Map(selectedFields.set(productCode, variantFields)));
  };
  
  const toggleExpanded = (productCode: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(productCode)) {
      newSet.delete(productCode);
    } else {
      newSet.add(productCode);
    }
    setExpandedRows(newSet);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            🔄 Phát hiện {conflicts.length} variants đã tồn tại trong kho
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-2 mb-4">
          <Button onClick={handleUpdateAll} variant="outline" size="sm">
            ☑️ Update All
          </Button>
          <Button onClick={handleSkipAll} variant="outline" size="sm">
            ⏭️ Skip All
          </Button>
        </div>
        
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Chọn</TableHead>
                <TableHead>Mã variant</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Thay đổi</TableHead>
                <TableHead>Chọn fields</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conflicts.map(conflict => (
                <Fragment key={conflict.product_code}>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        checked={selectedVariants.has(conflict.product_code)}
                        onCheckedChange={(checked) => toggleVariant(conflict.product_code, checked === true)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{conflict.product_code}</TableCell>
                    <TableCell>{conflict.variant_name || "-"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {conflict.diff_fields.map(field => (
                          <div key={field} className="text-xs">
                            <span className="font-medium">{FIELD_LABELS[field] || field}:</span>{" "}
                            <span className="text-muted-foreground">
                              {formatValue(field, conflict.old_data[field])}
                            </span>{" "}
                            → <span className="text-primary">{formatValue(field, conflict.new_data[field])}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(conflict.product_code)}
                      >
                        Chọn fields {expandedRows.has(conflict.product_code) ? "▲" : "▼"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  
                  {expandedRows.has(conflict.product_code) && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="pl-8 space-y-2 py-2">
                          {conflict.diff_fields.map(field => (
                            <div key={field} className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedFields.get(conflict.product_code)?.has(field) || false}
                                onCheckedChange={(checked) => 
                                  toggleField(conflict.product_code, field, checked === true)
                                }
                              />
                              <span className="text-sm">
                                <span className="font-medium">{FIELD_LABELS[field] || field}:</span>{" "}
                                <span className="text-muted-foreground">
                                  {formatValue(field, conflict.old_data[field])}
                                </span>{" "}
                                → <span className="text-primary">{formatValue(field, conflict.new_data[field])}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleConfirm} disabled={selectedVariants.size === 0}>
            Xác nhận update {selectedVariants.size} variants
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
