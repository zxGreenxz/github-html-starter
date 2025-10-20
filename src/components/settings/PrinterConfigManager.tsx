import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Printer, Save, FileText, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  NetworkPrinter,
  PrinterFormatSettings,
  BillData,
  PrinterTemplate,
  loadPrinters,
  savePrinter,
  updatePrinter,
  deletePrinter,
  generatePrintHTML,
  printHTMLToXC80,
  testPrinterConnection,
  saveFormatSettings,
  loadFormatSettings,
  SavedPrinterConfig,
  loadTemplates,
  createTemplate,
  setActiveTemplate,
  deleteTemplate,
} from "@/lib/printer-config-utils";

export function PrinterConfigManager() {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Printer management
  const [printers, setPrinters] = useState<NetworkPrinter[]>([]);
  const [serverOnline, setServerOnline] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form
  const [newPrinterName, setNewPrinterName] = useState("");
  const [newPrinterIp, setNewPrinterIp] = useState("");
  const [newPrinterPort, setNewPrinterPort] = useState("9100");
  const [newBridgeUrl, setNewBridgeUrl] = useState("http://localhost:3001");

  // Format settings
  const [width, setWidth] = useState("1024");
  const [customWidth, setCustomWidth] = useState("1024");
  const [height, setHeight] = useState("custom");
  const [customHeight, setCustomHeight] = useState("600");
  const [quickHeight, setQuickHeight] = useState("600");
  const [threshold, setThreshold] = useState("95");
  const [scale, setScale] = useState("2");

  // Font sizes
  const [fontSession, setFontSession] = useState("72");
  const [fontPhone, setFontPhone] = useState("52");
  const [fontCustomer, setFontCustomer] = useState("52");
  const [fontProduct, setFontProduct] = useState("36");
  const [fontComment, setFontComment] = useState("32");

  // Text styles
  const [alignment, setAlignment] = useState<"left" | "center" | "right">("center");
  const [isBold, setIsBold] = useState(true);
  const [isItalic, setIsItalic] = useState(false);

  // Spacing
  const [padding, setPadding] = useState("20");
  const [lineSpacing, setLineSpacing] = useState("12");

  // Templates management
  const [templates, setTemplates] = useState<PrinterTemplate[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  // Test data
  const [testData, setTestData] = useState<BillData>({
    sessionIndex: "001",
    phone: "0901234567",
    customerName: "Nguyễn Văn A",
    productCode: "SP001",
    productName: "Cà phê sữa đá",
    comment: "Ít đường",
  });

  // Check server status - check default bridge URL or active printer's URL
  const checkServer = async (printersList: NetworkPrinter[] = printers) => {
    try {
      // Try to check server using active printer's bridge URL if exists,
      // otherwise use default localhost:3001
      const activePrinter = printersList.find((p) => p.isActive);
      const bridgeUrl = activePrinter?.bridgeUrl || newBridgeUrl || "http://localhost:3001";

      const response = await fetch(`${bridgeUrl}/health`);
      setServerOnline(response.ok);
    } catch (error) {
      console.error("Server check failed:", error);
      setServerOnline(false);
    }
  };

  // Load printers and settings on mount
  useEffect(() => {
    const loadData = async () => {
      const loaded = await loadPrinters();
      setPrinters(loaded);

      // Load templates
      const loadedTemplates = await loadTemplates();
      setTemplates(loadedTemplates);

      // Load saved format settings
      const savedSettings = await loadFormatSettings();
      if (savedSettings) {
        setWidth(savedSettings.width);
        setCustomWidth(savedSettings.customWidth);
        setHeight(savedSettings.height);
        setCustomHeight(savedSettings.customHeight);
        setThreshold(savedSettings.threshold);
        setScale(savedSettings.scale);
        setFontSession(savedSettings.fontSession);
        setFontPhone(savedSettings.fontPhone);
        setFontCustomer(savedSettings.fontCustomer);
        setFontProduct(savedSettings.fontProduct);
        setFontComment(savedSettings.fontComment || "32");
        setPadding(savedSettings.padding);
        setLineSpacing(savedSettings.lineSpacing);
        setAlignment(savedSettings.alignment);
        setIsBold(savedSettings.isBold);
        setIsItalic(savedSettings.isItalic);
      }

      checkServer(loaded);
    };

    loadData();
    const interval = setInterval(() => checkServer(), 5000);
    return () => clearInterval(interval);
  }, []);

  // Re-check server when printers change
  useEffect(() => {
    checkServer(printers);
  }, [printers]);

  // Printer management
  const handleAddPrinter = async () => {
    if (!newPrinterName.trim() || !newPrinterIp.trim()) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập tên và IP máy in!",
      });
      return;
    }

    const newPrinter = await savePrinter({
      name: newPrinterName,
      ipAddress: newPrinterIp,
      port: parseInt(newPrinterPort) || 9100,
      bridgeUrl: newBridgeUrl,
      isActive: printers.length === 0,
    });

    if (newPrinter) {
      setPrinters([...printers, newPrinter]);
      setNewPrinterName("");
      setNewPrinterIp("");
      setNewPrinterPort("9100");
      setNewBridgeUrl("http://localhost:3001");
      setShowAddForm(false);

      toast({
        title: "Thành công",
        description: "Đã thêm máy in mới!",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể thêm máy in",
      });
    }
  };

  const handleDeletePrinter = async (id: string) => {
    const success = await deletePrinter(id);
    if (success) {
      setPrinters(printers.filter((p) => p.id !== id));
      toast({
        title: "Đã xóa",
        description: "Máy in đã được xóa",
      });
    }
  };

  const handleSetActivePrinter = async (id: string) => {
    const success = await updatePrinter(id, { isActive: true });
    if (success) {
      setPrinters(printers.map((p) => ({ ...p, isActive: p.id === id })));
      checkServer();
    }
  };

  // Get current width/height
  const getCurrentWidth = (): number => {
    if (width === "custom") {
      return parseInt(customWidth) || 1024;
    }
    return parseInt(width);
  };

  const getCurrentHeight = (): number | null => {
    if (height === "auto") return null;
    if (height === "custom") {
      return parseInt(quickHeight || customHeight) || null;
    }
    return parseInt(height);
  };

  // Generate preview
  const previewHTML = () => {
    const settings: PrinterFormatSettings = {
      width: getCurrentWidth(),
      height: getCurrentHeight(),
      threshold: parseInt(threshold),
      scale: parseFloat(scale),
      fontSession: parseInt(fontSession),
      fontPhone: parseInt(fontPhone),
      fontCustomer: parseInt(fontCustomer),
      fontProduct: parseInt(fontProduct),
      fontComment: parseInt(fontComment),
      padding: parseInt(padding),
      lineSpacing: parseInt(lineSpacing),
      alignment,
      isBold,
      isItalic,
    };

    return generatePrintHTML(settings, testData);
  };

  // Print function
  const handlePrint = async () => {
    const activePrinter = printers.find((p) => p.isActive);
    if (!activePrinter) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Chưa có máy in active!",
      });
      return;
    }

    if (!serverOnline) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Server chưa chạy! Vui lòng khởi động bridge server.",
      });
      return;
    }

    const settings: PrinterFormatSettings = {
      width: getCurrentWidth(),
      height: getCurrentHeight(),
      threshold: parseInt(threshold),
      scale: parseFloat(scale),
      fontSession: parseInt(fontSession),
      fontPhone: parseInt(fontPhone),
      fontCustomer: parseInt(fontCustomer),
      fontProduct: parseInt(fontProduct),
      fontComment: parseInt(fontComment),
      padding: parseInt(padding),
      lineSpacing: parseInt(lineSpacing),
      alignment,
      isBold,
      isItalic,
    };

    const html = generatePrintHTML(settings, testData);

    // Debug log để kiểm tra
    console.log("🖨️ Print Settings:", {
      width: settings.width,
      height: settings.height,
      threshold: settings.threshold,
      scale: settings.scale,
      printerIp: activePrinter.ipAddress,
      bridgeUrl: activePrinter.bridgeUrl,
    });

    const result = await printHTMLToXC80(activePrinter, html, {
      width: settings.width,
      height: settings.height,
      threshold: settings.threshold,
      scale: settings.scale,
    });

    if (result.success) {
      toast({
        title: "Thành công",
        description: "In thành công!",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Lỗi in",
        description: result.error || "Không thể in",
      });
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setWidth("1152");
    setCustomWidth("");
    setHeight("auto");
    setCustomHeight("");
    setQuickHeight("");
    setThreshold("95");
    setScale("2");
    setFontSession("72");
    setFontPhone("52");
    setFontCustomer("52");
    setFontProduct("36");
    setFontComment("32");
    setPadding("20");
    setLineSpacing("12");
    setAlignment("center");
    setIsBold(true);
    setIsItalic(false);

    // Clear saved settings
    sessionStorage.removeItem("printerFormatSettings");

    toast({
      title: "Đã reset",
      description: "Đã về cấu hình mặc định!",
    });
  };

  // Save current configuration
  const handleSaveConfig = async () => {
    const config: SavedPrinterConfig = {
      width,
      customWidth,
      height,
      customHeight,
      threshold,
      scale,
      fontSession,
      fontPhone,
      fontCustomer,
      fontProduct,
      fontComment,
      padding,
      lineSpacing,
      alignment,
      isBold,
      isItalic,
    };

    const success = await saveFormatSettings(config);
    if (success) {
      toast({
        title: "Đã lưu",
        description: "Cấu hình máy in và settings đã được lưu!",
      });
    }
  };

  // Template management
  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tên template",
        variant: "destructive",
      });
      return;
    }

    const config: SavedPrinterConfig = {
      width,
      customWidth,
      height,
      customHeight,
      threshold,
      scale,
      fontSession,
      fontPhone,
      fontCustomer,
      fontProduct,
      fontComment,
      padding,
      lineSpacing,
      alignment,
      isBold,
      isItalic,
    };

    const newTemplate = await createTemplate(newTemplateName, config);
    if (newTemplate) {
      setTemplates([...templates, newTemplate]);
      setNewTemplateName("");
      setShowTemplateForm(false);

      toast({
        title: "✅ Đã tạo template",
        description: `Template "${newTemplateName}" đã được lưu`,
      });
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    setWidth(template.width);
    setCustomWidth(template.customWidth);
    setHeight(template.height);
    setCustomHeight(template.customHeight);
    setThreshold(template.threshold);
    setScale(template.scale);
    setFontSession(template.fontSession);
    setFontPhone(template.fontPhone);
    setFontCustomer(template.fontCustomer);
    setFontProduct(template.fontProduct);
    setFontComment(template.fontComment || "32");
    setPadding(template.padding);
    setLineSpacing(template.lineSpacing);
    setAlignment(template.alignment);
    setIsBold(template.isBold);
    setIsItalic(template.isItalic);

    // Save to database so other components can use it
    const config: SavedPrinterConfig = {
      width: template.width,
      customWidth: template.customWidth,
      height: template.height,
      customHeight: template.customHeight,
      threshold: template.threshold,
      scale: template.scale,
      fontSession: template.fontSession,
      fontPhone: template.fontPhone,
      fontCustomer: template.fontCustomer,
      fontProduct: template.fontProduct,
      fontComment: template.fontComment || "32",
      padding: template.padding,
      lineSpacing: template.lineSpacing,
      alignment: template.alignment,
      isBold: template.isBold,
      isItalic: template.isItalic,
    };
    await saveFormatSettings(config);

    await setActiveTemplate(templateId);
    const updated = templates.map((t) => ({
      ...t,
      isActive: t.id === templateId,
    }));
    setTemplates(updated);

    toast({
      title: "✅ Đã load template",
      description: `Template "${template.name}" đã được áp dụng và lưu vào hệ thống`,
    });
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const success = await deleteTemplate(templateId);
    if (success) {
      setTemplates(templates.filter((t) => t.id !== templateId));
      toast({
        title: "🗑️ Đã xóa template",
        description: `Template "${template.name}" đã được xóa`,
      });
    }
  };

  return (
    <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
      {/* LEFT SIDE: Controls */}
      <div className="space-y-6">
        {/* Header & Printer List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Cấu hình Máy In
              </CardTitle>
              <Badge variant={serverOnline ? "default" : "destructive"}>
                {serverOnline ? "Server Online" : "Server Offline"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Máy in</h3>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="h-4 w-4 mr-1" />
                Thêm
              </Button>
            </div>

            {showAddForm && (
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Tên máy in"
                    value={newPrinterName}
                    onChange={(e) => setNewPrinterName(e.target.value)}
                  />
                  <Input
                    placeholder="IP Address"
                    value={newPrinterIp}
                    onChange={(e) => setNewPrinterIp(e.target.value)}
                  />
                  <Input
                    placeholder="Port"
                    value={newPrinterPort}
                    onChange={(e) => setNewPrinterPort(e.target.value)}
                  />
                  <Input
                    placeholder="Bridge URL"
                    value={newBridgeUrl}
                    onChange={(e) => setNewBridgeUrl(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddPrinter}>
                    Lưu
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                    Hủy
                  </Button>
                </div>
              </div>
            )}

            {printers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chưa có máy in</p>
            ) : (
              <div className="space-y-2">
                {printers.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      p.isActive ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{p.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {p.ipAddress}:{p.port}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.isActive ? (
                        <Badge variant="default" className="text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetActivePrinter(p.id)}
                          className="text-xs"
                        >
                          Set Active
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDeletePrinter(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Templates Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" />
                📋 Templates
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowTemplateForm(!showTemplateForm)}>
                <Plus className="h-4 w-4 mr-1" />
                Tạo mới
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showTemplateForm && (
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <Input
                  placeholder="Tên template (vd: Template Mặc định, In Nhanh...)"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handleCreateTemplate();
                  }}
                />
                <div className="flex gap-2">
                  <Button onClick={handleCreateTemplate} size="sm" className="flex-1">
                    Lưu Template
                  </Button>
                  <Button
                    onClick={() => {
                      setShowTemplateForm(false);
                      setNewTemplateName("");
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            )}

            {templates.length > 0 ? (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      template.isActive ? "bg-primary/10 border-primary" : "bg-background",
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {template.isActive && <Check className="h-4 w-4 text-primary" />}
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(template.createdAt).toLocaleDateString("vi-VN")}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={template.isActive ? "default" : "outline"}
                        onClick={() => handleLoadTemplate(template.id)}
                      >
                        {template.isActive ? "Đang dùng" : "Load"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteTemplate(template.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Chưa có template nào. Tạo template để lưu cấu hình in!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Format Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">⚙️ Tùy chỉnh Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Width & Height */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>📏 Width (px)</Label>
                <Select value={width} onValueChange={setWidth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1152">1152px (80mm) ⭐</SelectItem>
                    <SelectItem value="1024">1024px (72mm)</SelectItem>
                    <SelectItem value="864">864px (60mm)</SelectItem>
                    <SelectItem value="768">768px (54mm)</SelectItem>
                    <SelectItem value="custom">Custom...</SelectItem>
                  </SelectContent>
                </Select>
                {width === "custom" && (
                  <Input
                    type="number"
                    placeholder="Nhập width"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    min={400}
                    max={1600}
                    step={8}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>📐 Height</Label>
                <div className="flex gap-2">
                  <Select value={height} onValueChange={setHeight}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto ⭐</SelectItem>
                      <SelectItem value="800">800px</SelectItem>
                      <SelectItem value="1000">1000px</SelectItem>
                      <SelectItem value="1200">1200px</SelectItem>
                      <SelectItem value="1500">1500px</SelectItem>
                      <SelectItem value="custom">Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Auto"
                    value={quickHeight}
                    onChange={(e) => setQuickHeight(e.target.value)}
                    min={400}
                    max={3000}
                    step={100}
                    className="w-24"
                  />
                </div>
                {height === "custom" && (
                  <Input
                    type="number"
                    placeholder="Nhập height"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    min={400}
                    max={3000}
                    step={100}
                  />
                )}
              </div>
            </div>

            {/* Threshold & Scale */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>⚫ Threshold</Label>
                <Select value={threshold} onValueChange={setThreshold}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="85">85 - Rất đậm</SelectItem>
                    <SelectItem value="95">95 - Đậm ⭐</SelectItem>
                    <SelectItem value="105">105 - Vừa</SelectItem>
                    <SelectItem value="115">115 - Nhẹ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>🔍 Scale</Label>
                <Select value={scale} onValueChange={setScale}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1x</SelectItem>
                    <SelectItem value="1.5">1.5x</SelectItem>
                    <SelectItem value="2">2x ⭐</SelectItem>
                    <SelectItem value="2.5">2.5x</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Font Sizes */}
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-sm">🔤 Font Sizes</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Session (#001)</Label>
                  <Input
                    type="number"
                    value={fontSession}
                    onChange={(e) => setFontSession(e.target.value)}
                    min={20}
                    max={120}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    type="number"
                    value={fontPhone}
                    onChange={(e) => setFontPhone(e.target.value)}
                    min={20}
                    max={100}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Customer Name</Label>
                  <Input
                    type="number"
                    value={fontCustomer}
                    onChange={(e) => setFontCustomer(e.target.value)}
                    min={20}
                    max={100}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Product</Label>
                  <Input
                    type="number"
                    value={fontProduct}
                    onChange={(e) => setFontProduct(e.target.value)}
                    min={16}
                    max={80}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comment</Label>
                  <Input
                    type="number"
                    value={fontComment}
                    onChange={(e) => setFontComment(e.target.value)}
                    min={12}
                    max={60}
                  />
                </div>
              </div>
            </div>

            {/* Text Alignment */}
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-sm">📍 Căn chỉnh</h4>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={alignment === "left" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAlignment("left")}
                >
                  ← Trái
                </Button>
                <Button
                  variant={alignment === "center" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAlignment("center")}
                >
                  ↕ Giữa
                </Button>
                <Button
                  variant={alignment === "right" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAlignment("right")}
                >
                  → Phải
                </Button>
              </div>
            </div>

            {/* Text Styles */}
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-sm">✏️ Kiểu chữ</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="bold" checked={isBold} onCheckedChange={(checked) => setIsBold(!!checked)} />
                  <Label htmlFor="bold" className="font-bold">
                    In đậm (Bold)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="italic" checked={isItalic} onCheckedChange={(checked) => setIsItalic(!!checked)} />
                  <Label htmlFor="italic" className="italic">
                    In nghiêng (Italic)
                  </Label>
                </div>
              </div>
            </div>

            {/* Spacing */}
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-semibold text-sm">📐 Khoảng cách</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Padding (px)</Label>
                  <Input type="number" value={padding} onChange={(e) => setPadding(e.target.value)} min={1} max={50} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Line Spacing</Label>
                  <Input
                    type="number"
                    value={lineSpacing}
                    onChange={(e) => setLineSpacing(e.target.value)}
                    min={1}
                    max={30}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📝 Dữ liệu Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Session Index"
              value={testData.sessionIndex}
              onChange={(e) => setTestData({ ...testData, sessionIndex: e.target.value })}
            />
            <Input
              placeholder="Số điện thoại"
              value={testData.phone}
              onChange={(e) => setTestData({ ...testData, phone: e.target.value })}
            />
            <Input
              placeholder="Tên khách hàng"
              value={testData.customerName}
              onChange={(e) => setTestData({ ...testData, customerName: e.target.value })}
            />
            <Input
              placeholder="Mã sản phẩm"
              value={testData.productCode}
              onChange={(e) => setTestData({ ...testData, productCode: e.target.value })}
            />
            <Input
              placeholder="Tên sản phẩm"
              value={testData.productName}
              onChange={(e) => setTestData({ ...testData, productName: e.target.value })}
            />
            <Input
              placeholder="Ghi chú"
              value={testData.comment}
              onChange={(e) => setTestData({ ...testData, comment: e.target.value })}
            />
            <Button className="w-full" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              In Ngay
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT SIDE: Live Preview */}
      <div className={cn(isMobile ? "" : "sticky top-6 h-fit")}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">👁️ Xem trước</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSaveConfig}>
                  <Save className="h-4 w-4 mr-1" />
                  Lưu
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Reset
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg overflow-auto max-h-[800px]">
              <iframe
                srcDoc={previewHTML()}
                className="bg-white border-2 border-dashed border-border max-w-md mx-auto shadow-lg w-full h-[600px]"
                title="Print Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
