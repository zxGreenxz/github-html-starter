import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Loader2,
  FileText,
  Download,
  Printer,
  ChevronDown,
  Settings2,
  Edit,
  Undo,
  Redo,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
} from "lucide-react";
import { getActivePrinter } from "@/lib/printer-utils";
import { textToESCPOSBitmap } from "@/lib/text-to-bitmap";
import jsPDF from "jspdf";

type PaperSize = {
  name: string;
  width: number;
  height: number;
};

const PAPER_SIZES: PaperSize[] = [
  { name: "A4 (210 x 297 mm)", width: 210, height: 297 },
  { name: "80mm Thermal (80 x 210 mm)", width: 80, height: 210 },
  { name: "58mm Thermal (58 x 210 mm)", width: 58, height: 210 },
  { name: "Custom", width: 80, height: 210 },
];

const VIETNAMESE_FONTS = ["Arial", "Tahoma", "Times New Roman", "Verdana", "Roboto", "Open Sans", "Noto Sans"];

export const TextToPdfPrinter = () => {
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

  // Font settings
  const [fontSize, setFontSize] = useState("14");
  const [fontFamily, setFontFamily] = useState("Tahoma");
  const [lineHeight, setLineHeight] = useState("1.5");

  // Paper settings
  const [selectedPaperIndex, setSelectedPaperIndex] = useState(1); // 80mm thermal default
  const [customWidth, setCustomWidth] = useState("80");
  const [customHeight, setCustomHeight] = useState("210");

  // Margin settings
  const [marginTop, setMarginTop] = useState("10");
  const [marginBottom, setMarginBottom] = useState("10");
  const [marginLeft, setMarginLeft] = useState("10");
  const [marginRight, setMarginRight] = useState("10");

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Simple editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const [currentHeading, setCurrentHeading] = useState("p");

  const getInvoiceTemplate = () => {
    return `<div style="font-family: Tahoma, sans-serif;">
<h1 style="text-align: center;">HÓA ĐƠN BÁN HÀNG</h1>
<p><strong>Công ty TNHH ABC</strong></p>
<p>Địa chỉ: 123 Nguyễn Huệ, Quận 1, TP.HCM</p>
<p>Điện thoại: 028-1234-5678</p>
<hr>
<p>Khách hàng: <strong>Nguyễn Văn A</strong></p>
<p>Ngày: <strong>${new Date().toLocaleDateString("vi-VN")}</strong></p>
<table border="1" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <thead>
    <tr>
      <th style="padding: 8px; border: 1px solid #000;">STT</th>
      <th style="padding: 8px; border: 1px solid #000;">Sản phẩm</th>
      <th style="padding: 8px; border: 1px solid #000;">Số lượng</th>
      <th style="padding: 8px; border: 1px solid #000;">Đơn giá</th>
      <th style="padding: 8px; border: 1px solid #000;">Thành tiền</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8px; border: 1px solid #000;">1</td>
      <td style="padding: 8px; border: 1px solid #000;">Điện thoại iPhone 15</td>
      <td style="padding: 8px; border: 1px solid #000;">1</td>
      <td style="padding: 8px; border: 1px solid #000;">25.000.000 đ</td>
      <td style="padding: 8px; border: 1px solid #000;">25.000.000 đ</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #000;">2</td>
      <td style="padding: 8px; border: 1px solid #000;">Ốp lưng iPhone 15</td>
      <td style="padding: 8px; border: 1px solid #000;">2</td>
      <td style="padding: 8px; border: 1px solid #000;">200.000 đ</td>
      <td style="padding: 8px; border: 1px solid #000;">400.000 đ</td>
    </tr>
  </tbody>
</table>
<p style="text-align: right;"><strong>Tổng cộng: 25.400.000 đ</strong></p>
<p style="text-align: right;"><strong>Đã thanh toán: 25.400.000 đ</strong></p>
<p style="text-align: right;"><strong>Còn lại: 0 đ</strong></p>
<hr>
<p style="text-align: center;"><em>Cảm ơn quý khách! Hẹn gặp lại!</em></p>
</div>`.trim();
  };

  const handleOpenEditor = () => {
    const template = getInvoiceTemplate();
    setEditorContent(template);
    setEditorOpen(true);
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleHeadingChange = (value: string) => {
    setCurrentHeading(value);
    execCommand("formatBlock", value);
  };

  const handlePreview = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Preview</title>
          <style>
            body { font-family: Tahoma, sans-serif; padding: 20px; }
          </style>
        </head>
        <body>${content}</body>
        </html>
      `);
      previewWindow.document.close();
    }
  };

  const getPaperSize = () => {
    const paper = PAPER_SIZES[selectedPaperIndex];
    if (paper.name === "Custom") {
      return {
        width: parseFloat(customWidth),
        height: parseFloat(customHeight),
      };
    }
    return { width: paper.width, height: paper.height };
  };

  const handleGeneratePreview = async () => {
    if (!text.trim()) {
      toast.error("Vui lòng nhập nội dung cần xem trước");
      return;
    }

    setIsGenerating(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Cannot get canvas context");

      const paperSize = getPaperSize();
      const mmToPx = 3.78;
      const width = Math.round(paperSize.width * mmToPx);

      const margins = {
        top: parseInt(marginTop),
        bottom: parseInt(marginBottom),
        left: parseInt(marginLeft),
        right: parseInt(marginRight),
      };

      const fontSizeNum = parseInt(fontSize);
      const lineHeightNum = parseFloat(lineHeight);

      ctx.font = `${fontSizeNum}px ${fontFamily}, sans-serif`;

      const lines: string[] = [];
      const textLines = text.split("\n");
      const maxWidth = width - (margins.left + margins.right);

      textLines.forEach((line) => {
        if (!line) {
          lines.push("");
          return;
        }

        const words = line.split(" ");
        let currentLine = "";

        words.forEach((word) => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);

          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });

        if (currentLine) {
          lines.push(currentLine);
        }
      });

      const lineHeightPx = fontSizeNum * lineHeightNum;
      const height = Math.ceil(lines.length * lineHeightPx + margins.top + margins.bottom);

      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${fontSizeNum}px ${fontFamily}, sans-serif`;
      ctx.fillStyle = "#000000";
      ctx.textBaseline = "top";

      lines.forEach((line, index) => {
        const y = margins.top + index * lineHeightPx;
        ctx.fillText(line, margins.left, y);
      });

      const imageUrl = canvas.toDataURL("image/png");
      setPreviewImage(imageUrl);

      toast.success("✅ Đã tạo ảnh xem trước!");
    } catch (error) {
      console.error("Preview error:", error);
      toast.error("❌ Lỗi khi tạo ảnh xem trước");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (!previewImage) {
      toast.error("Vui lòng tạo ảnh xem trước trước");
      return;
    }

    try {
      const link = document.createElement("a");
      link.href = previewImage;
      link.download = `print-preview-${Date.now()}.png`;
      link.click();
      toast.success("✅ Đã tải ảnh xuống!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("❌ Lỗi khi tải xuống");
    }
  };

  const handlePrintFromEditor = async () => {
    if (!editorRef.current) return;

    const editedHtml = editorRef.current.innerHTML;

    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = editedHtml;
      const plainText = tempDiv.innerText || tempDiv.textContent || "";

      const activePrinter = getActivePrinter();
      if (!activePrinter) {
        toast.error("❌ Không tìm thấy máy in đang active");
        return;
      }

      const paperSize = getPaperSize();
      const mmToPx = 3.78;
      const printerWidth = Math.round(paperSize.width * mmToPx);

      const escposData = await textToESCPOSBitmap(plainText, {
        width: printerWidth,
        fontSize: parseInt(fontSize),
        fontFamily: `${fontFamily}, sans-serif`,
        lineHeight: parseFloat(lineHeight),
        align: "left",
        padding: parseInt(marginLeft),
      });

      const base64 = btoa(String.fromCharCode(...escposData));

      const response = await fetch(`${activePrinter.bridgeUrl}/print/bitmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerIp: activePrinter.ipAddress,
          printerPort: activePrinter.port,
          bitmapData: Array.from(escposData),
          feeds: 3,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        toast.success("✅ In thành công!");
        setEditorOpen(false);
      } else {
        throw new Error(result.error || "In thất bại");
      }
    } catch (error: any) {
      console.error("Print error:", error);
      toast.error(`❌ Lỗi khi in: ${error.message}`);
    }
  };

  const handleDownloadPDFFromEditor = () => {
    if (!editorRef.current) return;

    const editedHtml = editorRef.current.innerHTML;

    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = editedHtml;
      const plainText = tempDiv.innerText || tempDiv.textContent || "";

      const paperSize = getPaperSize();
      const orientation = paperSize.width > paperSize.height ? "landscape" : "portrait";

      const doc = new jsPDF({
        orientation,
        unit: "mm",
        format: [paperSize.width, paperSize.height],
      });

      doc.setFont("helvetica");
      doc.setFontSize(parseInt(fontSize));

      const margins = {
        top: parseInt(marginTop),
        left: parseInt(marginLeft),
      };

      const maxWidth = paperSize.width - parseInt(marginLeft) - parseInt(marginRight);
      const lines = doc.splitTextToSize(plainText, maxWidth);
      doc.text(lines, margins.left, margins.top);

      doc.save(`invoice-${Date.now()}.pdf`);
      toast.success("✅ Đã tải PDF xuống!");
      setEditorOpen(false);
    } catch (error) {
      console.error("PDF error:", error);
      toast.error("❌ Lỗi khi tạo PDF");
    }
  };

  const handleDownloadPDF = () => {
    if (!text.trim()) {
      toast.error("Vui lòng nhập nội dung");
      return;
    }

    try {
      const paperSize = getPaperSize();
      const orientation = paperSize.width > paperSize.height ? "landscape" : "portrait";

      const doc = new jsPDF({
        orientation,
        unit: "mm",
        format: [paperSize.width, paperSize.height],
      });

      doc.setFont("helvetica");
      doc.setFontSize(parseInt(fontSize));

      const margins = {
        top: parseInt(marginTop),
        left: parseInt(marginLeft),
      };

      const maxWidth = paperSize.width - parseInt(marginLeft) - parseInt(marginRight);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, margins.left, margins.top);

      doc.save(`document-${Date.now()}.pdf`);
      toast.success("✅ Đã tải PDF xuống!");
    } catch (error) {
      console.error("PDF error:", error);
      toast.error("❌ Lỗi khi tạo PDF");
    }
  };

  const handlePrintAsPDF = async () => {
    const activePrinter = getActivePrinter();
    if (!activePrinter) {
      toast.error("❌ Không tìm thấy máy in đang active");
      return;
    }

    if (!text.trim()) {
      toast.error("Vui lòng nhập nội dung cần in");
      return;
    }

    setIsPrinting(true);
    try {
      const paperSize = getPaperSize();
      const orientation = paperSize.width > paperSize.height ? "landscape" : "portrait";

      const doc = new jsPDF({
        orientation,
        unit: "mm",
        format: [paperSize.width, paperSize.height],
      });

      doc.setFont("helvetica");
      doc.setFontSize(parseInt(fontSize));

      const margins = {
        top: parseInt(marginTop),
        left: parseInt(marginLeft),
      };

      const maxWidth = paperSize.width - parseInt(marginLeft) - parseInt(marginRight);
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, margins.left, margins.top);

      const pdfBase64 = doc.output("datauristring").split(",")[1];

      console.log(`📄 PDF generated, size: ${pdfBase64.length} bytes`);
      console.log(`📤 Sending to bridge: ${activePrinter.bridgeUrl}/print/pdf`);

      const response = await fetch(`${activePrinter.bridgeUrl}/print/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerIp: activePrinter.ipAddress,
          printerPort: activePrinter.port,
          pdfBase64: pdfBase64,
          dpi: 300,
          threshold: 115,
          width: 944,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Bridge error:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ Print result:", result);

      if (result.success) {
        toast.success("✅ In PDF thành công!");
      } else {
        throw new Error(result.error || "In thất bại");
      }
    } catch (error: any) {
      console.error("Print error:", error);
      if (error.message?.includes("404") || error.message?.includes("Failed to fetch")) {
        toast.error(
          "❌ Không kết nối được Bridge Server.\n\nVui lòng kiểm tra:\n1. Bridge đang chạy tại " +
            activePrinter.bridgeUrl +
            "\n2. Chạy: node xc80-bridge-cp1258.js",
        );
      } else if (error.message?.includes("pdftoppm") || error.message?.includes("poppler")) {
        toast.error(
          "❌ Chưa cài đặt poppler-utils.\n\nCài đặt:\n• Ubuntu: sudo apt-get install poppler-utils\n• macOS: brew install poppler\n• Windows: Download từ github.com/oschwartz10612/poppler-windows",
        );
      } else {
        toast.error(`❌ Lỗi khi in PDF: ${error.message}`);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrint = async () => {
    const activePrinter = getActivePrinter();
    if (!activePrinter) {
      toast.error("❌ Không tìm thấy máy in đang active");
      return;
    }

    if (!text.trim()) {
      toast.error("Vui lòng nhập nội dung cần in");
      return;
    }

    setIsPrinting(true);
    try {
      const paperSize = getPaperSize();
      const mmToPx = 3.78;
      const printerWidth = Math.round(paperSize.width * mmToPx);

      console.log("📄 Creating canvas with text...");

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      canvas.width = printerWidth;

      const lines = text.split("\n");
      const lineHeightPx = parseInt(fontSize) * parseFloat(lineHeight);
      const paddingPx = parseInt(marginLeft);
      canvas.height = Math.ceil(lines.length * lineHeightPx + paddingPx * 2);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#000000";
      ctx.font = `${fontSize}px ${fontFamily}, sans-serif`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";

      let yPos = paddingPx;
      lines.forEach((line) => {
        ctx.fillText(line, paddingPx, yPos);
        yPos += lineHeightPx;
      });

      console.log(`✅ Canvas created: ${canvas.width}x${canvas.height}px`);

      const dataUrl = canvas.toDataURL("image/png");
      const base64Png = dataUrl.split(",")[1];

      console.log(`📦 Sending to bridge: ${activePrinter.bridgeUrl}/print/bitmap`);

      const response = await fetch(`${activePrinter.bridgeUrl}/print/bitmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerIp: activePrinter.ipAddress,
          printerPort: activePrinter.port,
          bitmapData: Array.from(new Uint8Array(await (await fetch(dataUrl)).arrayBuffer())),
          feeds: 3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Bridge error:", errorText);
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ Print result:", result);

      if (result.success) {
        toast.success("✅ In thành công!");
      } else {
        throw new Error(result.error || "In thất bại");
      }
    } catch (error: any) {
      console.error("Print error:", error);
      toast.error(`❌ Lỗi khi in: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Text to PDF & Printer (Tahoma Font)
        </CardTitle>
        <CardDescription>
          Tạo PDF hoặc in văn bản trực tiếp lên máy in nhiệt với font Tahoma hỗ trợ tiếng Việt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="printer-text">Nội dung văn bản</Label>
          <Textarea
            id="printer-text"
            placeholder="Nhập nội dung cần in..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            style={{ fontFamily: `${fontFamily}, sans-serif` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="font-family">Font chữ</Label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger id="font-family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIETNAMESE_FONTS.map((font) => (
                  <SelectItem key={font} value={font}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="printer-font-size">Cỡ chữ (px)</Label>
            <Input
              id="printer-font-size"
              type="number"
              min="8"
              max="72"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="printer-line-height">Khoảng cách dòng</Label>
            <Input
              id="printer-line-height"
              type="number"
              min="1"
              max="3"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(e.target.value)}
            />
          </div>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Cài đặt nâng cao (Khổ giấy & Canh lề)
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "transform rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="paper-size">Khổ giấy</Label>
              <Select
                value={selectedPaperIndex.toString()}
                onValueChange={(val) => setSelectedPaperIndex(parseInt(val))}
              >
                <SelectTrigger id="paper-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_SIZES.map((paper, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {paper.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {PAPER_SIZES[selectedPaperIndex].name === "Custom" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-width">Chiều rộng (mm)</Label>
                  <Input
                    id="custom-width"
                    type="number"
                    min="50"
                    max="300"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-height">Chiều cao (mm)</Label>
                  <Input
                    id="custom-height"
                    type="number"
                    min="50"
                    max="500"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="mb-2 block">Lề (mm)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="margin-top" className="text-xs">
                    Trên
                  </Label>
                  <Input
                    id="margin-top"
                    type="number"
                    min="0"
                    max="50"
                    value={marginTop}
                    onChange={(e) => setMarginTop(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin-bottom" className="text-xs">
                    Dưới
                  </Label>
                  <Input
                    id="margin-bottom"
                    type="number"
                    min="0"
                    max="50"
                    value={marginBottom}
                    onChange={(e) => setMarginBottom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin-left" className="text-xs">
                    Trái
                  </Label>
                  <Input
                    id="margin-left"
                    type="number"
                    min="0"
                    max="50"
                    value={marginLeft}
                    onChange={(e) => setMarginLeft(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin-right" className="text-xs">
                    Phải
                  </Label>
                  <Input
                    id="margin-right"
                    type="number"
                    min="0"
                    max="50"
                    value={marginRight}
                    onChange={(e) => setMarginRight(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-wrap gap-2">
          <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
            <DialogTrigger asChild>
              <Button variant="default" onClick={handleOpenEditor}>
                <Edit className="h-4 w-4 mr-2" />
                Chỉnh sửa Template & In
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Chỉnh sửa Hóa đơn trước khi in</DialogTitle>
                <DialogDescription>Chỉnh sửa nội dung và định dạng hóa đơn đơn giản với font Tahoma</DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-hidden flex flex-col space-y-4">
                <div className="flex items-center gap-2 flex-wrap p-2 border rounded-lg bg-muted/50">
                  <Button variant="ghost" size="icon" onClick={() => execCommand("undo")} title="Undo">
                    <Undo className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => execCommand("redo")} title="Redo">
                    <Redo className="h-4 w-4" />
                  </Button>

                  <Separator orientation="vertical" className="h-6" />

                  <Select value={currentHeading} onValueChange={handleHeadingChange}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="p">Paragraph</SelectItem>
                      <SelectItem value="h1">Heading 1</SelectItem>
                      <SelectItem value="h2">Heading 2</SelectItem>
                      <SelectItem value="h3">Heading 3</SelectItem>
                    </SelectContent>
                  </Select>

                  <Separator orientation="vertical" className="h-6" />

                  <Button variant="ghost" size="icon" onClick={() => execCommand("bold")} title="Bold">
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => execCommand("italic")} title="Italic">
                    <Italic className="h-4 w-4" />
                  </Button>

                  <Separator orientation="vertical" className="h-6" />

                  <Button variant="ghost" size="icon" onClick={() => execCommand("justifyLeft")} title="Align Left">
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => execCommand("justifyCenter")} title="Align Center">
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => execCommand("justifyRight")} title="Align Right">
                    <AlignRight className="h-4 w-4" />
                  </Button>

                  <Separator orientation="vertical" className="h-6" />

                  <Button variant="ghost" size="icon" onClick={handlePreview} title="Preview">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>

                <div
                  ref={editorRef}
                  contentEditable
                  className="flex-1 overflow-auto border rounded-lg p-4 bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                  style={{
                    fontFamily: "Tahoma, sans-serif",
                    minHeight: "400px",
                  }}
                  dangerouslySetInnerHTML={{ __html: editorContent }}
                  onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
                />

                <div className="flex gap-2 justify-end pt-2 border-t">
                  <Button variant="outline" onClick={() => setEditorOpen(false)}>
                    Hủy
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadPDFFromEditor}>
                    <Download className="h-4 w-4 mr-2" />
                    Tải PDF
                  </Button>
                  <Button onClick={handlePrintFromEditor}>
                    <Printer className="h-4 w-4 mr-2" />
                    Xác nhận in
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={handleGeneratePreview} disabled={isGenerating || !text.trim()} variant="secondary">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Tạo ảnh xem trước
              </>
            )}
          </Button>

          <Button onClick={handleDownloadPDF} disabled={!text.trim()} variant="secondary">
            <Download className="h-4 w-4 mr-2" />
            Tải PDF xuống
          </Button>

          <Button onClick={handleDownloadImage} disabled={!previewImage} variant="secondary">
            <Download className="h-4 w-4 mr-2" />
            Tải ảnh xuống
          </Button>

          <Button onClick={handlePrint} disabled={isPrinting || !text.trim()} variant="outline">
            {isPrinting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang in...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                In Bitmap (Fast)
              </>
            )}
          </Button>

          <Button onClick={handlePrintAsPDF} disabled={isPrinting || !text.trim()} variant="default">
            {isPrinting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang in PDF...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                In PDF (High Quality)
              </>
            )}
          </Button>
        </div>

        {previewImage && (
          <div className="space-y-2">
            <Label>Xem trước ảnh sẽ in (Font Tahoma)</Label>
            <div className="border rounded-lg overflow-hidden bg-white p-4">
              <img src={previewImage} alt="Print Preview" className="max-w-full h-auto" />
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
          <p>
            💡 <strong>Hướng dẫn sử dụng:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>🆕 Chỉnh sửa Template:</strong> Nhấn nút xanh để mở trình soạn thảo WYSIWYG với mẫu hóa đơn
            </li>
            <li>
              <strong>Chọn font:</strong> Tất cả font đều hỗ trợ tiếng Việt đầy đủ
            </li>
            <li>
              <strong>Khổ giấy:</strong> Mở "Cài đặt nâng cao" để chọn khổ giấy phù hợp
            </li>
            <li>
              <strong>Canh lề:</strong> Điều chỉnh lề trên/dưới/trái/phải theo nhu cầu
            </li>
            <li>
              <strong>Xem trước:</strong> Kiểm tra bố cục trước khi in hoặc tải xuống
            </li>
            <li>
              <strong>2 chế độ in:</strong>
              <ul className="list-circle list-inside ml-4 space-y-1">
                <li>
                  <strong>In Bitmap (Fast):</strong> Nhanh, không cần poppler
                </li>
                <li>
                  <strong>In PDF (High Quality):</strong> Chất lượng cao hơn, CẦN cài poppler-utils
                </li>
              </ul>
            </li>
          </ul>
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="font-semibold text-amber-800 mb-1">⚠️ Cài đặt Poppler để dùng chế độ "In PDF":</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-amber-700">
              <li>
                <strong>Ubuntu/Debian:</strong>{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded">sudo apt-get install poppler-utils</code>
              </li>
              <li>
                <strong>macOS:</strong> <code className="bg-amber-100 px-1 py-0.5 rounded">brew install poppler</code>
              </li>
              <li>
                <strong>Windows:</strong> Download từ{" "}
                <a
                  href="https://github.com/oschwartz10612/poppler-windows/releases/"
                  target="_blank"
                  className="underline"
                >
                  github.com/oschwartz10612/poppler-windows
                </a>
              </li>
            </ul>
            <p className="text-xs mt-2">💡 Nếu chưa cài poppler, vẫn có thể dùng chế độ "In Bitmap (Fast)"</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
