-- Stage 1 vertical slice, closure pass -- deterministic idempotency
-- protection. Without these constraints, every qualifying engine
-- invocation (nightly AND continuous mode) appends a full new row set
-- describing the same night's computation, growing these tables
-- unboundedly. Each constraint keys on the natural "this specific
-- computation, once" identity for its object, letting
-- sleepDurationSlice.ts upsert instead of blind-insert -- a re-run of the
-- same source data reuses the same rows rather than duplicating them.
alter table public.features
  add constraint features_user_domain_feature_window_key
  unique (user_id, domain, feature_type, window_end);

alter table public.baselines
  add constraint baselines_user_domain_feature_window_key
  unique (user_id, domain, feature_type, window_end);

alter table public.change_events
  add constraint change_events_user_domain_feature_feature_id_key
  unique (user_id, domain, feature_type, feature_id);

alter table public.finding_evidence
  add constraint finding_evidence_user_domain_baseline_key
  unique (user_id, domain, baseline_id);

alter table public.findings
  add constraint findings_user_domain_feature_evidence_key
  unique (user_id, domain, feature_type, evidence_id);
