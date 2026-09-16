import { Film } from './Film';

/**
 * The hero film.
 *
 * The clip is a slow one against a warm gradient wall, with the subject at
 * frame right and the left third left calm. That empty area is not incidental:
 * it is where the headline sits, and it is why this clip was chosen over the
 * portrait one. The crop and the directional scrim both live in the CSS for
 * `.hero-film` / `.hero-scrim`, because they are properties of this clip.
 */
export function HeroFilm() {
  return <Film base="hero" />;
}
