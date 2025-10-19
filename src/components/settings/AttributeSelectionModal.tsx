import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle, X } from "lucide-react";
import { TPOS_ATTRIBUTES } from "@/lib/variant-attributes";
import { useToast } from "@/hooks/use-toast";

// Attribute line structure for TPOS API
export interface AttributeLine {
  Attribute: {
    Id: number;
    Name: string;
    Code: string;
    Sequence: null;
    CreateVariant: true;
  };
  Values: Array<{
    Id: number;
    Name: string;
    Code: null;
    Sequence: number | null;
    AttributeId: number;
    AttributeName: string;
    PriceExtra: null;
    NameGet: string;
    DateCreated: null;
  }>;
  AttributeId: number;
}

interface AttributeSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAttributeLines: AttributeLine[];
  onSave: (attributeLines: AttributeLine[]) => void;
}

const ATTRIBUTE_CONFIGS = {
  sizeText: { 
    id: 1, 
    name: "Size Chữ", 
    code: "SZCh", 
    values: TPOS_ATTRIBUTES.sizeText 
  },
  color: { 
    id: 3, 
    name: "Màu", 
    code: "Mau", 
    values: TPOS_ATTRIBUTES.color 
  },
  sizeNumber: { 
    id: 4, 
    name: "Size Số", 
    code: "SZNu", 
    values: TPOS_ATTRIBUTES.sizeNumber 
  }
};

export function AttributeSelectionModal({ open, onOpenChange, initialAttributeLines, onSave }: AttributeSelectionModalProps) {
  const [currentLines, setCurrentLines] = useState<AttributeLine[]>(initialAttributeLines);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setCurrentLines(initialAttributeLines);
    }
  }, [open, initialAttributeLines]);

  const handleAddValue = (type: keyof typeof ATTRIBUTE_CONFIGS, valueId: number) => {
    const config = ATTRIBUTE_CONFIGS[type];
    const selectedValue = config.values.find(v => v.Id === valueId);
    
    if (!selectedValue) return;
    
    // Find existing AttributeLine
    const existingLineIndex = currentLines.findIndex(line => line.AttributeId === config.id);
    
    // Check duplicate
    if (existingLineIndex !== -1) {
      if (currentLines[existingLineIndex].Values.find(v => v.Id === valueId)) {
        toast({
          title: "Lỗi",
          description: "Giá trị đã được thêm",
          variant: "destructive"
        });
        return;
      }
    }
    
    // Create new value
    const newValue = {
      Id: selectedValue.Id,
      Name: selectedValue.Name,
      Code: null,
      Sequence: selectedValue.Sequence || null,
      AttributeId: config.id,
      AttributeName: config.name,
      PriceExtra: null,
      NameGet: `${config.name}: ${selectedValue.Name}`,
      DateCreated: null
    };
    
    // Update or create AttributeLine
    if (existingLineIndex !== -1) {
      const updatedLines = [...currentLines];
      updatedLines[existingLineIndex] = {
        ...updatedLines[existingLineIndex],
        Values: [...updatedLines[existingLineIndex].Values, newValue]
      };
      setCurrentLines(updatedLines);
    } else {
      const newLine: AttributeLine = {
        Attribute: {
          Id: config.id,
          Name: config.name,
          Code: config.code,
          Sequence: null,
          CreateVariant: true
        },
        Values: [newValue],
        AttributeId: config.id
      };
      setCurrentLines([...currentLines, newLine]);
    }
  };

  const handleRemoveValue = (type: keyof typeof ATTRIBUTE_CONFIGS, valueId: number) => {
    const config = ATTRIBUTE_CONFIGS[type];
    const attrLine = currentLines.find(line => line.AttributeId === config.id);
    
    if (!attrLine) return;
    
    attrLine.Values = attrLine.Values.filter(v => v.Id !== valueId);
    
    // Remove line if empty
    if (attrLine.Values.length === 0) {
      setCurrentLines(currentLines.filter(line => line.AttributeId !== config.id));
    } else {
      setCurrentLines([...currentLines]);
    }
  };

  const getSelectedValues = (type: keyof typeof ATTRIBUTE_CONFIGS) => {
    const config = ATTRIBUTE_CONFIGS[type];
    const attrLine = currentLines.find(line => line.AttributeId === config.id);
    return attrLine?.Values || [];
  };

  const handleSave = () => {
    onSave(currentLines);
    toast({
      title: "Thành công",
      description: "Đã lưu biến thể"
    });
  };

  const renderAttributeTab = (type: keyof typeof ATTRIBUTE_CONFIGS, label: string) => {
    const config = ATTRIBUTE_CONFIGS[type];
    const selectedValues = getSelectedValues(type);

    return (
      <TabsContent value={type} className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label>{label}</Label>
          <Select onValueChange={(valueId) => handleAddValue(type, parseInt(valueId))}>
            <SelectTrigger>
              <SelectValue placeholder={`-- Chọn ${label} --`} />
            </SelectTrigger>
            <SelectContent>
              {config.values.map((val) => (
                <SelectItem key={val.Id} value={val.Id.toString()}>
                  {val.Name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Đã chọn:</Label>
          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md">
            {selectedValues.length === 0 ? (
              <span className="text-sm text-muted-foreground">Chưa có giá trị</span>
            ) : (
              selectedValues.map((val) => (
                <Badge key={val.Id} variant="secondary" className="gap-2">
                  {val.Name}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:text-destructive" 
                    onClick={() => handleRemoveValue(type, val.Id)}
                  />
                </Badge>
              ))
            )}
          </div>
        </div>
      </TabsContent>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chọn biến thể sản phẩm</DialogTitle>
          <DialogDescription>
            Chọn các thuộc tính để tạo biến thể sản phẩm trên TPOS
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="sizeText" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="sizeText">Size Chữ</TabsTrigger>
            <TabsTrigger value="color">Màu sắc</TabsTrigger>
            <TabsTrigger value="sizeNumber">Size Số</TabsTrigger>
          </TabsList>

          {renderAttributeTab("sizeText", "Size Chữ")}
          {renderAttributeTab("color", "Màu sắc")}
          {renderAttributeTab("sizeNumber", "Size Số")}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSave}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Lưu biến thể
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
