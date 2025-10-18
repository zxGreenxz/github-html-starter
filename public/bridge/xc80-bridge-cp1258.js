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
const fs = require("fs");
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
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
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
 * Convert PDF thành hình ảnh PNG sử dụng pdftoppm
 */
async function convertPdfToImage(pdfBuffer, dpi = 203) {
  const timestamp = Date.now();
  const pdfPath = path.join(TEMP_DIR, `temp_${timestamp}.pdf`);
  const outputPrefix = path.join(TEMP_DIR, `output_${timestamp}`);

  try {
    // Lưu PDF buffer vào file
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Convert PDF sang PNG với pdftoppm (grayscale)
    // -png: output PNG
    // -gray: grayscale mode
    // -r: resolution (DPI)
    // -singlefile: chỉ convert page đầu tiên
    const command = `pdftoppm -png -gray -r ${dpi} -singlefile "${pdfPath}" "${outputPrefix}"`;
    
    await execAsync(command);

    // Đọc file PNG vừa tạo
    const pngPath = `${outputPrefix}.png`;
    const imageBuffer = fs.readFileSync(pngPath);

    // Cleanup temp files
    fs.unlinkSync(pdfPath);
    fs.unlinkSync(pngPath);

    return imageBuffer;
  } catch (error) {
    // Cleanup on error
    try {
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    } catch (e) {}
    throw error;
  }
}

/**
 * Convert hình ảnh thành monochrome bitmap cho thermal printer
 */
async function convertToMonochrome(imageBuffer, width = 576, threshold = 128) {
  try {
    // Resize và convert sang grayscale
    let image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // Resize để fit với độ rộng máy in (576px cho 80mm @ 203dpi)
    if (metadata.width > width) {
      image = image.resize(width, null, {
        fit: "inside",
        withoutEnlargement: false,
      });
    }

    // Convert sang grayscale và threshold để tạo ảnh đen trắng
    const processedBuffer = await image
      .grayscale()
      .threshold(threshold)
      .raw()
      .toBuffer({ resolveWithObject: true });

    return {
      data: processedBuffer.data,
      width: processedBuffer.info.width,
      height: processedBuffer.info.height,
    };
  } catch (error) {
    throw new Error(`Image processing error: ${error.message}`);
  }
}

/**
 * Tạo ESC/POS bitmap commands từ monochrome image data
 */
function createBitmapCommands(imageData, width, height) {
  const commands = [];

  // ESC @ - Initialize printer
  commands.push(Buffer.from([0x1B, 0x40]));

  // Chia hình ảnh thành các dải 24 pixel height
  const sliceHeight = 24;
  const numSlices = Math.ceil(height / sliceHeight);

  for (let slice = 0; slice < numSlices; slice++) {
    const startY = slice * sliceHeight;
    const endY = Math.min(startY + sliceHeight, height);
    const actualHeight = endY - startY;

    // ESC * m nL nH d1...dk
    // m = 33 (24-dot double-density)
    const nL = width & 0xff;
    const nH = (width >> 8) & 0xff;

    const header = Buffer.from([0x1B, 0x2A, 0x21, nL, nH]);
    commands.push(header);

    // Tạo bitmap data cho slice này
    const sliceData = [];
    for (let x = 0; x < width; x++) {
      // Mỗi cột có 3 bytes (24 bits)
      const bytes = [0, 0, 0];

      for (let y = 0; y < sliceHeight; y++) {
        const actualY = startY + y;
        if (actualY >= height) break;

        const pixelIndex = actualY * width + x;
        const pixelValue = imageData[pixelIndex];

        // Nếu pixel đen (0), set bit tương ứng
        if (pixelValue === 0) {
          const byteIndex = Math.floor(y / 8);
          const bitIndex = y % 8;
          bytes[byteIndex] |= 1 << (7 - bitIndex);
        }
      }

      sliceData.push(...bytes);
    }

    commands.push(Buffer.from(sliceData));

    // Line feed
    commands.push(Buffer.from([0x0A]));
  }

  // Feed thêm giấy và cut
  commands.push(Buffer.from([0x1B, 0x64, 0x03])); // Feed 3 lines
  commands.push(Buffer.from([0x1D, 0x56, 0x00])); // Full cut

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
 * POST /print/pdf - In file PDF trắng đen
 * Body: {
 *   printerIp: "192.168.1.100",
 *   printerPort: 9100,
 *   pdf: "base64_encoded_pdf_data",
 *   width: 576 (optional, default 576px for 80mm),
 *   dpi: 203 (optional, default 203),
 *   threshold: 128 (optional, 0-255, default 128)
 * }
 */
app.post("/print/pdf", async (req, res) => {
  try {
    const { printerIp, printerPort = 9100, pdf, width = 576, dpi = 203, threshold = 128 } = req.body;

    if (!printerIp || !pdf) {
      return res.status(400).json({
        error: "Missing required fields: printerIp, pdf",
      });
    }

    console.log(`\n📄 [PDF Print Request]`);
    console.log(`   Printer: ${printerIp}:${printerPort}`);
    console.log(`   Width: ${width}px, DPI: ${dpi}, Threshold: ${threshold}`);

    // Decode base64 PDF
    const pdfBuffer = Buffer.from(pdf, "base64");
    console.log(`   PDF size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    // Step 1: Convert PDF to PNG
    console.log(`   🔄 Converting PDF to image...`);
    const imageBuffer = await convertPdfToImage(pdfBuffer, dpi);
    console.log(`   ✅ Image created`);

    // Step 2: Convert to monochrome
    console.log(`   🔄 Processing image to monochrome...`);
    const { data, width: imgWidth, height: imgHeight } = await convertToMonochrome(
      imageBuffer,
      width,
      threshold
    );
    console.log(`   ✅ Monochrome image: ${imgWidth}x${imgHeight}px`);

    // Step 3: Create ESC/POS commands
    console.log(`   🔄 Creating ESC/POS bitmap commands...`);
    const escposData = createBitmapCommands(data, imgWidth, imgHeight);
    console.log(`   ✅ Commands created: ${escposData.length} bytes`);

    // Step 4: Send to printer
    console.log(`   📤 Sending to printer...`);
    await sendToPrinter(printerIp, printerPort, escposData);
    console.log(`   ✅ Print job sent successfully\n`);

    res.json({
      success: true,
      message: "PDF printed successfully",
      details: {
        imageSize: `${imgWidth}x${imgHeight}`,
        dataSize: escposData.length,
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

/**
 * POST /print/bitmap - In bitmap từ canvas
 */
app.post("/print/bitmap", async (req, res) => {
  try {
    const { printerIp, printerPort = 9100, bitmap, width, height, threshold = 128 } = req.body;

    if (!printerIp || !bitmap || !width || !height) {
      return res.status(400).json({
        error: "Missing required fields: printerIp, bitmap, width, height",
      });
    }

    console.log(`\n🖼️  [Bitmap Print Request]`);
    console.log(`   Printer: ${printerIp}:${printerPort}`);
    console.log(`   Size: ${width}x${height}px`);

    // Convert base64 bitmap to buffer
    const imageBuffer = Buffer.from(bitmap, "base64");

    // Process image
    const { data, width: imgWidth, height: imgHeight } = await convertToMonochrome(
      imageBuffer,
      width,
      threshold
    );

    // Create ESC/POS commands
    const escposData = createBitmapCommands(data, imgWidth, imgHeight);

    // Send to printer
    await sendToPrinter(printerIp, printerPort, escposData);
    console.log(`   ✅ Bitmap printed successfully\n`);

    res.json({
      success: true,
      message: "Bitmap printed successfully",
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
