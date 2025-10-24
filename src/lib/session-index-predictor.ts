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
  
  // Query recent comments globally (limit 5 để detect gaps/patterns)
  const { data, error } = await supabase
    .from('facebook_comments_archive')
    .select('session_index, created_at')
    .eq('facebook_user_id', userId)
    .not('session_index', 'is', null)
    .order('session_index', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('❌ Error fetching comments for prediction:', error);
    return { 
      predicted: 1, 
      confidence: 'high',
      reasoning: 'First comment (no history)'
    };
  }
  
  // No comments yet → first comment
  if (!data || data.length === 0) {
    return { 
      predicted: 1, 
      confidence: 'high',
      reasoning: 'First comment for this user'
    };
  }
  
  // session_index is already INTEGER in facebook_comments_archive, no need to parse
  const maxIndex = data[0].session_index;
  
  // Check for concurrent comments within 5 seconds (race condition risk)
  const now = Date.now();
  const recentComments = data.filter(comment => {
    const createdTime = new Date(comment.created_at).getTime();
    const diff = now - createdTime;
    return diff < 5000; // 5 seconds
  });
  
  const confidence = recentComments.length > 1 ? 'low' : 'high';
  const reasoning = confidence === 'low' 
    ? `${recentComments.length} comments created within 5s (race condition risk)`
    : 'Normal prediction';
  
  console.log(`✅ Prediction result: ${maxIndex + 1} (confidence: ${confidence})`);
  
  return {
    predicted: maxIndex + 1,
    confidence,
    reasoning
  };
}
