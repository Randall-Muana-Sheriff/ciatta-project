// Counting and splitting a PDF, so a long portal export is read in pieces
// small enough for the model. Nothing is kept: the pieces exist only for
// the length of the request.

import { PDFDocument } from 'npm:pdf-lib@1.17.1';

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function splitPdf(bytes: Uint8Array, ranges: { first: number; last: number }[]): Promise<string[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out: string[] = [];
  for (const { first, last } of ranges) {
    const part = await PDFDocument.create();
    const indices = Array.from({ length: last - first + 1 }, (_, i) => first - 1 + i);
    for (const page of await part.copyPages(src, indices)) part.addPage(page);
    out.push(await part.saveAsBase64());
  }
  return out;
}
