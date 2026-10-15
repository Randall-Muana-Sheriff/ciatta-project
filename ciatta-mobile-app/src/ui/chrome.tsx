import { type ReactNode, useEffect, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayCopy } from '../lib/displayCopy';
import { menuFor, type MenuItem, type Tab } from '../navigation';
import { C, font, fonts, GUTTER } from '../theme';
import { Icon, type IconName } from './icons';
import { G } from './scheme';
import { L, TILE_RADIUS } from './surface';
import { ChevronRight } from './kit';
import { CardFill } from './cardFill';

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
      <Icon name={icon} size={20} color={G.ink} weight={2} />
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.textButton, pressed && s.pressed]}>
      <Text style={[font('body'), { color: G.ink }]}>{label}</Text>
    </Pressable>
  );
}

// Large title for a tab's root screen, with navigation bar items trailing.
// Without a title the eyebrow stands alone and serves as the screen's header.
// Health, Journey and Profile. Half the size it was: largeTitle is 34 and
// this is 17, which is the same step the body text sits on. A screen whose
// name is already in the tab bar does not need to announce itself twice,
// and the space it gives back goes to the content under it.
export function LargeTitle({ title, eyebrow, trailing }: { title?: string; eyebrow?: string; trailing?: ReactNode }) {
  return (
    <View style={[s.largeTitle, !title && s.eyebrowOnly]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text
            style={[font('footnote', 'semibold'), { color: G.body }]}
            accessibilityRole={title ? undefined : 'header'}
          >
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text style={[font('largeTitle', 'bold'), { color: G.ink, letterSpacing: 0.2 }]} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={s.trailing}>{trailing}</View> : null}
    </View>
  );
}

// ── Content ────────────────────────────────────────────────────

// A card. `flat` draws the plain surface Settings uses instead of a glow.
export function Panel({ children, style, flat = false }: { children: ReactNode; style?: object; flat?: boolean }) {
  return (
    <View style={[s.panel, flat && s.panelFlat, style]}>
      {flat ? null : <CardFill />}
      {children}
    </View>
  );
}

export function PanelTitle({ icon, children }: { icon: IconName; children: string }) {
  return (
    <View style={s.panelTitle}>
      <Icon name={icon} size={20} color={C.text} weight={1.8} />
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
  light,
}: {
  header?: string;
  footer?: string;
  children: ReactNode;
  style?: object;
  // Renders on the white surface instead of the dark record. A variant
  // rather than a second component, because six other screens use these
  // rows and must not move until each is moved deliberately.
  light?: boolean;
}) {
  return (
    <View style={style}>
      {header ? (
        <Text
          style={[font('title2', 'semibold'), s.groupHeader, light && s.groupHeaderLight]}
          accessibilityRole="header"
        >
          {header}
        </Text>
      ) : null}
      <View style={[s.group, light && s.groupLight]}>{children}</View>
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
  light,
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
  // See ListGroup. On the white surface the glyph loses its coloured
  // square: a column of tinted tiles was the busiest thing on the old
  // screen, and ink reads as considered where seven hues read as a legend.
  light?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: light ? G.rule : G.fillSelected }]}
    >
      {icon ? light ? <Icon name={icon} size={20} color={G.ink} /> : <IconSquare icon={icon} color={tint ?? G.ink} /> : null}
      <View style={[s.rowBody, !first && (light ? s.rowSepLight : s.rowSep)]}>
        <View style={{ flex: 1 }}>
          <Text style={[font('body'), { color: destructive ? C.red : light ? G.ink : G.ink }]}>{displayCopy(title)}</Text>
          {sub ? (
            <Text style={[font('footnote'), { color: light ? G.meta : G.body, marginTop: 2 }]}>{displayCopy(sub)}</Text>
          ) : null}
        </View>
        {value ? <Text style={[font('body'), { color: light ? G.meta : G.body }]}>{displayCopy(value)}</Text> : null}
        {selected === undefined ? right : selected ? <Icon name="check" size={20} color={light ? G.ink : G.ink} weight={2} /> : <View style={s.checkBlank} />}
        {selected === undefined && onPress && !destructive ? <ChevronRight light={light} /> : null}
      </View>
    </Pressable>
  );
}

// ── Corner navigation ─────────────────────────────────────────

// The menu, one round button in the bottom right corner, opening the
// places above it. On Today it sits just above the chat card (lift), since
// the chat is how she talks to Ciatta now and there is no other button.
export function CornerNav({
  active,
  onGo,
  lift = 0,
}: {
  active: Tab;
  onGo: (item: MenuItem) => void;
  lift?: number;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const rows = menuFor(active);
  // Out of the way while she types, so it never sits over the box.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setTyping(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setTyping(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (typing) return null;
  return (
    <View style={s.cornerRoot} pointerEvents="box-none">
      {open ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close the menu"
        />
      ) : null}
      <View style={[s.cornerWrap, lift ? { bottom: lift + 10 } : { paddingBottom: Math.max(insets.bottom - 16, 8) }]} pointerEvents="box-none">
        {open ? (
          <View style={[s.card, s.cardPlain, s.menuCard]} accessibilityRole="menu">
            {rows.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => {
                  setOpen(false);
                  onGo(m);
                }}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: m.current }}
                accessibilityLabel={m.label}
                style={({ pressed }) => [s.menuRow, m.current && s.tabOn, pressed && s.pressed]}
              >
                <Icon name={m.icon} size={22} color={m.current ? G.ink : G.meta} weight={1.5} />
                <Text style={[font('body', m.current ? 'semibold' : 'regular'), { color: m.current ? G.ink : G.body, flex: 1 }]}>
                  {m.label}
                </Text>
                {m.current ? <View style={s.menuDot} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={s.cornerButtons}>
          <Pressable
            onPress={() => setOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={open ? 'Close the menu' : 'Open the menu'}
            accessibilityState={{ expanded: open }}
            style={({ pressed }) => [s.track, s.round, pressed && s.pressed]}
          >
            <Icon name={open ? 'xmark' : 'menu'} size={24} color={G.onPill} weight={2} />
          </Pressable>
        </View>
      </View>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderSub,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },

  panel: {
    backgroundColor: L.glass,
    padding: 16,
    overflow: 'hidden', borderRadius: TILE_RADIUS },
  panelFlat: { backgroundColor: G.card },
  panelTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },

  iconSquare: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  // Set as every section heading is: outside the card, Title 2.
  groupHeader: { color: G.ink, marginBottom: 12 },
  groupHeaderLight: { color: G.ink },
  groupLight: {
    backgroundColor: G.card,
    overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: G.rule, borderRadius: TILE_RADIUS },
  rowSepLight: { borderTopColor: G.rule },
  group: {
    backgroundColor: G.card,
    overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: G.rule, borderRadius: TILE_RADIUS },
  groupFooter: { color: G.body, marginTop: 6, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, minHeight: 44 },
  checkBlank: { width: 20 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 11, paddingRight: 16 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: G.rule },

  // The tracking button. White, filled, and the same 60 the bar is tall,
  // so it sits as a peer of the group rather than inside it.
  // The same object as the card beside it, in a different colour.
  //
  // It was 60 square with a heavier shadow, so it sat 4 points shorter
  // than the group and lit differently, and read as a button dropped next
  // to the bar rather than as its pair. Height, radius, hairline and
  // shadow all come from the card now; only the fill differs, which is
  // the one difference that is saying something.
  track: {
    // Wider than it is tall, which is what makes it the same shape rather
    // than merely the same radius. At 64 square a radius of 30 is a
    // circle; the bar is a stadium, its ends semicircular with straight
    // edges between them. 84 gives the plus 24 points of straight edge
    // top and bottom, so the two read as one shape at two widths.
    width: 84,
    height: 64,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: G.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: G.pill,
    shadowColor: G.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  card: {
    flexDirection: 'row',
    padding: 5,
    // Fully rounded against a 60pt bar, so the ends are true half circles
    // rather than a rectangle with soft corners.
    borderRadius: 30,
    // The same hairline every card now carries, so the bar is the same kind
    // of object as the things it sits over.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    overflow: 'hidden',
    // Lifted off the page rather than drawn onto it. Low opacity and a
    // wide spread: a floating bar needs to read as above the content
    // without announcing a shadow.
    shadowColor: G.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardPlain: { backgroundColor: G.card, borderColor: G.rule },

  // The selected tab stands one step above the bar, the way the bar stands
  // one step above the page, and it is edged like a selected tile so the two
  // read as the same kind of selection.
  tabOn: {
    backgroundColor: G.fillSelected,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: G.rule,
  },

  // The corner: a full screen layer that only catches taps while the menu
  // is open, and the buttons and card anchored to its bottom right.
  cornerRoot: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  cornerWrap: { position: 'absolute', right: 0, bottom: 0, paddingRight: 14, alignItems: 'flex-end', gap: 10 },
  cornerButtons: { flexDirection: 'row', gap: 10 },
  round: { width: 60, height: 60, borderRadius: 30 },
  menuCard: { flexDirection: 'column', minWidth: 200, padding: 6, borderRadius: 24 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 14, borderRadius: 18 },
  menuDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: G.ink },
});
