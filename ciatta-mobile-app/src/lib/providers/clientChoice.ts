// Which of Ciatta's two Epic client ids a provider is asked with.
//
// Epic issues one registration two ids. The non production id works only
// against the sandbox at fhir.epic.com; the production id works at real
// hospitals once Epic has made it live there. Sending the wrong one gets
// a refusal page that says nothing useful, so the choice is made here,
// by endpoint, and tested.

import type { Endpoint } from './directory';
import { isSandbox } from './epicDirectory';

export type ClientIds = { production: string; nonProduction: string };

export function clientFor(endpoint: Endpoint, ids: ClientIds): string {
  return (isSandbox(endpoint) ? ids.nonProduction : ids.production).trim();
}
