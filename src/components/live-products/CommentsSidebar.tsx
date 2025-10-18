import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface CommentsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function CommentsSidebar({ isOpen, onClose, children }: CommentsSidebarProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full bg-background border-l shadow-lg z-50",
        isMobile ? "w-full" : "w-[400px] sm:w-[450px]",
        "transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between border-b",
        isMobile ? "p-3" : "p-4"
      )}>
        <h2 className={cn(
          "font-semibold",
          isMobile ? "text-base" : "text-lg"
        )}>
          Facebook Comments
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className={isMobile ? "h-7 w-7" : "h-8 w-8"}
        >
          <X className={isMobile ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>
      </div>
      
      {/* Content */}
      <div className={cn(
        "overflow-y-auto",
        isMobile ? "h-[calc(100vh-57px)]" : "h-[calc(100vh-65px)]"
      )}>
        {children}
      </div>
    </div>
  );
}
