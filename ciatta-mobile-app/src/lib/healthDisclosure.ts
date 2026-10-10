// What Ciatta reads from Apple Health, in twenty words.
//
// This stopped listing categories, and the reason is worth keeping. Reading
// every metric took the list from three categories to eight, and eight
// cannot be named in a sentence anyone will read. Trimming the list to fit
// would have been the one unacceptable fix: a disclosure that drops a
// category to read better is a disclosure that is wrong.
//
// So the copy makes a claim instead of an inventory, and the claim is
// stronger than the inventory was. "Every health metric Apple Health
// records" is true only while QUANTITY_SPECS covers every quantity type the
// library exposes, and the test beside this file reads the library's own
// identifier list and asserts exactly that. The word every is checked rather
// than written, which no list of categories ever was.
//
// The enumeration still exists where she can act on it: Apple's sheet names
// every type with a real toggle, one tap after this screen.

export function healthDisclosureLines(): string[] {
  return [
    'Ciatta reads every health metric Apple Health records.',
    'It compares your week to your own usual, never to anybody else.',
  ];
}
