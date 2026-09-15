// The single letter shown in the identity circle in place of a photograph.
// Her record holds her name, never a portrait, so nobody else's face stands
// in for hers. Null means there is no letter to show and the caller falls
// back to a neutral glyph.
export function avatarInitial(name: string | null | undefined): string | null {
  const letter = (name ?? '').trim().replace(/^[^\p{L}\p{N}]+/u, '').charAt(0);
  return letter ? letter.toUpperCase() : null;
}
