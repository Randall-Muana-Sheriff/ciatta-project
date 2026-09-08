# HealthKit Reliable Sync v0.1

Date: 2026-09-01

## What changed

Apple Health sync is now anchored and incremental. First connection still imports the existing 30 day / 365 day windows. Later syncs fetch only added and deleted samples since the saved anchor. Anchors are stored per user and HealthKit type and advance only after persistence succeeds.

Manual Sync Now is capped at 25 seconds of ingestion (hard ceiling 30 seconds). Intelligence is not waited on. The sheet reports complete, processing, partial, or error in product language.

Background delivery is enabled through `@kingstinct/react-native-healthkit` (`enableBackgroundDelivery` + `subscribeToChanges`). This requires a native rebuild (`background: true` and `UIBackgroundModes: fetch`).

Stage 1 sleep still uses `sleep_segment` from HealthKit and `sleep_session` from Health Connect. Night eligibility remains the engine's night-bucket rule, not a UI row count. Stage 2 Cycle/Mood processors are not imported.

## Architecture

Apple Health
→ observer / manual / first connect
→ HKAnchoredObjectQuery per type
→ normalize
→ observations (idempotent unique key)
→ existing insert trigger / engine cadence
→ Now reload on next foreground or after Sync Now

## Not claimed

Background delivery has not been proven on a physical iPhone in this change. iOS may delay or coalesce updates. Force-quit stops background delivery until the next launch.
