/**
 * Text to Bitmap Converter for Thermal Printers
 * Render text lên Canvas rồi convert thành monochrome bitmap
 * Hỗ trợ tiếng Việt đầy đủ dấu
 */

export interface LineConfig {
  text: string;
  fontSize: number;
  bold?: boolean;
}

export interface BitmapOptions {
  width?: number;          // Pixel width (default: 384 for 80mm printer)
  fontSize?: number;       // Font size (default: 24)
  fontFamily?: string;     // Font family (default: "Arial, sans-serif")
  lineHeight?: number;     // Line height multiplier (default: 1.2)
  align?: 'left' | 'center' | 'right';
  padding?: number;        // Padding around text (default: 10)
  bold?: boolean;          // Bold text
  lines?: LineConfig[];    // Per-line configuration (overrides text and fontSize)
  lineSpacing?: number;    // Extra spacing between lines in pixels (default: 0)
}

export interface BitmapResult {
  width: number;           // Bitmap width in pixels
  height: number;          // Bitmap height in pixels
  data: Uint8Array;        // Monochrome bitmap data (1 bit per pixel, packed)
}

/**
 * Convert text to monochrome bitmap
 */
export async function textToBitmap(
  text: string,
  options: BitmapOptions = {}
): Promise<BitmapResult> {
  const {
    width = 384,          // 80mm printer = 384 dots
    fontSize = 24,
    fontFamily = 'Arial, sans-serif',
    lineHeight = 1.2,
    align = 'center',
    padding = 10,
    bold = false,
    lines: lineConfigs,
    lineSpacing = 0
  } = options;

  // Create canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Set canvas width
  canvas.width = width;

  // Prepare line data
  let lines: Array<{ text: string; fontSize: number; bold: boolean }>;
  
  if (lineConfigs && lineConfigs.length > 0) {
    // Use per-line configuration
    lines = lineConfigs.map(lc => ({
      text: lc.text,
      fontSize: lc.fontSize,
      bold: lc.bold ?? bold
    }));
  } else {
    // Use single text with default settings
    lines = text.split('\n').map(t => ({
      text: t,
      fontSize,
      bold
    }));
  }

  // Calculate total height
  let totalHeight = padding * 2;
  const lineHeights: number[] = [];
  
  lines.forEach((line, index) => {
    const lineHeightPx = line.fontSize * lineHeight;
    lineHeights.push(lineHeightPx);
    totalHeight += lineHeightPx;
    if (index < lines.length - 1) {
      totalHeight += lineSpacing; // Add extra spacing between lines
    }
  });

  // Set canvas height
  canvas.height = Math.ceil(totalHeight);

  // Fill white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Set text color to black
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  // Draw each line with its own font size
  let yPos = padding;
  lines.forEach((line, index) => {
    const fontWeight = line.bold ? 'bold' : 'normal';
    ctx.font = `${fontWeight} ${line.fontSize}px ${fontFamily}`;
    
    // Set alignment for each line
    ctx.textAlign = align;
    
    // Calculate X position based on alignment
    let xPos = padding;
    if (align === 'center') xPos = canvas.width / 2;
    else if (align === 'right') xPos = canvas.width - padding;
    
    ctx.fillText(line.text, xPos, yPos);
    yPos += lineHeights[index];
    if (index < lines.length - 1) {
      yPos += lineSpacing; // Add extra spacing
    }
  });

  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Convert to monochrome bitmap (1 bit per pixel)
  const monoData = convertToMonochrome(imageData);

  return {
    width: canvas.width,
    height: canvas.height,
    data: monoData
  };
}

/**
 * Convert ImageData to monochrome (1-bit) bitmap
 * Packed format: 8 pixels per byte
 */
function convertToMonochrome(imageData: ImageData): Uint8Array {
  const { width, height, data } = imageData;
  
  // Calculate bytes per line (must be multiple of 8 bits)
  const bytesPerLine = Math.ceil(width / 8);
  const totalBytes = bytesPerLine * height;
  
  const monoData = new Uint8Array(totalBytes);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;
      
      // Get RGB values (alpha is ignored)
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      
      // Calculate grayscale value
      const gray = (r + g + b) / 3;
      
      // Threshold: < 128 = black (1), >= 128 = white (0)
      const isBlack = gray < 128 ? 1 : 0;
      
      // Pack into byte (MSB first)
      const byteIndex = y * bytesPerLine + Math.floor(x / 8);
      const bitIndex = 7 - (x % 8);
      
      if (isBlack) {
        monoData[byteIndex] |= (1 << bitIndex);
      }
    }
  }
  
  return monoData;
}

/**
 * Encode monochrome bitmap to ESC/POS GS v 0 format
 * GS v 0 m xL xH yL yH [data]
 */
export function encodeBitmapToESCPOS(bitmap: BitmapResult): Uint8Array {
  const { width, height, data } = bitmap;
  
  // Calculate bytes per line
  const bytesPerLine = Math.ceil(width / 8);
  
  // GS v 0 command header
  const header = new Uint8Array([
    0x1D, 0x76, 0x30,        // GS v 0
    0x00,                     // m = normal mode (0x00)
    bytesPerLine & 0xFF,      // xL (width in bytes, low byte)
    (bytesPerLine >> 8) & 0xFF, // xH (width in bytes, high byte)
    height & 0xFF,            // yL (height in dots, low byte)
    (height >> 8) & 0xFF      // yH (height in dots, high byte)
  ]);
  
  // Combine header + bitmap data
  const result = new Uint8Array(header.length + data.length);
  result.set(header, 0);
  result.set(data, header.length);
  
  return result;
}

/**
 * Main function: Text → Bitmap → ESC/POS bytes
 */
export async function textToESCPOSBitmap(
  text: string,
  options: BitmapOptions = {}
): Promise<Uint8Array> {
  console.log('🖼️ Converting text to bitmap...');
  
  // Step 1: Render text to canvas → monochrome bitmap
  const bitmap = await textToBitmap(text, options);
  console.log(`✅ Bitmap created: ${bitmap.width}x${bitmap.height} pixels`);
  
  // Step 2: Encode bitmap to ESC/POS format
  const escposData = encodeBitmapToESCPOS(bitmap);
  console.log(`✅ ESC/POS encoded: ${escposData.length} bytes`);
  
  // Step 3: Add paper feed and cut commands
  const cutCommands = new Uint8Array([
    0x1B, 0x64, 0x03,  // ESC d 3 - Feed 3 lines
    0x1D, 0x56, 0x42   // GS V 66 - Feed and full cut paper
  ]);
  
  // Combine ESC/POS data + cut commands
  const result = new Uint8Array(escposData.length + cutCommands.length);
  result.set(escposData, 0);
  result.set(cutCommands, escposData.length);
  
  console.log(`✅ Added paper cut command`);
  
  return result;
}
