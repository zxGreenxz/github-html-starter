import { useState, useEffect } from 'react';
import { detectVariantsFromText, DetectionResult } from '@/lib/variant-detector';

export interface UseVariantDetectorProps {
  productName: string;
  variant?: string;
  enabled?: boolean;
  onDetected?: (result: DetectionResult) => void;
}

/**
 * React hook for auto-detecting product variants
 * Usage: const { detectionResult, hasDetections } = useVariantDetector({ productName, variant });
 */
export function useVariantDetector({ 
  productName, 
  variant = '', 
  enabled = true,
  onDetected 
}: UseVariantDetectorProps) {
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  
  useEffect(() => {
    if (!enabled || !productName.trim()) {
      setDetectionResult(null);
      return;
    }
    
    // Combine product name and variant for analysis
    const textToAnalyze = `${productName} ${variant || ''}`.trim();
    const result = detectVariantsFromText(textToAnalyze);
    
    setDetectionResult(result);
    onDetected?.(result);
  }, [productName, variant, enabled, onDetected]);
  
  const hasDetections = detectionResult && (
    detectionResult.colors.length > 0 ||
    detectionResult.sizeText.length > 0 ||
    detectionResult.sizeNumber.length > 0 ||
    detectionResult.modelCodes.length > 0
  );
  
  return { 
    detectionResult, 
    hasDetections: !!hasDetections 
  };
}
