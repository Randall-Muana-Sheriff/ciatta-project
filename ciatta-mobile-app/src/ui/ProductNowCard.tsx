// The period product she has in, on Today, and only while one is in.
//
// What it is, how long it has been in, and when to change it by, from the
// source each product's limit comes from (lib/periodProducts WEAR_LIMIT).
// Two things to do next: she changed it (same product and size, now) or
// took it out. It refreshes each minute and whenever Today comes back into
// view, so it never shows a product she has already logged out.

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import { changeBy, changeLine, endUse, inForLine, openUse, productName, type ProductUse, startUse } from '../lib/periodProducts';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { keepRemindersInStep } from '../state/notifications';
import { heavyBleedingFlag, overnightNote } from '../lib/productSafety';
import { font } from '../theme';
import { PrimaryButton, SecondaryButton } from './kit';
import { L, SPACE, TILE_RADIUS } from './surface';
import { onGround } from './scheme';
import { GlassFill } from './frosted';

const id = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function ProductNowCard() {
  const repo = useRepo();
  const nav = useNav();
  const [uses, setUses] = useState<ProductUse[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [remindersOn, setRemindersOn] = useState(true);
  // Read what she has in, and bring the phone's reminders into step with
  // it: this is the repair after a reinstall or a missed cancel.
  const load = useCallback(() => {
    repo
      .loadProductUses()
      .then((u) => {
        setUses(u);
        return keepRemindersInStep(openUse(u));
      })
      .then(setRemindersOn)
      .catch(() => {});
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
      const next = local(uses);
      setUses(next);
      void keepRemindersInStep(openUse(next)).then(setRemindersOn);
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
    <View style={[c.card, over && c.over]}>
      <GlassFill />
      {/* The facts read as one line; the buttons below stay their own. */}
      <View accessible accessibilityLabel={`${productName(current)} in. ${inForLine(current, now)}. ${changeLine(current, now)}`}>
        <Text style={[font('caption1'), c.eyebrow]}>IN NOW</Text>
        <Text style={[font('headline'), c.name]}>{displayCopy(productName(current))}</Text>
        <Text style={[font('subhead'), c.meta]}>{inForLine(current, now)}</Text>
        <Text style={[font('subhead', 'semibold'), over ? c.overText : c.by]}>{changeLine(current, now)}</Text>
      </View>
      {!remindersOn ? (
        <Text style={[font('footnote'), c.meta]}>Reminders are off. You can turn on notifications for Ciatta in Settings.</Text>
      ) : null}
      {[overnightNote(current), heavyBleedingFlag(uses, now)]
        .filter((l): l is string => !!l)
        .map((l) => (
          <Text key={l} style={[font('footnote'), c.by]}>
            {displayCopy(l)}
          </Text>
        ))}
      <View style={c.actions}>
        <PrimaryButton label="Changed It" disabled={busy} onPress={changed} />
        <SecondaryButton label="Took It Out" onPress={out} />
      </View>
      <Pressable onPress={() => nav.push('productSafety')} accessibilityRole="button" hitSlop={8}>
        <Text style={[font('footnote', 'semibold'), c.meta]}>Safety and warning signs</Text>
      </Pressable>
      {error ? <Text style={[font('footnote'), c.meta]}>{displayCopy(error)}</Text> : null}
    </View>
  );
}

const c = StyleSheet.create({
  card: {
    marginTop: SPACE.block,
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    padding: 16,
    gap: 4,
    overflow: 'hidden',
  },
  over: { borderColor: onGround('#F27D9B') },
  eyebrow: { color: L.meta, letterSpacing: 0.9 },
  name: { color: L.ink },
  meta: { color: L.meta },
  by: { color: L.body },
  overText: { color: onGround('#F27D9B') },
  actions: { gap: SPACE.tight, marginTop: SPACE.tight },
});
