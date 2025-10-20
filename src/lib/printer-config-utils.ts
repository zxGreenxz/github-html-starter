export interface NetworkPrinter {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  bridgeUrl: string;
  isActive: boolean;
  createdAt: string;
}

export interface PrinterFormatSettings {
  width: number;
  height: number | null;
  threshold: number;
  scale: number;
  fontSession: number;
  fontPhone: number;
  fontCustomer: number;
  fontProduct: number;
  padding: number;
  lineSpacing: number;
  alignment: 'left' | 'center' | 'right';
  isBold: boolean;
  isItalic: boolean;
}

export interface BillData {
  sessionIndex: string;
  phone: string;
  customerName: string;
  productCode: string;
  productName: string;
  comment: string;
}

/**
 * Generate HTML for printing bill
 */
export const generatePrintHTML = (
  settings: PrinterFormatSettings,
  billData: BillData
): string => {
  const alignClass = settings.alignment;
  const fontWeight = settings.isBold ? '900' : 'normal';
  const fontStyle = settings.isItalic ? 'italic' : 'normal';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=${settings.width}, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: ${settings.width}px; margin: 0; padding: 0; background: white; }
        body { 
          width: ${settings.width}px;
          min-width: ${settings.width}px;
          max-width: ${settings.width}px;
          margin: 0 auto;
          padding: ${settings.padding}px;
          font-family: 'Arial Black', Arial, sans-serif; 
          font-weight: ${fontWeight};
          font-style: ${fontStyle};
        }
        .${alignClass} { text-align: ${settings.alignment}; width: 100%; }
        .session { font-size: ${settings.fontSession}px; margin: ${settings.lineSpacing}px 0; letter-spacing: 2px; text-shadow: 2px 2px 0px #000; }
        .phone { font-size: ${settings.fontPhone}px; margin: ${settings.lineSpacing}px 0; }
        .customer { font-size: ${settings.fontCustomer}px; margin: ${settings.lineSpacing}px 0; }
        .product-code { font-size: ${settings.fontProduct}px; margin: ${settings.lineSpacing}px 0; }
        .product-name { font-size: ${settings.fontProduct}px; margin: ${settings.lineSpacing}px 0; line-height: 1.4; word-wrap: break-word; }
        .comment { font-size: ${settings.fontProduct - 4}px; margin: ${settings.lineSpacing}px 0; font-weight: 900; }
        .time { font-size: ${settings.fontProduct - 8}px; margin: ${settings.lineSpacing * 1.5}px 0; }
      </style>
    </head>
    <body>
      <div class="${alignClass} session">#${billData.sessionIndex}</div>
      ${billData.phone ? `<div class="${alignClass} phone">${billData.phone}</div>` : ''}
      <div class="${alignClass} customer">${billData.customerName}</div>
      <div class="${alignClass} product-code">${billData.productCode}</div>
      <div class="${alignClass} product-name">${billData.productName}</div>
      ${billData.comment ? `<div class="${alignClass} comment">${billData.comment}</div>` : ''}
      <div class="${alignClass} time">${new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>
    </body>
    </html>
  `;
};

/**
 * Load printers from sessionStorage
 */
export const loadPrinters = (): NetworkPrinter[] => {
  const saved = sessionStorage.getItem('networkPrinters');
  return saved ? JSON.parse(saved) : [];
};

/**
 * Save printers to sessionStorage
 */
export const savePrinters = (printers: NetworkPrinter[]): void => {
  sessionStorage.setItem('networkPrinters', JSON.stringify(printers));
};

/**
 * Get the currently active printer
 */
export const getActivePrinter = (): NetworkPrinter | null => {
  const printers = loadPrinters();
  return printers.find(p => p.isActive) || null;
};

/**
 * Save printer format settings to sessionStorage
 */
export interface SavedPrinterConfig {
  width: string;
  customWidth: string;
  height: string;
  customHeight: string;
  threshold: string;
  scale: string;
  fontSession: string;
  fontPhone: string;
  fontCustomer: string;
  fontProduct: string;
  padding: string;
  lineSpacing: string;
  alignment: 'left' | 'center' | 'right';
  isBold: boolean;
  isItalic: boolean;
}

export const saveFormatSettings = (settings: SavedPrinterConfig): void => {
  sessionStorage.setItem('printerFormatSettings', JSON.stringify(settings));
};

export const loadFormatSettings = (): SavedPrinterConfig | null => {
  const saved = sessionStorage.getItem('printerFormatSettings');
  return saved ? JSON.parse(saved) : null;
};

/**
 * Print HTML via bridge server
 */
export const printHTMLToXC80 = async (
  printer: NetworkPrinter,
  html: string,
  settings: {
    width: number;
    height: number | null;
    threshold: number;
    scale: number;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const payload = {
      printerIp: printer.ipAddress,
      printerPort: printer.port,
      html: html,
      width: settings.width,
      height: settings.height,
      threshold: settings.threshold,
      scale: settings.scale
    };
    
    console.log('📤 Sending to bridge server:', {
      url: `${printer.bridgeUrl}/print/html`,
      width: payload.width,
      height: payload.height,
      threshold: payload.threshold,
      scale: payload.scale
    });
    
    const response = await fetch(`${printer.bridgeUrl}/print/html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Print error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Test printer connection via bridge server
 */
export const testPrinterConnection = async (
  printer: NetworkPrinter
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${printer.bridgeUrl}/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Connection test error:', error);
    return { success: false, error: error.message };
  }
};
