// Period products, under Cycle on the Log screen.
//
// Two states. Nothing in: pick the product, pick the size, put it in now.
// Something in: what it is and how long it has been in, and the two things
// she does next, change it (same product, same size, now) or take it out
// (and, if she likes, say how full it was). Each tap saves at once: a
// product going in is a moment, not a sentence to compose and send.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { displayCopy } from '../lib/displayCopy';
import {
  endUse,
  FULLNESS,
  type Fullness,
  inForLine,
  openUse,
  productName,
  type Product,
  PRODUCTS,
  type ProductUse,
  SIZES,
  startUse,
} from '../lib/periodProducts';
import { userFacingError } from '../lib/userFacingError';
import { useRepo } from '../state/session';
import { useCycle } from '../state/cycleStore';
import { keepRemindersInStep } from '../state/notifications';
import { absorbencyHint, cupIudNote, heavyBleedingFlag, overnightNote } from '../lib/productSafety';
import { useNav } from '../navigation';
import { font } from '../theme';
import { Eyebrow } from './bento';
import { ChoiceChips } from './cycleInputs';
import { PrimaryButton, SecondaryButton } from './kit';
import { L, SPACE, TILE_RADIUS } from './surface';
import { GlassFill } from './frosted';

const id = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function ProductLogger() {
  const repo = useRepo();
  const nav = useNav();
  const { profile } = useCycle();
  const [uses, setUses] = useState<ProductUse[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [takingOut, setTakingOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let ignore = false;
    repo
      .loadProductUses()
      .then((rows) => {
        if (!ignore) setUses(rows);
      })
      .catch(() => {
        // Starts empty; she can still log, and a failed read says nothing
        // false about what is in.
      });
    // The time in moves on while the screen is open.
    const tick = setInterval(() => setNow(new Date()), 60000);
    return () => {
      ignore = true;
      clearInterval(tick);
    };
  }, [repo]);

  const current = openUse(uses);

  const run = async (write: () => Promise<void>, local: (u: ProductUse[]) => ProductUse[]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await write();
      const next = local(uses);
      setUses(next);
      // Reminders follow what is in. Asked for the first time she puts one
      // in; declined, nothing is scheduled and Today says so.
      void keepRemindersInStep(openUse(next), true);
      setNow(new Date());
      setTakingOut(false);
      setProduct(null);
      setSize(null);
    } catch (e) {
      setError(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const putIn = (next: { product: Product; size: string }) => {
    const use = { id: id(), ...next, at: new Date().toISOString() };
    void run(
      () => repo.startProduct(use),
      (u) => startUse(u, use),
    );
  };

  const takeOut = (fullness: Fullness | null) => {
    const out = { at: new Date().toISOString(), fullness };
    void run(
      () => repo.endProduct(out),
      (u) => endUse(u, out),
    );
  };

  return (
    <View style={p.wrap}>
      <Eyebrow>Period products</Eyebrow>

      {current ? (
        <View style={p.current}>
          <GlassFill />
          <View accessible accessibilityLabel={`${productName(current)} in. ${inForLine(current, now)}`}>
            <Text style={[font('headline'), p.currentName]}>{displayCopy(productName(current))}</Text>
            <Text style={[font('subhead'), p.meta]}>{inForLine(current, now)}</Text>
          </View>
          {takingOut ? (
            <>
              <Text style={[font('footnote'), p.meta, { marginTop: SPACE.near }]}>How full was it? You can skip this.</Text>
              <ChoiceChips options={FULLNESS} selected={[]} onToggle={(f) => takeOut(f as Fullness)} single />
              <SecondaryButton label="Skip" onPress={() => takeOut(null)} />
            </>
          ) : (
            <View style={p.actions}>
              <PrimaryButton label="Changed it" disabled={busy} onPress={() => putIn({ product: current.product, size: current.size })} />
              <SecondaryButton label="Took it out" onPress={() => setTakingOut(true)} />
            </View>
          )}
        </View>
      ) : null}

      {/* What she is putting in now, when nothing is in or she is switching. */}
      {!takingOut ? (
        <>
          <Text style={[font('footnote'), p.meta, { marginTop: SPACE.tight }]}>
            {current ? 'Or switch to something else:' : 'What are you using?'}
          </Text>
          <ChoiceChips
            options={PRODUCTS}
            selected={product ? [product] : []}
            onToggle={(v) => {
              setProduct(v === product ? null : (v as Product));
              setSize(null);
            }}
            single
          />
          {product ? (
            <>
              <Text style={[font('footnote'), p.meta]}>Size</Text>
              <ChoiceChips options={SIZES[product]} selected={size ? [size] : []} onToggle={(v) => setSize(v === size ? null : v)} single />
              <PrimaryButton
                label={busy ? 'Saving' : 'Put in now'}
                disabled={!size || busy}
                onPress={() => size && putIn({ product, size })}
              />
            </>
          ) : null}
        </>
      ) : null}

      {/* Safety, only where it applies, each from its source. */}
      {[heavyBleedingFlag(uses, now), absorbencyHint(uses), overnightNote(current), product ? cupIudNote(product, profile.contraception) : null]
        .filter((l): l is string => !!l)
        .map((line) => (
          <Text key={line} style={[font('footnote'), p.safety]}>
            {displayCopy(line)}
          </Text>
        ))}
      <Pressable onPress={() => nav.push('productSafety')} accessibilityRole="button" hitSlop={8}>
        <Text style={[font('footnote', 'semibold'), p.meta]}>Product safety and warning signs</Text>
      </Pressable>

      {error ? <Text style={[font('footnote'), p.error]}>{displayCopy(error)}</Text> : null}
    </View>
  );
}

const p = StyleSheet.create({
  wrap: { marginTop: SPACE.block, gap: SPACE.tight },
  current: {
    backgroundColor: L.recessed,
    borderRadius: TILE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    padding: 16,
    gap: 6,
    overflow: 'hidden',
  },
  currentName: { color: L.ink },
  meta: { color: L.meta },
  actions: { gap: SPACE.tight, marginTop: SPACE.tight },
  error: { color: L.ink },
  safety: { color: L.body, lineHeight: 19 },
});
