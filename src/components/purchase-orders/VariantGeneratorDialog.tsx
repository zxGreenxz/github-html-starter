import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { useProductAttributes } from "@/hooks/use-product-attributes";
import { toast as oldToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VariantGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (result: { 
    combinations: Array<{
      combinationString: string;
      selectedAttributeValueIds: string[];
    }>;
    hasVariants: boolean;
  }) => void;
  productCode?: string;
  productInfo?: {
    productName: string;
    purchasePrice: number;
    sellingPrice: number;
    productImages: string[];
    supplierName: string;
  };
}

export function VariantGeneratorDialog({
  open,
  onOpenChange,
  onSubmit,
  productCode,
  productInfo,
}: VariantGeneratorDialogProps) {
  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({});
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [selectedCombinations, setSelectedCombinations] = useState<Set<string>>(new Set());

  const { attributes, attributeValues, isLoading } = useProductAttributes();

  // Add value to selected
  const addValue = (attrId: string, value: string) => {
    setSelectedValues((prev) => ({
      ...prev,
      [attrId]: [...(prev[attrId] || []), value],
    }));
  };

  // Remove value from selected
  const removeValue = (attrId: string, value: string) => {
    setSelectedValues((prev) => {
      const newValues = (prev[attrId] || []).filter((v) => v !== value);
      if (newValues.length === 0) {
        const { [attrId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [attrId]: newValues,
      };
    });
  };

  // Generate all possible combinations
  const generateCombinations = useMemo(() => {
    const attributeIds = Object.keys(selectedValues).filter(
      id => selectedValues[id] && selectedValues[id].length > 0
    );
    
    if (attributeIds.length === 0) return [];
    
    const valueArrays = attributeIds.map(id => selectedValues[id]);
    
    // Cartesian product
    const cartesian = (...arrays: string[][]): string[][] => {
      return arrays.reduce((acc, curr) => 
        acc.flatMap(a => curr.map(b => [...a, b])), 
        [[]] as string[][]
      );
    };
    
    return cartesian(...valueArrays).map(combo => combo.join(", "));
  }, [selectedValues]);

  // Auto-select all combinations when they change
  useEffect(() => {
    if (generateCombinations.length > 0) {
      setSelectedCombinations(new Set(generateCombinations));
    } else {
      setSelectedCombinations(new Set());
    }
  }, [generateCombinations]);

  // Toggle functions
  const toggleCombination = (combo: string) => {
    setSelectedCombinations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(combo)) {
        newSet.delete(combo);
      } else {
        newSet.add(combo);
      }
      return newSet;
    });
  };

  const toggleAllCombinations = () => {
    if (selectedCombinations.size === generateCombinations.length) {
      setSelectedCombinations(new Set());
    } else {
      setSelectedCombinations(new Set(generateCombinations));
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (selectedCombinations.size === 0) {
      oldToast({
        title: "Chưa chọn biến thể",
        description: "Vui lòng chọn ít nhất một biến thể",
        variant: "destructive",
      });
      return;
    }

    // Generate full selectedAttributeValueIds array (same for all combinations)
    const allSelectedAttributeValueIds = attributes
      .filter(attr => selectedValues[attr.id] && selectedValues[attr.id].length > 0)
      .flatMap(attr => 
        selectedValues[attr.id].map(valueName => {
          const attrValue = attributeValues.find(
            av => av.value === valueName && av.attribute_id === attr.id
          );
          return attrValue?.id;
        })
      )
      .filter(Boolean) as string[];

    // Create array of combinations with full attribute IDs
    const combinations = Array.from(selectedCombinations).map(combo => ({
      combinationString: combo,
      selectedAttributeValueIds: allSelectedAttributeValueIds
    }));

    console.log('✅ Submitting combinations:', {
      count: combinations.length,
      allAttributeValueIds: allSelectedAttributeValueIds.length,
      sample: combinations[0]
    });

    onSubmit({
      combinations,
      hasVariants: true
    });

    // Reset state
    setSelectedValues({});
    setSearchQueries({});
    setSelectedCombinations(new Set());
  };

  // Handle dialog close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setSelectedValues({});
      setSearchQueries({});
      setSelectedCombinations(new Set());
    }
    onOpenChange(newOpen);
  };

  // Get attribute name by id
  const getAttributeName = (attrId: string) => {
    return attributes.find((a) => a.id === attrId)?.name || "";
  };

  // Calculate grid columns based on number of attributes
  const gridCols = Math.min(attributes.length, 4);
  const gridClass = `grid gap-4 grid-cols-1 md:grid-cols-${gridCols}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Tạo biến thể từ thuộc tính</DialogTitle>
          {productCode && (
            <p className="text-sm text-muted-foreground mt-1">
              Mã sản phẩm: <span className="font-semibold text-foreground">{productCode}</span>
            </p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Đang tải thuộc tính...</p>
          </div>
        ) : attributes.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">
              Chưa có thuộc tính nào. Vui lòng tạo thuộc tính trong Quản lý thuộc tính.
            </p>
          </div>
        ) : (
          <>
            {/* Selected values display */}
            <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg min-h-[60px]">
              {Object.entries(selectedValues).flatMap(([attrId, values]) =>
                values.map((value) => (
                  <Badge
                    key={`${attrId}-${value}`}
                    variant="secondary"
                    className="gap-1"
                  >
                    <span className="text-xs">{getAttributeName(attrId)}:</span>
                    <span>{value}</span>
                    <button
                      type="button"
                      onClick={() => removeValue(attrId, value)}
                      className="ml-1 hover:bg-background/20 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
              {Object.keys(selectedValues).length === 0 && (
                <span className="text-muted-foreground italic text-sm">
                  Chưa chọn giá trị nào
                </span>
              )}
            </div>

            {/* Main content: Attributes grid + Combinations list */}
            <div className="flex gap-4 flex-1 overflow-hidden">
              {/* Left: Attributes grid */}
              <ScrollArea className="flex-1">
                <div className={gridClass}>
                  {attributes.map((attr) => {
                    const values = attributeValues.filter(
                      (v) => v.attribute_id === attr.id
                    );
                    const searchQuery = searchQueries[attr.id] || "";
                    const filteredValues = values.filter((v) =>
                      v.value.toLowerCase().includes(searchQuery.toLowerCase())
                    );

                    return (
                      <div key={attr.id} className="border rounded-lg p-3 space-y-2">
                        <h3 className="font-semibold text-sm">{attr.name}</h3>

                        <Input
                          placeholder="Tìm kiếm..."
                          value={searchQuery}
                          onChange={(e) =>
                            setSearchQueries((prev) => ({
                              ...prev,
                              [attr.id]: e.target.value,
                            }))
                          }
                          className="h-8 text-sm"
                        />

                        <ScrollArea className="h-[300px]">
                          <div className="space-y-1 pr-3">
                            {filteredValues.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic py-2">
                                Không tìm thấy giá trị
                              </p>
                            ) : (
                              filteredValues.map((value) => {
                                const isChecked = selectedValues[attr.id]?.includes(
                                  value.value
                                );
                                return (
                                  <div
                                    key={value.id}
                                    className="flex items-center gap-2 py-1.5 hover:bg-muted/50 rounded px-2 cursor-pointer"
                                    onClick={() => {
                                      if (isChecked) {
                                        removeValue(attr.id, value.value);
                                      } else {
                                        addValue(attr.id, value.value);
                                      }
                                    }}
                                  >
                                    <Checkbox checked={isChecked} />
                                    <label className="text-sm cursor-pointer flex-1">
                                      {value.value}
                                    </label>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Right: Combinations list */}
              <div className="w-[280px] border-l pl-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Danh sách Biến Thể</h3>
                  {generateCombinations.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={toggleAllCombinations}
                    >
                      {selectedCombinations.size === generateCombinations.length 
                        ? "Bỏ chọn tất cả" 
                        : "Chọn tất cả"}
                    </Button>
                  )}
                </div>
                
                {generateCombinations.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground italic text-center">
                      Chọn giá trị thuộc tính<br/>để tạo biến thể
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="space-y-1 pr-3">
                      {generateCombinations.map((combo, index) => (
                        <div
                          key={`combo-${index}`}
                          className="flex items-start gap-2 py-2 hover:bg-muted/50 rounded px-2 cursor-pointer transition-colors"
                          onClick={() => toggleCombination(combo)}
                        >
                          <Checkbox 
                            checked={selectedCombinations.has(combo)}
                            className="mt-0.5"
                            onCheckedChange={() => toggleCombination(combo)}
                          />
                          <label className="text-sm cursor-pointer flex-1 leading-tight">
                            {combo}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                
                {generateCombinations.length > 0 && (
                  <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                    Đã chọn {selectedCombinations.size}/{generateCombinations.length}
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            {generateCombinations.length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <p className="text-sm font-medium mb-1">Preview:</p>
                <p className="text-xs text-muted-foreground">
                  Sẽ tạo <span className="font-semibold text-foreground">{selectedCombinations.size}</span> dòng sản phẩm mới
                </p>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedCombinations.size === 0 || isLoading}
          >
            Tạo {selectedCombinations.size} biến thể
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
