import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

interface VariantSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVariants: string;
  onVariantsChange: (variants: string) => void;
}

export function VariantSelectorDialog({
  open,
  onOpenChange,
  selectedVariants,
  onVariantsChange,
}: VariantSelectorDialogProps) {
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>({});
  const [tempSelectedVariants, setTempSelectedVariants] = useState<string>(selectedVariants);
  
  // Sync tempSelectedVariants when dialog opens
  useEffect(() => {
    if (open) {
      setTempSelectedVariants(selectedVariants);
    }
  }, [open, selectedVariants]);
  
  const { data: attributes, isLoading: isLoadingAttributes } = useQuery({
    queryKey: ["product-attributes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_attributes")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });
  
  const { data: attributeValues, isLoading: isLoadingValues } = useQuery({
    queryKey: ["product-attribute-values"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_attribute_values")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });
  
  const groupedByAttribute = useMemo(() => {
    if (!attributeValues) return {};
    
    const groups: Record<string, typeof attributeValues> = {};
    attributeValues.forEach(value => {
      if (!groups[value.attribute_id]) {
        groups[value.attribute_id] = [];
      }
      groups[value.attribute_id].push(value);
    });
    
    return groups;
  }, [attributeValues]);
  
  const selectedValueIds = useMemo(() => {
    if (!tempSelectedVariants || !attributeValues) return new Set<string>();
    
    // Match ALL groups: (1 | 2 | 3) (Trắng | Đen) (S | M)
    const matches = tempSelectedVariants.match(/\([^)]+\)/g);
    if (!matches) return new Set<string>();
    
    const allNames: string[] = [];
    matches.forEach(group => {
      // Remove ( and ) → "1 | 2 | 3"
      const content = group.slice(1, -1);
      const names = content.split("|").map(s => s.trim());
      allNames.push(...names);
    });
    
    const ids = new Set<string>();
    attributeValues.forEach(value => {
      if (allNames.includes(value.value)) {
        ids.add(value.id);
      }
    });
    
    return ids;
  }, [tempSelectedVariants, attributeValues]);
  
  const getFilteredValues = (attributeId: string, values: typeof attributeValues) => {
    const searchTerm = searchFilters[attributeId]?.toLowerCase() || '';
    if (!searchTerm) return values;
    
    return values.filter(v => v.value.toLowerCase().includes(searchTerm));
  };
  
  const handleToggle = (valueId: string) => {
    const newSet = new Set(selectedValueIds);
    
    if (newSet.has(valueId)) {
      newSet.delete(valueId);
    } else {
      newSet.add(valueId);
    }
    
    // Group by attribute_id
    const selectedByAttribute: Record<string, string[]> = {};
    
    attributeValues?.forEach(value => {
      if (newSet.has(value.id)) {
        if (!selectedByAttribute[value.attribute_id]) {
          selectedByAttribute[value.attribute_id] = [];
        }
        selectedByAttribute[value.attribute_id].push(value.value);
      }
    });
    
    // Format: "(Val1 | Val2) (ValA | ValB)"
    const parts = Object.values(selectedByAttribute).map(values =>
      `(${values.join(" | ")})`
    );
    
    const variantString = parts.join(" ");
    
    // Only update local state, don't call onVariantsChange yet
    setTempSelectedVariants(variantString);
  };
  
  const handleSave = () => {
    onVariantsChange(tempSelectedVariants);
    onOpenChange(false);
  };
  
  const handleClose = () => {
    setTempSelectedVariants(selectedVariants); // Reset to original value
    onOpenChange(false);
  };
  
  const isLoading = isLoadingAttributes || isLoadingValues;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chọn biến thể</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* 3-column grid with borders */}
            <div className="grid grid-cols-3 gap-4">
              {attributes?.map(attr => {
                const values = groupedByAttribute[attr.id] || [];
                const filteredValues = getFilteredValues(attr.id, values);
                
                if (values.length === 0) return null;
                
                return (
                  <div 
                    key={attr.id} 
                    className="border rounded-lg p-4 space-y-3"
                  >
                    {/* Attribute name header */}
                    <h4 className="font-semibold text-sm">
                      {attr.name}
                    </h4>
                    
                    {/* Search input */}
                    <Input
                      placeholder="Tìm kiếm..."
                      value={searchFilters[attr.id] || ''}
                      onChange={(e) => setSearchFilters(prev => ({
                        ...prev,
                        [attr.id]: e.target.value
                      }))}
                      className="h-9"
                    />
                    
                    {/* Scrollable checkbox list */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {filteredValues.map(value => (
                        <div key={value.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`variant-${value.id}`}
                            checked={selectedValueIds.has(value.id)}
                            onCheckedChange={() => handleToggle(value.id)}
                          />
                          <Label 
                            htmlFor={`variant-${value.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {value.value}
                          </Label>
                        </div>
                      ))}
                      
                      {/* No results message */}
                      {filteredValues.length === 0 && (
                        <p className="text-xs text-muted-foreground italic text-center py-2">
                          Không tìm thấy kết quả
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Đóng
          </Button>
          <Button
            onClick={handleSave}
          >
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
