import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, type StyleProp, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { SourceKind } from '../data/sample';
import { displayCopy } from '../lib/displayCopy';
import { C, font, GUTTER } from '../theme';
import { L, TILE_RADIUS } from './surface';
import { CardFill } from './cardFill';
import { Icon, type IconName } from './icons';
import { G } from './scheme';

// ── Icons ──────────────────────────────────────────────────────

// Disclosure indicator, drawn like chevron.forward.
export function ChevronRight({ light }: { light?: boolean } = {}) {
  return (
    <Svg width={8} height={13} viewBox="0 0 8 13" fill="none">
      <Path
        d="M1.5 1.5l5 5-5 5"
        stroke={light ? G.rule : G.meta}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronToggle({ open }: { open: boolean }) {
  return (
    <Svg width={13} height={8} viewBox="0 0 13 8" fill="none">
      <Path
        d={open ? 'M1.5 6.5l5-5 5 5' : 'M1.5 1.5l5 5 5-5'}
        stroke={G.body}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Chrome ─────────────────────────────────────────────────────

// Standard navigation bar: a back chevron alone, in the accent color, with
// a full 44 point target, and a centred Headline title. The chevron says
// back on its own everywhere in the app; the word beside it was noise. The
// spoken label still says Back.
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
          <Path d="M10 2L2 10l8 8" stroke={G.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <View style={s.headerTitle} pointerEvents="none">
        <Text style={[font('headline'), { color: G.ink }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      </View>
    </View>
  );
}

// A pushed screen: navigation bar, scrolling body, optional footer.
//
// The keyboard never hides what she is typing or how she saves it: the
// screen rises with the keyboard, so the footer (where Save lives) stays
// above it, and the body scrolls the field she is in into view. A tap on a
// button with the keyboard up acts at once rather than only closing it.
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
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={title} onBack={onBack} />
      <ScrollView
        style={s.fill}
        contentContainerStyle={s.detailBody}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

// The Save bar: fixed under a screen's body, above the keyboard when it
// is up, so saving is always one tap away and never scrolled out of reach.
export function SaveBar({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <View style={s.saveBar}>
      <PrimaryButton label={label} onPress={onPress} disabled={disabled} />
    </View>
  );
}

// ── Labels and tags ────────────────────────────────────────────

export function SecLabel({ children, right }: { children: string; right?: string }) {
  return (
    <View style={s.secLabel}>
      <Text style={[font('title3', 'semibold'), { color: G.ink, flex: 1 }]} accessibilityRole="header">
        {displayCopy(children)}
      </Text>
      {right ? <Text style={[font('footnote'), { color: G.body }]}>{displayCopy(right)}</Text> : null}
    </View>
  );
}

type Tone = 'amber' | 'neutral' | 'orange' | 'in' | 'low' | SourceKind;

const TONES: Record<Tone, { bg: string; fg: string }> = {
  amber: { bg: C.amberBg, fg: C.amber },
  neutral: { bg: C.fill, fg: C.secondary },
  orange: { bg: C.amberBg, fg: C.orange },
  in: { bg: C.inBg, fg: C.inText },
  low: { bg: C.lowBg, fg: C.lowText },
  logged: { bg: C.loggedBg, fg: C.loggedInk },
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

const SOURCE_LABEL: Record<SourceKind, string> = { logged: 'You logged', measured: 'Synced', lab: 'Lab' };

// Where the data on a screen came from, pinned above the tab bar.
export function SourceFooter({ kind, text }: { kind: SourceKind; text: string }) {
  return (
    <View style={s.sourceFooter}>
      <Tag label={SOURCE_LABEL[kind]} tone={kind} />
      <Text style={[font('footnote'), { color: G.body, flex: 1 }]}>{displayCopy(text)}</Text>
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
            <Text
              style={[font('footnote', on ? 'semibold' : 'medium'), { color: on ? G.ink : G.body }]}
              numberOfLines={1}
            >
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
// Buttons. Two kinds and one shape: a 52 point pill, solid in the ground's
// ink for the one primary action, a flat fill with a hairline for the
// rest. Pressing settles the button a little rather than fading it out.
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [s.button, s.primary, disabled && s.disabled, pressed && s.buttonPressed]}
    >
      {icon ? <Icon name={icon} size={18} color={G.onPill} weight={1.8} /> : null}
      <Text style={[font('headline', 'semibold'), s.buttonLabel, { color: G.onPill }]}>{label}</Text>
    </Pressable>
  );
}

// A screen's lead sentence, set as a statement: the first sentence large
// and in Jost semibold, the rest quieter beneath it. The editorial type of
// the Your Care cards, used for every screen's opening line.
export function Lead({ text, style }: { text: string; style?: StyleProp<ViewStyle | TextStyle> }) {
  const said = displayCopy(text.replace(/\s+/g, ' ').trim());
  const cut = said.search(/[.?!](\s|$)/);
  const first = cut >= 0 ? said.slice(0, cut + 1) : said;
  const rest = cut >= 0 ? said.slice(cut + 1).trim() : '';
  return (
    <View style={style as StyleProp<ViewStyle>}>
      <Text style={[font('title3', 'semibold'), s.statement]}>{first}</Text>
      {rest ? <Text style={[font('body'), s.statementRest]}>{rest}</Text> : null}
    </View>
  );
}

// Gray capsule with an accent label for supporting actions.
export function SecondaryButton({ label, onPress, icon }: { label: string; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.button, s.secondary, pressed && s.buttonPressed]}>
      {icon ? <Icon name={icon} size={18} color={G.ink} weight={1.8} /> : null}
      <Text style={[font('headline', 'semibold'), s.buttonLabel, { color: G.ink }]}>{label}</Text>
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
      <Text style={[font('subhead', 'semibold'), { color: G.ink, textDecorationLine: 'underline' }]}>{label}</Text>
    </Pressable>
  );
}

// ── Rows ───────────────────────────────────────────────────────

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.card, style]}><CardFill />{children}</View>;
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
        {sub ? <Text style={[font('footnote'), { color: G.body, marginTop: 2 }]}>{displayCopy(sub)}</Text> : null}
      </View>
      <View style={s.rowRight}>
        {value ? <Text style={[font('body'), { color: valueColor ?? G.body }]}>{displayCopy(value)}</Text> : null}
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
      <CardFill />
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
          <Text style={[font('subhead'), { color: G.body }]}>{displayCopy(r.label)}</Text>
          <Text style={[font('subhead'), s.factValue]}>{displayCopy(r.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export const s = StyleSheet.create({
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  saveBar: {
    paddingHorizontal: GUTTER,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: G.rule,
  },
  fill: { flex: 1 },
  pressed: { opacity: 0.55 },

  header: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 8 },
  back: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 4, zIndex: 1 },
  headerTitle: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 88,
  },
  detailBody: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 32 },

  secLabel: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  tag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  sourceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: GUTTER,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: G.rule,
  },

  segWrap: { marginBottom: 20 },
  segScroll: { flexGrow: 0 },
  // A track with the same hairline every other surface carries, and tall
  // enough that a segment is a real tap target: 28 high was under the 44
  // minimum, which on a control with three choices side by side is where
  // the wrong one gets picked.
  segBar: {
    flexDirection: 'row',
    backgroundColor: G.fill,
    borderRadius: 999,
    padding: 3,
    minHeight: 44,
  },
  seg: { minHeight: 38, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segFlex: { flex: 1 },
  // Selected the way a tile and a tab are selected: the shared tokens, so
  // the same gesture looks the same wherever it happens.
  segOn: { backgroundColor: C.fillSelected, borderWidth: StyleSheet.hairlineWidth, borderColor: L.edgeOn },

  button: {
    minHeight: 52,
    borderRadius: 999,
    paddingHorizontal: 24,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { letterSpacing: 0.1 },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  // The white pill, as the Your Care cards set their actions: the one
  // primary action on any screen.
  primary: { backgroundColor: G.pill },
  statement: { color: G.ink, lineHeight: 28, letterSpacing: -0.2 },
  statementRest: { color: G.body, lineHeight: 23, marginTop: 6 },
  disabled: { opacity: 0.4 },
  secondary: { backgroundColor: G.fill, borderWidth: StyleSheet.hairlineWidth, borderColor: G.rule },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },

  card: { backgroundColor: L.glass, borderRadius: TILE_RADIUS, padding: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, paddingVertical: 11 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },
  rowText: { flex: 1, paddingRight: 12 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  openCard: { backgroundColor: L.glass, borderRadius: TILE_RADIUS, paddingVertical: 12, paddingHorizontal: 16, marginVertical: 4, overflow: 'hidden' },
  openHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: G.rule,
  },
  factValue: { color: G.ink, flexShrink: 1, textAlign: 'right' },
});

// What a screen shows while her record has nothing for it yet.
export function EmptyNote({ text }: { text: string }) {
  return <Text style={[font('body'), { color: G.body, lineHeight: 25 }]}>{displayCopy(text)}</Text>;
}

// A section's heading, set as Insights sets its own: Title 2, semibold, on
// the ground above the cards it names rather than inside them. Today,
// Health and Journey use it; Care keeps its headings inside its cards.
// `right` holds the one thing that goes with it: All, a date, a count.
export function SectionHeading({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={s.sectionHeading}>
      <Text style={[font('title2', 'semibold'), { color: G.ink, flex: 1 }]} accessibilityRole="header">
        {displayCopy(title)}
      </Text>
      {right}
    </View>
  );
}
