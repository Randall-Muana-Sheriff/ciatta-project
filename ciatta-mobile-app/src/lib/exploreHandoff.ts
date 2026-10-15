// Which Explore health topic a pushed screen opens on. Navigation carries
// a screen name only, so the choice is left here first and read once.

let chosen: string | null = null;
export const chooseExplore = (key: string) => {
  chosen = key;
};
export const takeExplore = (): string | null => chosen;
