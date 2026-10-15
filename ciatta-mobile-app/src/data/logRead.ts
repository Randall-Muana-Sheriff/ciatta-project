// What she said to Ciatta, read on the server for the record's log words
// (supabase/functions/log-read). Null when it could not be read, and the
// phone's own reader stands in.

import { LOG_VOCABULARY } from '../lib/agent/logOffer';
import { supabase } from '../lib/supabase';

export async function readLog(text: string): Promise<{ items: string[]; daysAgo: number } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('log-read', { body: { text, vocabulary: LOG_VOCABULARY } });
    if (error || !Array.isArray(data?.items)) return null;
    return { items: data.items.filter((x: unknown): x is string => typeof x === 'string'), daysAgo: Number(data.daysAgo) || 0 };
  } catch {
    return null;
  }
}
