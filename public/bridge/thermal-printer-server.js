/**
 * THERMAL PRINTER BRIDGE SERVER - COMPACT VERSION
 * Bold text, smaller paper (58mm), auto-scaled
 */

const express = require('express');
const cors = require('cors');
const sharp = require('sharp');
const puppeteer = require('puppeteer');
const net = require('net');

const app = express();
const PORT = 3001;

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

/**
 * POST /print/html
 * Convert HTML to bitmap with BOLD settings
 * Default width: 384px (58mm) - compact size
 */
app.post('/print/html', async (req, res) => {
  try {
    const { 
      printerIp, 
      printerPort, 
      html, 
      width, 
      height,
      threshold,
      scale
    } = req.body;
    
    // Convert and validate all parameters with safe defaults
    const widthValue = parseInt(width) || 576;
    const heightValue = (height === 'auto' || height === null || height === undefined) ? null : parseInt(height);
    const thresholdValue = parseInt(threshold);
    const scaleValue = parseFloat(scale) || 2;
    
    // Validate threshold - must be a valid number between 0-255
    if (isNaN(thresholdValue) || thresholdValue < 0 || thresholdValue > 255) {
      console.error('❌ Invalid threshold:', threshold, '→', thresholdValue);
      throw new Error(`Invalid threshold value: ${threshold}. Must be a number between 0 and 255.`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 Converting HTML to BOLD bitmap...');
    console.log('📍 Printer:', printerIp + ':' + printerPort);
    console.log('📏 Width:', widthValue, 'pixels');
    console.log('📐 Height:', heightValue ? heightValue + ' pixels' : 'Auto');
    console.log('⚫ Threshold:', thresholdValue, '(bold mode)');
    console.log('🔍 Scale:', scaleValue + 'x');
    
    // 1. Launch Puppeteer with higher DPI for sharper text
    console.log('🚀 Starting Puppeteer...');
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none'
      ]
    });
    
    const page = await browser.newPage();
    
    // Calculate viewport dimensions
    const viewportWidth = Math.max(800, Math.round(widthValue * 1.5));
    const viewportHeight = heightValue || 2000;
    
    await page.setViewport({ 
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: scaleValue
    });
    
    console.log('📄 Loading HTML...');
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');
    
    console.log('📸 Taking high-quality screenshot...');
    
    // Always use fullPage for simplicity and reliability
    const screenshot = await page.screenshot({ 
      type: 'png',
      fullPage: true,
      omitBackground: true
    });
    
    await browser.close();
    console.log('✅ Screenshot completed');
    
    // 2. Process image with Sharp - BOLD settings
    console.log('🖼️  Processing image with BOLD filter...');
    
    // Start with resize to target width
    let sharpInstance = sharp(screenshot);
    
    // If specific height is requested, resize with exact dimensions
    if (heightValue) {
      console.log('📐 Resizing to exact dimensions:', widthValue, 'x', heightValue);
      sharpInstance = sharpInstance.resize({
        width: widthValue,
        height: heightValue,
        fit: 'cover',
        position: 'top'
      });
    } else {
      // Auto height - just resize width
      console.log('📏 Auto height - resizing width only');
      sharpInstance = sharpInstance.resize({
        width: widthValue,
        fit: 'inside'
      });
    }
    
    // Apply filters
    const imageBuffer = await sharpInstance
      .grayscale()
      .sharpen({ sigma: 1.5 })
      .threshold(thresholdValue)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    console.log('📐 Final size:', imageBuffer.info.width, 'x', imageBuffer.info.height);
    
    // 3. Send to thermal printer
    console.log('🖨️  Sending to printer...');
    await printImageToThermal(printerIp, printerPort, imageBuffer.data, imageBuffer.info);
    
    console.log('✅ Print completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.json({ 
      success: true, 
      message: 'Print completed successfully',
      imageInfo: {
        width: imageBuffer.info.width,
        height: imageBuffer.info.height
      }
    });
    
  } catch (error) {
    console.error('❌ Print error:', error.message);
    console.error('Stack:', error.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'Thermal Printer Bridge (Full Width & Bold)',
    timestamp: new Date().toISOString(),
    port: PORT,
    defaultWidth: 576,
    defaultThreshold: 95
  });
});

/**
 * GET /
 */
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Thermal Printer Bridge - Compact</title>
        <style>
          body { font-family: Arial; padding: 40px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; }
          .feature { background: #e8f5e9; padding: 10px; margin: 8px 0; border-radius: 5px; border-left: 4px solid #4caf50; }
          .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #007bff; }
          .method { color: #28a745; font-weight: bold; }
          code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
          .bold { font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🖨️ Thermal Printer Bridge Server</h1>
          <p><span class="bold">Full Width & Bold Edition</span></p>
          
          <h2>✨ Optimizations:</h2>
          <div class="feature">
            ⚫ <strong>Bold Text</strong> - Threshold: 95 (darker)
          </div>
          <div class="feature">
            📏 <strong>Full Width</strong> - Default: 576px (80mm)
          </div>
          <div class="feature">
            🔍 <strong>High Quality</strong> - 2x device scale + sharpening
          </div>
          
          <h2>📡 Available Endpoints:</h2>
          
          <div class="endpoint">
            <span class="method">POST</span> <code>/print/html</code>
            <p>Convert HTML to bold bitmap and print</p>
            <small>Parameters: printerIp, printerPort, html, width (default: 384), threshold (default: 95)</small>
          </div>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/health</code>
            <p>Health check endpoint</p>
          </div>
          
          <hr>
          <p><strong>Status:</strong> ✅ Ready</p>
          <p><strong>Mode:</strong> Compact & Bold</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString('vi-VN')}</p>
        </div>
      </body>
    </html>
  `);
});

/**
 * Print image to thermal printer using ESC/POS
 */
async function printImageToThermal(ip, port, imageData, info) {
  const { width, height } = info;
  const commands = [];
  
  // Initialize printer
  commands.push(Buffer.from([ESC, 0x40])); // ESC @ - Initialize
  
  // Set line spacing to 0
  commands.push(Buffer.from([ESC, 0x33, 0x00])); // ESC 3 0
  
  // Center alignment
  commands.push(Buffer.from([ESC, 0x61, 0x01])); // ESC a 1
  
  // Print image in 24-dot slices
  for (let y = 0; y < height; y += 24) {
    const sliceHeight = Math.min(24, height - y);
    
    // ESC * m nL nH - Bit image mode
    // m = 33 (24-dot double-density)
    const nL = width & 0xFF;
    const nH = (width >> 8) & 0xFF;
    commands.push(Buffer.from([ESC, 0x2A, 33, nL, nH]));
    
    // Convert pixels to ESC/POS format
    const lineData = [];
    for (let x = 0; x < width; x++) {
      let byte1 = 0, byte2 = 0, byte3 = 0;
      
      // First 8 dots
      for (let i = 0; i < 8 && (y + i) < height; i++) {
        const pixelIndex = (y + i) * width + x;
        const pixel = imageData[pixelIndex];
        if (pixel < 128) { // Black pixel
          byte1 |= (1 << (7 - i));
        }
      }
      
      // Second 8 dots
      for (let i = 8; i < 16 && (y + i) < height; i++) {
        const pixelIndex = (y + i) * width + x;
        const pixel = imageData[pixelIndex];
        if (pixel < 128) {
          byte2 |= (1 << (15 - i));
        }
      }
      
      // Third 8 dots
      for (let i = 16; i < 24 && (y + i) < height; i++) {
        const pixelIndex = (y + i) * width + x;
        const pixel = imageData[pixelIndex];
        if (pixel < 128) {
          byte3 |= (1 << (23 - i));
        }
      }
      
      lineData.push(byte1, byte2, byte3);
    }
    
    commands.push(Buffer.from(lineData));
    commands.push(Buffer.from([0x0A])); // Line feed
  }
  
  // Reset line spacing
  commands.push(Buffer.from([ESC, 0x32])); // ESC 2
  
  // Feed paper (minimal - compact)
  commands.push(Buffer.from([0x0A, 0x0A]));
  
  // Cut paper (full cut)
  commands.push(Buffer.from([GS, 0x56, 0x00])); // GS V 0
  
  // Send to printer via TCP socket
  await sendToPrinter(ip, port, Buffer.concat(commands));
}

/**
 * Send data to printer via TCP socket
 */
function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let timeout;
    
    timeout = setTimeout(() => {
      client.destroy();
      reject(new Error('Connection timeout'));
    }, 10000);
    
    client.connect(port, ip, () => {
      console.log('🔌 Connected to printer');
      clearTimeout(timeout);
      client.write(data);
    });
    
    client.on('data', (data) => {
      console.log('📨 Received from printer:', data.length, 'bytes');
    });
    
    client.on('close', () => {
      console.log('🔌 Connection closed');
      clearTimeout(timeout);
      resolve();
    });
    
    client.on('error', (err) => {
      console.error('❌ Socket error:', err.message);
      clearTimeout(timeout);
      reject(err);
    });
    
    setTimeout(() => {
      client.destroy();
    }, 2000);
  });
}

// Error handling
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   🖨️  FULL WIDTH & BOLD PRINTER SERVER       ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('');
  console.log('🚀 Server:        http://localhost:' + PORT);
  console.log('📏 Paper Width:   80mm (576px) - Full Width');
  console.log('⚫ Text Style:    Bold & Dark (Threshold: 95)');
  console.log('');
  console.log('📡 Endpoints:');
  console.log('   POST /print/html - Print bold bitmap');
  console.log('   GET  /health     - Health check');
  console.log('');
  console.log('⏰ Started:', new Date().toLocaleString('vi-VN'));
  console.log('');
  console.log('💡 Open printer-config.html to configure');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});
