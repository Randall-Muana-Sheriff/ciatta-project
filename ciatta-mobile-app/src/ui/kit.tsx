import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { SourceKind } from '../data/sample';
import { displayCopy } from '../lib/displayCopy';
import { C, font, GUTTER, RADIUS } from '../theme';

// ── Icons ──────────────────────────────────────────────────────

// Disclosure indicator, drawn like chevron.forward.
export function ChevronRight() {
  return (
    <Svg width={8} height={13} viewBox="0 0 8 13" fill="none">
      <Path d="M1.5 1.5l5 5-5 5" stroke={C.chevron} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronToggle({ open }: { open: boolean }) {
  return (
    <Svg width={13} height={8} viewBox="0 0 13 8" fill="none">
      <Path
        d={open ? 'M1.5 6.5l5-5 5 5' : 'M1.5 1.5l5 5 5-5'}
        stroke={C.secondary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Chrome ─────────────────────────────────────────────────────

// Standard navigation bar: a Back button in the accent color and a
// centred Headline title.
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [s.back, pressed && s.pressed]}
      >
        <Svg width={12} height={20} viewBox="0 0 12 20" fill="none">
          <Path d="M10 2L2 10l8 8" stroke={C.tint} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={[font('body'), { color: C.tint }]}>Back</Text>
      </Pressable>
      <View style={s.headerTitle} pointerEvents="none">
        <Text style={[font('headline'), { color: C.text }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      </View>
    </View>
  );
}

// A pushed screen: navigation bar, scrolling body, optional provenance footer.
export function DetailScreen({
  title,
  onBack,
  footer,
  children,
}: {
  title: string;
  onBack: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={s.fill}>
      <ScreenHeader title={title} onBack={onBack} />
      <ScrollView style={s.fill} contentContainerStyle={s.detailBody}>
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}

// ── Labels and tags ────────────────────────────────────────────

export function SecLabel({ children, right }: { children: string; right?: string }) {
  return (
    <View style={s.secLabel}>
      <Text style={[font('title3', 'semibold'), { color: C.text, flex: 1 }]} accessibilityRole="header">
        {displayCopy(children)}
      </Text>
      {right ? <Text style={[font('footnote'), { color: C.secondary }]}>{displayCopy(right)}</Text> : null}
    </View>
  );
}

type Tone = 'amber' | 'neutral' | 'orange' | 'in' | 'low' | SourceKind;

const TONES: Record<Tone, { bg: string; fg: string }> = {
  amber: { bg: C.amberBg, fg: C.amber },
  neutral: { bg: C.fill, fg: C.secondary },
  orange: { bg: '#3A2410', fg: C.orange },
  in: { bg: C.inBg, fg: C.inText },
  low: { bg: C.lowBg, fg: C.lowText },
  logged: { bg: C.loggedBg, fg: C.white },
  measured: { bg: C.measuredBg, fg: C.measuredText },
  lab: { bg: C.labBg, fg: C.labText },
};

// `size` is kept for callers; every tag renders at Caption 1 (12 pt),
// above the 11 pt minimum.
export function Tag({
  label,
  tone,
  upper = false,
}: {
  label: string;
  tone: Tone;
  size?: 10 | 11;
  upper?: boolean;
}) {
  const t = TONES[tone];
  return (
    <View style={[s.tag, { backgroundColor: t.bg }]}>
      <Text style={[font('caption1', 'semibold'), { color: t.fg }]}>
        {upper ? label.toUpperCase() : displayCopy(label)}
      </Text>
    </View>
  );
}

const SOURCE_LABEL: Record<SourceKind, string> = { logged: 'You logged', measured: 'Measured', lab: 'Lab' };

// Where the data on a screen came from, pinned above the tab bar.
export function SourceFooter({ kind, text }: { kind: SourceKind; text: string }) {
  return (
    <View style={s.sourceFooter}>
      <Tag label={SOURCE_LABEL[kind]} tone={kind} />
      <Text style={[font('footnote'), { color: C.secondary, flex: 1 }]}>{displayCopy(text)}</Text>
    </View>
  );
}

// ── Controls ───────────────────────────────────────────────────

// iOS segmented control. `scroll` lets a long set of segments scroll
// sideways instead of squeezing.
export function SegmentedControl<T extends string>({
  segments,
  active,
  onChange,
  scroll = false,
  style,
}: {
  segments: readonly T[];
  active: T;
  onChange: (segment: T) => void;
  scroll?: boolean;
  style?: object;
}) {
  const bar = (
    <View style={s.segBar} accessibilityRole="tablist">
      {segments.map((seg) => {
        const on = seg === active;
        return (
          <Pressable
            key={seg}
            onPress={() => onChange(seg)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            hitSlop={{ top: 6, bottom: 6 }}
            style={[s.seg, !scroll && s.segFlex, on && s.segOn]}
          >
            <Text style={[font('footnote', on ? 'semibold' : 'medium'), { color: C.text }]} numberOfLines={1}>
              {seg}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.segScroll, style]}
        contentContainerStyle={{ paddingHorizontal: GUTTER }}
      >
        {bar}
      </ScrollView>
    );
  }
  return <View style={[s.segWrap, style]}>{bar}</View>;
}

// Filled capsule for the one most likely action on a view.
export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [s.button, s.primary, disabled && s.disabled, pressed && s.pressed]}
    >
      <Text style={[font('headline'), { color: C.bg }]}>{label}</Text>
    </Pressable>
  );
}

// Gray capsule with an accent label for supporting actions.
export function SecondaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.button, s.secondary, pressed && s.pressed]}>
      <Text style={[font('headline'), { color: C.tint }]}>{label}</Text>
    </Pressable>
  );
}

export function LinkButton({
  label,
  onPress,
  center = false,
}: {
  label: string;
  onPress?: () => void;
  center?: boolean;
  size?: 13 | 14;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => [s.link, center && { alignSelf: 'center' }, pressed && s.pressed]}
    >
      <Text style={[font('subhead'), { color: C.tint }]}>{label}</Text>
    </Pressable>
  );
}

// ── Rows ───────────────────────────────────────────────────────

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({
  title,
  sub,
  value,
  valueColor,
  titleColor = C.text,
  onPress,
  first = false,
}: {
  title: string;
  sub?: string;
  value?: string;
  valueColor?: string;
  titleColor?: string;
  onPress?: () => void;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [s.row, !first && s.rowBorder, pressed && s.pressed]}
    >
      <View style={s.rowText}>
        <Text style={[font('body'), { color: titleColor }]}>{displayCopy(title)}</Text>
        {sub ? <Text style={[font('footnote'), { color: C.secondary, marginTop: 2 }]}>{displayCopy(sub)}</Text> : null}
      </View>
      <View style={s.rowRight}>
        {value ? <Text style={[font('body'), { color: valueColor ?? C.secondary }]}>{displayCopy(value)}</Text> : null}
        {onPress ? <ChevronRight /> : null}
      </View>
    </Pressable>
  );
}

// A row that opens into a card of facts. Collapsed it reads like any Row.
export function Expandable({
  title,
  sub,
  value,
  valueColor,
  open,
  onToggle,
  first = false,
  children,
}: {
  title: string;
  sub?: string;
  value?: string;
  valueColor?: string;
  open: boolean;
  onToggle: () => void;
  first?: boolean;
  children: ReactNode;
}) {
  if (!open) {
    return <Row title={title} sub={sub} value={value} valueColor={valueColor} onPress={onToggle} first={first} />;
  }
  return (
    <View style={s.openCard}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: true }}
        style={s.openHead}
      >
        <View style={s.rowText}>
          <Text style={[font('headline'), { color: C.text }]}>{displayCopy(title)}</Text>
          {sub ? <Text style={[font('footnote'), { color: C.secondary }]}>{displayCopy(sub)}</Text> : null}
        </View>
        <View style={s.rowRight}>
          {value ? <Text style={[font('headline'), { color: valueColor ?? C.text }]}>{displayCopy(value)}</Text> : null}
          <ChevronToggle open />
        </View>
      </Pressable>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}

export function Facts({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <View>
      {rows.map((r) => (
        <View key={r.label} style={s.fact}>
          <Text style={[font('subhead'), { color: C.secondary }]}>{displayCopy(r.label)}</Text>
          <Text style={[font('subhead'), s.factValue]}>{displayCopy(r.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  fill: { flex: 1 },
  pressed: { opacity: 0.55 },

  header: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 4, zIndex: 1 },
  headerTitle: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 88,
  },
  detailBody: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 32 },

  secLabel: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  tag: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  sourceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: GUTTER,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
  },

  segWrap: { marginBottom: 20 },
  segScroll: { flexGrow: 0 },
  segBar: { flexDirection: 'row', backgroundColor: C.fill, borderRadius: 9, padding: 2, minHeight: 32 },
  seg: { minHeight: 28, paddingHorizontal: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segFlex: { flex: 1 },
  segOn: { backgroundColor: C.fillSelected },

  button: { minHeight: 50, borderRadius: 25, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: C.tint },
  disabled: { opacity: 0.4 },
  secondary: { backgroundColor: C.fill },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },

  card: { backgroundColor: C.card, borderRadius: RADIUS, padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, paddingVertical: 11 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },
  rowText: { flex: 1, paddingRight: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  openCard: { backgroundColor: C.card, borderRadius: RADIUS, paddingVertical: 12, paddingHorizontal: 16, marginVertical: 4 },
  openHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
  },
  factValue: { color: C.text, flexShrink: 1, textAlign: 'right' },
});
