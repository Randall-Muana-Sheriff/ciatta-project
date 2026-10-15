// The check in, handed from Today to the chat when it opens, so Ciatta can
// ask it there in words: no answer pills, she replies as she would to
// anything else, and what she says is offered for her timeline as usual.

import type { CheckIn } from '../../supabase/functions/_shared/checkIn';

let waiting: CheckIn | null = null;

export const offerCheckIn = (c: CheckIn | null) => {
  waiting = c;
};

export const takeCheckIn = (): CheckIn | null => {
  const c = waiting;
  waiting = null;
  return c;
};
