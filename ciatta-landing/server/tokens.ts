// Signed links for confirming and unsubscribing.
//
// Stateless on purpose: a token carries its own claims and an HMAC over them,
// so the site needs no pending-signups table to know a link is genuine, and
// nothing about a subscriber sits in a database until they have confirmed.

import type { Source, TopicKey } from './config';

export type Purpose = 'confirm' | 'unsubscribe';

export type Claims = {
  v: 1;
  p: Purpose;
  /** normalised email */
  e: string;
  /** topics the person chose (confirm only) */
  t?: TopicKey[];
  /** form it came from (confirm only) */
  s?: Source;
  /** issued at, seconds */
  iat: number;
};

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signToken(claims: Omit<Claims, 'v' | 'iat'>, secret: string, now = Date.now()): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ v: 1, ...claims, iat: Math.floor(now / 1000) })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export type VerifyResult = { ok: true; claims: Claims } | { ok: false; reason: 'invalid' | 'expired' };

export async function verifyToken(
  token: string,
  secret: string,
  purpose: Purpose,
  maxAgeSeconds: number | null,
  now = Date.now(),
): Promise<VerifyResult> {
  const [body, sig] = token.split('.');
  if (!body || !sig || token.length > 2048) return { ok: false, reason: 'invalid' };

  let valid = false;
  try {
    // crypto.subtle.verify compares in constant time.
    valid = await crypto.subtle.verify('HMAC', await key(secret), fromB64url(sig), enc.encode(body));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!valid) return { ok: false, reason: 'invalid' };

  let claims: Claims;
  try {
    claims = JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (claims.v !== 1 || claims.p !== purpose || typeof claims.e !== 'string') return { ok: false, reason: 'invalid' };
  if (maxAgeSeconds !== null && Math.floor(now / 1000) - claims.iat > maxAgeSeconds) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, claims };
}

/** A stable, non-reversible handle for an email, for rate-limit keys and idempotency keys. */
export async function emailHash(email: string, secret: string): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(`email:${email}`)));
  return b64url(sig).slice(0, 32);
}
