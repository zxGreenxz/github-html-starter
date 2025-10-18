import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, AlertTriangle, Search, Check, ChevronRight, X, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { generateAllVariants } from "@/lib/variant-code-generator";
import { TPOS_ATTRIBUTES } from "@/lib/tpos-attributes";
import { cn } from "@/lib/utils";

interface VariantGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentItem: {
    product_code: string;
    product_name: string;
  };
  onVariantsGenerated: (
    variants: Array<{
      fullCode: string;
      variantCode: string;
      productName: string;
      variantText: string;
      hasCollision: boolean;
    }>,
    selectedIndices: number[]
  ) => void;
}

export function VariantGeneratorDialog({
  open,
  onOpenChange,
  currentItem,
  onVariantsGenerated
}: VariantGeneratorDialogProps) {
  const [selectedSizeText, setSelectedSizeText] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizeNumber, setSelectedSizeNumber] = useState<string[]>([]);
  const [activeAttributeType, setActiveAttributeType] = useState<'sizeText' | 'color' | 'sizeNumber' | null>(null);
  const [sizeTextFilter, setSizeTextFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [sizeNumberFilter, setSizeNumberFilter] = useState("");
  const [previewResults, setPreviewResults] = useState<Array<{
    fullCode: string;
    variantCode: string;
    productName: string;
    variantText: string;
    hasCollision: boolean;
  }>>([]);
  const [selectedVariantIndices, setSelectedVariantIndices] = useState<Set<number>>(new Set());
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  // Auto-generate preview on selection change
  useEffect(() => {
    if (!currentItem.product_code || !currentItem.product_name) {
      setPreviewResults([]);
      return;
    }

    if (selectedSizeText.length === 0 && selectedColors.length === 0 && selectedSizeNumber.length === 0) {
      setPreviewResults([]);
      return;
    }

    try {
      const variants = generateAllVariants({
        productCode: currentItem.product_code.trim(),
        productName: currentItem.product_name.trim(),
        sizeTexts: selectedSizeText,
        colors: selectedColors,
        sizeNumbers: selectedSizeNumber
      });

      const formatted = variants.map(v => ({
        fullCode: v.fullCode,
        variantCode: v.variantCode,
        productName: v.productName,
        variantText: v.variantText,
        hasCollision: v.hasCollision
      }));

      setPreviewResults(formatted);
    } catch (error) {
      console.error('Error generating variants:', error);
      setPreviewResults([]);
    }
  }, [selectedSizeText, selectedColors, selectedSizeNumber, currentItem.product_code, currentItem.product_name]);

  // Auto-select all preview results when they change
  useEffect(() => {
    if (previewResults.length > 0) {
      setSelectedVariantIndices(new Set(previewResults.map((_, i) => i)));
    } else {
      setSelectedVariantIndices(new Set());
    }
  }, [previewResults]);

  const toggleSelection = (type: 'sizeText' | 'color' | 'sizeNumber', value: string) => {
    // Block if different type is already active
    if (activeAttributeType && activeAttributeType !== type) {
      return;
    }

    if (type === 'sizeText') {
      const newSelection = selectedSizeText.includes(value)
        ? selectedSizeText.filter(v => v !== value)
        : [...selectedSizeText, value];
      setSelectedSizeText(newSelection);
      setActiveAttributeType(newSelection.length > 0 ? 'sizeText' : null);
    } else if (type === 'color') {
      const newSelection = selectedColors.includes(value)
        ? selectedColors.filter(v => v !== value)
        : [...selectedColors, value];
      setSelectedColors(newSelection);
      setActiveAttributeType(newSelection.length > 0 ? 'color' : null);
    } else {
      const newSelection = selectedSizeNumber.includes(value)
        ? selectedSizeNumber.filter(v => v !== value)
        : [...selectedSizeNumber, value];
      setSelectedSizeNumber(newSelection);
      setActiveAttributeType(newSelection.length > 0 ? 'sizeNumber' : null);
    }
  };

  const handleConfirm = () => {
    if (previewResults.length > 0) {
      const selectedIndicesArray = Array.from(selectedVariantIndices).sort((a, b) => a - b);
      onVariantsGenerated(previewResults, selectedIndicesArray);
      onOpenChange(false);
      // Reset selections and filters
      setSelectedSizeText([]);
      setSelectedColors([]);
      setSelectedSizeNumber([]);
      setSelectedVariantIndices(new Set());
      setIsPreviewExpanded(false);
      setSizeTextFilter("");
      setColorFilter("");
      setSizeNumberFilter("");
    }
  };

  const handleRemoveVariantFromPreview = (index: number) => {
    const variantToRemove = previewResults[index];
    
    // Parse variant text to get individual attributes
    const variantParts = variantToRemove.variantText.split(',').map(s => s.trim()).filter(Boolean);
    
    // Check which attributes from this variant are ONLY used by this variant
    const attributesToRemove = {
      sizeText: [] as string[],
      colors: [] as string[],
      sizeNumbers: [] as string[]
    };
    
    for (const part of variantParts) {
      // Count how many variants use this attribute
      const usageCount = previewResults.filter((r, i) => 
        i !== index && r.variantText.includes(part)
      ).length;
      
      // If only this variant uses this attribute, mark for removal
      if (usageCount === 0) {
        // Check which category this attribute belongs to
        if (TPOS_ATTRIBUTES.sizeText.some(st => st.Name === part)) {
          attributesToRemove.sizeText.push(part);
        } else if (TPOS_ATTRIBUTES.color.some(c => c.Name === part)) {
          attributesToRemove.colors.push(part);
        } else if (TPOS_ATTRIBUTES.sizeNumber.some(sn => sn.Name === part)) {
          attributesToRemove.sizeNumbers.push(part);
        }
      }
    }
    
    // Remove attributes that are no longer needed
    if (attributesToRemove.sizeText.length > 0) {
      setSelectedSizeText(prev => prev.filter(s => !attributesToRemove.sizeText.includes(s)));
    }
    if (attributesToRemove.colors.length > 0) {
      setSelectedColors(prev => prev.filter(c => !attributesToRemove.colors.includes(c)));
    }
    if (attributesToRemove.sizeNumbers.length > 0) {
      setSelectedSizeNumber(prev => prev.filter(s => !attributesToRemove.sizeNumbers.includes(s)));
    }
    
    // Update active attribute type if needed
    const hasAnySelection = 
      (selectedSizeText.length - attributesToRemove.sizeText.length) > 0 ||
      (selectedColors.length - attributesToRemove.colors.length) > 0 ||
      (selectedSizeNumber.length - attributesToRemove.sizeNumbers.length) > 0;
    
    if (!hasAnySelection) {
      setActiveAttributeType(null);
    }
    
    // Note: previewResults will be auto-updated by useEffect when selections change
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset selections and filters
    setSelectedSizeText([]);
    setSelectedColors([]);
    setSelectedSizeNumber([]);
    setActiveAttributeType(null);
    setSelectedVariantIndices(new Set());
    setIsPreviewExpanded(false);
    setSizeTextFilter("");
    setColorFilter("");
    setSizeNumberFilter("");
  };

  // Filter functions
  const filteredSizeText = TPOS_ATTRIBUTES.sizeText.filter(item =>
    item.Name.toLowerCase().includes(sizeTextFilter.toLowerCase())
  );
  
  const filteredColors = TPOS_ATTRIBUTES.color.filter(item =>
    item.Name.toLowerCase().includes(colorFilter.toLowerCase())
  );
  
  const filteredSizeNumber = TPOS_ATTRIBUTES.sizeNumber.filter(item =>
    item.Name.toLowerCase().includes(sizeNumberFilter.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Tạo Biến Thể Tự Động
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Product Info - Compact */}
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

          {/* Selected Variants Display */}
          {(selectedSizeText.length > 0 || selectedColors.length > 0 || selectedSizeNumber.length > 0) && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Các Biến Thể Đã Chọn
                <span className="ml-2 text-muted-foreground">
                  ({selectedSizeText.length + selectedColors.length + selectedSizeNumber.length})
                </span>
              </Label>
              <div className="border rounded-lg p-3 min-h-[60px] bg-muted/30">
                <div className="flex flex-wrap gap-2">
                  {selectedSizeText.map((size) => (
                    <Badge 
                      key={`st-${size}`}
                      variant="secondary" 
                      className="gap-1.5 pl-3 pr-2 py-1 hover:bg-secondary/80 transition-colors"
                    >
                      <span className="text-xs">{size}</span>
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection('sizeText', size);
                        }}
                      />
                    </Badge>
                  ))}
                  
                  {selectedColors.map((color) => (
                    <Badge 
                      key={`c-${color}`}
                      variant="secondary" 
                      className="gap-1.5 pl-3 pr-2 py-1 hover:bg-secondary/80 transition-colors"
                    >
                      <span className="text-xs">{color}</span>
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection('color', color);
                        }}
                      />
                    </Badge>
                  ))}
                  
                  {selectedSizeNumber.map((size) => (
                    <Badge 
                      key={`sn-${size}`}
                      variant="secondary" 
                      className="gap-1.5 pl-3 pr-2 py-1 hover:bg-secondary/80 transition-colors"
                    >
                      <span className="text-xs">{size}</span>
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection('sizeNumber', size);
                        }}
                      />
                    </Badge>
                  ))}
                  
                  {selectedSizeText.length === 0 && 
                   selectedColors.length === 0 && 
                   selectedSizeNumber.length === 0 && (
                    <span className="text-muted-foreground text-sm italic">
                      Chưa chọn biến thể nào
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Selection Columns and Preview */}
          <div className="grid grid-cols-[15%_15%_15%_55%] gap-4 flex-1 overflow-hidden">
            {/* Size Text */}
            <div className={cn(
              "space-y-2 flex flex-col h-full transition-opacity",
              activeAttributeType && activeAttributeType !== 'sizeText' && "opacity-40 pointer-events-none"
            )}>
              <Label>Size Chữ ({selectedSizeText.length})</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm size chữ..."
                  value={sizeTextFilter}
                  onChange={(e) => setSizeTextFilter(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <ScrollArea className="flex-1 rounded-md border p-3 bg-muted/30 max-h-[400px]">
                <div className="space-y-1">
                  {filteredSizeText.map((item) => (
                    <div 
                      key={item.Id}
                      onClick={() => toggleSelection('sizeText', item.Name)}
                      className={cn(
                        "flex items-center space-x-3 py-3 px-2 rounded cursor-pointer transition-all",
                        "hover:bg-accent/50 active:bg-accent",
                        selectedSizeText.includes(item.Name) && "bg-primary/10 border border-primary/20"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                        selectedSizeText.includes(item.Name) 
                          ? "bg-primary border-primary" 
                          : "border-muted-foreground/30"
                      )}>
                        {selectedSizeText.includes(item.Name) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="flex-1 font-normal select-none">
                        {item.Name}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Color */}
            <div className={cn(
              "space-y-2 flex flex-col h-full transition-opacity",
              activeAttributeType && activeAttributeType !== 'color' && "opacity-40 pointer-events-none"
            )}>
              <Label>Màu Sắc ({selectedColors.length})</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm màu sắc..."
                  value={colorFilter}
                  onChange={(e) => setColorFilter(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <ScrollArea className="flex-1 rounded-md border p-3 bg-muted/30 max-h-[400px]">
                <div className="space-y-1">
                  {filteredColors.map((item) => (
                    <div 
                      key={item.Id}
                      onClick={() => toggleSelection('color', item.Name)}
                      className={cn(
                        "flex items-center space-x-3 py-3 px-2 rounded cursor-pointer transition-all",
                        "hover:bg-accent/50 active:bg-accent",
                        selectedColors.includes(item.Name) && "bg-primary/10 border border-primary/20"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                        selectedColors.includes(item.Name) 
                          ? "bg-primary border-primary" 
                          : "border-muted-foreground/30"
                      )}>
                        {selectedColors.includes(item.Name) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="flex-1 font-normal select-none">
                        {item.Name}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Size Number */}
            <div className={cn(
              "space-y-2 flex flex-col h-full transition-opacity",
              activeAttributeType && activeAttributeType !== 'sizeNumber' && "opacity-40 pointer-events-none"
            )}>
              <Label>Size Số ({selectedSizeNumber.length})</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm size số..."
                  value={sizeNumberFilter}
                  onChange={(e) => setSizeNumberFilter(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <ScrollArea className="flex-1 rounded-md border p-3 bg-muted/30 max-h-[400px]">
                <div className="space-y-1">
                  {filteredSizeNumber.map((item) => (
                    <div 
                      key={item.Id}
                      onClick={() => toggleSelection('sizeNumber', item.Name)}
                      className={cn(
                        "flex items-center space-x-3 py-3 px-2 rounded cursor-pointer transition-all",
                        "hover:bg-accent/50 active:bg-accent",
                        selectedSizeNumber.includes(item.Name) && "bg-primary/10 border border-primary/20"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                        selectedSizeNumber.includes(item.Name) 
                          ? "bg-primary border-primary" 
                          : "border-muted-foreground/30"
                      )}>
                        {selectedSizeNumber.includes(item.Name) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="flex-1 font-normal select-none">
                        {item.Name}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Preview Results - Always Visible */}
            <div className="space-y-2 flex flex-col h-full">
              <div className="flex items-center justify-between">
                <Label className="text-base">Xem trước kết quả</Label>
                {previewResults.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    {previewResults.length} biến thể
                  </Badge>
                )}
              </div>
              
              {previewResults.length > 0 ? (
                <div className="border rounded-lg overflow-hidden flex-1">
                  <ScrollArea className="h-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedVariantIndices.size === previewResults.length && previewResults.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedVariantIndices(new Set(previewResults.map((_, i) => i)));
                                } else {
                                  setSelectedVariantIndices(new Set());
                                }
                              }}
                            />
                          </TableHead>
                          <TableHead className="w-12"></TableHead>
                          <TableHead className="w-[110px]">Mã Đầy Đủ</TableHead>
                          <TableHead>Tên Sản Phẩm</TableHead>
                          <TableHead>Biến thể</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewResults.map((result, index) => (
                          <TableRow 
                            key={index}
                            className={cn(
                              selectedVariantIndices.has(index) && "bg-primary/5 border-l-2 border-l-primary"
                            )}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedVariantIndices.has(index)}
                                onCheckedChange={(checked) => {
                                  const newSet = new Set(selectedVariantIndices);
                                  if (checked) {
                                    newSet.add(index);
                                  } else {
                                    newSet.delete(index);
                                  }
                                  setSelectedVariantIndices(newSet);
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveVariantFromPreview(index);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {result.fullCode}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {result.productName}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {result.variantText}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              ) : (
                <div className="border rounded-lg flex-1 flex items-center justify-center bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Chọn thuộc tính để xem trước biến thể
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Hủy
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={previewResults.length === 0}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Xác Nhận Tạo {previewResults.length > 0 ? `${previewResults.length} Biến Thể` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
