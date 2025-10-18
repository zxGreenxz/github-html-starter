import { useState, useEffect } from "react";
import { Printer, Plus, Trash2, TestTube2, RefreshCw, AlertCircle, CheckCircle, Wifi, Download, FileCode, Package, Info, Terminal, FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TextToImagePrinter } from "./TextToImagePrinter";
import { TextToPdfPrinter } from "./TextToPdfPrinter";
import { textToESCPOSBitmap } from "@/lib/text-to-bitmap";
import { useToast } from "@/hooks/use-toast";

interface NetworkPrinter {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  bridgeUrl: string;
  isActive: boolean;
  createdAt: string;
}

export default function NetworkPrinterManager() {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<NetworkPrinter[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<NetworkPrinter | null>(null);
  
  const [newPrinterName, setNewPrinterName] = useState("");
  const [newPrinterIp, setNewPrinterIp] = useState("");
  const [newPrinterPort, setNewPrinterPort] = useState("9100");
  const [bridgeUrl, setBridgeUrl] = useState("http://localhost:9100");
  
  const [isDownloadingBridge, setIsDownloadingBridge] = useState(false);
  const [isDownloadingConfig, setIsDownloadingConfig] = useState(false);
  const [isDownloadingPackage, setIsDownloadingPackage] = useState(false);
  
  const [testContent, setTestContent] = useState(
    "================================\n" +
    "     XC80 TEST TIẾNG VIỆT\n" +
    "================================\n" +
    "Máy in: [Printer Name]\n" +
    "IP: [IP Address]\n" +
    "Thời gian: [Time]\n" +
    "--------------------------------\n" +
    "In thử tiếng Việt (CÓ DẤU):\n" +
    "- Xin chào Việt Nam!\n" +
    "- Đây là bản in thử nghiệm.\n" +
    "- Các ký tự: áàảãạ éèẻẽẹ\n" +
    "- Giá: 150,000 VNĐ\n" +
    "================================\n\n\n"
  );
  
  const [isPrinting, setIsPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = () => {
    const stored = localStorage.getItem("networkPrinters");
    if (stored) {
      setPrinters(JSON.parse(stored));
    }
  };

  const savePrinters = (updatedPrinters: NetworkPrinter[]) => {
    localStorage.setItem("networkPrinters", JSON.stringify(updatedPrinters));
    setPrinters(updatedPrinters);
  };

  const downloadFile = (content: string, filename: string, type: string = 'text/javascript') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadFileFromUrl = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      downloadFile(content, filename, 'text/plain');
      
      // Simple success notification - không quá intrusive
      console.log(`✅ Downloaded: ${filename}`);
    } catch (error: any) {
      console.error('Download error:', error);
      alert(`❌ Lỗi tải file: ${error.message}\n\nVui lòng thử lại hoặc tải thủ công từ:\n${url}`);
    }
  };

  const handleDownloadBridgeServer = async () => {
    setIsDownloadingBridge(true);
    const url = 'https://nhijudyshop.github.io/n2store/tpos-import/xc80-bridge-cp1258.js';
    await downloadFileFromUrl(url, 'xc80-bridge-cp1258.js');
    setIsDownloadingBridge(false);
  };

  const handleDownloadConfigScript = async () => {
    setIsDownloadingConfig(true);
    const url = 'https://nhijudyshop.github.io/n2store/tpos-import/config-xc80-cp1258.js';
    await downloadFileFromUrl(url, 'config-xc80-cp1258.js');
    setIsDownloadingConfig(false);
  };

  const handleDownloadPackageJson = async () => {
    setIsDownloadingPackage(true);
    const url = 'https://nhijudyshop.github.io/n2store/tpos-import/package.json';
    await downloadFileFromUrl(url, 'package.json');
    setIsDownloadingPackage(false);
  };

  const handleDownloadHTML = () => {
    // Mở link hướng dẫn HTML online
    const guideUrl = 'https://nhijudyshop.github.io/n2store/tpos-import/printer.html';
    window.open(guideUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadAllInstructions = () => {
    const instructions = `
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║          HƯỚNG DẪN CÀI ĐẶT XC80 PRINT BRIDGE V5.0             ║
║                   (CP1258 - In tiếng Việt có dấu)             ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

📋 MỤC LỤC:
══════════
1. Yêu cầu hệ thống
2. Tải và cài đặt files
3. Chạy Bridge Server
4. Cấu hình máy in XC80
5. Test và sử dụng
6. Troubleshooting


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ YÊU CẦU HỆ THỐNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Phần mềm:
   • Node.js 14.x trở lên (tải tại: https://nodejs.org)
   • npm (đi kèm với Node.js)

✅ Phần cứng:
   • Máy in nhiệt XC80 hoặc tương thích
   • Kết nối mạng LAN/WiFi với máy in
   • Máy in có IP address cố định (khuyến nghị)

✅ Kiến thức:
   • Biết sử dụng Command Line/Terminal cơ bản
   • Biết IP address của máy in


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣ TẢI VÀ CÀI ĐẶT FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Bước 1: Tạo thư mục project
────────────────────────────────
Mở Terminal/Command Prompt và chạy:

    mkdir xc80-bridge
    cd xc80-bridge


📥 Bước 2: Tải các files (3 files)
──────────────────────────────────

File 1: package.json
   → Tải từ UI: Click nút "📦 Tải package.json"
   → Hoặc copy từ artifact "package.json" bên trái
   → Lưu vào: xc80-bridge/package.json

File 2: xc80-bridge-cp1258.js (Main server)
   → Copy từ artifact "xc80-bridge-cp1258.js" bên trái
   → Lưu vào: xc80-bridge/xc80-bridge-cp1258.js
   → ⚠️ File này ~400 dòng, phải copy toàn bộ!

File 3: config-xc80-cp1258.js (Configuration tool)
   → Copy từ artifact "config-xc80-cp1258.js" bên trái
   → Lưu vào: xc80-bridge/config-xc80-cp1258.js
   → 🔧 Dùng để cấu hình Code Page trên máy in


📦 Bước 3: Cài đặt dependencies
────────────────────────────────
Trong thư mục xc80-bridge, chạy:

    npm install

Chờ khoảng 30 giây để npm tải các thư viện cần thiết.

✅ Kết quả: Sẽ có thư mục node_modules/ được tạo ra


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣ CHẠY BRIDGE SERVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Start server:

    node xc80-bridge-cp1258.js

Hoặc:

    npm start


✅ Server chạy thành công khi thấy:
────────────────────────────────────

    ╔═══════════════════════════════════════════════╗
    ║   XC80 Print Bridge v5.0 - CP1258            ║
    ║   Server running on port 9100                ║
    ╚═══════════════════════════════════════════════╝

    ✅ Server is ready to accept connections!


🧪 Test server:
────────────────
Mở browser hoặc terminal khác, gõ:

    http://localhost:9100/health

Hoặc:

    curl http://localhost:9100/health

Nếu thấy JSON response → Server đang chạy OK!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4️⃣ CẤU HÌNH MÁY IN XC80
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ QUAN TRỌNG: Máy in phải hỗ trợ Code Page 30 (CP1258)
   để in tiếng Việt có dấu.


🔧 Cách 1: Dùng XPrinter Tool (KHUYẾN NGHỊ)
────────────────────────────────────────────

1. Tải XPrinter Configuration Tool:
   → http://www.xprintertech.com/download
   → Hoặc Google: "XPrinter Configuration Tool download"

2. Cài đặt và mở tool

3. Kết nối máy in:
   • USB: Cắm cáp USB
   • Network: Nhập IP của máy in

4. Vào Settings:
   → International Character Set
   → Chọn "PC1258" hoặc "30"
   → Apply

5. Restart máy in

6. In test page từ tool để kiểm tra


🔧 Cách 2: Dùng script tự động
──────────────────────────────

Nếu không có XPrinter Tool, dùng script:

    node config-xc80-cp1258.js 192.168.1.100 9100

Thay 192.168.1.100 bằng IP máy in của bạn.

Script sẽ:
✅ Gửi lệnh cấu hình Code Page 30
✅ In test page tiếng Việt
✅ Giúp bạn kiểm tra xem máy in có hỗ trợ CP1258 không


📋 Kiểm tra kết quả:
────────────────────
Xem test page vừa in ra:

✅ NẾU THẤY: "Xin chào Việt Nam!" → Thành công!
❌ NẾU THẤY: Ký tự lạ/vuông → Máy in không hỗ trợ CP1258
   → Dùng mode "NO-ACCENTS" (bỏ dấu) thay thế


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5️⃣ TEST VÀ SỬ DỤNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🖥️ Test từ Web UI:
───────────────────

1. Mở web app → Settings → Tab "Máy in"

2. Click "Thêm máy in":
   • Bridge URL: http://localhost:9100
   • Tên máy in: XC80 Kho 1
   • IP: 192.168.1.100 (IP máy in của bạn)
   • Port: 9100

3. Click "Test" để test kết nối

4. Click "In thử":
   • Chọn mode: CP1258 (mặc định)
   • Click "In thử (cp1258)"

5. Kiểm tra giấy in có chữ Việt đúng không


🧪 Test từ Terminal (Advanced):
────────────────────────────────

Test với curl:

curl -X POST http://localhost:9100/printers/test \\
  -H "Content-Type: application/json" \\
  -d '{"ipAddress":"192.168.1.100","port":9100}'


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6️⃣ TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 Lỗi: "Cannot connect to printer"
────────────────────────────────────
✅ Kiểm tra:
   • IP máy in có đúng không?
   • Ping thử: ping 192.168.1.100
   • Máy in có bật không?
   • Máy in có kết nối mạng không?


🔴 Lỗi: "npm: command not found"
─────────────────────────────────
✅ Giải pháp:
   • Cài Node.js: https://nodejs.org
   • Restart terminal sau khi cài
   • Kiểm tra: node --version


🔴 Tiếng Việt bị lỗi font/ký tự lạ
──────────────────────────────────
✅ Giải pháp:
   • Máy in chưa hỗ trợ CP1258
   • Chạy: node config-xc80-cp1258.js [IP] [PORT]
   • Hoặc dùng mode "NO-ACCENTS"


🔴 Port 9100 bị chiếm
──────────────────────
✅ Giải pháp:
   • Tắt ứng dụng đang dùng port 9100
   • Hoặc đổi PORT trong code:
     const PORT = 9200; // Dòng 16 trong xc80-bridge-cp1258.js


🔴 Bridge server bị dừng khi tắt terminal
──────────────────────────────────────────
✅ Giải pháp: Chạy server như background service

Windows:
    pm2 start xc80-bridge-cp1258.js

Mac/Linux:
    nohup node xc80-bridge-cp1258.js &


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 HỖ TRỢ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 Tài liệu:
   • XPrinter: http://www.xprintertech.com
   • ESC/POS Commands: Google "ESC/POS command reference"

🐛 Báo lỗi:
   • Ghi lại: Loại lỗi, message, bước đang làm
   • Screenshot nếu có thể


╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║                   🎉 CHÚC BẠN THÀNH CÔNG! 🎉                   ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

Generated by XC80 Bridge v5.0
Date: ${new Date().toLocaleString('vi-VN')}
    `;
    downloadFile(instructions, 'HUONG-DAN-CAI-DAT.txt', 'text/plain');
  };

  const testPrinterConnection = async (printer: NetworkPrinter) => {
    setIsTesting(printer.id);
    try {
      const response = await fetch(`${printer.bridgeUrl}/printers/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: printer.ipAddress,
          port: printer.port,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Kết nối thành công đến ${printer.name}!`);
      } else {
        alert(`❌ Không thể kết nối: ${data.error}`);
      }
    } catch (error: any) {
      alert(`❌ Lỗi: ${error.message}\n\nĐảm bảo Print Bridge v5.0 đang chạy tại ${printer.bridgeUrl}`);
    } finally {
      setIsTesting(null);
    }
  };

  const handleAddPrinter = () => {
    if (!newPrinterName.trim() || !newPrinterIp.trim()) {
      alert("Vui lòng nhập đầy đủ thông tin máy in");
      return;
    }

    const newPrinter: NetworkPrinter = {
      id: crypto.randomUUID(),
      name: newPrinterName.trim(),
      ipAddress: newPrinterIp.trim(),
      port: parseInt(newPrinterPort) || 9100,
      bridgeUrl: bridgeUrl.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const updatedPrinters = [...printers, newPrinter];
    savePrinters(updatedPrinters);

    setNewPrinterName("");
    setNewPrinterIp("");
    setNewPrinterPort("9100");
    setIsAddDialogOpen(false);
  };

  const handleTogglePrinter = (id: string) => {
    const updatedPrinters = printers.map((p) =>
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    savePrinters(updatedPrinters);
  };

  const handleDeletePrinter = (id: string) => {
    if (confirm("Bạn có chắc muốn xóa máy in này?")) {
      const updatedPrinters = printers.filter((p) => p.id !== id);
      savePrinters(updatedPrinters);
    }
  };

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      toast({
        title: "⚠️ Chưa chọn máy in",
        description: "Vui lòng chọn máy in",
        variant: "destructive"
      });
      return;
    }

    if (!testContent.trim()) {
      toast({
        title: "⚠️ Chưa có nội dung",
        description: "Vui lòng nhập nội dung in thử",
        variant: "destructive"
      });
      return;
    }

    setIsPrinting(true);
    setPrintResult(null);

    try {
      // Replace placeholders
      const content = testContent
        .replace("[Printer Name]", selectedPrinter.name)
        .replace("[IP Address]", `${selectedPrinter.ipAddress}:${selectedPrinter.port}`)
        .replace("[Time]", new Date().toLocaleString("vi-VN"));

      // Convert text to ESC/POS bitmap (384px = 80mm printer)
      const bitmapBytes = await textToESCPOSBitmap(content, {
        width: 384,
        fontSize: 20,
        fontFamily: 'Arial',
        lineHeight: 1.5,
        align: 'left',
        padding: 20
      });

      // Convert to base64
      const base64Bitmap = btoa(String.fromCharCode(...bitmapBytes));

      // Send bitmap to printer via bridge
      const response = await fetch(`${selectedPrinter.bridgeUrl}/print/bitmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: selectedPrinter.ipAddress,
          port: selectedPrinter.port,
          bitmapBase64: base64Bitmap,
          feeds: 3
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setPrintResult(result);

      if (result.success) {
        toast({
          title: "✅ In thử thành công",
          description: `Đã in tới ${selectedPrinter.name} (Bitmap mode)`
        });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error("Print error:", error);
      toast({
        title: "❌ Lỗi in",
        description: `${error.message}. Đảm bảo Bridge Server v5.0 đang chạy tại ${selectedPrinter.bridgeUrl}`,
        variant: "destructive"
      });
      setPrintResult({ success: false, error: error.message });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Quản lý máy in mạng XC80
          </CardTitle>
          <CardDescription>
            In trực tiếp qua TCP/IP - Hỗ trợ tiếng Việt có dấu với CP1258
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Alert thông tin */}
          <Alert className="bg-green-50 border-green-200">
            <Info className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">✅ In dạng ảnh (Bitmap) - Tiếng Việt 100% chính xác</AlertTitle>
            <AlertDescription className="text-sm text-green-700">
              <div className="space-y-2 mt-2">
                <div>
                  <strong>✨ Chế độ BITMAP (Mặc định)</strong>
                  <br />
                  <span className="text-xs">Chuyển text thành ảnh → In 100% chính xác tiếng Việt có dấu</span>
                  <br />
                  <span className="text-xs font-semibold">⚙️ Không cần cấu hình Code Page trên máy in</span>
                </div>
                <div>
                  <strong>🎯 Ưu điểm:</strong>
                  <br />
                  <span className="text-xs">✓ Hỗ trợ tất cả ký tự đặc biệt và emoji</span>
                  <br />
                  <span className="text-xs">✓ Không bị lỗi font chữ tiếng Việt</span>
                  <br />
                  <span className="text-xs">✓ Tương thích với mọi máy in nhiệt</span>
                </div>
                <div className="pt-2 mt-2 border-t border-green-300">
                  <strong>📖 Hướng dẫn chi tiết:</strong>
                  <br />
                  <span className="text-xs">
                    Mở accordion "Hướng dẫn cài đặt đầy đủ" bên dưới → Click nút <strong>"📖 Hướng dẫn HTML đẹp (Online)"</strong> 
                    để xem step-by-step instructions với giao diện đẹp!
                  </span>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Accordion hướng dẫn chi tiết */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="instructions">
              <AccordionTrigger className="text-base font-semibold">
                📖 Hướng dẫn cài đặt đầy đủ (Click để xem)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6 p-4 bg-muted/50 rounded-lg">
                  {/* Bước 1 */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                      Tải các file cần thiết
                    </h3>
                    
                    <div className="alert alert-success p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg mb-4">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">🎉</span>
                        <div>
                          <h4 className="font-bold text-purple-800 mb-2">✨ Tất cả files sẵn sàng tải về!</h4>
                          <p className="text-sm text-purple-700 mb-2">
                            <strong>Bước 1:</strong> Click nút <strong>"📖 Hướng dẫn HTML đẹp (Online)"</strong> để đọc hướng dẫn chi tiết.
                            <br />
                            <strong>Bước 2:</strong> Tải 3 files bên dưới (tất cả đều download trực tiếp).
                            <br />
                            <strong>Bước 3:</strong> Làm theo hướng dẫn để cài đặt.
                          </p>
                          <p className="text-xs text-purple-600">
                            💡 Tip: Tạo folder <code>xc80-bridge</code> trước, rồi lưu tất cả 3 files vào folder đó.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8">
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={handleDownloadPackageJson}
                        disabled={isDownloadingPackage}
                      >
                        {isDownloadingPackage ? (
                          <RefreshCw className="h-5 w-5 mr-2 text-blue-500 animate-spin" />
                        ) : (
                          <FileJson className="h-5 w-5 mr-2 text-blue-500" />
                        )}
                        <div className="text-left">
                          <div className="font-semibold">📦 package.json</div>
                          <div className="text-xs text-muted-foreground">
                            {isDownloadingPackage ? 'Đang tải...' : 'Click để tải xuống'}
                          </div>
                        </div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={handleDownloadBridgeServer}
                        disabled={isDownloadingBridge}
                      >
                        {isDownloadingBridge ? (
                          <RefreshCw className="h-5 w-5 mr-2 text-green-500 animate-spin" />
                        ) : (
                          <FileCode className="h-5 w-5 mr-2 text-green-500" />
                        )}
                        <div className="text-left">
                          <div className="font-semibold">🚀 xc80-bridge-cp1258.js</div>
                          <div className="text-xs text-muted-foreground">
                            {isDownloadingBridge ? 'Đang tải...' : 'Main server (400+ dòng)'}
                          </div>
                        </div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={handleDownloadConfigScript}
                        disabled={isDownloadingConfig}
                      >
                        {isDownloadingConfig ? (
                          <RefreshCw className="h-5 w-5 mr-2 text-orange-500 animate-spin" />
                        ) : (
                          <Terminal className="h-5 w-5 mr-2 text-orange-500" />
                        )}
                        <div className="text-left">
                          <div className="font-semibold">🔧 config-xc80-cp1258.js</div>
                          <div className="text-xs text-muted-foreground">
                            {isDownloadingConfig ? 'Đang tải...' : 'Config tool (300+ dòng)'}
                          </div>
                        </div>
                      </Button>
                      
                      <Button
                        variant="default"
                        className="justify-start h-auto py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                        onClick={handleDownloadHTML}
                      >
                        <Download className="h-5 w-5 mr-2" />
                        <div className="text-left">
                          <div className="font-semibold">📖 Hướng dẫn HTML (Online)</div>
                          <div className="text-xs">Mở trang hướng dẫn chi tiết</div>
                        </div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={handleDownloadAllInstructions}
                      >
                        <FileText className="h-5 w-5 mr-2 text-gray-500" />
                        <div className="text-left">
                          <div className="font-semibold">📝 Hướng dẫn TXT</div>
                          <div className="text-xs text-muted-foreground">Plain text offline</div>
                        </div>
                      </Button>
                    </div>
                  </div>

                  {/* Bước 2 */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                      Cài đặt và chạy
                    </h3>
                    <div className="pl-8 space-y-3">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm font-semibold text-blue-800 mb-1">
                          ✅ Sau khi tải 3 files ở Bước 1:
                        </p>
                        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                          <li>Kiểm tra thư mục <strong>Downloads</strong> của bạn</li>
                          <li>Tạo folder mới: <code className="bg-blue-100 px-1 py-0.5 rounded">xc80-bridge</code></li>
                          <li>Di chuyển 3 files vào folder đó</li>
                        </ol>
                      </div>
                      
                      <code className="block bg-black text-green-400 p-3 rounded text-sm">
                        <span className="comment"># Windows (Command Prompt)</span><br />
                        C:\Users\YourName\Downloads&gt; mkdir xc80-bridge<br />
                        C:\Users\YourName\Downloads&gt; move *.js xc80-bridge\<br />
                        C:\Users\YourName\Downloads&gt; move *.json xc80-bridge\<br />
                        C:\Users\YourName\Downloads&gt; cd xc80-bridge<br />
                        <br />
                        <span className="comment"># Mac/Linux (Terminal)</span><br />
                        $ cd ~/Downloads<br />
                        $ mkdir xc80-bridge<br />
                        $ mv *.js *.json xc80-bridge/<br />
                        $ cd xc80-bridge<br />
                        <br />
                        <span className="comment"># Cài đặt và chạy (cả Windows & Mac/Linux)</span><br />
                        $ npm install<br />
                        $ node xc80-bridge-cp1258.js
                      </code>
                      
                      <p className="text-sm text-muted-foreground">
                        ✅ Server chạy OK khi thấy: <strong>"Server running on port 9100"</strong>
                      </p>
                    </div>
                  </div>

                  {/* Bước 3 */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                      Cấu hình máy in XC80
                    </h3>
                    <div className="pl-8 space-y-3">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                        <p className="font-semibold text-amber-800 mb-2">🔧 Cách 1: XPrinter Tool (Khuyến nghị)</p>
                        <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
                          <li>Tải: <a href="http://www.xprintertech.com/download" target="_blank" className="underline">xprintertech.com/download</a></li>
                          <li>Kết nối máy in (USB hoặc Network)</li>
                          <li>Settings → Character Set → PC1258 (30)</li>
                          <li>Apply và restart máy in</li>
                        </ol>
                      </div>
                      
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="font-semibold text-blue-800 mb-2">🤖 Cách 2: Script tự động</p>
                        <code className="block bg-black text-green-400 p-2 rounded text-sm">
                          $ node config-xc80-cp1258.js 192.168.1.100 9100
                        </code>
                        <p className="text-sm text-blue-700 mt-2">
                          Thay IP và Port của máy in. Script sẽ in test page tiếng Việt.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bước 4 */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">4</span>
                      Test và sử dụng
                    </h3>
                    <div className="pl-8 space-y-2">
                      <p className="text-sm">
                        ✅ Thêm máy in bằng nút "Thêm máy in" bên dưới
                      </p>
                      <p className="text-sm">
                        ✅ Chọn mode <strong>CP1258</strong> để in tiếng Việt có dấu
                      </p>
                      <p className="text-sm">
                        ✅ Click "In thử" để kiểm tra
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Nút actions */}
          <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Thêm máy in
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Thêm máy in XC80</DialogTitle>
                  <DialogDescription>
                    Cấu hình máy in để in trực tiếp qua mạng
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bridge-url">Bridge Server URL</Label>
                    <Input
                      id="bridge-url"
                      value={bridgeUrl}
                      onChange={(e) => setBridgeUrl(e.target.value)}
                      placeholder="http://localhost:9100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="printer-name">Tên máy in</Label>
                    <Input
                      id="printer-name"
                      value={newPrinterName}
                      onChange={(e) => setNewPrinterName(e.target.value)}
                      placeholder="XC80 Kho 1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="printer-ip">IP Address</Label>
                      <Input
                        id="printer-ip"
                        value={newPrinterIp}
                        onChange={(e) => setNewPrinterIp(e.target.value)}
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="printer-port">Port</Label>
                      <Input
                        id="printer-port"
                        type="number"
                        value={newPrinterPort}
                        onChange={(e) => setNewPrinterPort(e.target.value)}
                        placeholder="9100"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Hủy
                  </Button>
                  <Button onClick={handleAddPrinter}>
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={loadPrinters}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Làm mới
            </Button>
          </div>

          {/* Danh sách máy in */}
          {printers.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Chưa có máy in</AlertTitle>
              <AlertDescription>
                Nhấn "Thêm máy in" để cấu hình máy in XC80 đầu tiên
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {printers.map((printer) => (
                <Card key={printer.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Printer className="h-5 w-5" />
                          <h3 className="font-semibold text-lg">{printer.name}</h3>
                          <Badge variant={printer.isActive ? "default" : "secondary"}>
                            {printer.isActive ? "Hoạt động" : "Tắt"}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20">IP:Port:</span>
                            <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                              {printer.ipAddress}:{printer.port}
                            </code>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-20">Bridge:</span>
                            <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                              {printer.bridgeUrl}
                            </code>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Bật/Tắt:</span>
                          <Switch
                            checked={printer.isActive}
                            onCheckedChange={() => handleTogglePrinter(printer.id)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testPrinterConnection(printer)}
                            disabled={!printer.isActive || isTesting === printer.id}
                          >
                            {isTesting === printer.id ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                Test...
                              </>
                            ) : (
                              <>
                                <Wifi className="h-4 w-4 mr-1" />
                                Test
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setSelectedPrinter(printer);
                              setIsTestDialogOpen(true);
                            }}
                            disabled={!printer.isActive}
                          >
                            <TestTube2 className="h-4 w-4 mr-1" />
                            In thử
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeletePrinter(printer.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Dialog In thử */}
          <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>🎨 In thử nghiệm - Bitmap Mode</DialogTitle>
                <DialogDescription>
                  Máy in: {selectedPrinter?.name} ({selectedPrinter?.ipAddress}:{selectedPrinter?.port})
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-700">
                    <strong>💡 Chế độ in Bitmap:</strong> Text sẽ được chuyển thành ảnh trước khi in. 
                    Điều này đảm bảo tiếng Việt có dấu hiển thị 100% chính xác, không cần cấu hình Code Page.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="test-content">Nội dung in thử</Label>
                  <Textarea
                    id="test-content"
                    value={testContent}
                    onChange={(e) => setTestContent(e.target.value)}
                    className="font-mono text-sm min-h-[200px]"
                    placeholder="Nhập nội dung..."
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Hỗ trợ: [Printer Name], [IP Address], [Time]
                  </p>
                </div>

                {printResult && (
                  <Alert variant={printResult.success ? "default" : "destructive"}>
                    {printResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>
                      {printResult.success ? "✅ In thành công" : "❌ Lỗi in"}
                    </AlertTitle>
                    <AlertDescription>
                      {printResult.success ? (
                        <div className="text-sm space-y-1">
                          <div>Job ID: <code className="bg-muted px-1 py-0.5 rounded">{printResult.jobID}</code></div>
                          <div>Encoding: <Badge variant="outline">{printResult.encoding}</Badge></div>
                        </div>
                      ) : (
                        <div className="text-sm">{printResult.error}</div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
                  Đóng
                </Button>
                <Button onClick={handleTestPrint} disabled={isPrinting}>
                  {isPrinting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Đang in...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4 mr-2" />
                      In thử (Bitmap)
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Text to Image Printer */}
      <TextToImagePrinter />

      {/* Text to PDF Printer */}
      <TextToPdfPrinter />
    </div>
  );
}