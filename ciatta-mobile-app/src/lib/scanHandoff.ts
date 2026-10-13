// The photo the Log screen hands to the food scan screen.
//
// Navigation here carries no parameters, so the photo waits in this one
// slot between the tap that chose it and the screen that reads it. Taking
// it empties the slot, so a scan screen opened later never reads a stale
// photo.

let pending: string | null = null;

export const handPhoto = (uri: string) => {
  pending = uri;
};

export const takePhoto = (): string | null => {
  const uri = pending;
  pending = null;
  return uri;
};
