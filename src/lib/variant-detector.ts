/**
 * Enhanced Variant Detection System
 * Auto-detects product attributes (colors, sizes, model codes) from Vietnamese product names
 */

// Vietnamese color list with normalized versions
const COLORS = [
  "Đỏ", "Xanh", "Trắng", "Đen", "Vàng", "Hồng", "Tím", "Nâu", "Xám", "Cam",
  "Be", "Kem", "Bạc", "Vàng Gold", "Xanh Dương", "Xanh Lá", "Xanh Navy",
  "Hồng Phấn", "Tím Than", "Nâu Đất", "Xanh Rêu", "Xanh Lơ", "Xanh Mint"
];

// Size text patterns
const TEXT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "XXXL"];

// Abbreviations to expand before detection
const ABBREVIATIONS: Record<string, string> = {
  "sz": "size",
  "ms": "màu sắc",
  "s.": "size",
  "cỡ": "size",
  "số": "size",
};

export interface DetectedAttribute {
  type: 'color' | 'size_text' | 'size_number' | 'model_code';
  value: string;
  confidence: number; // 0-1
  position: number; // position in text
}

export interface DetectionResult {
  colors: DetectedAttribute[];
  sizeText: DetectedAttribute[];
  sizeNumber: DetectedAttribute[];
  modelCodes: DetectedAttribute[];
  normalized: string; // normalized text
  original: string;
}

/**
 * Normalize Vietnamese text: remove diacritics and lowercase
 */
function normalizeVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Expand common abbreviations in text
 */
function expandAbbreviations(text: string): string {
  let expanded = text;
  Object.entries(ABBREVIATIONS).forEach(([abbr, full]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    expanded = expanded.replace(regex, full);
  });
  return expanded;
}

/**
 * Detect colors from text with diacritic normalization
 */
function detectColors(text: string, normalizedText: string): DetectedAttribute[] {
  const detected: DetectedAttribute[] = [];
  const normalizedColors = COLORS.map(c => normalizeVietnamese(c));
  
  // Pattern for multiple colors: "Đỏ/Xanh", "Đỏ, Xanh", "phối đen"
  const colorSeparatorPattern = /[/,\-–—]|\s+phối\s+|\s+và\s+/gi;
  
  COLORS.forEach((color, index) => {
    const normalizedColor = normalizedColors[index];
    const colorPattern = new RegExp(`\\b${normalizedColor}\\b`, 'gi');
    
    let match;
    while ((match = colorPattern.exec(normalizedText)) !== null) {
      // Check context before the color
      const contextBefore = normalizedText.slice(Math.max(0, match.index - 10), match.index);
      
      // LOWER confidence if accent color keywords detected (phối, viền, họa tiết, etc.)
      const isAccentColor = /phoi|vien|hoa tiet|pha|trang tri|chi tiet|noi/i.test(contextBefore);
      
      // Higher confidence if primary color keywords detected (màu, sắc)
      const isPrimaryColor = /mau|sac/i.test(contextBefore);
      
      let confidence = 0.7; // default
      if (isAccentColor) {
        confidence = 0.4; // Low confidence for accent colors like "phối đen"
      } else if (isPrimaryColor) {
        confidence = 0.9; // High confidence for primary colors
      }
      
      detected.push({
        type: 'color',
        value: color,
        confidence,
        position: match.index
      });
    }
  });
  
  // Remove duplicates (keep highest confidence)
  const uniqueColors = new Map<string, DetectedAttribute>();
  detected.forEach(attr => {
    const existing = uniqueColors.get(normalizeVietnamese(attr.value));
    if (!existing || attr.confidence > existing.confidence) {
      uniqueColors.set(normalizeVietnamese(attr.value), attr);
    }
  });
  
  return Array.from(uniqueColors.values()).sort((a, b) => a.position - b.position);
}

/**
 * Detect text sizes (S, M, L, XL, etc.) with context awareness
 */
function detectTextSizes(text: string, normalizedText: string): DetectedAttribute[] {
  const detected: DetectedAttribute[] = [];
  
  TEXT_SIZES.forEach(size => {
    // CRITICAL: Match size ONLY if "size", "cỡ", or other keyword is nearby
    const sizePattern = new RegExp(`(size|cỡ|sz|s\\.)\\s*${size}\\b`, 'gi');
    
    let match;
    while ((match = sizePattern.exec(normalizedText)) !== null) {
      detected.push({
        type: 'size_text',
        value: size,
        confidence: 0.95, // High confidence because we matched with keyword
        position: match.index
      });
    }
  });
  
  // Detect patterns like "M/L", "M-L"
  const rangePattern = /\b([SMLX]{1,4})[/\\-]([SMLX]{1,4})\b/gi;
  let rangeMatch;
  while ((rangeMatch = rangePattern.exec(normalizedText)) !== null) {
    const size1 = rangeMatch[1].toUpperCase();
    const size2 = rangeMatch[2].toUpperCase();
    
    if (TEXT_SIZES.includes(size1)) {
      detected.push({
        type: 'size_text',
        value: size1,
        confidence: 0.8,
        position: rangeMatch.index
      });
    }
    if (TEXT_SIZES.includes(size2) && size1 !== size2) {
      detected.push({
        type: 'size_text',
        value: size2,
        confidence: 0.8,
        position: rangeMatch.index + size1.length + 1
      });
    }
  }
  
  return detected;
}

/**
 * Detect numeric sizes (36, 40, etc.) with context awareness - avoid false positives
 */
function detectNumericSizes(text: string, normalizedText: string): DetectedAttribute[] {
  const detected: DetectedAttribute[] = [];
  
  // CRITICAL: Only detect if "size", "cỡ", "số" keyword is nearby
  // Pattern: "size 40", "cỡ 38", "số 42"
  const sizePattern = /(size|cỡ|số|sz|s\.)\s*(\d{2,3})\b/gi;
  
  let match;
  while ((match = sizePattern.exec(normalizedText)) !== null) {
    const number = parseInt(match[2], 10);
    
    // Valid size range for clothing/shoes (prevent false positives like "150k")
    if (number >= 28 && number <= 50) {
      detected.push({
        type: 'size_number',
        value: match[2],
        confidence: 0.9,
        position: match.index
      });
    }
  }
  
  // Detect ranges: "36-40", "38, 40, 42"
  const rangePattern = /(\d{2})[,\\-](\d{2})/g;
  let rangeMatch;
  while ((rangeMatch = rangePattern.exec(normalizedText)) !== null) {
    const num1 = parseInt(rangeMatch[1], 10);
    const num2 = parseInt(rangeMatch[2], 10);
    
    // Check if it's in shoe/clothing range AND has size keyword nearby
    const context = normalizedText.slice(Math.max(0, rangeMatch.index - 20), rangeMatch.index + 10);
    const hasKeyword = /size|cỡ|số|giày|quần|áo/i.test(context);
    
    if (hasKeyword && num1 >= 28 && num1 <= 50) {
      detected.push({
        type: 'size_number',
        value: rangeMatch[1],
        confidence: 0.8,
        position: rangeMatch.index
      });
    }
    if (hasKeyword && num2 >= 28 && num2 <= 50 && num1 !== num2) {
      detected.push({
        type: 'size_number',
        value: rangeMatch[2],
        confidence: 0.8,
        position: rangeMatch.index + rangeMatch[1].length + 1
      });
    }
  }
  
  return detected;
}

/**
 * Detect model codes (A77, G123, etc.)
 */
function detectModelCodes(text: string): DetectedAttribute[] {
  const detected: DetectedAttribute[] = [];
  
  // Pattern: Letter followed by 1-4 digits (e.g., A77, G123)
  const modelPattern = /\b([A-Z]\d{1,4})\b/g;
  
  let match;
  while ((match = modelPattern.exec(text)) !== null) {
    detected.push({
      type: 'model_code',
      value: match[1],
      confidence: 0.85,
      position: match.index
    });
  }
  
  return detected;
}

/**
 * Main detection function - analyzes product name and returns all detected attributes
 */
export function detectVariantsFromText(text: string): DetectionResult {
  if (!text || typeof text !== 'string') {
    return {
      colors: [],
      sizeText: [],
      sizeNumber: [],
      modelCodes: [],
      normalized: '',
      original: text || ''
    };
  }
  
  // Step 1: Expand abbreviations
  const expanded = expandAbbreviations(text);
  
  // Step 2: Normalize for matching
  const normalized = normalizeVietnamese(expanded);
  
  // Step 3: Run all detectors
  const colors = detectColors(text, normalized);
  const sizeText = detectTextSizes(expanded, normalized);
  const sizeNumber = detectNumericSizes(expanded, normalized);
  const modelCodes = detectModelCodes(text); // Use original text for case-sensitive codes
  
  // Debug logging
  console.log('[Variant Detector]', {
    original: text,
    expanded,
    normalized,
    detected: {
      colors: colors.map(c => c.value),
      sizeText: sizeText.map(s => s.value),
      sizeNumber: sizeNumber.map(s => s.value),
      modelCodes: modelCodes.map(m => m.value)
    }
  });
  
  return {
    colors,
    sizeText,
    sizeNumber,
    modelCodes,
    normalized,
    original: text
  };
}

/**
 * Helper: Get simple string arrays from detection result (backward compatibility)
 */
export function getSimpleDetection(result: DetectionResult) {
  return {
    color: result.colors.map(c => c.value),
    sizeText: result.sizeText.map(s => s.value),
    sizeNumber: result.sizeNumber.map(s => s.value),
    modelCodes: result.modelCodes.map(m => m.value)
  };
}
