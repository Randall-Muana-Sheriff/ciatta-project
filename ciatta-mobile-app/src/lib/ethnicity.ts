// Ethnicity, in the broad groups most health systems and studies use.
// Broad on purpose: some reference ranges and risks differ by ancestry,
// and a group this wide is enough for that without asking for more than
// it needs. Mixed and decline are first class answers.

export const ETHNICITIES = [
  { id: 'african_black', label: 'African or Black' },
  { id: 'east_asian', label: 'East Asian' },
  { id: 'south_asian', label: 'South Asian' },
  { id: 'southeast_asian', label: 'Southeast Asian' },
  { id: 'hispanic_latino', label: 'Hispanic or Latino' },
  { id: 'middle_eastern', label: 'Middle Eastern or North African' },
  { id: 'indigenous', label: 'Indigenous peoples' },
  { id: 'pacific_islander', label: 'Pacific Islander' },
  { id: 'white_european', label: 'White or European' },
  { id: 'mixed', label: 'Mixed or multiple' },
  { id: 'another', label: 'Another ethnicity' },
  { id: 'prefer_not', label: 'Prefer not to say' },
] as const;

export type Ethnicity = (typeof ETHNICITIES)[number]['id'];

export function ethnicityLabel(id: string | null | undefined): string | null {
  return ETHNICITIES.find((e) => e.id === id)?.label ?? null;
}
