import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";

interface ReceivingItemRowProps {
  item: any;
  index?: number;
  onQuantityChange: (itemId: string, quantity: number) => void;
  isConfirmed: boolean;
  onConfirm: (itemId: string) => void;
  isMobile?: boolean;
}

export function ReceivingItemRow({ item, index = 0, onQuantityChange, isConfirmed, onConfirm, isMobile = false }: ReceivingItemRowProps) {
  const getRowClassName = () => {
    if (isConfirmed) return 'bg-green-50/50';
    return '';
  };

  const getInputClassName = () => {
    const baseClass = isMobile ? "w-full text-center h-12 text-lg" : "w-24 text-center mx-auto";
    const disabledClass = isConfirmed ? baseClass : baseClass;
    
    if (isConfirmed) return disabledClass;
    
    if (item.received_quantity < item.quantity) {
      return `${baseClass} bg-red-50 border-2 border-red-400 text-red-700 focus-visible:ring-red-500`;
    } else if (item.received_quantity > item.quantity) {
      return `${baseClass} bg-orange-50 border-2 border-orange-400 text-orange-700 focus-visible:ring-orange-500`;
    }
    return baseClass;
  };

  const getDiscrepancyDisplay = () => {
    const diff = item.received_quantity - item.quantity;
    
    if (diff < 0) {
      return (
        <div className={`flex items-center ${isMobile ? 'justify-start' : 'justify-center'} gap-2 text-red-700`}>
          <AlertCircle className={isMobile ? "w-6 h-6" : "w-5 h-5"} />
          <span className={isMobile ? "text-base font-semibold" : "text-sm font-medium"}>Thiếu {Math.abs(diff)}</span>
        </div>
      );
    } else if (diff > 0) {
      return (
        <div className={`flex items-center ${isMobile ? 'justify-start' : 'justify-center'} gap-2 text-orange-600`}>
          <AlertTriangle className={isMobile ? "w-6 h-6" : "w-5 h-5"} />
          <span className={isMobile ? "text-base font-semibold" : "text-sm font-medium"}>Dư {diff}</span>
        </div>
      );
    } else {
      return (
        <div className={`flex items-center ${isMobile ? 'justify-start' : 'justify-center'} gap-2 text-green-700`}>
          <CheckCircle className={isMobile ? "w-6 h-6" : "w-5 h-5"} />
          <span className={isMobile ? "text-base font-semibold" : "text-sm font-medium"}>Đủ hàng</span>
        </div>
      );
    }
  };

  // Mobile Card Layout
  if (isMobile) {
    return (
      <div className={`border rounded-lg p-4 space-y-3 ${getRowClassName()}`}>
        <div className="flex gap-3">
          {item.product_images && item.product_images.length > 0 ? (
            <img 
              src={item.product_images[0]} 
              alt={item.product_name}
              className="w-20 h-20 object-cover rounded border flex-shrink-0 cursor-pointer transition-transform duration-200 hover:scale-[14] hover:z-50 relative origin-left"
            />
          ) : (
            <div className="w-20 h-20 bg-muted rounded border flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base mb-1">{item.product_name}</div>
            {item.variant && (
              <div className="text-sm text-muted-foreground mb-2">{item.variant}</div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">SL Đặt:</span>
                <span className="font-semibold ml-1 text-base">{item.quantity}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Số lượng nhận thực tế</label>
          <Input
            type="number"
            min="0"
            value={item.received_quantity}
            onChange={(e) => onQuantityChange(item.id, parseInt(e.target.value) || 0)}
            className={getInputClassName()}
            disabled={isConfirmed}
          />
        </div>

        <div className="space-y-2">
          {getDiscrepancyDisplay()}
        </div>
        
        <div>
          <Button 
            size="default"
            variant={isConfirmed ? "secondary" : "default"}
            onClick={() => onConfirm(item.id)}
            className="w-full min-h-[48px] text-base"
          >
            {isConfirmed ? "Hủy xác nhận" : "Xác nhận"}
          </Button>
        </div>
      </div>
    );
  }

  // Desktop Table Row Layout
  return (
    <tr className={getRowClassName()}>
      <td className="p-2 text-center w-12">
        <span className="text-sm text-muted-foreground">{index + 1}</span>
      </td>
      <td className="p-2 min-w-[200px]">
        <div className="flex items-center gap-2">
          {item.product_images && item.product_images.length > 0 ? (
            <img 
              src={item.product_images[0]} 
              alt={item.product_name}
              className="w-10 h-10 object-cover rounded border flex-shrink-0 cursor-pointer transition-transform duration-200 hover:scale-[14] hover:z-50 relative origin-left"
            />
          ) : (
            <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-muted-foreground">No img</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{item.product_name}</div>
            {item.variant && (
              <div className="text-xs text-muted-foreground truncate">{item.variant}</div>
            )}
          </div>
        </div>
      </td>
      <td className="p-2 text-center w-20">
        <span className="font-medium">{item.quantity}</span>
      </td>
      <td className="p-2 text-center w-28">
        <Input
          type="number"
          min="0"
          value={item.received_quantity}
          onChange={(e) => onQuantityChange(item.id, parseInt(e.target.value) || 0)}
          className={getInputClassName()}
          disabled={isConfirmed}
        />
      </td>
      <td className="p-2 text-center w-32">
        {getDiscrepancyDisplay()}
      </td>
      <td className="p-2 text-center w-32">
        <Button 
          size="sm"
          variant={isConfirmed ? "secondary" : "default"}
          onClick={() => onConfirm(item.id)}
          className="whitespace-nowrap"
        >
          {isConfirmed ? "Hủy xác nhận" : "Xác nhận"}
        </Button>
      </td>
    </tr>
  );
}
