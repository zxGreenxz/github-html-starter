import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { useProductVariants, ProductVariant } from "@/hooks/use-product-variants";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface VariantDropdownSelectorProps {
  baseProductCode: string;
  value: string;
  onChange: (value: string) => void;
  onVariantSelect?: (data: {
    productCode: string;
    productName: string;
    variant: string;
  }) => void;
  className?: string;
  disabled?: boolean;
}

export function VariantDropdownSelector({
  baseProductCode,
  value,
  onChange,
  onVariantSelect,
  className,
  disabled = false
}: VariantDropdownSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: variants = [], isLoading } = useProductVariants(baseProductCode);
  
  const handleSelectVariant = (variant: ProductVariant) => {
    if (onVariantSelect) {
      onVariantSelect({
        productCode: variant.product_code,
        productName: variant.product_name,
        variant: variant.variant
      });
    }
    // Delay closing to ensure selection is processed
    setTimeout(() => setOpen(false), 100);
  };

  if (disabled) {
    return (
      <Input
        value={value}
        readOnly
        disabled
        placeholder="Chọn biến thể..."
        className={className}
      />
    );
  }
  
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="Chọn hoặc nhập biến thể..."
        className="flex-1"
      />
      
      {variants.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              type="button"
              title={`${variants.length} biến thể có sẵn`}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="p-0 w-80" 
            align="start"
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('[role="option"]')) {
                e.preventDefault();
              }
            }}
          >
            <Command>
              <CommandList>
                {isLoading && <CommandEmpty>Đang tải...</CommandEmpty>}
                {!isLoading && variants.length === 0 && (
                  <CommandEmpty>Chưa có biến thể trong kho</CommandEmpty>
                )}
                {variants.length > 0 && (
                  <CommandGroup heading={`${variants.length} biến thể có sẵn`}>
                    {variants.map((variant) => (
                      <CommandItem
                        key={variant.id}
                        onSelect={() => handleSelectVariant(variant)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="font-medium">{variant.variant}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {variant.product_code}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
