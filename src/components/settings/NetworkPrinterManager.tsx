import { useState, useEffect } from "react";
import {
  Printer,
  Plus,
  Trash2,
  TestTube2,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  printHTMLToXC80,
  getActivePrinter,
  getAllPrinters,
  savePrinters as savePrintersUtil,
  testPrinterConnection,
  NetworkPrinter,
} from "@/lib/printer-utils";
import { generateBillHTML } from "@/lib/bill-pdf-generator";

// Width presets
const WIDTH_OPTIONS = [
  { value: "576", label: "576px (80mm Full Width) ⭐" },
  { value: "512", label: "512px (72mm)" },
  { value: "432", label: "432px (60mm)" },
  { value: "384", label: "384px (54mm Compact)" },
  { value: "custom", label: "Custom..." },
];

// Height presets
const HEIGHT_OPTIONS = [
  { value: "auto", label: "Auto ⭐" },
  { value: "800", label: "800px (Short)" },
  { value: "1000", label: "1000px (Medium)" },
  { value: "1200", label: "1200px (Long)" },
  { value: "1500", label: "1500px (Very Long)" },
  { value: "custom", label: "Custom..." },
];

// Threshold presets
const THRESHOLD_OPTIONS = [
  { value: "85", label: "85 (Very Dark)" },
  { value: "95", label: "95 (Bold) ⭐" },
  { value: "105", label: "105 (Medium)" },
  { value: "115", label: "115 (Balanced)" },
  { value: "125", label: "125 (Light)" },
];

// Scale presets
const SCALE_OPTIONS = [
  { value: "1", label: "1x (Normal)" },
  { value: "1.5", label: "1.5x (Good)" },
  { value: "2", label: "2x (High) ⭐" },
  { value: "2.5", label: "2.5x (Very High)" },
  { value: "3", label: "3x (Maximum)" },
];

export default function NetworkPrinterManager() {
  const { toast } = useToast();
  
  // Printer list state
  const [printers, setPrinters] = useState<NetworkPrinter[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState("");
  const [newPrinterIp, setNewPrinterIp] = useState("");
  const [newPrinterPort, setNewPrinterPort] = useState("9100");
  const [bridgeUrl, setBridgeUrl] = useState("http://localhost:9100");
  
  // Test print state
  const [testData, setTestData] = useState({
    sessionIndex: "TEST",
    phone: "0901234567",
    customerName: "Khách hàng test",
    productCode: "TEST001",
    productName: "Sản phẩm test",
    comment: "Ghi chú test",
    price: 50000,
    quantity: 1,
  });
  
  // Print settings state
  const [printSettings, setPrintSettings] = useState({
    width: "576",
    height: "auto",
    threshold: "95",
    scale: "2",
    customWidth: "",
    customHeight: "",
  });
  
  const [isPrinting, setIsPrinting] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = () => {
    setPrinters(getAllPrinters());
  };

  const savePrinters = (updatedPrinters: NetworkPrinter[]) => {
    savePrintersUtil(updatedPrinters);
    setPrinters(updatedPrinters);
  };

  const handleAddPrinter = () => {
    if (!newPrinterName.trim() || !newPrinterIp.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập đầy đủ thông tin máy in",
      });
      return;
    }

    const newPrinter: NetworkPrinter = {
      id: crypto.randomUUID(),
      name: newPrinterName,
      ipAddress: newPrinterIp,
      port: parseInt(newPrinterPort) || 9100,
      bridgeUrl: bridgeUrl || "http://localhost:9100",
      isActive: printers.length === 0,
      createdAt: new Date().toISOString(),
    };

    const updated = [...printers, newPrinter];
    savePrinters(updated);

    toast({
      title: "Thành công",
      description: `Đã thêm máy in: ${newPrinterName}`,
    });

    setNewPrinterName("");
    setNewPrinterIp("");
    setNewPrinterPort("9100");
    setBridgeUrl("http://localhost:9100");
    setIsAddDialogOpen(false);
  };

  const handleDeletePrinter = (id: string) => {
    if (confirm("Bạn có chắc muốn xóa máy in này?")) {
      const updated = printers.filter((p) => p.id !== id);
      if (updated.length > 0 && !updated.some((p) => p.isActive)) {
        updated[0].isActive = true;
      }
      savePrinters(updated);
      toast({
        title: "Đã xóa",
        description: "Máy in đã được xóa",
      });
    }
  };

  const handleSetActive = (id: string) => {
    const updated = printers.map((p) => ({
      ...p,
      isActive: p.id === id,
    }));
    savePrinters(updated);
    toast({
      title: "Thành công",
      description: "Đã chuyển máy in Active",
    });
  };

  const handleTestConnection = async (printer: NetworkPrinter) => {
    setIsTesting(printer.id);
    try {
      const result = await testPrinterConnection(printer);
      if (result.success) {
        toast({
          title: "Thành công",
          description: `Kết nối OK đến ${printer.name}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Lỗi kết nối",
          description: result.error || "Không thể kết nối",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message,
      });
    } finally {
      setIsTesting(null);
    }
  };

  const handleTestPrint = async () => {
    const printer = getActivePrinter();
    if (!printer) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Chưa có máy in active. Vui lòng chọn máy in.",
      });
      return;
    }

    setIsPrinting(true);

    try {
      const billHTML = generateBillHTML({
        sessionIndex: testData.sessionIndex,
        phone: testData.phone,
        customerName: testData.customerName,
        productCode: testData.productCode,
        productName: testData.productName,
        comment: testData.comment,
        createdTime: new Date().toISOString(),
        price: testData.price,
        quantity: testData.quantity,
      });

      // Parse settings
      const width =
        printSettings.width === "custom"
          ? parseInt(printSettings.customWidth) || 576
          : parseInt(printSettings.width);
      const height =
        printSettings.height === "custom"
          ? parseInt(printSettings.customHeight) || null
          : printSettings.height === "auto"
          ? null
          : parseInt(printSettings.height);
      const threshold = parseInt(printSettings.threshold);
      const scale = parseFloat(printSettings.scale);

      const result = await printHTMLToXC80(printer, billHTML, {
        width,
        height,
        threshold,
        scale,
      });

      if (result.success) {
        toast({
          title: "Thành công",
          description: "Test print hoàn tất!",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Lỗi in",
          description: result.error || "Không thể in",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message,
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Printer Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Quản lý máy in</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm máy in
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm máy in mới</DialogTitle>
              <DialogDescription>
                Nhập thông tin máy in và bridge server
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tên máy in</Label>
                <Input
                  value={newPrinterName}
                  onChange={(e) => setNewPrinterName(e.target.value)}
                  placeholder="VD: XC80 Kho 1"
                />
              </div>
              <div>
                <Label>IP Address</Label>
                <Input
                  value={newPrinterIp}
                  onChange={(e) => setNewPrinterIp(e.target.value)}
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  value={newPrinterPort}
                  onChange={(e) => setNewPrinterPort(e.target.value)}
                  placeholder="9100"
                />
              </div>
              <div>
                <Label>Bridge URL</Label>
                <Input
                  value={bridgeUrl}
                  onChange={(e) => setBridgeUrl(e.target.value)}
                  placeholder="http://localhost:9100"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Hủy
              </Button>
              <Button onClick={handleAddPrinter}>Thêm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Printer List */}
      <Card>
        <CardHeader>
          <CardTitle>Danh sách máy in</CardTitle>
        </CardHeader>
        <CardContent>
          {printers.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Chưa có máy in nào. Nhấn "Thêm máy in" để bắt đầu.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {printers.map((printer) => (
                <Card key={printer.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Printer className="w-4 h-4" />
                        <h4 className="font-semibold">{printer.name}</h4>
                        {printer.isActive && (
                          <Badge variant="default">Active</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        IP: {printer.ipAddress}:{printer.port}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Bridge: {printer.bridgeUrl}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!printer.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetActive(printer.id)}
                        >
                          Chọn Active
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestConnection(printer)}
                        disabled={isTesting === printer.id}
                      >
                        {isTesting === printer.id ? "Testing..." : "Test"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeletePrinter(printer.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Print Section */}
      <Card>
        <CardHeader>
          <CardTitle>Test In (với máy in Active)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test Data Form */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Session</Label>
              <Input
                value={testData.sessionIndex}
                onChange={(e) =>
                  setTestData({ ...testData, sessionIndex: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Số điện thoại</Label>
              <Input
                value={testData.phone}
                onChange={(e) =>
                  setTestData({ ...testData, phone: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Tên khách hàng</Label>
              <Input
                value={testData.customerName}
                onChange={(e) =>
                  setTestData({ ...testData, customerName: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Mã sản phẩm</Label>
              <Input
                value={testData.productCode}
                onChange={(e) =>
                  setTestData({ ...testData, productCode: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <Label>Tên sản phẩm</Label>
              <Input
                value={testData.productName}
                onChange={(e) =>
                  setTestData({ ...testData, productName: e.target.value })
                }
              />
            </div>
            <div className="col-span-2">
              <Label>Ghi chú</Label>
              <Input
                value={testData.comment}
                onChange={(e) =>
                  setTestData({ ...testData, comment: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Giá</Label>
              <Input
                type="number"
                value={testData.price}
                onChange={(e) =>
                  setTestData({ ...testData, price: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label>Số lượng</Label>
              <Input
                type="number"
                value={testData.quantity}
                onChange={(e) =>
                  setTestData({ ...testData, quantity: parseInt(e.target.value) || 1 })
                }
              />
            </div>
          </div>

          {/* Print Settings */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="font-semibold">Cài đặt in</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Width</Label>
                <Select
                  value={printSettings.width}
                  onValueChange={(value) =>
                    setPrintSettings({ ...printSettings, width: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WIDTH_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {printSettings.width === "custom" && (
                  <Input
                    className="mt-2"
                    placeholder="Nhập width (pixels)"
                    value={printSettings.customWidth}
                    onChange={(e) =>
                      setPrintSettings({
                        ...printSettings,
                        customWidth: e.target.value,
                      })
                    }
                  />
                )}
              </div>

              <div>
                <Label>Height</Label>
                <Select
                  value={printSettings.height}
                  onValueChange={(value) =>
                    setPrintSettings({ ...printSettings, height: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEIGHT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {printSettings.height === "custom" && (
                  <Input
                    className="mt-2"
                    placeholder="Nhập height (pixels)"
                    value={printSettings.customHeight}
                    onChange={(e) =>
                      setPrintSettings({
                        ...printSettings,
                        customHeight: e.target.value,
                      })
                    }
                  />
                )}
              </div>

              <div>
                <Label>Threshold</Label>
                <Select
                  value={printSettings.threshold}
                  onValueChange={(value) =>
                    setPrintSettings({ ...printSettings, threshold: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THRESHOLD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Scale</Label>
                <Select
                  value={printSettings.scale}
                  onValueChange={(value) =>
                    setPrintSettings({ ...printSettings, scale: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCALE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button
            onClick={handleTestPrint}
            disabled={isPrinting}
            className="w-full"
          >
            {isPrinting ? "Đang in..." : "In thử 🖨️"}
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Hướng dẫn cài đặt Bridge Server</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-sm">
            <p>1. cd public/bridge</p>
            <p>2. npm install</p>
            <p>3. npm start</p>
            <p>4. Server chạy trên http://localhost:9100</p>
          </div>
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Xem file <strong>CUSTOM-SIZE-GUIDE.md</strong> và{" "}
              <strong>README.md</strong> trong thư mục public/bridge để biết
              thêm chi tiết về tùy chỉnh size và cài đặt.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
