import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayCopy } from '../lib/displayCopy';
import type { Tab } from '../navigation';
import { C, font, fonts, GUTTER, RADIUS } from '../theme';
import { Icon, type IconName } from './icons';
import { ChevronRight } from './kit';

// ── Navigation bar items ───────────────────────────────────────

// Circular icon button for a navigation bar, 44 pt square.
export function ToolbarButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.toolbarButton, pressed && s.pressed]}
    >
      <Icon name={icon} size={20} color={C.tint} weight={2} />
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.textButton, pressed && s.pressed]}>
      <Text style={[font('body'), { color: C.tint }]}>{label}</Text>
    </Pressable>
  );
}

// Large title for a tab's root screen, with navigation bar items trailing.
// Without a title the eyebrow stands alone and serves as the screen's header.
export function LargeTitle({ title, eyebrow, trailing }: { title?: string; eyebrow?: string; trailing?: ReactNode }) {
  return (
    <View style={[s.largeTitle, !title && s.eyebrowOnly]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text
            style={[font('footnote', 'semibold'), { color: C.secondary }]}
            accessibilityRole={title ? undefined : 'header'}
          >
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text style={[font('largeTitle', 'bold'), { color: C.text }]} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
    </View>
  );
}

// ── Content ────────────────────────────────────────────────────

export function Panel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.panel, style]}>{children}</View>;
}

export function PanelTitle({ icon, children }: { icon: IconName; children: string }) {
  return (
    <View style={s.panelTitle}>
      <Icon name={icon} size={20} color={C.tint} weight={1.8} />
      <Text style={[font('headline'), { color: C.text, flex: 1 }]} accessibilityRole="header">
        {children}
      </Text>
    </View>
  );
}

// Settings style glyph: a white symbol on a rounded color square.
export function IconSquare({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View style={[s.iconSquare, { backgroundColor: color }]}>
      <Icon name={icon} size={18} color={C.white} weight={1.8} />
    </View>
  );
}

// Inset grouped list section.
export function ListGroup({
  header,
  footer,
  children,
  style,
}: {
  header?: string;
  footer?: string;
  children: ReactNode;
  style?: object;
}) {
  return (
    <View style={style}>
      {header ? (
        <Text style={[font('title3', 'semibold'), s.groupHeader]} accessibilityRole="header">
          {header}
        </Text>
      ) : null}
      <View style={s.group}>{children}</View>
      {footer ? <Text style={[font('footnote'), s.groupFooter]}>{footer}</Text> : null}
    </View>
  );
}

export function ListRow({
  icon,
  tint,
  title,
  sub,
  value,
  onPress,
  first = false,
  destructive = false,
  right,
  selected,
}: {
  icon?: IconName;
  tint?: string;
  title: string;
  sub?: string;
  value?: string;
  onPress?: () => void;
  first?: boolean;
  destructive?: boolean;
  right?: ReactNode;
  // When set, the row is a toggle: a check mark stands in for `right` and
  // the chevron, and the selected state is exposed to VoiceOver.
  selected?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: C.cardHi }]}
    >
      {icon ? <IconSquare icon={icon} color={tint ?? C.tint} /> : null}
      <View style={[s.rowBody, !first && s.rowSep]}>
        <View style={{ flex: 1 }}>
          <Text style={[font('body'), { color: destructive ? C.red : C.text }]}>{displayCopy(title)}</Text>
          {sub ? <Text style={[font('footnote'), { color: C.secondary, marginTop: 2 }]}>{displayCopy(sub)}</Text> : null}
        </View>
        {value ? <Text style={[font('body'), { color: C.secondary }]}>{displayCopy(value)}</Text> : null}
        {selected === undefined ? right : selected ? <Icon name="check" size={20} color={C.tint} weight={2} /> : <View style={s.checkBlank} />}
        {selected === undefined && onPress && !destructive ? <ChevronRight /> : null}
      </View>
    </Pressable>
  );
}

// ── Tab bar ────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Today', icon: 'home' },
  { key: 'myhealth', label: 'Health', icon: 'heart' },
  { key: 'journey', label: 'Journey', icon: 'journey' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

export function BottomNav({ active, onTab }: { active: Tab; onTab: (tab: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.nav, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.key === active;
        const color = on ? C.tint : C.muted;
        return (
          <Pressable
            key={t.key}
            onPress={() => onTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            style={s.tab}
          >
            <Icon name={t.icon} size={25} color={color} weight={1.6} filled />
            <Text style={[s.tabLabel, { color }]} maxFontSizeMultiplier={1.2}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  pressed: { opacity: 0.55 },

  largeTitle: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    paddingBottom: 4,
  },
  eyebrowOnly: { alignItems: 'center' },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolbarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },

  panel: { backgroundColor: C.card, borderRadius: RADIUS, padding: 16 },
  panelTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },

  iconSquare: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  groupHeader: { color: C.text, marginBottom: 8 },
  group: { backgroundColor: C.card, borderRadius: RADIUS, overflow: 'hidden' },
  groupFooter: { color: C.secondary, marginTop: 6, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, minHeight: 44 },
  checkBlank: { width: 20 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 11, paddingRight: 16 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },

  nav: {
    flexDirection: 'row',
    backgroundColor: '#121214',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.separator,
  },
  tab: { flex: 1, height: 49, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 13 },
});
