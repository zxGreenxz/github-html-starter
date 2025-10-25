import { useQuery } from "@tanstack/react-query";
import { 
  fetchTPOSOrdersBySessionIndex, 
  fetchTPOSOrderDetails, 
  getTPOSBearerToken,
  TPOSOrderInfo 
} from "@/lib/tpos-order-details-fetcher";

interface UseTPOSOrderDetailsParams {
  sessionIndex: number | null;
  startDate: string;
  endDate: string;
  enabled?: boolean;
}

interface UseTPOSOrderDetailsResult {
  orderInfo: TPOSOrderInfo | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTPOSOrderDetails({
  sessionIndex,
  startDate,
  endDate,
  enabled = true,
}: UseTPOSOrderDetailsParams): UseTPOSOrderDetailsResult {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tpos-order-details', sessionIndex, startDate, endDate],
    queryFn: async () => {
      if (!sessionIndex) {
        throw new Error('SessionIndex is required');
      }

      console.log('🔄 [Hook] Fetching TPOS order details:', { sessionIndex, startDate, endDate });

      // Step 1: Get bearer token
      const bearerToken = await getTPOSBearerToken();

      // Step 2: Fetch orders list
      const orders = await fetchTPOSOrdersBySessionIndex(
        sessionIndex,
        startDate,
        endDate,
        bearerToken
      );

      if (!orders || orders.length === 0) {
        console.warn('⚠️ [Hook] No orders found for SessionIndex:', sessionIndex);
        return null;
      }

      // Step 3: Get the first order's ID and fetch details
      const firstOrderId = orders[0].Id;
      console.log('📦 [Hook] Fetching details for order:', orders[0].Code);

      const orderDetails = await fetchTPOSOrderDetails(firstOrderId, bearerToken);
      
      return orderDetails;
    },
    enabled: enabled && !!sessionIndex && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    orderInfo: data || null,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
