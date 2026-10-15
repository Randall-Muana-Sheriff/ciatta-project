// Whether Today is showing her body: Explore's Topics | Body switch. Body
// is a world of its own, so Today hides everything else while it is open,
// and the corner menu drops back down with the chat card gone.

import { useEffect, useState } from 'react';

let bodyOpen = false;
const listeners = new Set<(open: boolean) => void>();

export function useBodyOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(bodyOpen);
  useEffect(() => {
    listeners.add(setOpen);
    setOpen(bodyOpen);
    return () => {
      listeners.delete(setOpen);
    };
  }, []);
  const set = (next: boolean) => {
    bodyOpen = next;
    for (const l of listeners) l(next);
  };
  return [open, set];
}
