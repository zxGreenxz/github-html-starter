import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FlaskConical, AlertTriangle } from "lucide-react";
import { generateAllVariants } from "@/lib/variant-generator-adapter";
import { TPOS_ATTRIBUTES, DEFAULT_SELECTIONS } from "@/lib/tpos-attributes";

export function VariantTestTool() {
  const [productCode, setProductCode] = useState("M800");
  const [productName, setProductName] = useState("Áo Thun");
  const [selectedSizeText, setSelectedSizeText] = useState<string[]>(DEFAULT_SELECTIONS.sizeText);
  const [selectedColors, setSelectedColors] = useState<string[]>(DEFAULT_SELECTIONS.color);
  const [selectedSizeNumber, setSelectedSizeNumber] = useState<string[]>(DEFAULT_SELECTIONS.sizeNumber);
  const [results, setResults] = useState<Array<{
    variant: string;
    code: string;
    fullCode: string;
    productName: string;
    hasCollision: boolean;
  }>>([]);

  // Auto-generate on load
  useEffect(() => {
    handleTest();
  }, []);

  const toggleSelection = (type: 'sizeText' | 'color' | 'sizeNumber', value: string) => {
    if (type === 'sizeText') {
      setSelectedSizeText(prev => 
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
    } else if (type === 'color') {
      setSelectedColors(prev => 
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
    } else {
      setSelectedSizeNumber(prev => 
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
    }
  };

  const handleTest = () => {
    if (!productCode.trim()) {
      return;
    }

    if (!productName.trim()) {
      return;
    }

    if (selectedSizeText.length === 0 && selectedColors.length === 0 && selectedSizeNumber.length === 0) {
      return;
    }

    try {
      // Use the standard generator
      const generatedVariants = generateAllVariants({
        productCode: productCode.trim(),
        productName: productName.trim(),
        sizeTexts: selectedSizeText,
        colors: selectedColors,
        sizeNumbers: selectedSizeNumber
      });

      const formattedResults = generatedVariants.map(v => ({
        variant: v.variantText,
        code: v.variantCode,
        fullCode: v.fullCode,
        productName: v.productName,
        hasCollision: v.hasCollision
      }));

      setResults(formattedResults);
    } catch (error) {
      console.error('Error generating variants:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          Test Trộn Biến Thể
        </CardTitle>
        <CardDescription>
          Tạo mã variant tự động với logic: Size Chữ (chữ cái đầu) + Màu (chữ cái đầu mỗi từ) + Size Số
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="product-code">Mã Sản Phẩm Gốc</Label>
            <Input
              id="product-code"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="Ví dụ: M800, TEST"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-name">Tên Sản Phẩm Gốc</Label>
            <Input
              id="product-name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ví dụ: Áo Thun"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Size Text Selection */}
          <div className="space-y-2">
            <Label>Size Chữ ({selectedSizeText.length} đã chọn)</Label>
            <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/30">
              <div className="space-y-2">
                {TPOS_ATTRIBUTES.sizeText.map((item) => (
                  <div key={item.Id} className="flex items-center space-x-2 hover:bg-accent p-2 rounded cursor-pointer" onClick={() => toggleSelection('sizeText', item.Name)}>
                    <Checkbox
                      id={`size-${item.Id}`}
                      checked={selectedSizeText.includes(item.Name)}
                      onCheckedChange={() => toggleSelection('sizeText', item.Name)}
                    />
                    <Label htmlFor={`size-${item.Id}`} className="cursor-pointer flex-1 font-normal">
                      {item.Name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label>Màu Sắc ({selectedColors.length} đã chọn)</Label>
            <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/30">
              <div className="space-y-2">
                {TPOS_ATTRIBUTES.color.map((item) => (
                  <div key={item.Id} className="flex items-center space-x-2 hover:bg-accent p-2 rounded cursor-pointer" onClick={() => toggleSelection('color', item.Name)}>
                    <Checkbox
                      id={`color-${item.Id}`}
                      checked={selectedColors.includes(item.Name)}
                      onCheckedChange={() => toggleSelection('color', item.Name)}
                    />
                    <Label htmlFor={`color-${item.Id}`} className="cursor-pointer flex-1 font-normal">
                      {item.Name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Size Number Selection */}
          <div className="space-y-2">
            <Label>Size Số ({selectedSizeNumber.length} đã chọn)</Label>
            <ScrollArea className="h-[200px] rounded-md border p-3 bg-muted/30">
              <div className="space-y-2">
                {TPOS_ATTRIBUTES.sizeNumber.map((item) => (
                  <div key={item.Id} className="flex items-center space-x-2 hover:bg-accent p-2 rounded cursor-pointer" onClick={() => toggleSelection('sizeNumber', item.Name)}>
                    <Checkbox
                      id={`num-${item.Id}`}
                      checked={selectedSizeNumber.includes(item.Name)}
                      onCheckedChange={() => toggleSelection('sizeNumber', item.Name)}
                    />
                    <Label htmlFor={`num-${item.Id}`} className="cursor-pointer flex-1 font-normal">
                      {item.Name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Button onClick={handleTest} className="w-full">
          <FlaskConical className="mr-2 h-4 w-4" />
          Tạo Kết Quả
        </Button>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Kết Quả</h3>
              <Badge variant="secondary">{results.length} biến thể</Badge>
            </div>
            
            <div className="border rounded-lg">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-32">Mã Đầy Đủ</TableHead>
                      <TableHead className="w-28">Mã Variant</TableHead>
                      <TableHead>Tên Sản Phẩm</TableHead>
                      <TableHead>Chi Tiết Variant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {result.fullCode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {result.code}
                            </code>
                            {result.hasCollision && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Collision
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {result.productName}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {result.variant}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
