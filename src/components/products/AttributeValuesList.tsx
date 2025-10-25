import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { ProductAttributeValue } from "@/hooks/use-product-attributes";

interface AttributeValuesListProps {
  values: ProductAttributeValue[];
  onDelete: (id: string) => void;
}

export function AttributeValuesList({ values, onDelete }: AttributeValuesListProps) {
  if (values.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Chưa có giá trị nào
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge key={value.id} variant="secondary" className="gap-2 pr-1">
          {value.value}
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-destructive/20"
            onClick={() => onDelete(value.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
    </div>
  );
}
