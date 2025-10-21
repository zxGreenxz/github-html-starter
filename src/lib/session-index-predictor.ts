import { SupabaseClient } from '@supabase/supabase-js';

export interface SessionIndexPrediction {
  predicted: number;
  confidence: 'high' | 'low';
  reasoning?: string;
}

/**
 * Dự đoán session_index tiếp theo cho một facebook_user_id
 * 
 * Logic:
 * - Query 5 orders gần nhất của user
 * - Lấy session_index lớn nhất
 * - Check race condition: nếu có orders được tạo trong vòng 5s → confidence = 'low'
 * - Trả về: maxIndex + 1
 */
export async function predictNextSessionIndex(
  userId: string,
  supabase: SupabaseClient
): Promise<SessionIndexPrediction> {
  console.log(`🔮 Predicting SessionIndex for user: ${userId}`);
  
  // Query recent orders (limit 5 để detect gaps/patterns)
  const { data, error } = await supabase
    .from('facebook_pending_orders')
    .select('session_index, created_time')
    .eq('facebook_user_id', userId)
    .not('session_index', 'is', null)
    .order('session_index', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('❌ Error fetching orders for prediction:', error);
    return { 
      predicted: 1, 
      confidence: 'high',
      reasoning: 'First order (no history)'
    };
  }
  
  // No orders yet → first order
  if (!data || data.length === 0) {
    return { 
      predicted: 1, 
      confidence: 'high',
      reasoning: 'First order for this user'
    };
  }
  
  const maxIndex = parseInt(data[0].session_index);
  
  // Check for concurrent orders within 5 seconds (race condition risk)
  const now = Date.now();
  const recentOrders = data.filter(order => {
    const createdTime = new Date(order.created_time).getTime();
    const diff = now - createdTime;
    return diff < 5000; // 5 seconds
  });
  
  const confidence = recentOrders.length > 1 ? 'low' : 'high';
  const reasoning = confidence === 'low' 
    ? `${recentOrders.length} orders created within 5s (race condition risk)`
    : 'Normal prediction';
  
  console.log(`✅ Prediction result: ${maxIndex + 1} (confidence: ${confidence})`);
  
  return {
    predicted: maxIndex + 1,
    confidence,
    reasoning
  };
}
