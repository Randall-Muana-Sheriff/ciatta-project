// What Today's Insights card says. Her lead insight, from the engine that
// reads her own record on the phone, when there is one, and it opens its
// evidence. Until there is, the card says what Ciatta is doing (watching a
// possible pattern, or learning her usual) rather than vanishing, so a live
// record never looks emptier than the example one.
export function todayInsight(input: { leadId: string | null; leadText: string; fallback: string }): { text: string; evidence: string | null } {
  return input.leadId ? { text: input.leadText, evidence: input.leadId } : { text: input.fallback, evidence: null };
}
