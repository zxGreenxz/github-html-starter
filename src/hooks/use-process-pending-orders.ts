import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseVariant } from '@/lib/variant-utils';

/**
 * Extract all product codes from comment text
 * Pattern: N followed by numbers and optional letters (e.g., N55, N236L, N217)
 * Handles special characters around codes: (N217), [N217], N217., N217,, etc.
 */
function extractProductCodes(text: string): string[] {
  const pattern = /N\d+[A-Z]*/gi;
  const matches = text.match(pattern);
  
  if (!matches) return [];
  
  // Convert to uppercase, remove duplicates, and normalize
  const codes = matches.map(m => m.toUpperCase().trim());
  return [...new Set(codes)]; // Remove duplicates
}

interface PendingLiveOrder {
  id: string;
  facebook_comment_id: string;
  comment_text: string | null;
  customer_name: string | null;
  session_index: string | null;
  created_at: string;
  processed: boolean;
  error_message: string | null;
}

interface LiveProduct {
  id: string;
  product_code: string;
  variant: string | null;
  live_session_id: string;
  live_phase_id: string | null;
  sold_quantity: number;
  prepared_quantity: number;
}

/**
 * ⚠️ DEPRECATED: Logic moved to edge function
 * Auto-creation now happens in create-tpos-order-from-comment function
 * This hook is kept for backward compatibility but does nothing
 */
export function useProcessPendingOrders() {
  const queryClient = useQueryClient();

  const processPendingOrders = useCallback(async () => {
    // Logic moved to edge function - do nothing
    return;
    // Deprecated - logic moved to edge function
  }, [queryClient]);

  // Deprecated - no longer auto-processing
  return { processPendingOrders };
}
