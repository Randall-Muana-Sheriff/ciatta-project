// The period product she has in, on Today, and only while one is in.
//
// What it is, how long it has been in, and when to change it by, from the
// source each product's limit comes from (lib/periodProducts WEAR_LIMIT).
// Two things to do next: she changed it (same product and size, now) or
// took it out. It refreshes each minute and whenever Today comes back into
// view, so it never shows a product she has already logged out.

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { changeBy, changeLine, endUse, inForLine, openUse, productName, type ProductUse, startUse } from '../lib/periodProducts';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { font } from '../theme';
import { PrimaryButton, SecondaryButton } from './kit';
import { L, SPACE, TILE_RADIUS } from './surface';

const id = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function ProductNowCard() {
  const repo = useRepo();
  const nav = useNav();
  const [uses, setUses] = useState<ProductUse[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    repo.loadProductUses().then(setUses).catch(() => {});
    setNow(new Date());
  }, [repo]);

  useEffect(() => {
    if (nav.depth === 0) load();
  }, [nav.depth, load]);
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  const current = openUse(uses);
  if (!current) return null;
  const over = now >= changeBy(current);

  const act = async (write: () => Promise<void>, local: (u: ProductUse[]) => ProductUse[]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await write();
      setUses(local);
      setNow(new Date());
    } catch (e) {
      setError(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const changed = () => {
    const next = { id: id(), product: current.product, size: current.size, at: new Date().toISOString() };
    void act(() => repo.startProduct(next), (u) => startUse(u, next));
  };
  const out = () => {
    const end = { at: new Date().toISOString(), fullness: null };
    void act(() => repo.endProduct(end), (u) => endUse(u, end));
  };

  return (
    <View style={[c.card, over && c.over]} accessible accessibilityLabel={`${productName(current)} in. ${inForLine(current, now)}. ${changeLine(current, now)}`}>
      <Text style={[font('caption1'), c.eyebrow]}>IN NOW</Text>
      <Text style={[font('headline'), c.name]}>{displayCopy(productName(current))}</Text>
      <Text style={[font('subhead'), c.meta]}>{inForLine(current, now)}</Text>
      <Text style={[font('subhead', 'semibold'), over ? c.overText : c.by]}>{changeLine(current, now)}</Text>
      <View style={c.actions}>
        <PrimaryButton label="Changed It" disabled={busy} onPress={changed} />
        <SecondaryButton label="Took It Out" onPress={out} />
      </View>
      {error ? <Text style={[font('footnote'), c.meta]}>{displayCopy(error)}</Text> : null}
    </View>
  );
}

const c = StyleSheet.create({
  card: {
    marginTop: SPACE.block,
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    padding: 16,
    gap: 4,
  },
  over: { borderColor: '#F27D9B' },
  eyebrow: { color: L.meta, letterSpacing: 0.9 },
  name: { color: L.ink },
  meta: { color: L.meta },
  by: { color: L.body },
  overText: { color: '#F27D9B' },
  actions: { gap: SPACE.tight, marginTop: SPACE.tight },
});
