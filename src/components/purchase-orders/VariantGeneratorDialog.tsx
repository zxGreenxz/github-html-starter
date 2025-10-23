import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Search, X, Edit2, Trash2, Plus } from "lucide-react";
import { TPOS_ATTRIBUTES } from "@/lib/tpos-attributes";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  generateVariants,
  TPOSAttributeLine,
  ProductData,
  TPOSAttributeValue
} from "@/lib/variant-generator";

interface AttributeLine {
  attributeId: number;
  attributeName: string;
  values: string[];
}

interface GeneratedVariantForForm {
  product_code: string;
  product_name: string;
  variant: string;
  quantity: number;
  purchase_price: number | string;
  selling_price: number | string;
  product_images: string[];
  price_images: string[];
  _tempTotalPrice: number;
}

interface VariantGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentItem: {
    product_code: string;
    product_name: string;
    variant?: string;
    quantity?: number;
    purchase_price?: number | string;
    selling_price?: number | string;
    product_images?: string[];
    price_images?: string[];
  };
  // New behavior: Generate full variant products (for CreatePurchaseOrderDialog)
  onVariantsGenerated?: (data: {
    variants: GeneratedVariantForForm[];
    attributeLines: AttributeLine[];
  }) => void;
  // Old behavior: Just generate variant text (for EditPurchaseOrderDialog)
  onVariantTextGenerated?: (variantText: string) => void;
  // Regenerate behavior: Delete old variants and create new ones (for Products)
  onVariantsRegenerated?: (data: {
    variants: any[];
    variantText: string;
    attributeLines: AttributeLine[];
  }) => void;
}

const ATTRIBUTES = [
  { id: 1, name: "Size Chữ", key: "sizeText" as const },
  { id: 3, name: "Màu", key: "color" as const },
  { id: 4, name: "Size Số", key: "sizeNumber" as const }
];

export function VariantGeneratorDialog({
  open,
  onOpenChange,
  currentItem,
  onVariantsGenerated,
  onVariantTextGenerated,
  onVariantsRegenerated
}: VariantGeneratorDialogProps) {
  const { toast } = useToast();
  const [attributeLines, setAttributeLines] = useState<AttributeLine[]>([]);
  const [selectedAttributeId, setSelectedAttributeId] = useState<number | null>(null);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [valueFilter, setValueFilter] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Parse variant string to attribute lines when dialog opens
  useEffect(() => {
    if (open && currentItem.variant) {
      // Extract all groups in parentheses: "(S | M | L) (Đỏ | Xanh)" → ["S | M | L", "Đỏ | Xanh"]
      const groupRegex = /\(([^)]+)\)/g;
      const groups: string[] = [];
      let match;
      while ((match = groupRegex.exec(currentItem.variant)) !== null) {
        groups.push(match[1]);
      }

      // If no groups found, try splitting by pipe directly (fallback for "S | M | L" without parentheses)
      if (groups.length === 0 && currentItem.variant.includes('|')) {
        groups.push(currentItem.variant);
      }

      // Parse each group into values
      const lines: AttributeLine[] = [];
      
      groups.forEach(group => {
        // Split by pipe and clean up
        const values = group
          .split('|')
          .map(v => v.trim())
          .filter(v => v.length > 0);

        if (values.length === 0) return;

        // Try to detect which attribute this group belongs to
        let detectedAttributeId: number | null = null;
        let detectedAttributeName: string | null = null;
        const matchedValues: string[] = [];

        // Check each attribute type
        for (const attr of ATTRIBUTES) {
          const matches: string[] = [];
          
          values.forEach(value => {
            const match = TPOS_ATTRIBUTES[attr.key].find(
              item => item.Name.toUpperCase() === value.toUpperCase()
            );
            if (match) {
              matches.push(match.Name);
            }
          });

          // If we found matches, this is the attribute
          if (matches.length > 0) {
            detectedAttributeId = attr.id;
            detectedAttributeName = attr.name;
            matchedValues.push(...matches);
            break; // Stop after first match
          }
        }

        // Add to lines if we detected an attribute
        if (detectedAttributeId && detectedAttributeName && matchedValues.length > 0) {
          lines.push({
            attributeId: detectedAttributeId,
            attributeName: detectedAttributeName,
            values: matchedValues
          });
        }
      });

      setAttributeLines(lines);
    } else if (open) {
      // Reset when opening without variant
      setAttributeLines([]);
    }
  }, [open, currentItem.variant]);

  // Get available attributes (not yet selected)
  const availableAttributes = ATTRIBUTES.filter(
    attr => !attributeLines.some(line => line.attributeId === attr.id) || 
           (editingIndex !== null && attributeLines[editingIndex]?.attributeId === attr.id)
  );

  // Get available values for selected attribute
  const getAvailableValues = () => {
    if (!selectedAttributeId) return [];
    
    const attr = ATTRIBUTES.find(a => a.id === selectedAttributeId);
    if (!attr) return [];
    
    return TPOS_ATTRIBUTES[attr.key].filter(item =>
      item.Name.toLowerCase().includes(valueFilter.toLowerCase())
    );
  };

  const toggleValue = (value: string) => {
    setSelectedValues(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleSave = (addNew: boolean = false) => {
    if (!selectedAttributeId || selectedValues.length === 0) return;
    
    const attr = ATTRIBUTES.find(a => a.id === selectedAttributeId);
    if (!attr) return;

    const newLine: AttributeLine = {
      attributeId: selectedAttributeId,
      attributeName: attr.name,
      values: [...selectedValues]
    };

    if (editingIndex !== null) {
      // Update existing line
      const updated = [...attributeLines];
      updated[editingIndex] = newLine;
      setAttributeLines(updated);
      setEditingIndex(null);
    } else {
      // Add new line
      setAttributeLines(prev => [...prev, newLine]);
    }

    // Reset form
    setSelectedAttributeId(null);
    setSelectedValues([]);
    setValueFilter("");

    // If "Save and Add New", keep dialog ready for next attribute
    if (addNew && availableAttributes.length > 1) {
      // Auto-focus next attribute if available
    }
  };

  const handleEdit = (index: number) => {
    const line = attributeLines[index];
    setEditingIndex(index);
    setSelectedAttributeId(line.attributeId);
    setSelectedValues([...line.values]);
    setValueFilter("");
  };

  const handleDelete = (index: number) => {
    setAttributeLines(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setSelectedAttributeId(null);
      setSelectedValues([]);
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setSelectedAttributeId(null);
    setSelectedValues([]);
    setValueFilter("");
  };

  const handleConfirm = () => {
    if (attributeLines.length === 0) {
      toast({
        title: "⚠️ Chưa có thuộc tính",
        description: "Vui lòng thêm ít nhất 1 thuộc tính",
        variant: "destructive"
      });
      return;
    }

    // Generate variant text first (common for all paths)
    const variantText = attributeLines
      .map(line => `(${line.values.join(' | ')})`)
      .join(' ');

    // Check which callback to use
    if (onVariantTextGenerated) {
      // Just update variant text (for PurchaseOrders)
      onVariantTextGenerated(variantText);
    } else if (onVariantsRegenerated) {
      // Regenerate all variants (for Products)
      // Convert AttributeLine[] → TPOSAttributeLine[]
      const tposAttributeLines: TPOSAttributeLine[] = attributeLines.map(line => {
        const attribute = ATTRIBUTES.find(a => a.id === line.attributeId);
        if (!attribute) return null;

        const values: TPOSAttributeValue[] = line.values
          .map(valueName => {
            const value = TPOS_ATTRIBUTES[attribute.key].find(v => v.Name === valueName);
            return value ? {
              ...value,
              AttributeId: line.attributeId,
              AttributeName: line.attributeName
            } : null;
          })
          .filter(Boolean) as TPOSAttributeValue[];

        return {
          Attribute: {
            Id: line.attributeId,
            Name: line.attributeName
          },
          Values: values
        };
      }).filter(Boolean) as TPOSAttributeLine[];

      // Prepare ProductData
      const productData: ProductData = {
        Id: 0,
        Name: currentItem.product_name.trim().toUpperCase(),
        DefaultCode: currentItem.product_code.trim().toUpperCase(),
        ListPrice: Number(currentItem.selling_price || 0) * 1000
      };

      // Generate variants using variant-generator.ts
      const generatedVariants = generateVariants(productData, tposAttributeLines);

      // Return data for parent to handle
      onVariantsRegenerated({
        variants: generatedVariants,
        variantText: variantText,
        attributeLines: attributeLines
      });
    } else if (onVariantsGenerated) {
      // New behavior: Generate full variant products using variant-generator.ts
      // ✅ STEP 1: Convert AttributeLine[] → TPOSAttributeLine[] (giữ nguyên thứ tự người dùng chọn)
      const tposAttributeLines: TPOSAttributeLine[] = attributeLines.map(line => {
        const attribute = ATTRIBUTES.find(a => a.id === line.attributeId);
        if (!attribute) return null;

        const values: TPOSAttributeValue[] = line.values
          .map(valueName => {
            const value = TPOS_ATTRIBUTES[attribute.key].find(v => v.Name === valueName);
            return value ? {
              ...value,
              AttributeId: line.attributeId,
              AttributeName: line.attributeName
            } : null;
          })
          .filter(Boolean) as TPOSAttributeValue[];

        return {
          Attribute: {
            Id: line.attributeId,
            Name: line.attributeName
          },
          Values: values
        };
      }).filter(Boolean) as TPOSAttributeLine[];

      // ✅ STEP 3: Prepare ProductData
      const productData: ProductData = {
        Id: 0,
        Name: currentItem.product_name.trim().toUpperCase(),
        DefaultCode: currentItem.product_code.trim().toUpperCase(),
        ListPrice: Number(currentItem.selling_price || 0) * 1000
      };

      // ✅ STEP 4: Generate variants - 100% từ variant-generator.ts
      const generatedVariants = generateVariants(productData, tposAttributeLines);

      // ✅ STEP 5: Convert GeneratedVariant[] → GeneratedVariantForForm[]
      const variantsForForm: GeneratedVariantForForm[] = generatedVariants.map(v => ({
        product_code: v.DefaultCode,
        product_name: v.Name,
        variant: v.AttributeValues?.map(av => av.Name).join(', ') || '',
        quantity: currentItem.quantity || 1,
        purchase_price: currentItem.purchase_price || 0,
        selling_price: currentItem.selling_price || 0,
        product_images: [...(currentItem.product_images || [])],
        price_images: [...(currentItem.price_images || [])],
        _tempTotalPrice: Number(currentItem.purchase_price || 0) * (currentItem.quantity || 1)
      }));

      console.log('✅ Generated variants:', variantsForForm);

      // ✅ Return both variants and attributeLines for formatting
      onVariantsGenerated({
        variants: variantsForForm,
        attributeLines: attributeLines
      });
    }

    onOpenChange(false);

    // Reset state
    setAttributeLines([]);
    setSelectedAttributeId(null);
    setSelectedValues([]);
    setValueFilter("");
    setEditingIndex(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state
    setAttributeLines([]);
    setSelectedAttributeId(null);
    setSelectedValues([]);
    setEditingIndex(null);
    setValueFilter("");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      if (e.key === 'F7') {
        e.preventDefault();
        handleSave(false);
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleSave(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedAttributeId, selectedValues, editingIndex]);

  const filteredValues = getAvailableValues();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Tạo Biến Thể Tự Động
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Product Info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Mã SP:</span>
              <Badge variant="outline" className="font-mono">
                {currentItem.product_code}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Tên SP:</span>
              <span className="font-medium">{currentItem.product_name}</span>
            </div>
          </div>

          {/* Add/Edit Attribute Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="grid grid-cols-2 gap-4">
              {/* Attribute Selection */}
              <div className="space-y-2">
                <Label>Thuộc tính</Label>
                <Select
                  value={selectedAttributeId?.toString() || ""}
                  onValueChange={(value) => {
                    setSelectedAttributeId(Number(value));
                    setSelectedValues([]);
                    setValueFilter("");
                  }}
                  disabled={editingIndex !== null}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn thuộc tính..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAttributes.map(attr => (
                      <SelectItem key={attr.id} value={attr.id.toString()}>
                        {attr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Values Selection */}
              <div className="space-y-2">
                <Label>Giá trị thuộc tính</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={selectedAttributeId ? "Tìm giá trị..." : "Chọn thuộc tính trước"}
                    value={valueFilter}
                    onChange={(e) => setValueFilter(e.target.value)}
                    disabled={!selectedAttributeId}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Selected Values Tags */}
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-background rounded-md border">
                {selectedValues.map(value => (
                  <Badge
                    key={value}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {value}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => toggleValue(value)}
                    />
                  </Badge>
                ))}
              </div>
            )}

            {/* Available Values Grid */}
            {selectedAttributeId && (
              <ScrollArea className="h-32 rounded-md border p-3 bg-background">
                <div className="grid grid-cols-6 gap-2">
                  {filteredValues.map((item) => (
                    <Button
                      key={item.Id}
                      size="sm"
                      variant={selectedValues.includes(item.Name) ? "default" : "outline"}
                      onClick={() => toggleValue(item.Name)}
                      className="h-8 text-xs"
                    >
                      {item.Name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={() => handleSave(false)}
                disabled={!selectedAttributeId || selectedValues.length === 0}
                className="flex-1"
              >
                {editingIndex !== null ? "Cập nhật" : "Lưu (F7)"}
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={!selectedAttributeId || selectedValues.length === 0 || editingIndex !== null}
                variant="secondary"
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-1" />
                Lưu và Thêm Mới (F8)
              </Button>
              {(selectedAttributeId || editingIndex !== null) && (
                <Button
                  onClick={handleCancel}
                  variant="outline"
                >
                  Hủy
                </Button>
              )}
            </div>
          </div>

          {/* Attribute Lines List */}
          <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
            <Label>Thuộc tính đã chọn ({attributeLines.length})</Label>
            <ScrollArea className="flex-1 rounded-md border p-3">
              {attributeLines.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm italic">
                    Chưa có thuộc tính nào
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attributeLines.map((line, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-3 rounded-lg border bg-background transition-all",
                        editingIndex === index && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="font-medium text-sm">{line.attributeName}</div>
                          <div className="flex flex-wrap gap-1">
                            {line.values.map(value => (
                              <Badge key={value} variant="outline">
                                {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleEdit(index)}
                            disabled={editingIndex !== null && editingIndex !== index}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 hover:text-destructive"
                            onClick={() => handleDelete(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={attributeLines.length === 0}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Xác Nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
