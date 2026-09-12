import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { SourceKind } from '../data/sample';
import { displayCopy } from '../lib/displayCopy';
import type { Tab } from '../navigation';
import { C, caps, GUTTER, sans } from '../theme';

// ── Icons ──────────────────────────────────────────────────────

export function ChevronRight() {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none">
      <Path d="M1 1l6 6-6 6" stroke={C.muted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronToggle({ open }: { open: boolean }) {
  return (
    <Svg width={14} height={8} viewBox="0 0 14 8" fill="none">
      <Path
        d={open ? 'M1 7l6-6 6 6' : 'M1 1l6 6 6-6'}
        stroke={C.secondary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Chrome ─────────────────────────────────────────────────────

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View>
      <View style={s.header}>
        <Pressable onPress={onBack} hitSlop={14} accessibilityRole="button" accessibilityLabel="Back" style={s.back}>
          <Svg width={10} height={18} viewBox="0 0 10 18" fill="none">
            <Path d="M9 1L1 9l8 8" stroke={C.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={s.headerTitle}>
          <Text style={[sans(17, 600), { color: C.text }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        </View>
      </View>
      <View style={s.hairline} />
    </View>
  );
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'myhealth', label: 'My Health' },
  { key: 'profile', label: 'Profile' },
];

export function BottomNav({ active, onTab }: { active: Tab; onTab: (tab: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.nav, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => onTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.navButton, on && { backgroundColor: C.white }]}
          >
            <Text style={[sans(15, 600), { color: on ? C.bg : C.secondary }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A pushed screen: back header, scrolling body, optional provenance footer.
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
      <Text style={[sans(11, 600), caps, { color: C.muted }]}>{displayCopy(children)}</Text>
      {right ? <Text style={[sans(12), { color: C.muted }]}>{displayCopy(right)}</Text> : null}
    </View>
  );
}

type Tone = 'amber' | 'neutral' | 'orange' | 'in' | 'low' | SourceKind;

const TONES: Record<Tone, { bg: string; fg: string; border?: string }> = {
  amber: { bg: C.amberBg, fg: C.amber, border: C.amberBorder },
  neutral: { bg: C.surface, fg: C.secondary, border: C.border },
  orange: { bg: C.orange + '30', fg: C.orange },
  in: { bg: C.inBg, fg: C.inText },
  low: { bg: C.lowBg, fg: C.lowText, border: C.amberBorder },
  logged: { bg: C.loggedBg, fg: C.white },
  measured: { bg: C.measuredBg, fg: C.measuredText },
  lab: { bg: C.labBg, fg: C.labText },
};

export function Tag({
  label,
  tone,
  size = 11,
  upper = false,
}: {
  label: string;
  tone: Tone;
  size?: 10 | 11;
  upper?: boolean;
}) {
  const t = TONES[tone];
  return (
    <View
      style={[
        s.tag,
        { backgroundColor: t.bg, borderColor: t.border ?? t.bg, paddingHorizontal: upper ? 11 : 8 },
      ]}
    >
      <Text style={[sans(size, 600), { color: t.fg, lineHeight: 16 }, upper && { letterSpacing: 0.6 }]}>
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
      <Tag label={SOURCE_LABEL[kind]} tone={kind} size={10} />
      <Text style={[sans(12), { color: C.secondary, flex: 1 }]}>{displayCopy(text)}</Text>
    </View>
  );
}

// ── Controls ───────────────────────────────────────────────────

export function FilterPills<T extends string>({
  pills,
  active,
  onChange,
}: {
  pills: readonly T[];
  active: T;
  onChange: (pill: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.pillsScroll}
      contentContainerStyle={s.pills}
    >
      {pills.map((p) => {
        const on = p === active;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.pill, on ? s.pillOn : s.pillOff]}
          >
            <Text style={[sans(14, on ? 600 : 400), { color: on ? C.bg : C.secondary }]}>{p}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.primary, pressed && s.pressed]}>
      <Text style={[sans(16, 600), { color: C.bg }]}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
      <Text style={[sans(15, 600), { color: C.text }]}>{label}</Text>
    </Pressable>
  );
}

export function LinkButton({
  label,
  onPress,
  center = false,
  size = 13,
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
      hitSlop={8}
      style={({ pressed }) => [s.link, center && { alignSelf: 'center' }, pressed && s.pressed]}
    >
      <Text style={[sans(size, 500), { color: C.blueLink }]}>{label}</Text>
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
        <Text style={[sans(15), { color: titleColor }]}>{displayCopy(title)}</Text>
        {sub ? <Text style={[sans(12), { color: C.muted, marginTop: 2 }]}>{displayCopy(sub)}</Text> : null}
      </View>
      <View style={s.rowRight}>
        {value ? <Text style={[sans(15, 500), { color: valueColor ?? C.text }]}>{displayCopy(value)}</Text> : null}
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
          <Text style={[sans(15, 600), { color: C.text }]}>{displayCopy(title)}</Text>
          {sub ? <Text style={[sans(12), { color: C.muted }]}>{displayCopy(sub)}</Text> : null}
        </View>
        <View style={s.rowRight}>
          {value ? <Text style={[sans(15, 600), { color: valueColor ?? C.text }]}>{displayCopy(value)}</Text> : null}
          <ChevronToggle open />
        </View>
      </Pressable>
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

export function Facts({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <View>
      {rows.map((r) => (
        <View key={r.label} style={s.fact}>
          <Text style={[sans(13), { color: C.muted }]}>{displayCopy(r.label)}</Text>
          <Text style={[sans(13), s.factValue]}>{displayCopy(r.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  fill: { flex: 1 },
  pressed: { opacity: 0.6 },

  header: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: GUTTER },
  back: { paddingVertical: 6, paddingRight: 8, zIndex: 1 },
  headerTitle: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 56,
    pointerEvents: 'none',
  },
  hairline: { height: StyleSheet.hairlineWidth * 2, backgroundColor: C.border, opacity: 0.6 },
  detailBody: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 24 },

  nav: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  navButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 100 },

  secLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tag: { alignSelf: 'flex-start', borderRadius: 100, borderWidth: 1, paddingVertical: 1 },
  sourceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: GUTTER,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.borderSub,
  },

  pillsScroll: { flexGrow: 0, marginBottom: 20, marginHorizontal: -GUTTER },
  pills: { gap: 8, paddingHorizontal: GUTTER },
  pill: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1 },
  pillOn: { backgroundColor: C.white, borderColor: C.white },
  pillOff: { backgroundColor: C.surface, borderColor: C.border },

  primary: { alignItems: 'center', paddingVertical: 16, borderRadius: 100, backgroundColor: C.white },
  secondary: {
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 100,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  link: { paddingTop: 8, alignSelf: 'flex-start' },

  card: { backgroundColor: C.card, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: C.borderSub },
  rowText: { flex: 1, paddingRight: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  openCard: { backgroundColor: C.card, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 1 },
  openHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: C.borderSub,
  },
  factValue: { color: C.secondary, flexShrink: 1, textAlign: 'right' },
});
