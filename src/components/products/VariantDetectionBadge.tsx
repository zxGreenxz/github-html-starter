import { Badge } from "@/components/ui/badge";
import { DetectionResult } from "@/lib/variant-detector";
import { Sparkles } from "lucide-react";

interface VariantDetectionBadgeProps {
  detectionResult: DetectionResult | null;
  className?: string;
}

/**
 * Display detected variants as badges
 */
export function VariantDetectionBadge({ 
  detectionResult, 
  className = "" 
}: VariantDetectionBadgeProps) {
  if (!detectionResult) return null;
  
  const { colors, sizeText, sizeNumber, modelCodes } = detectionResult;
  const hasAnyDetection = colors.length > 0 || sizeText.length > 0 || 
                          sizeNumber.length > 0 || modelCodes.length > 0;
  
  if (!hasAnyDetection) return null;
  
  return (
    <div className={`flex items-start gap-2 flex-wrap ${className}`}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Sparkles className="w-3 h-3" />
        <span>Phát hiện:</span>
      </div>
      
      {colors.map((attr, i) => (
        <Badge 
          key={`color-${i}`} 
          variant="secondary"
          className="text-xs"
        >
          {attr.value}
        </Badge>
      ))}
      
      {sizeText.map((attr, i) => (
        <Badge 
          key={`size-text-${i}`} 
          variant="outline"
          className="text-xs"
        >
          Size {attr.value}
        </Badge>
      ))}
      
      {sizeNumber.map((attr, i) => (
        <Badge 
          key={`size-num-${i}`} 
          variant="outline"
          className="text-xs"
        >
          Số {attr.value}
        </Badge>
      ))}
      
      {modelCodes.map((attr, i) => (
        <Badge 
          key={`model-${i}`} 
          variant="default"
          className="text-xs"
        >
          {attr.value}
        </Badge>
      ))}
    </div>
  );
}
