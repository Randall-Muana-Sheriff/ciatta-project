# Fasten Connect: other providers and insurers

Date: 2026-10-15
App: `ciatta-mobile-app` (Expo 57, React Native, Supabase)
Status: design approved in conversation, awaiting spec review

## Goal

A person can connect any hospital, clinic or insurer that Fasten Connect
supports, not only Epic. They choose "Other providers and insurers", find
their provider in Fasten's search, and sign in to that patient portal.
Their records then arrive in Ciatta like Epic records do:
- in the Providers list
- in Records and Labs
- available to the agent

## Decisions taken in conversation

1. **Side by side.**
   - The Connect screen offers "Epic (MyChart)", which is today's direct SMART flow, unchanged.
   - Beside it, "Other providers and insurers" opens Fasten.
2. **Search only.** TEFCA "find all my records" is not offered now. It
   costs extra in live mode. It can be added later through Stitch's
   `tefcaMode`.
3. **Test mode first** with public id
   `public_test_551yuukkzlpybkvzp3z6jckk3o06zenjh3utdyxgi2qjb`. It is kept
   in `.env` as `EXPO_PUBLIC_FASTEN_PUBLIC_ID` and as the Supabase secret
   `FASTEN_PUBLIC_ID`.
4. **Secrets stay server side.** The private key (`FASTEN_PRIVATE_KEY`) and
   the webhook signing secret (`FASTEN_WEBHOOK_SECRET`) live only in
   Supabase secrets. The user sets them in Terminal. They are never in
   chat, the app or git.
5. **After the free month**, records already imported stay in Ciatta. Only
   new connections and new exports need a paid Fasten plan.

## How Fasten works (from its docs)

- **Stitch** is Fasten's React Native component
  (`@fastenhealth/fasten-stitch-element-react-native`, with
  `react-native-webview`).
  - The person searches the catalog and signs in to the portal inside it.
  - It emits `patient.connection_success` and `widget.complete` events.
  - The events include `org_connection_id`, `endpoint_id`, `brand_id`, `portal_id` and `platform_type`.
  - It accepts an opaque `externalId`, which Fasten echoes back.
- **The server API** (`https://api.connect.fastenhealth.com/v1/`) uses
  Basic auth (`public_id:private_key`).
  - `POST /bridge/fhir/ehi-export {org_connection_id}` starts a full record export. It is idempotent per connection.
  - `GET /bridge/catalog?brand_id=` returns the institution's name.
- **Webhooks** follow the Standard Webhooks specification and are signed
  with a per endpoint secret. They carry a timestamp to guard against
  replay.
  - `patient.connection_success`: carries `org_connection_id` and `external_id`.
  - `patient.ehi_export_success`: carries `download_links[]`, a FHIR NDJSON file with one resource per line, behind Basic auth that redirects to a signed URL.
  - `patient.ehi_export_failed`: carries a `failure_reason`.
  - `patient.authorization_revoked`.

## Global constraints

The same as earlier specs:
- Expo 57 docs before Expo code.
- No em dash, en dash or hyphen in UI copy, and `displayCopy()` on remote text.
- Jost, on Ground (the sheet uses `ui/Sheet`).
- Health data is never logged. Webhook logs carry event type and ids only, never resources.
- RLS on every table. The service role is used only server side, and every write is scoped to the owning user.
- Public copy is gender neutral.

---

## Part 1: Binding a connection to the right person

The app never tells the server which Fasten connection is theirs. The
signed webhook does. This stops one account claiming another person's
`org_connection_id`.

1. When the person taps "Other providers and insurers", the app calls
   `fasten-connect` with action `start`. The JWT is verified.
2. The function creates a row in `fasten_connect_requests` with:
   - `user_id`
   - a random 32 byte `external_id`
   - `expires_at` (now plus 2 hours)
   It returns the `external_id`.
3. The app opens Stitch with `publicId` and `externalId`.
4. Fasten sends `patient.connection_success` with that `external_id`. The
   webhook:
   - finds the unexpired request
   - creates or updates the person's `provider_connections` row, keyed by `(user_id, endpoint_id)` as today
   - asks Fasten for the export
   An unknown or expired `external_id` is acknowledged (200) and ignored.
5. On `widget.complete`, the app closes the sheet and refreshes the
   Providers list. The new provider shows "Getting your records" until the
   export lands.

One Stitch session may connect several providers. So a request stays
valid until it expires and can bind several connections. Each
`org_connection_id` is bound to one person only, and a later event naming
the same id under a different person is ignored.

## Part 2: Data

Migration `20261021100000_fasten_connections.sql`:

- **`provider_connections`** gains:
  - `source text not null default 'smart' check (source in ('smart', 'fasten'))`
  - `fasten_org_connection_id text`, unique when not null
  - `fasten_export_task_id text`
  - `fhir_base_url` becomes nullable, with a check that it is present when `source = 'smart'`
  - `vendor` gains `'fasten'`. Fasten's `platform_type` (the EHR behind the portal) is kept in `portal_name`, and the catalog name in `endpoint_name` and `organization`.
- The column grant for the person's client **excludes** the two Fasten id
  columns, as it already excludes the tokens. The person's client reads
  `source`.
- **`fasten_connect_requests`** has:
  - `id`
  - `user_id`, cascading from auth.users
  - `external_id`, unique
  - `expires_at`
  - `created_at`
  RLS is on with no client policies. Only the service role touches it.
  Expired rows are deleted by the start action, on its way in.
- **`fasten_webhook_events`** has `webhook_id text primary key` and
  `received_at`. RLS is on with no client policies. It is used for
  idempotency (Part 3). Rows older than 30 days are deleted by the webhook
  on its way in.
- **`clinical_records` and `results`** are unchanged. Fasten records use the
  same `connection_id`, `source_id` and `source_ref` keys. A second export
  updates rows rather than duplicating them.
- **Removal** uses the existing `disconnect_provider`. It deletes the
  connection, which cascades to the records, and removes its results. For
  a Fasten connection, the copy also says access can be revoked at the
  portal, because Fasten has no delete endpoint.

## Part 3: Functions

### `fasten-connect` (verify_jwt = true)

The only action is `start`, as in Part 1. It responds with
`{ externalId, publicId }`.

### `fasten-webhook` (verify_jwt = false)

1. **Read the raw body and verify** with `standardwebhooks` (npm, through
   Deno). It checks:
   - `webhook-id`, `webhook-timestamp` and `webhook-signature`
   - a tolerance of 5 minutes
   A missing or bad signature gets 401. Nothing is read before
   verification.
2. **Idempotency:** `webhook-id` is stored in `fasten_webhook_events` (id,
   received_at). A repeat is acknowledged with 200 and skipped.
3. **By `type`:**
   - `patient.connection_success`: Part 1, step 4.
     - The name comes from `GET /bridge/catalog?brand_id=`, falling back to `portal_id`, then "Your provider".
     - Then `POST /bridge/fhir/ehi-export`. The task id is stored and the status set to `connected`.
   - `patient.ehi_export_success`:
     - find the connection by `org_connection_id`
     - download each `jsonl` link with Basic auth, following the redirect
     - stream the lines
     - for each resource, apply `mapResource`, plus `labFromResource` for Observations
     - upsert in batches of 200, exactly as `provider-connect` `sync` does
     - set `active` and `record_count` from what is held, or `connected` when nothing arrived, then `last_synced_at`
   - `patient.ehi_export_failed`: set `error`, with `last_error` from a plain table:
     - `tefca_no_documents_found` and no records: "Your provider did not share any records."
     - anything else: "Ciatta could not get your records from this provider. Try connecting again later."
   - `patient.authorization_revoked`: set the status to `revoked`. Records already imported stay until the person removes the provider.
   - Any other type: 200, ignored.
4. **Response:** 200 for every verified event that was handled or ignored,
   and 500 only for a failure Fasten should retry, such as a download or
   database error. The export file is read within the function's time
   budget, with `keepGoing` as in the sync. A file too large for one run
   records how far it got and continues on Fasten's retry.

### Shared code

`fhirMap.ts` and the results row building move or are re-exported from
`supabase/functions/_shared/`. Both functions use the same mapping, and
the existing unit tests keep covering it from `src/lib/providers/`.

## Part 4: App

- **The Connect screen** (where "Connect a provider" lives today) shows two
  rows:
  - "Epic (MyChart)", with the line "Most hospitals and clinics using MyChart". This is today's flow.
  - "Other providers and insurers", with the line "Hospitals, clinics, labs and insurance plans".
- **`FastenConnectSheet`** on `ui/Sheet`:
  - calls `start`
  - renders `FastenStitchElement` with `publicId` from `EXPO_PUBLIC_FASTEN_PUBLIC_ID` and `externalId`
  - listens on `onEventBus`
  - on `widget.complete`, closes and refreshes the providers
  - on `patient.connection_failed`, shows "That provider did not connect. Nothing was shared." with Try again
  - the Stitch screen is Fasten's own web view. The sheet's header and copy are ours.
- **The Providers list and connection view** (`connectionView.ts`):
  - A Fasten connection that is `connected` reads "Getting your records". Records usually arrive within minutes and can take longer.
  - "Refresh" is not offered for Fasten connections in this version. See Out of scope.
- **Native build:** add the two packages with `npx expo install`, then rebuild
  locally. Stitch is web view based, so there are no new permissions.

## Part 5: Privacy Policy

Add Fasten Health to the landing site's Privacy Policy as the service that
connects to providers and insurers and passes records to Ciatta at the
person's request. Then redeploy Cloudflare Pages.

## Testing

- **Pure, under `npm test`:**
  - webhook verification: valid, tampered body, wrong secret, stale timestamp, missing headers
  - NDJSON reading: blank lines, a malformed line skipped and counted, a resource without an id refused
  - event routing by type, and the failure reason to copy table
  - `connectionView` copy for a Fasten connection
- **SQL** (`supabase test db`):
  - the person cannot select the Fasten id columns or `fasten_connect_requests`
  - the source check
  - a smart row still requires `fhir_base_url`
- **End to end** (`npm run e2e:fasten`):
  - against `supabase functions serve` with a fake Fasten server, using `FASTEN_API_BASE` overridable in the e2e env
  - start, then signed `connection_success`, then signed `ehi_export_success` with a small NDJSON file
  - expect records, results and an active connection
  - a replayed webhook id changes nothing
  - an unsigned call gets 401
- **Device:** test mode with the FooClinic test patient
  (`annegoodwin@fooclinic.com` / `f00clinic`) and Fasten's Epic sandbox.

## Setup the user does

1. In Terminal, from `ciatta-mobile-app`:
   `supabase secrets set FASTEN_PUBLIC_ID=public_test_551y... FASTEN_PRIVATE_KEY=... FASTEN_WEBHOOK_SECRET=...`
2. In the Fasten portal:
   - set the webhook URL to `https://pghlquiwqnknpveyssui.supabase.co/functions/v1/fasten-webhook`
   - copy its signing secret into step 1
   The Stitch redirect URL is whatever the portal requires. The SDK handles the return in its web view.

## Out of scope

- TEFCA mode.
- Refreshing a Fasten connection. Export is idempotent per connection, so a
  new export needs a reconnect (`reconnectOrgConnectionId`), which comes
  later.
- Display components from Fasten's library. Ciatta's own Records screens show the data.
- Live mode keys. Swapping to them is a secrets change plus a rebuild.

## Risks

- **The webhook arrives before the app returns.** This is handled: the
  binding comes from the webhook, and the list simply refreshes.
- **Large exports.** A long history can be thousands of Observations. The
  work is batched and resumable through Fasten's retry, so one webhook does
  not need to finish everything.
- **Duplicates with the Epic flow.** If the same Epic hospital is connected
  both ways, records could appear twice. The two flows produce different
  connections. For now, the Connect screen points Epic users to the
  first row.
