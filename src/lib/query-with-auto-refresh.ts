import { autoRefreshToken } from "./auto-refresh-token";

/**
 * Wrapper that auto-refreshes token on 401 errors and retries the query
 * @param queryFn - The async function to execute (e.g., API call)
 * @param tokenType - 'tpos' or 'facebook'
 * @returns The result from queryFn
 */
export async function queryWithAutoRefresh<T>(
  queryFn: () => Promise<T>,
  tokenType: 'tpos' | 'facebook'
): Promise<T> {
  try {
    // First attempt
    return await queryFn();
  } catch (error: any) {
    // Check if it's a 401 error
    const is401Error = 
      error?.status === 401 || 
      error?.message?.includes('401') ||
      error?.message?.includes('Missing authorization header') ||
      error?.message?.includes('Invalid JWT') ||
      error?.message?.includes('token') ||
      error?.message?.includes('Unauthorized');

    if (!is401Error) {
      // Not a 401 error, just throw it
      throw error;
    }

    console.log(`⚠️ [Query Auto-Refresh] 401 error detected, attempting token refresh for ${tokenType}...`);

    // Attempt to refresh the token
    const refreshSuccess = await autoRefreshToken(tokenType);

    if (!refreshSuccess) {
      console.error(`❌ [Query Auto-Refresh] Token refresh failed, cannot retry query`);
      throw error; // Token refresh failed, throw original error
    }

    // Token refreshed successfully, retry the query once
    console.log(`🔄 [Query Auto-Refresh] Token refreshed, retrying query...`);
    try {
      const result = await queryFn();
      console.log(`✅ [Query Auto-Refresh] Query succeeded after token refresh`);
      return result;
    } catch (retryError) {
      console.error(`❌ [Query Auto-Refresh] Query failed even after token refresh:`, retryError);
      throw retryError;
    }
  }
}
