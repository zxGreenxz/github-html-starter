import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { X } from "lucide-react";
import { TPOS_ATTRIBUTES } from "@/lib/tpos-attributes";

// Extract variant lists from TPOS_ATTRIBUTES
const COLORS = TPOS_ATTRIBUTES.color.map(c => c.Name);
const TEXT_SIZES = TPOS_ATTRIBUTES.sizeText.map(s => s.Name);
const NUMBER_SIZES = TPOS_ATTRIBUTES.sizeNumber.map(s => s.Name);

interface VariantSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function VariantSelector({ value, onChange, className }: VariantSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse value thành array selectedVariants
  const selectedVariants = value
    ? value.split(',').map(v => v.trim()).filter(Boolean)
    : [];

  // Auto-focus input when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    // Mở popover khi bắt đầu gõ
    if (value && !open) {
      setOpen(true);
    }
  };

  const handleSelect = (selectedValue: string) => {
    // Không thêm duplicate variants
    if (selectedVariants.includes(selectedValue)) {
      setSearchTerm("");
      inputRef.current?.focus();
      return;
    }

    // Thêm variant mới vào danh sách
    const newVariants = [...selectedVariants, selectedValue];
    onChange(newVariants.join(', '));
    setSearchTerm("");
    // KHÔNG đóng popover - giữ mở để chọn tiếp
    // setOpen(false); 
    
    // Auto-focus vào input để tiếp tục chọn
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const removeVariant = (variantToRemove: string) => {
    const newVariants = selectedVariants.filter(v => v !== variantToRemove);
    onChange(newVariants.join(', '));
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const clearAll = () => {
    setSearchTerm("");
    onChange("");
    setOpen(false);
  };

  // Filter suggestions based on search term
  const searchLower = searchTerm.toLowerCase();
  const filteredColors = searchTerm 
    ? COLORS.filter((color) => color.toLowerCase().includes(searchLower)).slice(0, 10)
    : COLORS.slice(0, 10);
  const filteredTextSizes = searchTerm
    ? TEXT_SIZES.filter((size) => size.toLowerCase().includes(searchLower))
    : TEXT_SIZES;
  const filteredNumberSizes = searchTerm
    ? NUMBER_SIZES.filter((size) => size.toLowerCase().includes(searchLower)).slice(0, 10)
    : NUMBER_SIZES.slice(0, 10);

  const hasResults =
    filteredColors.length > 0 ||
    filteredTextSizes.length > 0 ||
    filteredNumberSizes.length > 0;

  return (
    <div className={className || "relative"}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div 
            className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text"
            onClick={() => {
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            <div className="flex flex-wrap gap-1 items-center">
              {/* Badges cho variants đã chọn */}
              {selectedVariants.map((variant) => (
                <Badge
                  key={variant}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {variant}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeVariant(variant);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              
              {/* Input để tiếp tục gõ */}
              <Input
                ref={inputRef}
                value={searchTerm}
                onChange={handleInputChange}
                placeholder={selectedVariants.length === 0 ? "Chọn biến thể" : "Chọn thêm..."}
                className="border-0 p-0 h-6 flex-1 min-w-[120px] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              
              {/* Clear all button */}
              {selectedVariants.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] max-w-[400px]"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={() => {
            setSearchTerm("");
            setOpen(false);
          }}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {!hasResults && <CommandEmpty>Không tìm thấy biến thể</CommandEmpty>}

              {filteredTextSizes.length > 0 && (
                <CommandGroup heading="📏 Size chữ">
                  {filteredTextSizes.map((size) => (
                    <CommandItem key={size} onSelect={() => handleSelect(size)}>
                      {size}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredColors.length > 0 && (
                <CommandGroup heading="🎨 Màu sắc">
                  {filteredColors.map((color) => (
                    <CommandItem key={color} onSelect={() => handleSelect(color)}>
                      {color}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredNumberSizes.length > 0 && (
                <CommandGroup heading="🔢 Size số">
                  {filteredNumberSizes.map((size) => (
                    <CommandItem key={size} onSelect={() => handleSelect(size)}>
                      {size}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
