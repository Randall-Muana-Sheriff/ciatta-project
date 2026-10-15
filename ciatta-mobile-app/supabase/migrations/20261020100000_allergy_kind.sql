-- Allergies a document names are filed in her conditions list, as their own
-- kind. In a migration of its own: Postgres will not let a new enum value
-- be used in the transaction that adds it.
alter type public.condition_kind add value if not exists 'allergy';
