import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { useProductVariants, ProductVariant } from "@/hooks/use-product-variants";

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            value={value}
            readOnly
            placeholder="Chọn biến thể..."
            className={className}
            onFocus={() => setOpen(true)}
          />
          {variants.length > 0 && (
            <Badge 
              variant="secondary" 
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
            >
              {variants.length}
            </Badge>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0 w-80" 
        align="start"
        onInteractOutside={(e) => {
          // Prevent closing when clicking inside the popover content
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
                      // Prevent default to avoid popover closing during click
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
  );
}
