import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface BitmapOptions {
  dpi?: number;
  threshold?: number;
  width?: number;
}

/**
 * Convert PDF data URI to Canvas using PDF.js
 */
async function pdfToCanvas(pdfDataUri: string, dpi: number, width: number): Promise<HTMLCanvasElement> {
  // Extract base64 data from data URI
  const base64Data = pdfDataUri.split(',')[1];
  const binaryData = atob(base64Data);
  const uint8Array = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    uint8Array[i] = binaryData.charCodeAt(i);
  }

  // Load PDF
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  // Calculate scale based on DPI and desired width
  const viewport = page.getViewport({ scale: 1 });
  const scale = width / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas context');
  }

  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  // Render PDF page to canvas
  await page.render({
    canvasContext: context,
    viewport: scaledViewport,
    canvas: canvas
  }).promise;

  return canvas;
}

/**
 * Enhance Canvas: Apply contrast and sharpening
 */
function enhanceCanvas(canvas: HTMLCanvasElement, contrastFactor: number = 1.3): void {
  const context = canvas.getContext('2d');
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Step 1: Increase contrast
  const factor = (259 * (contrastFactor * 255 + 255)) / (255 * (259 - contrastFactor * 255));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;     // R
    data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
    data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
  }

  // Step 2: Apply simple sharpening kernel (3x3)
  const width = canvas.width;
  const height = canvas.height;
  const original = new Uint8ClampedArray(data);

  // Sharpening kernel: [0, -1, 0], [-1, 5, -1], [0, -1, 0]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB only, skip alpha
        const idx = (y * width + x) * 4 + c;
        const sharpened = 
          5 * original[idx] -
          original[((y - 1) * width + x) * 4 + c] -
          original[((y + 1) * width + x) * 4 + c] -
          original[(y * width + (x - 1)) * 4 + c] -
          original[(y * width + (x + 1)) * 4 + c];
        
        data[idx] = Math.max(0, Math.min(255, sharpened));
      }
    }
  }

  context.putImageData(imageData, 0, 0);
}

/**
 * Convert Canvas to Monochrome Bitmap with threshold
 */
function canvasToMonochrome(canvas: HTMLCanvasElement, threshold: number): ImageData {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas context');
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale then apply threshold
  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale (weighted average)
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    
    // Apply threshold: < threshold = black (0), >= threshold = white (255)
    const bw = gray < threshold ? 0 : 255;
    
    data[i] = bw;     // R
    data[i + 1] = bw; // G
    data[i + 2] = bw; // B
    // Alpha remains unchanged
  }

  return imageData;
}

/**
 * Encode Monochrome ImageData to ESC/POS bitmap commands
 */
function encodeToESCPOS(imageData: ImageData): Uint8Array {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Calculate bytes per line (width must be divisible by 8)
  const bytesPerLine = Math.ceil(width / 8);
  const commands: number[] = [];

  // ESC/POS bitmap command: GS v 0
  // Format: GS v 0 m xL xH yL yH [bitmap data]
  commands.push(0x1D, 0x76, 0x30, 0x00); // GS v 0 m (m=0 for normal mode)
  
  // Width in bytes (little endian)
  commands.push(bytesPerLine & 0xFF, (bytesPerLine >> 8) & 0xFF);
  
  // Height in pixels (little endian)
  commands.push(height & 0xFF, (height >> 8) & 0xFF);

  // Convert pixels to bitmap bytes
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < bytesPerLine; x++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const px = x * 8 + bit;
        if (px < width) {
          const idx = (y * width + px) * 4;
          // If pixel is black (< 128), set bit to 1
          if (data[idx] < 128) {
            byte |= (1 << (7 - bit));
          }
        }
      }
      commands.push(byte);
    }
  }

  // Add line feeds
  commands.push(0x0A, 0x0A, 0x0A);

  return new Uint8Array(commands);
}

/**
 * Main export: Convert PDF to ESC/POS bitmap for XC80 printer
 */
export async function pdfToBitmapForXC80(
  pdfDataUri: string,
  options: BitmapOptions = {}
): Promise<Uint8Array> {
  const {
    dpi = 300,
    threshold = 115,
    width = 944 // 80mm @ 300 DPI
  } = options;

  console.log('Converting PDF to bitmap with options:', { dpi, threshold, width });

  // Step 1: PDF → Canvas
  const canvas = await pdfToCanvas(pdfDataUri, dpi, width);
  console.log('PDF rendered to canvas:', canvas.width, 'x', canvas.height);

  // Step 2: Enhance Canvas
  enhanceCanvas(canvas, 1.3);
  console.log('Enhanced canvas with contrast=1.3 and sharpening');

  // Step 3: Canvas → Monochrome
  const monochromeData = canvasToMonochrome(canvas, threshold);
  console.log('Converted to monochrome with threshold:', threshold);

  // Step 4: Monochrome → ESC/POS
  const escposData = encodeToESCPOS(monochromeData);
  console.log('Encoded to ESC/POS bitmap:', escposData.length, 'bytes');

  return escposData;
}
