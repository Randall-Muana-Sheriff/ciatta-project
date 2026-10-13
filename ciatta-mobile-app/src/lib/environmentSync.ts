// Bringing the weather around her into the record.
//
// Her position is read on the phone with reduced accuracy and rounded to
// one decimal place (about 10 km) before it goes anywhere; the server uses
// it for the request and keeps nothing. The first time fills the last 90
// days so patterns she already has get their background; after that only
// the days since the newest one stored, at most once a day.

const BACKFILL = 90;

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const round1 = (n: number) => Math.round(n * 10) / 10;

export const roughly = (lat: number, lon: number) => ({ lat: round1(lat), lon: round1(lon) });

export function syncRange(newestStored: string | null, today: Date): { from: string; to: string } | null {
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const to = key(yesterday);
  if (!newestStored) {
    return { from: key(new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() - (BACKFILL - 1))), to };
  }
  const [y, m, d] = newestStored.split('-').map(Number);
  const from = key(new Date(y, m - 1, d + 1));
  return from > to ? null : { from, to };
}
