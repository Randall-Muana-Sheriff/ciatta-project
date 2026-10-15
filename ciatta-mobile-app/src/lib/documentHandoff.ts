// Which document the document screen opens on, left here by the row or the
// save that opened it.
let chosen: string | null = null;
export const chooseDocument = (id: string) => {
  chosen = id;
};
export const chosenDocument = () => chosen;
