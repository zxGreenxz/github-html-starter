import { createContext, useContext, useState, ReactNode } from 'react';

interface CommentsSidebarContextType {
  isCommentsOpen: boolean;
  setIsCommentsOpen: (open: boolean) => void;
}

const CommentsSidebarContext = createContext<CommentsSidebarContextType | null>(null);

export function useCommentsSidebar() {
  const context = useContext(CommentsSidebarContext);
  if (!context) {
    throw new Error('useCommentsSidebar must be used within CommentsSidebarProvider');
  }
  return context;
}

interface CommentsSidebarProviderProps {
  children: ReactNode;
}

export function CommentsSidebarProvider({ children }: CommentsSidebarProviderProps) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  return (
    <CommentsSidebarContext.Provider value={{ isCommentsOpen, setIsCommentsOpen }}>
      {children}
    </CommentsSidebarContext.Provider>
  );
}
