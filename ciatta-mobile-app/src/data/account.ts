import { Share } from 'react-native';

import { supabase } from '../lib/supabase';
import { paginateAll } from './pagination';

// Everything she owns, read as her, so RLS guarantees it is only hers.
export const EXPORT_TABLES = [
  'profiles', 'health_sources', 'raw_inputs', 'episodes', 'journal_entries',
  'medications', 'supplements', 'documents', 'results', 'observations',
] as const;

export async function exportAndShare(userId: string): Promise<void> {
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: userId };
  for (const table of EXPORT_TABLES) {
    out[table] = await paginateAll((from, to) =>
      table === 'profiles'
        ? supabase.from(table).select('*').eq('id', userId).order('id').range(from, to)
        : supabase.from(table).select('*').order('id').range(from, to),
    );
  }
  await Share.share({ message: JSON.stringify(out, null, 2), title: 'Your data' });
}

// Deletes her files, then her account; every row cascades from the account.
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  await supabase.auth.signOut();
}
