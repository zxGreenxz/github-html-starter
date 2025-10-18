import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getActivePrinter } from "@/lib/printer-utils";
import { textToESCPOSBitmap } from "@/lib/text-to-bitmap";
import { Image, Printer, Download } from "lucide-react";

export function TextToImagePrinter() {
  const { toast } = useToast();
  
  const [text, setText] = useState(`Hóa đơn bán hàng
Công ty TNHH ABC
Địa chỉ: 123 Nguyễn Huệ, Quận 1, TP.HCM
---------------------------------------
Sản phẩm: Điện thoại iPhone 15
Giá: 25.000.000 đ
Số lượng: 1
---------------------------------------
Tổng tiền: 25.000.000 đ
Cảm ơn quý khách!`);
  
  const [fontSize, setFontSize] = useState(20);
  const [canvasWidth, setCanvasWidth] = useState(384); // 80mm printer
  const [fontFamily, setFontFamily] = useState("Arial");
  const [lineHeight, setLineHeight] = useState(1.5);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleGenerateImage = async () => {
    try {
      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      ctx.font = `${fontSize}px ${fontFamily}`;
      const lines = text.split('\n');
      const padding = 20;
      const lineHeightPx = fontSize * lineHeight;
      const canvasHeight = (lines.length * lineHeightPx) + (padding * 2);

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Black text
      ctx.fillStyle = 'black';
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'top';

      lines.forEach((line, index) => {
        const y = padding + (index * lineHeightPx);
        ctx.fillText(line, padding, y);
      });

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      setPreviewImage(dataUrl);

      toast({
        title: "✅ Tạo ảnh thành công",
        description: "Bạn có thể xem preview và in ảnh"
      });

    } catch (error: any) {
      toast({
        title: "❌ Lỗi tạo ảnh",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handlePrintImage = async () => {
    if (!previewImage) {
      toast({
        title: "⚠️ Chưa có ảnh",
        description: "Vui lòng tạo ảnh trước khi in",
        variant: "destructive"
      });
      return;
    }

    const activePrinter = getActivePrinter();
    if (!activePrinter) {
      toast({
        title: "⚠️ Chưa có máy in",
        description: "Vui lòng thiết lập máy in trong tab Máy in",
        variant: "destructive"
      });
      return;
    }

    setIsPrinting(true);

    try {
      // Send to bridge using /print endpoint with CP1258 mode
      const response = await fetch(`${activePrinter.bridgeUrl}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: activePrinter.ipAddress,
          port: activePrinter.port,
          content: text,
          options: {
            mode: 'cp1258',
            align: 'left',
            feeds: 3
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "✅ In thành công",
          description: `Đã gửi lệnh in tới ${activePrinter.name}`
        });
      } else {
        throw new Error(result.error || 'Unknown error');
      }

    } catch (error: any) {
      toast({
        title: "❌ Lỗi in ảnh",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = () => {
    if (!previewImage) {
      toast({
        title: "⚠️ Chưa có ảnh",
        description: "Vui lòng tạo ảnh trước",
        variant: "destructive"
      });
      return;
    }

    const link = document.createElement('a');
    link.download = `text_image_${Date.now()}.png`;
    link.href = previewImage;
    link.click();

    toast({
      title: "✅ Đã tải ảnh",
      description: "Ảnh đã được lưu vào máy"
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Text to Image - In Tiếng Việt
        </CardTitle>
        <CardDescription>
          Chuyển text tiếng Việt thành ảnh để in (100% chính xác có dấu)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="inputText">Nội dung cần in:</Label>
          <Textarea
            id="inputText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Nhập text tiếng Việt..."
            className="font-mono"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="fontSize">Cỡ chữ (px):</Label>
            <Input
              id="fontSize"
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              min={10}
              max={100}
            />
          </div>

          <div>
            <Label htmlFor="canvasWidth">Độ rộng (px):</Label>
            <Input
              id="canvasWidth"
              type="number"
              value={canvasWidth}
              onChange={(e) => setCanvasWidth(Number(e.target.value))}
              min={200}
              max={1200}
            />
          </div>

          <div>
            <Label htmlFor="fontFamily">Font chữ:</Label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger id="fontFamily">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arial">Arial</SelectItem>
                <SelectItem value="Courier New">Courier New</SelectItem>
                <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                <SelectItem value="Verdana">Verdana</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="lineHeight">Khoảng cách dòng:</Label>
            <Input
              id="lineHeight"
              type="number"
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              min={1}
              max={3}
              step={0.1}
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleGenerateImage} variant="default">
            <Image className="mr-2 h-4 w-4" />
            Tạo ảnh
          </Button>
          <Button 
            onClick={handlePrintImage} 
            variant="secondary"
            disabled={!previewImage || isPrinting}
          >
            {isPrinting ? (
              <>⏳ Đang in...</>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                In ảnh
              </>
            )}
          </Button>
          <Button 
            onClick={handleDownload} 
            variant="outline"
            disabled={!previewImage}
          >
            <Download className="mr-2 h-4 w-4" />
            Tải về
          </Button>
        </div>

        {previewImage && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <p className="text-sm text-gray-600 mb-2 font-medium">Preview:</p>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full border bg-white rounded"
            />
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          💡 <strong>Tip:</strong> Sau khi tạo ảnh, bạn có thể in trực tiếp qua máy in hoặc tải về để sử dụng
        </div>
      </CardContent>
    </Card>
  );
}
