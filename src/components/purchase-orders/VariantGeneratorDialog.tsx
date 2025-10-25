import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { useProductAttributes } from "@/hooks/use-product-attributes";
import { toast } from "@/hooks/use-toast";

interface VariantGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (result: { variantString: string; totalQuantity: number }) => void;
}

export function VariantGeneratorDialog({
  open,
  onOpenChange,
  onSubmit,
}: VariantGeneratorDialogProps) {
  const [selectedValues, setSelectedValues] = useState<Record<string, string[]>>({});
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

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

  // Calculate variant string
  const variantString = useMemo(() => {
    return Object.entries(selectedValues)
      .filter(([_, values]) => values.length > 0)
      .map(([_, values]) => `(${values.join(" | ")})`)
      .join(" ");
  }, [selectedValues]);

  // Calculate total quantity (combination of all attributes)
  const totalQuantity = useMemo(() => {
    const counts = Object.values(selectedValues)
      .filter((values) => values.length > 0)
      .map((values) => values.length);
    
    if (counts.length === 0) return 0;
    return counts.reduce((acc, count) => acc * count, 1);
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

    // Calculate and capture values BEFORE resetting state
    const finalVariantString = Object.entries(selectedValues)
      .filter(([_, values]) => values.length > 0)
      .map(([_, values]) => `(${values.join(" | ")})`)
      .join(" ");

    const finalTotalQuantity = Object.values(selectedValues)
      .filter((values) => values.length > 0)
      .map((values) => values.length)
      .reduce((acc, count) => acc * count, 1);

    console.log("🔵 VariantGeneratorDialog handleSubmit:", {
      selectedValues,
      finalVariantString,
      finalTotalQuantity
    });

    // Submit with captured values - not dependent on useMemo
    onSubmit({
      variantString: finalVariantString,
      totalQuantity: finalTotalQuantity,
    });

    // Reset state AFTER capturing values
    setSelectedValues({});
    setSearchQueries({});
  };

  // Handle dialog close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setSelectedValues({});
      setSearchQueries({});
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Tạo biến thể từ thuộc tính</DialogTitle>
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

            {/* Attributes grid */}
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

            {/* Preview */}
            {variantString && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Xem trước:</p>
                <p className="font-mono text-sm">{variantString}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tổng số biến thể: <span className="font-semibold">{totalQuantity}</span>
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
            disabled={totalQuantity === 0 || isLoading}
          >
            Tạo biến thể ({totalQuantity})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
