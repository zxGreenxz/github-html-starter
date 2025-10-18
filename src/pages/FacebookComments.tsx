import { MessageSquare } from "lucide-react";
import { FacebookCommentsManager } from "@/components/facebook/FacebookCommentsManager";
import { CommentsSidebar } from "@/components/live-products/CommentsSidebar";
import { useCommentsSidebar } from "@/contexts/CommentsSidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const FacebookComments = () => {
  const { isCommentsOpen, setIsCommentsOpen } = useCommentsSidebar();
  const isMobile = useIsMobile();

  return (
    <div className={cn(
      "transition-all duration-300 ease-in-out",
      isCommentsOpen && !isMobile ? "mr-[450px]" : "mr-0"
    )}>
      <div className={cn(
        "mx-auto space-y-6",
        isMobile ? "p-4" : "container p-6"
      )}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-lg">
            <MessageSquare 
              className={cn(
                "text-primary",
                isMobile ? "h-5 w-5" : "h-6 w-6"
              )}
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className={cn(
              "font-bold text-foreground",
              isMobile ? "text-xl" : "text-2xl"
            )}>
              Livestream Comment
            </h1>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-xs" : "text-sm"
            )}>
              Quản lý comment và đơn hàng từ Facebook Live
            </p>
          </div>
        </div>

        {/* Facebook Comments Manager */}
        <FacebookCommentsManager />
      </div>

      {/* Comments Sidebar */}
      <CommentsSidebar 
        isOpen={isCommentsOpen} 
        onClose={() => setIsCommentsOpen(false)}
      >
        <div className="p-4 text-center text-muted-foreground">
          Chọn video từ Facebook Comments Manager để xem comments ở đây
        </div>
      </CommentsSidebar>
    </div>
  );
};

export default FacebookComments;