import { useEffect, useState } from "react";
import { Printer, Plus, Trash2, Settings, TestTube, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface NetworkPrinter {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  bridgeUrl: string;
  isActive: boolean;
  createdAt: string;
}

const PrinterConfig = () => {
  const [printers, setPrinters] = useState<NetworkPrinter[]>([]);
  const [serverOnline, setServerOnline] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form states
  const [printerName, setPrinterName] = useState("");
  const [printerIp, setPrinterIp] = useState("");
  const [printerPort, setPrinterPort] = useState("9100");
  const [bridgeUrl, setBridgeUrl] = useState("http://localhost:3001");
  
  // Print settings
  const [width, setWidth] = useState("576");
  const [customWidth, setCustomWidth] = useState("");
  const [height, setHeight] = useState("auto");
  const [customHeight, setCustomHeight] = useState("");
  const [threshold, setThreshold] = useState("95");
  const [scale, setScale] = useState("2");
  
  // Test bill data
  const [sessionIndex, setSessionIndex] = useState("001");
  const [phone, setPhone] = useState("0901234567");
  const [customerName, setCustomerName] = useState("Nguyễn Văn A");
  const [productCode, setProductCode] = useState("SP001");
  const [productName, setProductName] = useState("Cà phê sữa đá");
  const [comment, setComment] = useState("Ít đường");

  useEffect(() => {
    loadPrinters();
    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkServer = async () => {
    try {
      const response = await fetch("http://localhost:3001/health");
      setServerOnline(response.ok);
    } catch {
      setServerOnline(false);
    }
  };

  const loadPrinters = () => {
    const saved = localStorage.getItem("networkPrinters");
    if (saved) {
      setPrinters(JSON.parse(saved));
    }
  };

  const savePrinters = (updatedPrinters: NetworkPrinter[]) => {
    localStorage.setItem("networkPrinters", JSON.stringify(updatedPrinters));
    setPrinters(updatedPrinters);
  };

  const addPrinter = () => {
    if (!printerName.trim() || !printerIp.trim()) {
      toast.error("Vui lòng nhập tên và IP máy in!");
      return;
    }

    const newPrinter: NetworkPrinter = {
      id: Date.now().toString(),
      name: printerName,
      ipAddress: printerIp,
      port: parseInt(printerPort),
      bridgeUrl,
      isActive: printers.length === 0,
      createdAt: new Date().toISOString(),
    };

    savePrinters([...printers, newPrinter]);
    setPrinterName("");
    setPrinterIp("");
    setPrinterPort("9100");
    setShowAddForm(false);
    toast.success("Đã thêm máy in thành công!");
  };

  const deletePrinter = (id: string) => {
    const filtered = printers.filter((p) => p.id !== id);
    if (filtered.length > 0 && !filtered.some((p) => p.isActive)) {
      filtered[0].isActive = true;
    }
    savePrinters(filtered);
    toast.success("Đã xóa máy in!");
  };

  const setActivePrinter = (id: string) => {
    const updated = printers.map((p) => ({
      ...p,
      isActive: p.id === id,
    }));
    savePrinters(updated);
    toast.success("Đã đặt làm máy in mặc định!");
  };

  const getEffectiveWidth = () => {
    if (width === "custom") return parseInt(customWidth) || 576;
    return parseInt(width);
  };

  const getEffectiveHeight = () => {
    if (height === "custom") return parseInt(customHeight) || null;
    if (height === "auto") return null;
    return parseInt(height);
  };

  const generateBillHTML = () => {
    const now = new Date().toLocaleString("vi-VN");
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 80mm;
            margin: 0;
            padding: 5mm;
            font-family: 'Arial Black', 'Arial', sans-serif;
            background: white;
            font-weight: 900;
          }
          .session-index {
            text-align: center;
            font-size: 36px;
            font-weight: 900;
            margin: 6px 0;
            letter-spacing: 2px;
            text-shadow: 1px 1px 0px #000;
          }
          .phone, .customer-name {
            text-align: center;
            font-size: 26px;
            font-weight: 900;
            margin: 5px 0;
            letter-spacing: 1px;
          }
          .product-code { font-size: 18px; font-weight: 900; margin: 5px 0; }
          .product-name { font-size: 18px; font-weight: 900; margin: 5px 0; line-height: 1.4; }
          .comment { text-align: center; font-size: 16px; font-weight: 900; font-style: italic; margin: 8px 0; }
          .time { text-align: center; font-size: 14px; font-weight: 900; margin: 8px 0; color: #222; }
          .separator { border-top: 3px dashed #000; margin: 8px 0; }
          .thank-you { text-align: center; font-size: 14px; font-weight: 900; margin-top: 6px; }
        </style>
      </head>
      <body>
        <div class="session-index">#${sessionIndex}</div>
        ${phone ? `<div class="phone">${phone}</div>` : ""}
        <div class="customer-name">${customerName}</div>
        <div class="product-code">${productCode}</div>
        <div class="product-name">${productName}</div>
        ${comment ? `<div class="comment">${comment}</div>` : ""}
        <div class="time">${now}</div>
        <div class="separator"></div>
        <div class="thank-you">Cảm ơn quý khách!</div>
      </body>
      </html>
    `;
  };

  const testPrint = async () => {
    const activePrinter = printers.find((p) => p.isActive);
    if (!activePrinter) {
      toast.error("Vui lòng chọn máy in!");
      return;
    }

    if (!serverOnline) {
      toast.error("Bridge server offline! Chạy: cd public/bridge && npm start");
      return;
    }

    try {
      const html = generateBillHTML();
      const response = await fetch(`${activePrinter.bridgeUrl}/print/html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          printerIp: activePrinter.ipAddress,
          printerPort: activePrinter.port,
          html,
          width: getEffectiveWidth(),
          height: getEffectiveHeight(),
          threshold: parseInt(threshold),
          scale: parseFloat(scale),
        }),
      });

      if (!response.ok) {
        throw new Error(`Bridge error: ${response.status}`);
      }

      toast.success("In thành công!");
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi in!");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-6xl mx-auto">
        <Card className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Printer className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Cấu hình Máy In</h1>
                <p className="text-sm text-primary font-semibold">Compact & Bold Edition</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${serverOnline ? "bg-green-100" : "bg-red-100"}`}>
              <div className={`w-3 h-3 rounded-full ${serverOnline ? "bg-green-500" : "bg-red-500"}`} />
              <span className={`text-sm font-semibold ${serverOnline ? "text-green-700" : "text-red-700"}`}>
                {serverOnline ? "Server Online" : "Server Offline"}
              </span>
            </div>
          </div>

          {/* Printer List */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Danh sách máy in</h2>
              <Button onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="w-4 h-4 mr-2" />
                Thêm máy in
              </Button>
            </div>

            {showAddForm && (
              <Card className="p-4 mb-4 bg-muted">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label>Tên máy in</Label>
                    <Input value={printerName} onChange={(e) => setPrinterName(e.target.value)} placeholder="Máy in bếp" />
                  </div>
                  <div>
                    <Label>IP Address</Label>
                    <Input value={printerIp} onChange={(e) => setPrinterIp(e.target.value)} placeholder="192.168.1.100" />
                  </div>
                  <div>
                    <Label>Port</Label>
                    <Input type="number" value={printerPort} onChange={(e) => setPrinterPort(e.target.value)} />
                  </div>
                  <div>
                    <Label>Bridge URL</Label>
                    <Input value={bridgeUrl} onChange={(e) => setBridgeUrl(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addPrinter}>Lưu máy in</Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>Hủy</Button>
                </div>
              </Card>
            )}

            <div className="space-y-3">
              {printers.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">
                  Chưa có máy in nào. Nhấn "Thêm máy in" để bắt đầu.
                </Card>
              ) : (
                printers.map((printer) => (
                  <Card key={printer.id} className={`p-4 ${printer.isActive ? "border-2 border-green-500 bg-green-50" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{printer.name}</h3>
                        <p className="text-sm text-muted-foreground">{printer.ipAddress}:{printer.port}</p>
                        <p className="text-xs text-muted-foreground">{printer.bridgeUrl}</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        {printer.isActive ? (
                          <div className="flex items-center gap-1 text-green-600 font-semibold px-3 py-1 bg-green-100 rounded">
                            <Check className="w-4 h-4" />
                            Active
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setActivePrinter(printer.id)}>
                            Set Active
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => deletePrinter(printer.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Print Settings */}
          <Card className="p-6 mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold">Cấu hình in - Compact & Bold</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>📏 Width (pixels)</Label>
                <Select value={width} onValueChange={setWidth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="576">576px (80mm) - Full Width ⭐</SelectItem>
                    <SelectItem value="512">512px (72mm)</SelectItem>
                    <SelectItem value="432">432px (60mm)</SelectItem>
                    <SelectItem value="384">384px (54mm)</SelectItem>
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {width === "custom" && (
                  <Input className="mt-2" type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} placeholder="576" />
                )}
              </div>

              <div>
                <Label>📐 Height (pixels)</Label>
                <Select value={height} onValueChange={setHeight}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto - Tự động ⭐</SelectItem>
                    <SelectItem value="800">800px</SelectItem>
                    <SelectItem value="1000">1000px</SelectItem>
                    <SelectItem value="1200">1200px</SelectItem>
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {height === "custom" && (
                  <Input className="mt-2" type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} placeholder="1000" />
                )}
              </div>

              <div>
                <Label>⚫ Threshold - Độ đậm</Label>
                <Select value={threshold} onValueChange={setThreshold}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="85">85 - Rất đậm</SelectItem>
                    <SelectItem value="95">95 - Đậm ⭐</SelectItem>
                    <SelectItem value="105">105 - Vừa</SelectItem>
                    <SelectItem value="115">115 - Cân bằng</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>🔍 Scale - Phóng to</Label>
                <Select value={scale} onValueChange={setScale}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1x</SelectItem>
                    <SelectItem value="1.5">1.5x</SelectItem>
                    <SelectItem value="2">2x ⭐</SelectItem>
                    <SelectItem value="2.5">2.5x</SelectItem>
                    <SelectItem value="3">3x</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="mt-4 p-4 bg-white">
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="text-center">
                  <div className="text-muted-foreground">Width</div>
                  <div className="font-bold text-primary">{getEffectiveWidth()}px</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">Height</div>
                  <div className="font-bold text-primary">{getEffectiveHeight() || "Auto"}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">Threshold</div>
                  <div className="font-bold text-primary">{threshold}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">Scale</div>
                  <div className="font-bold text-primary">{scale}x</div>
                </div>
              </div>
            </Card>
          </Card>

          {/* Test Bill */}
          <Card className="p-6 bg-indigo-50">
            <div className="flex items-center gap-2 mb-4">
              <TestTube className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold">Test In Bill</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input value={sessionIndex} onChange={(e) => setSessionIndex(e.target.value)} placeholder="Session Index" />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại" />
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Tên khách hàng" />
              <Input value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="Mã sản phẩm" />
              <Input className="col-span-2" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Tên sản phẩm" />
              <Input className="col-span-2" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ghi chú" />
            </div>

            <Button onClick={testPrint} className="w-full" size="lg">
              <Printer className="w-5 h-5 mr-2" />
              Test In Bill (Compact & Bold)
            </Button>
          </Card>
        </Card>
      </div>
    </div>
  );
};

export default PrinterConfig;
