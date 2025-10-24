import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface SessionIndexPrediction {
  predicted: number;
  confidence: 'high' | 'low';
  reasoning?: string;
}

export async function predictNextSessionIndex(
  userId: string,
  supabase: SupabaseClient
): Promise<SessionIndexPrediction> {
  // Query the last 5 comments for this user globally (across all posts)
  const { data, error } = await supabase
    .from('facebook_comments_archive')
    .select('session_index, created_at')
    .eq('facebook_user_id', userId)
    .not('session_index', 'is', null)
    .order('session_index', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error querying session index:', error);
    return {
      predicted: 1,
      confidence: 'low',
      reasoning: 'Error querying database, defaulting to 1'
    };
  }

  // If no previous comments, this is their first
  if (!data || data.length === 0) {
    return {
      predicted: 1,
      confidence: 'high',
      reasoning: 'No previous comments found for this user'
    };
  }

  // Get the highest session_index (already INTEGER, no need to parse)
  const maxIndex = data[0].session_index;
  const nextIndex = maxIndex + 1;

  // Check if multiple comments were created within 5 seconds (potential race condition)
  const recentComments = data.filter(comment => {
    const commentTime = new Date(comment.created_at).getTime();
    const now = Date.now();
    return now - commentTime < 5000; // 5 seconds
  });

  const confidence = recentComments.length > 1 ? 'low' : 'high';
  const reasoning = recentComments.length > 1
    ? `Multiple comments detected within 5 seconds. Max index: ${maxIndex}. Using ${nextIndex} but there might be race conditions.`
    : `Previous comments found. Max index: ${maxIndex}. Next should be ${nextIndex}.`;

  return {
    predicted: nextIndex,
    confidence,
    reasoning
  };
}
