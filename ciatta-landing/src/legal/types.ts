/** A legal document as data, so both pages share one layout and one tone. */
export type Block =
  | { p: string }
  | { list: string[] }
  | { table: { head: string[]; rows: string[][] } };

export type Section = { id: string; title: string; blocks: Block[] };

export type LegalDoc = {
  title: string;
  summary: string;
  /** The short version, read first. Not a substitute for the sections. */
  plainly: string[];
  sections: Section[];
};
