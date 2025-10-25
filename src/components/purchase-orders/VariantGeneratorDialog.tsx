import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProductAttributes } from "@/hooks/use-product-attributes";
import { Search, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface VariantGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (result: {
    variantString: string;
    totalQuantity: number;
  }) => void;
}

export function VariantGeneratorDialog({
  open,
  onOpenChange,
  onSubmit,
}: VariantGeneratorDialogProps) {
  const { attributes, attributeValues, isLoading } = useProductAttributes();
  
  // State: selected values grouped by attribute name
  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({});
  
  // State: search query per attribute
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

  // Group attribute values by attribute
  const valuesByAttribute = useMemo(() => {
    const grouped: Record<string, Array<{ id: string; value: string; display_order: number }>> = {};
    
    attributes.forEach((attr) => {
      grouped[attr.name] = attributeValues
        .filter((val) => val.attribute_id === attr.id)
        .sort((a, b) => a.display_order - b.display_order);
    });
    
    return grouped;
  }, [attributes, attributeValues]);

  // Filter values by search query
  const getFilteredValues = (attributeName: string) => {
    const values = valuesByAttribute[attributeName] || [];
    const query = searchQueries[attributeName]?.toLowerCase() || "";
    
    if (!query) return values;
    
    return values.filter((val) =>
      val.value.toLowerCase().includes(query)
    );
  };

  // Toggle value selection
  const toggleValue = (attributeName: string, value: string) => {
    setSelectedValues((prev) => {
      const current = prev[attributeName] || [];
      const isSelected = current.includes(value);
      
      if (isSelected) {
        return {
          ...prev,
          [attributeName]: current.filter((v) => v !== value),
        };
      } else {
        return {
          ...prev,
          [attributeName]: [...current, value],
        };
      }
    });
  };

  // Remove value from selection
  const removeValue = (attributeName: string, value: string) => {
    setSelectedValues((prev) => ({
      ...prev,
      [attributeName]: (prev[attributeName] || []).filter((v) => v !== value),
    }));
  };

  // Get all selected values as flat array with attribute info
  const allSelectedValues = useMemo(() => {
    return Object.entries(selectedValues).flatMap(([attrName, values]) =>
      values.map((value) => ({ attributeName: attrName, value }))
    );
  }, [selectedValues]);

  // Group selected values by attribute for display
  const selectedGroups = useMemo(() => {
    return Object.entries(selectedValues)
      .filter(([_, values]) => values.length > 0)
      .map(([attrName, values]) => ({
        attributeName: attrName,
        values: values,
        displayText: `(${values.join(' | ')})`
      }));
  }, [selectedValues]);

  // Calculate total quantity (Cartesian product)
  const totalQuantity = useMemo(() => {
    const counts = Object.values(selectedValues)
      .filter((values) => values.length > 0)
      .map((values) => values.length);
    
    if (counts.length === 0) return 0;
    
    return counts.reduce((acc, count) => acc * count, 1);
  }, [selectedValues]);

  // Format variant string
  const variantString = useMemo(() => {
    return Object.entries(selectedValues)
      .filter(([_, values]) => values.length > 0)
      .map(([_, values]) => `(${values.join(' | ')})`)
      .join(' ');
  }, [selectedValues]);

  // Get breakdown text for display
  const breakdownText = useMemo(() => {
    const counts = Object.entries(selectedValues)
      .filter(([_, values]) => values.length > 0)
      .map(([attrName, values]) => `${values.length} ${attrName}`);
    
    if (counts.length === 0) return "";
    
    return counts.join(' × ');
  }, [selectedValues]);

  // Handle submit
  const handleSubmit = () => {
    if (totalQuantity === 0) {
      toast({
        title: "Chưa chọn giá trị",
        description: "Vui lòng chọn ít nhất một giá trị thuộc tính",
        variant: "destructive",
      });
      return;
    }

    onSubmit({
      variantString,
      totalQuantity,
    });

    // Reset state
    setSelectedValues({});
    setSearchQueries({});
  };

  // Handle close
  const handleClose = () => {
    setSelectedValues({});
    setSearchQueries({});
    onOpenChange(false);
  };

  // Empty state
  if (!isLoading && attributes.length === 0) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo biến thể từ thuộc tính</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            <p>Chưa có thuộc tính nào.</p>
            <p className="mt-2">Vui lòng tạo thuộc tính trong Quản lý thuộc tính (Kho sản phẩm)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tạo biến thể từ thuộc tính</DialogTitle>
        </DialogHeader>

        {/* Selected badges */}
        {selectedGroups.length > 0 && (
          <div className="border-b pb-4">
            <div className="text-sm text-muted-foreground mb-2">
              Đã chọn ({selectedGroups.length} nhóm):
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedGroups.map((group) => (
                <Badge
                  key={group.attributeName}
                  variant="secondary"
                  className="gap-1 text-base px-3 py-1"
                >
                  {group.displayText}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedValues((prev) => {
                        const newValues = { ...prev };
                        delete newValues[group.attributeName];
                        return newValues;
                      });
                    }}
                    className="ml-1 hover:bg-muted rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Attributes columns */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
            {attributes.map((attribute) => {
              const values = valuesByAttribute[attribute.name] || [];
              const filteredValues = getFilteredValues(attribute.name);
              const selected = selectedValues[attribute.name] || [];

              return (
                <div
                  key={attribute.id}
                  className="border rounded-lg p-4 flex flex-col"
                >
                  {/* Attribute name */}
                  <h3 className="font-medium mb-3">{attribute.name}</h3>

                  {/* Search input */}
                  <div className="relative mb-3">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Tìm kiếm..."
                      value={searchQueries[attribute.name] || ""}
                      onChange={(e) =>
                        setSearchQueries((prev) => ({
                          ...prev,
                          [attribute.name]: e.target.value,
                        }))
                      }
                      className="pl-8"
                    />
                  </div>

                  {/* Values list */}
                  <ScrollArea className="flex-1 max-h-[300px]">
                    <div className="space-y-2">
                      {filteredValues.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          {values.length === 0
                            ? "Chưa có giá trị"
                            : "Không tìm thấy kết quả"}
                        </div>
                      ) : (
                        filteredValues.map((val) => {
                          const isSelected = selected.includes(val.value);
                          return (
                            <div
                              key={val.id}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={val.id}
                                checked={isSelected}
                                onCheckedChange={() =>
                                  toggleValue(attribute.name, val.value)
                                }
                              />
                              <label
                                htmlFor={val.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {val.value}
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

        {/* Footer with quantity and actions */}
        <DialogFooter className="border-t pt-4 flex-col sm:flex-row gap-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {totalQuantity > 0 && (
              <div>
                💡 Tổng số lượng: <span className="font-semibold text-foreground">{totalQuantity}</span>
                {breakdownText && <span className="ml-2">({breakdownText})</span>}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={totalQuantity === 0}>
              Tạo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
