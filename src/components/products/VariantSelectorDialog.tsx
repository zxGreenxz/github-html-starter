import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
    if (!selectedVariants || !attributeValues) return new Set<string>();
    
    const match = selectedVariants.match(/\((.*?)\)/);
    if (!match) return new Set<string>();
    
    const names = match[1].split("|").map(s => s.trim());
    const ids = new Set<string>();
    
    attributeValues.forEach(value => {
      if (names.includes(value.value)) {
        ids.add(value.id);
      }
    });
    
    return ids;
  }, [selectedVariants, attributeValues]);
  
  const handleToggle = (valueId: string) => {
    const newSet = new Set(selectedValueIds);
    
    if (newSet.has(valueId)) {
      newSet.delete(valueId);
    } else {
      newSet.add(valueId);
    }
    
    const selectedNames = attributeValues
      ?.filter(v => newSet.has(v.id))
      .map(v => v.value) || [];
    
    const variantString = selectedNames.length > 0 
      ? `(${selectedNames.join(" | ")})` 
      : "";
    
    onVariantsChange(variantString);
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
          <div className="grid grid-cols-3 gap-6">
            {attributes?.map(attr => {
              const values = groupedByAttribute[attr.id] || [];
              
              if (values.length === 0) return null;
              
              return (
                <div key={attr.id} className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase">
                    {attr.name}
                  </h4>
                  <div className="space-y-2">
                    {values.map(value => (
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
