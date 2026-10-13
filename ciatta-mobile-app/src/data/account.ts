import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { Share } from 'react-native';

import { buildExport, EXPORT_COLUMNS, EXPORT_TABLES, type ExportTable, exportFileName, type TableRead } from '../lib/dataExport';
import { supabase } from '../lib/supabase';
import { clearLocalRecord } from './localKeys';
import { paginateAll } from './pagination';

// Everything she owns, read as her, so RLS guarantees it is only hers.
// Written to a file she can keep and sent through the share sheet, so it can
// go to Files, Mail or AirDrop. It used to be pasted into the share sheet as
// text, which a large record overflows, and it left most tables out. Which
// tables, and what the file says about each, is in lib/dataExport.ts.
const ORDER_BY: Partial<Record<ExportTable, string>> = { health_summaries: 'user_id' };

export async function exportAndShare(userId: string): Promise<void> {
  const reads: Partial<Record<ExportTable, TableRead>> = {};
  for (const table of EXPORT_TABLES) {
    try {
      reads[table] = (await paginateAll((from, to) =>
        table === 'profiles'
          ? supabase.from(table).select('*').eq('id', userId).order('id').range(from, to)
          : supabase.from(table).select(EXPORT_COLUMNS[table] ?? '*').order(ORDER_BY[table] ?? 'id').range(from, to),
      )) as Record<string, unknown>[];
    } catch (e) {
      // One table that cannot be read is listed in the file as such,
      // rather than losing the rest of her record with it.
      reads[table] = { error: e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'unknown' };
    }
  }
  const now = new Date();
  const file = new File(Paths.cache, exportFileName(now));
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(buildExport(reads, userId, now), null, 2));
  await Share.share({ url: file.uri, title: 'Your Ciatta data' });
}

// Deletes her files, then her account; every row cascades from the account.
// Then this phone: the imported device record is a full copy of every episode
// ever logged here, and the outbox and loop keys are hers too. "Deleted for
// good" has to be true of the phone in her hand as well as the server.
// Returns the keys that could not be cleared, so the screen can say so.
export async function deleteAccount(userId: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  await supabase.auth.signOut();
  return clearLocalRecord(AsyncStorage, userId);
}
