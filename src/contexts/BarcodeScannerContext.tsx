import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { fetchProductVariants, fetchProductsByCode } from "@/lib/product-variants-fetcher";
import { supabase } from "@/integrations/supabase/client";

type ScannerPage = 'live-products' | 'settings-test' | 'facebook-comments';

interface ScannedBarcode {
  code: string;
  timestamp: string;
  productInfo?: {
    id: string;
    name: string;
    image_url?: string;
    product_code: string;
  };
}

interface BarcodeScannerContextType {
  enabledPages: ScannerPage[];
  togglePage: (page: ScannerPage) => void;
  lastScannedCode: string;
  scannedBarcodes: ScannedBarcode[];
  addScannedBarcode: (barcode: ScannedBarcode, sessionId?: string, pageId?: string) => Promise<void>;
  clearScannedBarcodes: (sessionId?: string) => Promise<void>;
  removeScannedBarcode: (code: string) => void;
  loadSessionBarcodes: (sessionId: string) => Promise<void>;
}

const BarcodeScannerContext = createContext<BarcodeScannerContextType | undefined>(undefined);

export function BarcodeScannerProvider({ children }: { children: ReactNode }) {
  const [enabledPages, setEnabledPages] = useState<ScannerPage[]>(() => {
    const saved = localStorage.getItem('barcode_scanner_enabled_pages');
    return saved ? JSON.parse(saved) : ['live-products', 'facebook-comments'];
  });
  const [lastScannedCode, setLastScannedCode] = useState("");
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [scannedBarcodes, setScannedBarcodes] = useState<ScannedBarcode[]>(() => {
    const saved = localStorage.getItem('scanned_barcodes');
    return saved ? JSON.parse(saved) : [];
  });
  const barcodeBufferRef = useRef<string>("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const togglePage = (page: ScannerPage) => {
    setEnabledPages(prev => {
      const newPages = prev.includes(page)
        ? prev.filter(p => p !== page)
        : [...prev, page];
      localStorage.setItem('barcode_scanner_enabled_pages', JSON.stringify(newPages));
      return newPages;
    });
  };

  const addScannedBarcode = async (
    barcode: ScannedBarcode, 
    sessionId?: string, 
    pageId?: string
  ) => {
    // Fetch all variants for this product
    const variantCodes = await fetchProductVariants(barcode.code);
    
    // If multiple variants, fetch full product details for all
    if (variantCodes.length > 1) {
      const products = await fetchProductsByCode(variantCodes);
      
      // Create ScannedBarcode objects for all variants
      const variantBarcodes: ScannedBarcode[] = products.map(product => ({
        code: product.product_code,
        timestamp: new Date().toISOString(),
        productInfo: {
          id: product.id,
          name: product.product_name,
          image_url: product.product_images?.[0] || product.tpos_image_url,
          product_code: product.product_code,
        }
      }));
      
      // Add all variants at once
      setScannedBarcodes(prev => {
        const updated = [...variantBarcodes, ...prev];
        localStorage.setItem('scanned_barcodes', JSON.stringify(updated));
        return updated;
      });

      // Sync to database if session context provided
      if (sessionId && pageId) {
        try {
          await saveBarcodeToDatabase(variantBarcodes, sessionId, pageId);
        } catch (error) {
          console.error('Failed to save variants to database:', error);
          window.dispatchEvent(
            new CustomEvent('barcode-save-error', {
              detail: {
                code: barcode.code,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            })
          );
        }
      }
    } else {
      // Single product - add normally
      setScannedBarcodes(prev => {
        const updated = [barcode, ...prev];
        localStorage.setItem('scanned_barcodes', JSON.stringify(updated));
        return updated;
      });

      // Sync to database if session context provided
      if (sessionId && pageId) {
        try {
          await saveBarcodeToDatabase([barcode], sessionId, pageId);
        } catch (error) {
          console.error('Failed to save barcode to database:', error);
          window.dispatchEvent(
            new CustomEvent('barcode-save-error', {
              detail: {
                code: barcode.code,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            })
          );
        }
      }
    }
  };

  const saveBarcodeToDatabase = async (
    barcodes: ScannedBarcode[], 
    sessionId: string, 
    pageId: string
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ No user found, skipping database save');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('💾 Saving barcodes to database:', {
        sessionId,
        pageId,
        userId: user.id,
        barcodeCount: barcodes.length
      });

      for (const barcode of barcodes) {
        // Fetch full product details for variant and base_product_code
        let variant = null;
        let base_product_code = null;
        
        if (barcode.productInfo?.id) {
          const { data: product } = await supabase
            .from('products')
            .select('variant, base_product_code')
            .eq('id', barcode.productInfo.id)
            .maybeSingle();
          
          if (product) {
            variant = product.variant;
            base_product_code = product.base_product_code;
          }
        }

        const insertData = {
          session_id: sessionId,
          page_id: pageId,
          user_id: user.id,
          user_name: profile?.display_name || 'Unknown',
          product_code: barcode.code,
          product_name: barcode.productInfo?.name || null,
          variant: variant,
          base_product_code: base_product_code,
          image_url: barcode.productInfo?.image_url || null,
        };

        console.log('📝 Inserting barcode:', insertData);

        const { data, error } = await supabase
          .from('scanned_barcodes_session')
          .insert(insertData)
          .select();

        if (error) {
          // 23505 = unique constraint violation (duplicate)
          if (error.code === '23505') {
            console.log('ℹ️ Duplicate barcode, skipping:', barcode.code);
            continue;
          }
          
          // Other errors - log and throw
          console.error('❌ Error saving barcode:', {
            error,
            barcode: insertData
          });
          
          // Show toast for non-duplicate errors
          throw new Error(`Database error: ${error.message}`);
        }

        console.log('✅ Barcode saved successfully:', data);
      }
    } catch (error: any) {
      console.error('💥 Fatal error in saveBarcodeToDatabase:', error);
      
      // Re-throw to let caller handle
      throw error;
    }
  };

  const loadSessionBarcodes = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('scanned_barcodes_session')
        .select('*')
        .eq('session_id', sessionId)
        .order('scanned_at', { ascending: false });

      if (error) throw error;

      // Convert to ScannedBarcode format and merge with existing
      const dbBarcodes: ScannedBarcode[] = data?.map(item => ({
        code: item.product_code,
        timestamp: item.scanned_at || new Date().toISOString(),
        productInfo: item.product_name ? {
          id: item.id,
          name: item.product_name,
          image_url: item.image_url || undefined,
          product_code: item.product_code,
        } : undefined
      })) || [];

      setScannedBarcodes(prev => {
        // Merge DB barcodes with existing, removing duplicates
        const existingCodes = new Set(prev.map(b => b.code));
        const newBarcodes = dbBarcodes.filter(b => !existingCodes.has(b.code));
        const updated = [...prev, ...newBarcodes];
        localStorage.setItem('scanned_barcodes', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error loading session barcodes:', error);
    }
  };

  const clearScannedBarcodes = async (sessionId?: string) => {
    // Clear from database if session provided
    if (sessionId) {
      try {
        await supabase
          .from('scanned_barcodes_session')
          .delete()
          .eq('session_id', sessionId);
      } catch (error) {
        console.error('Error clearing barcodes from database:', error);
      }
    }

    // Clear from local state
    setScannedBarcodes([]);
    localStorage.removeItem('scanned_barcodes');
  };

  const removeScannedBarcode = (code: string) => {
    setScannedBarcodes(prev => {
      const updated = prev.filter(b => b.code !== code);
      localStorage.setItem('scanned_barcodes', JSON.stringify(updated));
      return updated;
    });
  };

  // Global keyboard listener
  useEffect(() => {
    if (enabledPages.length === 0) return;

    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      // Bỏ qua nếu đang focus vào textarea, input, hoặc contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Bỏ qua các phím điều khiển (trừ Enter)
      if (e.key.length > 1 && e.key !== 'Enter') {
        return;
      }

      // Nếu là Enter, xử lý barcode đã scan
      if (e.key === 'Enter') {
        e.preventDefault();
        if (barcodeBufferRef.current.trim().length > 0) {
          const scannedCode = barcodeBufferRef.current.trim();
          handleBarcodeScanned(scannedCode);
          barcodeBufferRef.current = "";
        }
        return;
      }

      // Thêm ký tự vào buffer
      barcodeBufferRef.current += e.key;

      // Clear timeout cũ
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set timeout mới - nếu 200ms không có ký tự nào nữa, reset buffer
      timeoutRef.current = setTimeout(() => {
        barcodeBufferRef.current = "";
      }, 200);
    };

    const handleBarcodeScanned = (code: string) => {
      setLastScannedCode(code);
      
      // Kiểm tra xem có đang ở đúng trang không
      const currentPath = location.pathname;
      
      // Tìm trang được enable phù hợp với path hiện tại
      const pathToPageMap: Record<string, ScannerPage> = {
        '/live-products': 'live-products',
        '/facebook-comments': 'facebook-comments',
        '/settings': 'settings-test'
      };
      
      const currentPage = pathToPageMap[currentPath];
      
      // Nếu đang ở một trong các trang được enable
      if (currentPage && enabledPages.includes(currentPage)) {
        // Dispatch event để trang xử lý
        window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: { code } }));
      } else {
        // Tìm trang được enable đầu tiên để navigate tới
        const targetPage = enabledPages[0];
        const targetPath = targetPage === 'live-products' ? '/live-products' 
          : targetPage === 'facebook-comments' ? '/facebook-comments'
          : '/settings';
        
        setPendingNavigation(targetPath);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyPress);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyPress);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabledPages, location.pathname]);

  const handleNavigate = () => {
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
      // Sau khi navigate, dispatch event
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: { code: lastScannedCode } }));
      }, 100);
    }
  };

  const handleCancel = () => {
    setPendingNavigation(null);
  };

  const getPageName = (path: string) => {
    if (path === '/live-products') return 'Sản phẩm Live';
    if (path === '/facebook-comments') return 'Facebook Comments';
    if (path === '/settings') return 'Settings Test';
    return path;
  };

  return (
    <BarcodeScannerContext.Provider value={{ 
      enabledPages, 
      togglePage, 
      lastScannedCode,
      scannedBarcodes,
      addScannedBarcode,
      clearScannedBarcodes,
      removeScannedBarcode,
      loadSessionBarcodes
    }}>
      {children}
      
      <AlertDialog open={!!pendingNavigation} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chuyển trang để quét barcode?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đang quét barcode nhưng không ở trang được kích hoạt.
              <br /><br />
              Bạn có muốn chuyển sang trang <strong>{getPageName(pendingNavigation || '')}</strong> không?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleNavigate}>Chuyển trang</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BarcodeScannerContext.Provider>
  );
}

export function useBarcodeScanner() {
  const context = useContext(BarcodeScannerContext);
  if (context === undefined) {
    throw new Error('useBarcodeScanner must be used within a BarcodeScannerProvider');
  }
  return context;
}
