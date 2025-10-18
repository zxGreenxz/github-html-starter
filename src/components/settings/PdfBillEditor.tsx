import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { BillTemplate, BillField, DEFAULT_BILL_TEMPLATE } from '@/types/bill-template';
import { generateBillPDF } from '@/lib/bill-pdf-generator';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, 
  Eye, 
  EyeOff, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Save,
  RefreshCw,
  Download,
  Upload,
  Printer
} from 'lucide-react';
import { getActivePrinter, printPDFToXC80 } from '@/lib/printer-utils';

const FIELD_LABELS: Record<string, string> = {
  sessionIndex: 'Số thứ tự (#)',
  phone: 'Số điện thoại',
  customerName: 'Tên khách hàng',
  productCode: 'Mã sản phẩm',
  productName: 'Tên sản phẩm',
  comment: 'Ghi chú',
  createdTime: 'Thời gian tạo',
  price: 'Giá',
  quantity: 'Số lượng'
};

interface SortableFieldItemProps {
  field: BillField;
  onUpdate: (updatedField: BillField) => void;
}

function SortableFieldItem({ field, onUpdate }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-4 bg-card mb-2"
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>

        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{FIELD_LABELS[field.key]}</Label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUpdate({ ...field, visible: !field.visible })}
              >
                {field.visible ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {field.visible && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Font size: {field.fontSize}pt</Label>
                <Slider
                  value={[field.fontSize]}
                  onValueChange={([value]) => onUpdate({ ...field, fontSize: value })}
                  min={8}
                  max={48}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={field.align === 'left' ? 'default' : 'outline'}
                    onClick={() => onUpdate({ ...field, align: 'left' })}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={field.align === 'center' ? 'default' : 'outline'}
                    onClick={() => onUpdate({ ...field, align: 'center' })}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={field.align === 'right' ? 'default' : 'outline'}
                    onClick={() => onUpdate({ ...field, align: 'right' })}
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant={field.fontWeight === 'bold' ? 'default' : 'outline'}
                  onClick={() => onUpdate({ 
                    ...field, 
                    fontWeight: field.fontWeight === 'bold' ? 'normal' : 'bold' 
                  })}
                >
                  <strong>B</strong>
                </Button>
              </div>

              {field.label !== undefined && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Prefix (optional)</Label>
                  <Input
                    value={field.label || ''}
                    onChange={(e) => onUpdate({ ...field, label: e.target.value })}
                    placeholder="VD: Khách: "
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function PdfBillEditor() {
  const [template, setTemplate] = useState<BillTemplate>(DEFAULT_BILL_TEMPLATE);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved template from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('billTemplate');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTemplate(parsed);
      } catch (error) {
        console.error('Failed to load template:', error);
      }
    }
  }, []);

  // Generate preview whenever template changes
  useEffect(() => {
    // Debounce preview generation
    const timer = setTimeout(() => {
      generatePreview();
    }, 300);
    return () => clearTimeout(timer);
  }, [template]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTemplate((prev) => {
        const oldIndex = prev.fields.findIndex((f) => f.id === active.id);
        const newIndex = prev.fields.findIndex((f) => f.id === over.id);
        const newFields = arrayMove(prev.fields, oldIndex, newIndex);
        
        // Update order property
        return {
          ...prev,
          fields: newFields.map((f, idx) => ({ ...f, order: idx + 1 }))
        };
      });
    }
  };

  const handleFieldUpdate = (fieldId: string, updatedField: BillField) => {
    setTemplate((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => f.id === fieldId ? updatedField : f)
    }));
  };

  const generatePreview = () => {
    try {
      const now = new Date();
      const sampleData = {
        sessionIndex: '123',
        phone: '0901234567',
        customerName: 'Nguyễn Văn A',
        productCode: 'SP001',
        productName: '001 Áo thun nam basic cotton',
        comment: 'Size: L, Màu: Đen',
        createdTime: now.toISOString(),
        price: 250000,
        quantity: 2
      };

      console.log('🖼️ Generating PDF preview with template:', template);
      const pdf = generateBillPDF(template, sampleData);
      const pdfDataUri = pdf.output('datauristring');
      console.log('✅ PDF preview generated successfully');
      setPreviewUrl(pdfDataUri);
    } catch (error) {
      console.error('❌ Preview generation error:', error);
      setPreviewUrl(null);
      toast({
        variant: 'destructive',
        title: 'Lỗi tạo preview',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleSave = () => {
    localStorage.setItem('billTemplate', JSON.stringify(template));
    toast({
      title: 'Đã lưu template',
      description: 'Template bill đã được lưu thành công'
    });
  };

  const handleReset = () => {
    setTemplate(DEFAULT_BILL_TEMPLATE);
    localStorage.removeItem('billTemplate');
    toast({
      title: 'Đã reset template',
      description: 'Template bill đã được khôi phục về mặc định'
    });
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'bill-template.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast({
      title: 'Đã export template',
      description: 'File JSON đã được tải xuống'
    });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setTemplate(imported);
        toast({
          title: 'Đã import template',
          description: 'Template đã được import thành công'
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Lỗi import',
          description: 'File JSON không hợp lệ'
        });
      }
    };
    reader.readAsText(file);
  };

  const handleTestPrint = async () => {
    if (!previewUrl) {
      toast({
        variant: 'destructive',
        title: 'Chưa có preview',
        description: 'Vui lòng đợi preview được tạo'
      });
      return;
    }

    const activePrinter = getActivePrinter();
    if (!activePrinter) {
      toast({
        variant: 'destructive',
        title: 'Chưa có máy in',
        description: 'Vui lòng thiết lập máy in trong tab Máy in'
      });
      return;
    }

    try {
      console.log('🖨️ Printing test bill via bitmap...');
      
      toast({
        title: '⏳ Đang in...',
        description: `Đang chuyển PDF sang bitmap và gửi tới ${activePrinter.name}`
      });
      
      // Print PDF as bitmap
      const result = await printPDFToXC80(activePrinter, previewUrl);
      
      if (result.success) {
        toast({
          title: '✅ In thử thành công',
          description: `Đã gửi tới ${activePrinter.name}`
        });
      } else {
        throw new Error(result.error);
      }
      
    } catch (error: any) {
      console.error('Print error:', error);
      toast({
        variant: 'destructive',
        title: '❌ Lỗi in',
        description: error.message || 'Không thể in PDF'
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel - Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Chỉnh sửa Bill Template</CardTitle>
          <CardDescription>
            Kéo thả để sắp xếp thứ tự, tùy chỉnh font và alignment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={template.fields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {template.fields.map((field) => (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    onUpdate={(updated) => handleFieldUpdate(field.id, updated)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </ScrollArea>

          {/* Paper Size Settings */}
          <div className="mt-4 space-y-4 border-t pt-4">
            <div>
              <Label>Chiều rộng giấy: {template.paperWidth}mm</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant={template.paperWidth === 58 ? 'default' : 'outline'}
                  onClick={() => setTemplate(prev => ({ ...prev, paperWidth: 58 }))}
                >
                  58mm
                </Button>
                <Button
                  size="sm"
                  variant={template.paperWidth === 80 ? 'default' : 'outline'}
                  onClick={() => setTemplate(prev => ({ ...prev, paperWidth: 80 }))}
                >
                  80mm
                </Button>
              </div>
              <Slider
                value={[template.paperWidth]}
                onValueChange={([value]) => setTemplate(prev => ({ ...prev, paperWidth: value }))}
                min={58}
                max={100}
                step={1}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Chiều cao giấy: {template.paperHeight}mm</Label>
              <Slider
                value={[template.paperHeight]}
                onValueChange={([value]) => setTemplate(prev => ({ ...prev, paperHeight: value }))}
                min={100}
                max={400}
                step={10}
                className="mt-2"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Lưu
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <Button onClick={handleTestPrint} variant="secondary" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              In thử
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Right Panel - Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Xem trước bill với dữ liệu mẫu (#{template.fields.filter(f => f.visible).length} trường hiển thị)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Sample Data Display */}
            <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-muted-foreground mb-2">📋 Dữ liệu mẫu:</div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Số thứ tự:</span>
                <span className="font-mono">#123</span>
                <span className="text-muted-foreground">SĐT:</span>
                <span className="font-mono">0901234567</span>
                <span className="text-muted-foreground">Khách hàng:</span>
                <span>Nguyễn Văn A</span>
                <span className="text-muted-foreground">Mã SP:</span>
                <span className="font-mono">SP001</span>
                <span className="text-muted-foreground">Tên SP:</span>
                <span>Áo thun nam basic</span>
                <span className="text-muted-foreground">Ghi chú:</span>
                <span>Size: L, Màu: Đen</span>
                <span className="text-muted-foreground">Giá:</span>
                <span>250,000 đ</span>
                <span className="text-muted-foreground">Số lượng:</span>
                <span>SL: 2</span>
              </div>
            </div>

            {/* PDF Preview */}
            {previewUrl ? (
              <div className="border rounded-lg overflow-hidden bg-white">
                <iframe
                  src={previewUrl}
                  className="w-full h-[500px]"
                  title="PDF Preview"
                />
              </div>
            ) : (
              <div className="h-[500px] flex items-center justify-center border rounded-lg bg-muted">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Đang tạo preview...</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
