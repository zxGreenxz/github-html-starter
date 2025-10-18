import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Auto-refresh token when it expires (401 error)
 * @param tokenType - 'tpos' or 'facebook'
 * @returns true if refresh successful, false otherwise
 */
export async function autoRefreshToken(tokenType: 'tpos' | 'facebook'): Promise<boolean> {
  try {
    console.log(`🔄 [Auto-Refresh] Attempting to refresh ${tokenType.toUpperCase()} token...`);
    
    // Get the latest credential ID for this token type
    const { data: credentials, error: credError } = await (supabase
      .from('tpos_credentials' as any)
      .select('id, name')
      .eq('token_type', tokenType)
      .order('created_at', { ascending: false })
      .limit(1) as any);

    if (credError || !credentials || credentials.length === 0) {
      console.error(`❌ [Auto-Refresh] No ${tokenType} credential found in database`);
      toast({
        variant: "destructive",
        title: "❌ Không tìm thấy credentials",
        description: `Vui lòng thêm ${tokenType === 'tpos' ? 'TPOS' : 'Facebook'} credentials trong Cài đặt`,
      });
      return false;
    }

    const credential = credentials[0] as { id: string; name: string };
    console.log(`📝 [Auto-Refresh] Found credential: ${credential.name} (ID: ${credential.id})`);

    // Call the refresh-tpos-token edge function
    const { data, error } = await supabase.functions.invoke('refresh-tpos-token', {
      body: { credentialId: credential.id }
    });

    if (error) {
      console.error(`❌ [Auto-Refresh] Edge function error:`, error);
      toast({
        variant: "destructive",
        title: "❌ Lỗi refresh token",
        description: `Không thể refresh ${tokenType} token. Vui lòng kiểm tra credentials trong Cài đặt.`,
      });
      return false;
    }

    if (!data.success) {
      console.error(`❌ [Auto-Refresh] Refresh failed:`, data.message);
      toast({
        variant: "destructive",
        title: "❌ Refresh token thất bại",
        description: data.message || "Vui lòng kiểm tra username/password trong Cài đặt",
      });
      return false;
    }

    console.log(`✅ [Auto-Refresh] Token refreshed successfully for ${tokenType.toUpperCase()}`);
    toast({
      title: "✅ Token đã được cập nhật",
      description: `${tokenType === 'tpos' ? 'TPOS' : 'Facebook'} token đã được làm mới tự động`,
    });
    
    return true;
  } catch (error) {
    console.error(`❌ [Auto-Refresh] Unexpected error:`, error);
    toast({
      variant: "destructive",
      title: "❌ Lỗi không xác định",
      description: "Không thể refresh token. Vui lòng thử lại sau.",
    });
    return false;
  }
}
