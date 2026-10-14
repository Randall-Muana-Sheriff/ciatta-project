// Connecting to a provider's portal, by the SMART on FHIR rules.
//
// This is the flow behind "you will be taken to your provider's secure
// patient portal": the app sends her to the hospital's own authorize URL,
// she logs in there and nowhere else, and the hospital hands back a code
// that is exchanged for a token. Her portal password never touches Ciatta
// and must never be asked for inside it. Anything in this app that
// collected a MyChart password would be a phishing screen, whatever its
// intent, so the only route is the provider's own page in a browser.
//
// PKCE, not a client secret. A phone cannot keep a secret: anything
// compiled into the app is readable by anyone who downloads it. So the app
// proves it started the exchange by holding a verifier it never sent,
// sending only its hash up front. That is why there is no secret in this
// file and why there must never be one.
//
// Pure, and holds no network and no crypto. The caller supplies the random
// bytes and the hash, because expo-crypto cannot load under node and this
// has to stay testable. What lives here is the shape of the request, which
// is the part that is easy to get subtly and silently wrong.

import type { Endpoint } from './directory';

// What a provider's .well-known/smart-configuration gives back. Only the
// three fields the flow actually needs; a server sends many more.
export type SmartConfig = {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  // What the server says it supports. Checked rather than assumed: asking
  // for offline access where it is not offered gets the whole request
  // rejected, and the failure reads as "the provider is broken".
  scopesSupported: readonly string[];
};

// The scopes Ciatta asks for, and nothing beyond them.
//
// Read only, every one of them. There is no scope here that writes to her
// chart, and there must not be: Ciatta reads a record, it does not alter
// one. patient/ rather than user/, so the grant covers her own chart and
// not everything the logged in account can reach.
export const SCOPES = [
  'openid',
  'fhirUser',
  'launch/patient',
  'patient/Patient.read',
  'patient/Observation.read',
  'patient/Condition.read',
  'patient/MedicationRequest.read',
  'patient/AllergyIntolerance.read',
  'patient/Immunization.read',
  'patient/Procedure.read',
  'patient/DiagnosticReport.read',
  'patient/DocumentReference.read',
  'patient/Binary.read',
  'patient/Medication.read',
  'patient/Encounter.read',
  'patient/Appointment.read',
  'patient/Practitioner.read',
  'patient/Organization.read',
  'patient/Location.read',
  'patient/Device.read',
  'patient/FamilyMemberHistory.read',
  'patient/Goal.read',
  'patient/CarePlan.read',
  'patient/Coverage.read',
] as const;

// Keeping the connection alive past one session. Epic offers 6 and 12
// month refresh tokens and the sheet she reads says to choose one, so the
// request asks for it. Omitted where the server does not advertise it,
// rather than sent and rejected.
const OFFLINE = 'offline_access';

export type AuthRequest = {
  url: string;
  // Held by the app, never sent in the authorize request. The exchange
  // proves the app that finishes the flow is the one that started it.
  verifier: string;
  // Echoed back by the provider and compared. A callback whose state does
  // not match is a callback this app did not start.
  state: string;
};

export type Randomness = {
  // A high entropy string, 43 to 128 characters of the unreserved set.
  verifier: string;
  state: string;
  // Base64url of the SHA256 of the verifier. Computed by the caller.
  challenge: string;
};

export function authorizeUrl(
  endpoint: Endpoint,
  config: SmartConfig,
  redirectUri: string,
  clientId: string,
  random: Randomness,
): AuthRequest {
  const scopes: string[] = [...SCOPES];
  if (config.scopesSupported.includes(OFFLINE)) scopes.push(OFFLINE);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state: random.state,
    // aud is required by SMART and is the thing most often left out. The
    // server rejects the request without it, and the error it returns does
    // not say so.
    aud: endpoint.fhirBaseUrl,
    code_challenge: random.challenge,
    code_challenge_method: 'S256',
  });

  const join = config.authorizationEndpoint.includes('?') ? '&' : '?';
  return {
    url: `${config.authorizationEndpoint}${join}${params.toString()}`,
    verifier: random.verifier,
    state: random.state,
  };
}

export type FailureReason = 'denied' | 'state_mismatch' | 'no_code';

export type Callback = { ok: true; code: string } | { ok: false; reason: FailureReason; detail: string };

// Reading what the provider sent back.
//
// The state check is the security boundary and is done before anything
// else is believed. A mismatch means this callback belongs to some other
// request, and the only safe response is to discard it.
export function readCallback(url: string, expectedState: string): Callback {
  let params: URLSearchParams;
  try {
    const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    params = new URLSearchParams(q.split('#')[0]);
  } catch {
    return { ok: false, reason: 'no_code', detail: 'the provider sent back something unreadable' };
  }

  const state = params.get('state') ?? '';
  if (!expectedState || state !== expectedState) {
    return { ok: false, reason: 'state_mismatch', detail: 'this response does not match the request Ciatta made' };
  }

  // Checked after state, so an error that arrives with the wrong state is
  // still refused as a mismatch rather than reported as her decision.
  const error = params.get('error');
  if (error) {
    return { ok: false, reason: 'denied', detail: params.get('error_description') ?? error };
  }

  const code = params.get('code');
  if (!code) return { ok: false, reason: 'no_code', detail: 'no authorization code came back' };
  return { ok: true, code };
}

// What she reads when it did not connect. Her words, not the protocol's:
// "state_mismatch" is not a sentence anyone should be shown.
export function failureLine(reason: FailureReason): string {
  switch (reason) {
    case 'denied':
      return 'The connection was not approved, so nothing was shared. You can try again whenever you want.';
    case 'state_mismatch':
      return 'That response did not match the request Ciatta made, so it was discarded. Please start the connection again.';
    default:
      return 'Your provider did not finish the connection. Nothing was shared. You can try again.';
  }
}

// Where the .well-known document lives for a FHIR base.
export function smartConfigUrl(endpoint: Endpoint): string {
  const base = endpoint.fhirBaseUrl.replace(/\/+$/, '');
  return `${base}/.well-known/smart-configuration`;
}
