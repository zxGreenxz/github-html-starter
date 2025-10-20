export interface NetworkPrinter {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  bridgeUrl: string;
  isActive: boolean;
  createdAt: string;
}

export interface PrintSettings {
  dpi?: number; // Resolution (not used in bitmap mode)
  threshold?: number; // Black/white threshold (0-255, default: 95 for bold)
  width?: number; // Image width in pixels (default: 576 for 80mm full width)
  height?: number | null; // Image height in pixels (null = auto)
  scale?: number; // Device scale factor (default: 2 for high quality)
}

/**
 * Get active printer from localStorage
 */
export const getActivePrinter = (): NetworkPrinter | null => {
  try {
    const printersJson = localStorage.getItem("networkPrinters");
    if (!printersJson) return null;

    const printers: NetworkPrinter[] = JSON.parse(printersJson);
    const activePrinter = printers.find((p) => p.isActive === true);

    return activePrinter || null;
  } catch (error) {
    console.error("Error loading active printer:", error);
    return null;
  }
};

/**
 * Get all printers from localStorage
 */
export const getAllPrinters = (): NetworkPrinter[] => {
  try {
    const printersJson = localStorage.getItem("networkPrinters");
    if (!printersJson) return [];
    return JSON.parse(printersJson);
  } catch (error) {
    console.error("Error loading printers:", error);
    return [];
  }
};

/**
 * Save printer configuration to localStorage
 */
export const savePrinters = (printers: NetworkPrinter[]): void => {
  try {
    localStorage.setItem("networkPrinters", JSON.stringify(printers));
  } catch (error) {
    console.error("Error saving printers:", error);
  }
};

/**
 * Print HTML to thermal printer via bridge server (Full Width & Bold)
 *
 * OPTIMIZED SETTINGS:
 * - Default width: 576px (80mm) - full width to fill paper
 * - Default height: null (auto) - automatically fits content
 * - Default threshold: 95 - bold/dark text
 * - Default scale: 2 - high quality rendering
 *
 * @param printer Printer configuration
 * @param html HTML content to print
 * @param settings Print quality settings
 * @returns Promise with print result
 */
export const printHTMLToXC80 = async (
  printer: NetworkPrinter,
  html: string,
  settings: PrintSettings = {},
): Promise<{ success: boolean; error?: string }> => {
  const {
    width = 576, // 80mm full width
    height = null, // Auto height
    threshold = 95, // Bold/dark text
    scale = 2, // High quality
  } = settings;

  try {
    console.log("🌐 Printing HTML (Full Width & Bold mode)...");
    console.log("📏 Width:", width, "pixels");
    console.log("📐 Height:", height ? height + " pixels" : "Auto");
    console.log("⚫ Threshold:", threshold, "(lower = darker)");
    console.log("🔍 Scale:", scale + "x");

    console.log(`📦 Sending to bridge: ${printer.bridgeUrl}/print/html`);

    // Send to bridge /print/html endpoint with optimized settings
    const response = await fetch(`${printer.bridgeUrl}/print/html`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printerIp: printer.ipAddress,
        printerPort: printer.port,
        html,
        width,
        height,
        threshold,
        scale,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bridge error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Print successful:", result);

    return { success: true };
  } catch (error: any) {
    console.error("❌ HTML print error:", error);
    return {
      success: false,
      error: error.message || "Không thể in HTML",
    };
  }
};

/**
 * Print PDF to thermal printer via bridge server (Full Width & Bold)
 * Note: HTML method is recommended for better Unicode support
 *
 * @param printer Printer configuration
 * @param pdfDataUri PDF data URI
 * @param settings Print quality settings
 * @returns Promise with print result
 */
export const printPDFToXC80 = async (
  printer: NetworkPrinter,
  pdfDataUri: string,
  settings: PrintSettings = {},
): Promise<{ success: boolean; error?: string }> => {
  const {
    dpi = 300,
    threshold = 95, // Bold text
    width = 576, // Full width
  } = settings;

  try {
    console.log("📄 Printing PDF (Full Width & Bold mode)...");
    console.log("⚙️ Settings:", { dpi, threshold, width });

    // Extract base64 from data URI
    const base64Match = pdfDataUri.match(/^data:application\/pdf;[^,]*base64,(.+)$/);
    if (!base64Match) {
      throw new Error("Invalid PDF data URI format");
    }
    const pdfBase64 = base64Match[1];

    console.log(`📦 Sending to bridge: ${printer.bridgeUrl}/print/pdf`);

    // Send to bridge /print/pdf endpoint
    const response = await fetch(`${printer.bridgeUrl}/print/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printerIp: printer.ipAddress,
        printerPort: printer.port,
        pdfBase64,
        dpi,
        threshold,
        width,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bridge error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Print successful:", result);

    return { success: true };
  } catch (error: any) {
    console.error("❌ PDF print error:", error);
    return {
      success: false,
      error: error.message || "Không thể in PDF",
    };
  }
};

/**
 * Print text content to thermal printer (Legacy method)
 * Note: Limited Vietnamese support, use HTML method instead
 */
export const printTextToXC80 = async (
  printer: NetworkPrinter,
  content: string,
  options?: {
    mode?: "cp1258" | "no-accents" | "utf8";
    align?: "left" | "center" | "right";
    feeds?: number;
  },
): Promise<{ success: boolean; error?: string }> => {
  try {
    const printOptions = {
      mode: options?.mode || "cp1258",
      align: options?.align || "center",
      feeds: options?.feeds || 2, // Less paper feed for compact mode
    };

    const contentBase64 = btoa(
      encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }),
    );

    console.log("📝 Printing text (legacy mode)...");

    const response = await fetch(`${printer.bridgeUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify({
        ipAddress: printer.ipAddress,
        port: printer.port,
        contentBase64: contentBase64,
        options: printOptions,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("✅ Print result:", result);
    return result;
  } catch (error: any) {
    console.error("❌ Text print error:", error);
    return {
      success: false,
      error: error.message || "Không thể kết nối với Print Bridge",
    };
  }
};

/**
 * Test printer connection
 */
export const testPrinterConnection = async (printer: NetworkPrinter): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log("🔍 Testing printer connection...");

    const response = await fetch(`${printer.bridgeUrl}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Bridge not responding (${response.status})`);
    }

    const result = await response.json();
    console.log("✅ Bridge is healthy:", result);

    return { success: true };
  } catch (error: any) {
    console.error("❌ Connection test failed:", error);
    return {
      success: false,
      error: error.message || "Không thể kết nối với Bridge Server",
    };
  }
};

/**
 * RECOMMENDED SETTINGS FOR CUSTOMIZABLE SIZE & BOLD MODE
 *
 * For best results, use these settings:
 *
 * PAPER WIDTH:
 * - 576px = 80mm (recommended - full width) ⭐
 * - 512px = 72mm
 * - 432px = 60mm
 * - 384px = 54mm (compact)
 * - Custom: 200-800px
 *
 * PAPER HEIGHT:
 * - null/auto = Auto fit content (recommended) ⭐
 * - 800px = Short bill
 * - 1000px = Medium bill
 * - 1200px = Long bill
 * - 1500px = Very long bill
 * - Custom: 400-3000px
 *
 * THRESHOLD (darkness):
 * - 85 = Very dark/bold (blackest)
 * - 95 = Bold (recommended) ⭐
 * - 105 = Medium bold
 * - 115 = Balanced
 * - 125 = Light
 *
 * SCALE (quality):
 * - 1x = Normal quality
 * - 1.5x = Good quality
 * - 2x = High quality (recommended) ⭐
 * - 2.5x = Very high quality
 * - 3x = Maximum quality (slower)
 *
 * USAGE EXAMPLE:
 *
 * const result = await printHTMLToXC80(printer, htmlContent, {
 *   width: 576,       // Full width 80mm
 *   height: null,     // Auto fit content
 *   threshold: 95,    // Bold text
 *   scale: 2          // High quality
 * });
 */
