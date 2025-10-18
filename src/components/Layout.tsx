import { SidebarProvider, useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useCommentsSidebar } from "@/contexts/CommentsSidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
interface LayoutProps {
  children: React.ReactNode;
}
function LayoutContent({ children }: LayoutProps) {
  const { setOpen: setNavSidebarOpen } = useSidebar();
  const { isCommentsOpen } = useCommentsSidebar();
  const isMobile = useIsMobile();
  
  // Auto-close navigation sidebar when comments sidebar opens
  useEffect(() => {
    if (isCommentsOpen) {
      setNavSidebarOpen(false);
    }
  }, [isCommentsOpen, setNavSidebarOpen]);
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Floating Sidebar Trigger - Always visible */}
        {!isMobile && (
          <SidebarTrigger className="fixed left-4 top-4 z-50 p-4 w-14 h-14 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-lg transition-all hover:scale-105" />
        )}
        
        {/* Desktop Sidebar - Hidden on mobile */}
        {!isMobile && <AppSidebar />}
        
        <div className="flex-1 flex flex-col">
          {/* Main Content */}
          <main className={cn(
            "flex-1 overflow-auto",
            isMobile ? "pb-20" : ""
          )}>
            {children}
          </main>
          
          {/* Mobile Bottom Navigation */}
          {isMobile && <MobileBottomNav />}
        </div>
      </div>
    </SidebarProvider>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}