import { assertEquals } from 'jsr:@std/assert@1';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

import { pageCount, splitPdf } from './pdf.ts';

async function pdfOf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return await doc.save();
}

Deno.test('a PDF is counted and split into the ranges asked for', async () => {
  const bytes = await pdfOf(20);
  assertEquals(await pageCount(bytes), 20);
  const parts = await splitPdf(bytes, [
    { first: 1, last: 8 },
    { first: 9, last: 16 },
    { first: 17, last: 20 },
  ]);
  const counts = await Promise.all(parts.map(async (b64) => (await PDFDocument.load(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))).getPageCount()));
  assertEquals(counts, [8, 8, 4]);
});
