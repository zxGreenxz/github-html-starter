/**
 * XC80 Print Bridge Server v7.0 - PDF SUPPORT
 * Hỗ trợ CP1258 (Windows-1258) cho tiếng Việt có dấu
 * Hỗ trợ in BITMAP từ canvas
 * Hỗ trợ in PDF trắng đen
 *
 * Cách chạy:
 * npm install express body-parser cors iconv-lite pdf-poppler sharp
 * node xc80-bridge-pdf-support.js
 */

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const net = require("net");
const iconv = require("iconv-lite");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { promisify } = require("util");
const { exec } = require("child_process");
const execAsync = promisify(exec);

// Thư viện xử lý hình ảnh
const sharp = require("sharp");

const app = express();
const PORT = 9100;
const TEMP_DIR = path.join(__dirname, "temp");

// Tạo thư mục temp nếu chưa có
if (!fsSync.existsSync(TEMP_DIR)) {
  fsSync.mkdirSync(TEMP_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.raw({ type: "application/octet-stream", limit: "50mb" }));

// ESC/POS Constants
const ESC = "\x1B";
const GS = "\x1D";

/**
 * CP1258 Encoding Map (Unicode → Windows-1258)
 */
const CP1258_MAP = {
  // Lowercase vowels
  à: "\xE0", á: "\xE1", ả: "\xE3", ã: "\xE3", ạ: "\xE1",
  ằ: "\xE0", ắ: "\xE1", ẳ: "\xE3", ẵ: "\xE3", ặ: "\xE1",
  è: "\xE8", é: "\xE9", ẻ: "\xEB", ẽ: "\xEB", ẹ: "\xE9",
  ề: "\xE8", ế: "\xE9", ể: "\xEB", ễ: "\xEB", ệ: "\xE9",
  ì: "\xEC", í: "\xED", ỉ: "\xEF", ĩ: "\xEF", ị: "\xED",
  ò: "\xF2", ó: "\xF3", ỏ: "\xF5", õ: "\xF5", ọ: "\xF3",
  ồ: "\xF2", ố: "\xF3", ổ: "\xF5", ỗ: "\xF5", ộ: "\xF3",
  ờ: "\xF2", ớ: "\xF3", ở: "\xF5", ỡ: "\xF5", ợ: "\xF3",
  ù: "\xF9", ú: "\xFA", ủ: "\xFC", ũ: "\xFC", ụ: "\xFA",
  ừ: "\xF9", ứ: "\xFA", ử: "\xFC", ữ: "\xFC", ự: "\xFA",
  ỳ: "\xFD", ý: "\xFD", ỷ: "\xFF", ỹ: "\xFF", ỵ: "\xFD",
  đ: "\xF0", Đ: "\xD0",
  // Uppercase vowels
  À: "\xC0", Á: "\xC1", Ả: "\xC3", Ã: "\xC3", Ạ: "\xC1",
  È: "\xC8", É: "\xC9", Ẻ: "\xCB", Ẽ: "\xCB", Ẹ: "\xC9",
  Ì: "\xCC", Í: "\xCD", Ỉ: "\xCF", Ĩ: "\xCF", Ị: "\xCD",
  Ò: "\xD2", Ó: "\xD3", Ỏ: "\xD5", Õ: "\xD5", Ọ: "\xD3",
  Ù: "\xD9", Ú: "\xDA", Ủ: "\xDC", Ũ: "\xDC", Ụ: "\xDA",
  Ỳ: "\xDD", Ý: "\xDD", Ỷ: "\xDF", Ỹ: "\xDF", Ỵ: "\xDD",
};

/**
 * Chuyển Unicode sang CP1258
 */
function convertToCP1258(text) {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    result += CP1258_MAP[char] || char;
  }
  return result;
}

/**
 * Convert PDF to ESC/POS bitmap using pdftoppm + sharp
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {Object} options - Conversion options
 * @param {number} options.dpi - DPI (default: 300)
 * @param {number} options.threshold - Threshold 0-255 (default: 115)
 * @param {number} options.width - Width in pixels (default: 944 for 80mm @ 300 DPI)
 * @returns {Promise<Buffer>} ESC/POS bitmap commands
 */
async function pdfToESCPOSBitmap(pdfBuffer, options = {}) {
  const { dpi = 300, threshold = 115, width = 944 } = options;
  
  const timestamp = Date.now();
  const pdfPath = path.join(TEMP_DIR, `temp_${timestamp}.pdf`);
  const outputPrefix = path.join(TEMP_DIR, `output_${timestamp}`);
  
  try {
    // Step 1: Save PDF buffer to file (async)
    await fs.writeFile(pdfPath, pdfBuffer);
    
    // Step 2: Convert PDF to PNG using pdftoppm (better Sharp support)
    console.log(`🔄 Converting PDF to PNG (DPI: ${dpi})...`);
    const command = `pdftoppm -r ${dpi} -png "${pdfPath}" "${outputPrefix}"`;
    await execAsync(command);
    
    // Step 3: Find generated PNG file
    const pngPath = `${outputPrefix}-1.png`;
    if (!fsSync.existsSync(pngPath)) {
      throw new Error('PDF conversion failed - no output file generated');
    }
    
    // Step 4: Load and enhance image with sharp
    console.log(`🔄 Processing image (width: ${width}px, threshold: ${threshold})...`);
    let img = sharp(pngPath);
    
    // Get metadata
    const metadata = await img.metadata();
    console.log(`📐 Original size: ${metadata.width}x${metadata.height}px`);
    
    // Resize if necessary
    if (metadata.width > width) {
      img = img.resize(width, null, {
        kernel: 'lanczos3',
        fit: 'inside'
      });
    }
    
    // Enhance and convert to monochrome
    const processedBuffer = await img
      .greyscale()
      .sharpen({ sigma: 1.2, m1: 0.5, m2: 0.5 })
      .normalise()
      .threshold(threshold)
      .toFormat('png')
      .toBuffer();
    
    // Step 5: Get raw pixel data
    const { data: imageData, info } = await sharp(processedBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    console.log(`✅ Final size: ${info.width}x${info.height}px`);
    
    // Step 6: Convert to ESC/POS format
    const escposData = encodeImageToESCPOS(imageData, info.width, info.height);
    
    // Cleanup temp files (async)
    try {
      await fs.unlink(pdfPath);
      await fs.unlink(pngPath);
    } catch (e) {
      console.warn('Warning: Could not delete temp files:', e.message);
    }
    
    return escposData;
    
  } catch (error) {
    // Cleanup on error (async)
    try {
      await fs.unlink(pdfPath).catch(() => {});
      const pngPath = `${outputPrefix}-1.png`;
      await fs.unlink(pngPath).catch(() => {});
    } catch (e) {}
    
    throw new Error(`PDF to ESC/POS conversion failed: ${error.message}`);
  }
}

/**
 * Encode image buffer to ESC/POS bitmap commands (GS v 0 format)
 */
function encodeImageToESCPOS(imageData, width, height) {
  const commands = [];
  
  // Initialize printer
  commands.push(Buffer.from([0x1B, 0x40])); // ESC @ - Initialize
  
  // Center alignment
  commands.push(Buffer.from([0x1B, 0x61, 0x01])); // ESC a 1 - Center
  
  // Calculate bitmap dimensions
  const widthBytes = Math.ceil(width / 8);
  const xL = widthBytes & 0xFF;
  const xH = (widthBytes >> 8) & 0xFF;
  const yL = height & 0xFF;
  const yH = (height >> 8) & 0xFF;
  
  // GS v 0 - Print raster bitmap
  commands.push(Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]));
  
  // Convert pixels to bitmap (1 bit per pixel)
  const bitmapData = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < widthBytes; x++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const pixelX = x * 8 + bit;
        if (pixelX < width) {
          // For grayscale/RGB, take first channel
          const pixelIndex = (y * width + pixelX) * (imageData.length / (width * height));
          const pixelValue = imageData[Math.floor(pixelIndex)];
          
          // Black pixel = 1, White pixel = 0
          if (pixelValue < 128) {
            byte |= (1 << (7 - bit));
          }
        }
      }
      bitmapData.push(byte);
    }
  }
  
  commands.push(Buffer.from(bitmapData));
  
  // Left align for next commands
  commands.push(Buffer.from([0x1B, 0x61, 0x00])); // ESC a 0 - Left
  
  // Feed paper
  commands.push(Buffer.from([0x1B, 0x64, 3])); // ESC d 3 - Feed 3 lines
  
  // Cut paper
  commands.push(Buffer.from([0x1D, 0x56, 0x00])); // GS V 0 - Full cut
  
  return Buffer.concat(commands);
}


/**
 * Gửi data đến máy in qua network
 */
async function sendToPrinter(printerIp, printerPort, data) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(
      {
        host: printerIp,
        port: printerPort,
        timeout: 10000,
      },
      () => {
        client.write(data, (err) => {
          if (err) {
            reject(err);
          } else {
            setTimeout(() => {
              client.end();
              resolve();
            }, 500);
          }
        });
      }
    );

    client.on("timeout", () => {
      client.destroy();
      reject(new Error("Connection timeout"));
    });

    client.on("error", (err) => {
      reject(err);
    });
  });
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * Bitmap printing endpoint (ESC/POS bitmap format)
 */
app.post('/print/bitmap', async (req, res) => {
  try {
    const { printerIp, printerPort, bitmapData } = req.body;

    if (!printerIp || !printerPort || !bitmapData) {
      return res.status(400).json({ 
        error: 'Missing required fields: printerIp, printerPort, bitmapData' 
      });
    }

    console.log(`📄 Printing ESC/POS bitmap to ${printerIp}:${printerPort}`);
    console.log(`Bitmap size: ${bitmapData.length} bytes`);

    // Convert array back to Uint8Array
    const uint8Data = new Uint8Array(bitmapData);

    // Send to printer
    await sendToPrinter(printerIp, printerPort, uint8Data);

    res.json({ 
      success: true, 
      message: 'ESC/POS bitmap sent to printer',
      bytesTransferred: uint8Data.length
    });

  } catch (error) {
    console.error('❌ Bitmap print error:', error.message);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to print ESC/POS bitmap'
    });
  }
});

/**
 * Health check
 */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    version: "7.0",
    features: ["text", "bitmap", "pdf"],
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /print/pdf - In file PDF trắng đen (pdftoppm + sharp)
 * Body: {
 *   printerIp: "192.168.1.100",
 *   printerPort: 9100,
 *   pdfBase64: "base64_encoded_pdf_data",
 *   dpi: 300 (optional, default 300),
 *   threshold: 115 (optional, 0-255, default 115),
 *   width: 944 (optional, default 944px for 80mm @ 300 DPI)
 * }
 */
app.post("/print/pdf", async (req, res) => {
  try {
    const { 
      printerIp, 
      printerPort = 9100, 
      pdfBase64, 
      dpi = 300, 
      threshold = 115, 
      width = 944 
    } = req.body;

    if (!printerIp || !pdfBase64) {
      return res.status(400).json({
        error: "Missing required fields: printerIp, pdfBase64",
      });
    }

    console.log(`\n📄 [PDF Print Request]`);
    console.log(`   Printer: ${printerIp}:${printerPort}`);
    console.log(`   Settings: DPI=${dpi}, Threshold=${threshold}, Width=${width}px`);

    // Decode base64 PDF
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    console.log(`   PDF size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    // Convert PDF to ESC/POS bitmap
    console.log(`   🔄 Converting PDF to ESC/POS bitmap...`);
    const escposData = await pdfToESCPOSBitmap(pdfBuffer, { dpi, threshold, width });
    console.log(`   ✅ ESC/POS data: ${escposData.length} bytes`);

    // Send to printer
    console.log(`   📤 Sending to printer...`);
    await sendToPrinter(printerIp, printerPort, escposData);
    console.log(`   ✅ Print job sent successfully\n`);

    res.json({
      success: true,
      message: "PDF printed successfully",
      details: {
        dataSize: escposData.length,
        settings: { dpi, threshold, width }
      },
    });
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

/**
 * POST /print/text - In text với CP1258
 */
app.post("/print/text", async (req, res) => {
  try {
    const { printerIp, printerPort = 9100, text, encoding = "cp1258" } = req.body;

    if (!printerIp || !text) {
      return res.status(400).json({
        error: "Missing required fields: printerIp, text",
      });
    }

    console.log(`\n📝 [Text Print Request]`);
    console.log(`   Printer: ${printerIp}:${printerPort}`);
    console.log(`   Encoding: ${encoding}`);

    // Build ESC/POS commands
    const commands = [];

    // Initialize
    commands.push(Buffer.from([0x1B, 0x40]));

    // Set code page to CP1258 if requested
    if (encoding === "cp1258") {
      commands.push(Buffer.from([0x1B, 0x74, 0x1E])); // ESC t 30
    }

    // Convert text
    const convertedText = encoding === "cp1258" ? convertToCP1258(text) : text;
    commands.push(Buffer.from(convertedText + "\n\n\n", "binary"));

    // Cut
    commands.push(Buffer.from([0x1D, 0x56, 0x00]));

    const escposData = Buffer.concat(commands);

    // Send to printer
    await sendToPrinter(printerIp, printerPort, escposData);
    console.log(`   ✅ Text printed successfully\n`);

    res.json({
      success: true,
      message: "Text printed successfully",
    });
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    res.status(500).json({
      error: error.message,
    });
  }
});


// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║   XC80 Print Bridge Server v7.0 - PDF SUPPORT                ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 Endpoints:`);
  console.log(`   GET  /health           - Health check`);
  console.log(`   POST /print/pdf        - Print PDF (black & white)`);
  console.log(`   POST /print/text       - Print text (CP1258)`);
  console.log(`   POST /print/bitmap     - Print bitmap from canvas\n`);
  console.log(`📋 Requirements:`);
  console.log(`   • pdftoppm must be installed (poppler-utils)`);
  console.log(`   • Ubuntu/Debian: sudo apt-get install poppler-utils`);
  console.log(`   • macOS: brew install poppler`);
  console.log(`   • Windows: Download poppler from https://blog.alivate.com.au/poppler-windows/\n`);
  console.log(`🚀 Ready to accept print jobs!`);
  console.log(`════════════════════════════════════════════════════════════════\n`);
});
