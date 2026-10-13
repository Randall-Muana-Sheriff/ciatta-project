// The push sent when a run finds something new or changed in her record.
// This replaced the "Something changed in October" card on Journey: the
// finding comes to her when it is made, rather than waiting on a tab.
//
// The lock screen shows only that something changed and the month: never
// what it is about, because anyone holding her phone can read it. Sent
// only if she has New Findings on (profiles.notify_findings).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export type PushMessage = { to: string; title: string; body: string; data: { screen: string }; sound: 'default' };

export function findingPush(tokens: string[], statuses: string[], allowed: boolean, now: Date): PushMessage[] {
  if (!allowed || !statuses.some((s) => s === 'new' || s === 'updated')) return [];
  const body = `Something changed in ${MONTHS[now.getMonth()]}. Open Ciatta to see it.`;
  return tokens
    .filter((t) => EXPO_TOKEN.test(t))
    .map((to) => ({ to, title: 'Ciatta', body, data: { screen: 'evidence' }, sound: 'default' as const }));
}
