// Which category the Log screen opens on. Navigation carries a screen name
// only, so a screen that sends her to log something leaves the category
// here first. Read once; the next plain visit opens on Body, the daily
// symptoms log. The cycle experience has its own screen.
import type { CategoryKey } from './logCategories';

let next: CategoryKey | null = null;

export const chooseLogCategory = (key: CategoryKey) => {
  next = key;
};

export const takeLogCategory = (): CategoryKey | null => {
  const key = next;
  next = null;
  return key;
};
