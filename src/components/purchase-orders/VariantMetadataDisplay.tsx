import { Badge } from "@/components/ui/badge";
import type { TPOSAttributeLine } from "@/lib/variant-generator";

interface VariantMetadataDisplayProps {
  metadata: TPOSAttributeLine[] | null;
}

export function VariantMetadataDisplay({ metadata }: VariantMetadataDisplayProps) {
  if (!metadata || metadata.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      {metadata.map((line, index) => (
        <div key={index} className="flex flex-wrap items-center gap-1">
          <span className="text-sm font-medium text-muted-foreground">
            {line.Attribute.Name}:
          </span>
          <div className="flex flex-wrap gap-1">
            {line.Values.map((value, vIndex) => (
              <Badge key={vIndex} variant="secondary" className="text-xs">
                {value.Name}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
