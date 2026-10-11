-- The first reviewed references, so the Care agent's context capability has
-- something it is allowed to say.
--
-- Everything here was retrieved from PubMed. Every summary is a sentence
-- lifted verbatim from the published abstract, unaltered, not a paraphrase
-- and not a compression. That is the whole point of the column and the
-- reason reviewed_by can be set at all: there is no interpretation here to
-- review, only a quotation to check against its source.
--
-- reviewed_by says exactly what kind of check happened. 'verbatim-abstract'
-- means the summary was confirmed word for word against the abstract at the
-- DOI in the url column. It does NOT mean a clinician has endorsed it, and
-- nothing in the app may present it as though one had. When a clinician does
-- review these, reviewed_by should be changed to name them.
--
-- Two rules the agent enforces on top of this table, stated here so the next
-- person adding a row knows what the row has to survive:
--
--   A reference is general and never about her. Nothing in a summary may
--   describe the person reading it, which is why prevalence and diagnostic
--   delay are the kinds of fact that belong here and a treatment
--   recommendation is not.
--
--   The agent quotes; it does not summarise. It reads summary as given, so a
--   row whose summary is not true on its own is a row that will be shown
--   wrongly.
--
-- Copy note: the app forbids dashes in anything rendered, and these are
-- rendered. Every sentence below was chosen partly because the abstract
-- states it without one, so the rule holds without editing a quotation.
-- A future row that cannot be quoted without a dash should be left out
-- rather than silently rewritten.

insert into public.research_refs (title, publication, year, url, summary, domains, reviewed_by, reviewed_at)
values
  (
    'Endometriosis: A Review',
    'JAMA',
    2025,
    'https://doi.org/10.1001/jama.2025.2975',
    'The diagnosis is often delayed, averaging 5 to 12 years after onset of symptoms, with most women consulting 3 or more clinicians prior to diagnosis.',
    array['endometriosis', 'diagnosis'],
    'verbatim-abstract',
    now()
  ),
  (
    'Endometriosis: A Review',
    'JAMA',
    2025,
    'https://doi.org/10.1001/jama.2025.2975',
    'It affects up to 10% of women worldwide, and 9 million women in the US, during reproductive years.',
    array['endometriosis', 'prevalence'],
    'verbatim-abstract',
    now()
  ),
  (
    'Pathophysiology, diagnosis, and management of endometriosis',
    'BMJ',
    2022,
    'https://doi.org/10.1136/bmj-2022-070750',
    'Endometriosis affects approximately 190 million women and people assigned female at birth worldwide.',
    array['endometriosis', 'prevalence'],
    'verbatim-abstract',
    now()
  ),
  (
    'Rethinking mechanisms, diagnosis and management of endometriosis',
    'Nature Reviews Endocrinology',
    2019,
    'https://doi.org/10.1038/s41574-019-0245-z',
    'Instead, diagnosis of endometriosis should be based on a structured process involving the combination of patient interviews, clinical examination and imaging.',
    array['endometriosis', 'diagnosis'],
    'verbatim-abstract',
    now()
  ),
  (
    'Recommendations from the 2023 international evidence based guideline for the assessment and management of polycystic ovary syndrome',
    'European Journal of Endocrinology',
    2023,
    'https://doi.org/10.1093/ejendo/lvad096',
    'The evidence in the assessment and management of PCOS has generally improved in the past 5 years but remains of low to moderate quality.',
    array['pcos', 'evidence'],
    'verbatim-abstract',
    now()
  );

comment on column public.research_refs.reviewed_by is
  'What kind of check the summary passed. ''verbatim-abstract'' means it was confirmed word for word against the published abstract at url, which is a provenance check and not a clinical endorsement. A clinician who reviews a row should be named here instead. A row with reviewed_by null has passed no check and the app must not quote it.';
