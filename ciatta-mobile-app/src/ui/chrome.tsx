import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView } from 'expo-glass-effect';

import { displayCopy } from '../lib/displayCopy';
import type { Tab } from '../navigation';
import { C, font, fonts, GUTTER } from '../theme';
import { Icon, type IconName } from './icons';
import { GLASS } from './glass';
import { G } from './scheme';
import { L, TILE_RADIUS } from './surface';
import { ChevronRight } from './kit';
import { GlassFill } from './frosted';

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
            style={[font('footnote', 'semibold'), { color: C.secondary }]}
            accessibilityRole={title ? undefined : 'header'}
          >
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text style={[font('headline', 'bold'), { color: C.text }]} accessibilityRole="header">
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
  return <View style={[s.panel, style]}><GlassFill />{children}</View>;
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
          style={[font('title3', 'semibold'), s.groupHeader, light && s.groupHeaderLight]}
          accessibilityRole="header"
        >
          {header}
        </Text>
      ) : null}
      <View style={[s.group, light && s.groupLight]}><GlassFill />{children}</View>
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
      style={({ pressed }) => [s.row, pressed && { backgroundColor: light ? L.rule : C.cardHi }]}
    >
      {icon ? light ? <Icon name={icon} size={20} color={L.ink} /> : <IconSquare icon={icon} color={tint ?? C.tint} /> : null}
      <View style={[s.rowBody, !first && (light ? s.rowSepLight : s.rowSep)]}>
        <View style={{ flex: 1 }}>
          <Text style={[font('body'), { color: destructive ? C.red : light ? L.ink : C.text }]}>{displayCopy(title)}</Text>
          {sub ? (
            <Text style={[font('footnote'), { color: light ? L.meta : C.secondary, marginTop: 2 }]}>{displayCopy(sub)}</Text>
          ) : null}
        </View>
        {value ? <Text style={[font('body'), { color: light ? L.meta : C.secondary }]}>{displayCopy(value)}</Text> : null}
        {selected === undefined ? right : selected ? <Icon name="check" size={20} color={light ? L.ink : C.tint} weight={2} /> : <View style={s.checkBlank} />}
        {selected === undefined && onPress && !destructive ? <ChevronRight light={light} /> : null}
      </View>
    </Pressable>
  );
}

// ── Tab bar ────────────────────────────────────────────────────

// The four she moves between. Profile left this row and lives behind the
// hamburger at the top of Today: it is where she goes to read about
// herself, not somewhere she switches to twenty times a day, and holding
// a seat here it rarely earned pushed Care out of the group.
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Today', icon: 'home' },
  { key: 'myhealth', label: 'Health', icon: 'heart' },
  { key: 'journey', label: 'Journey', icon: 'timeline' },
  { key: 'care', label: 'Care', icon: 'concierge' },
];

// The card beside them is no longer a destination at all. It is the one
// thing on the bar that does something rather than going somewhere, which
// is why it is a different object and why it is the only white surface in
// a dark app: nothing else competes with it, so it reads as the action
// before it is read as a button.

// A floating rounded bar rather than a full width strip, the way Oura's
// sits. Labels and glyphs are untouched: this is where the bar is and what
// shape it is, nothing about what it says.
//
// It floats clear of the home indicator rather than padding itself down to
// meet it, so the rounded edge stays a rounded edge instead of becoming a
// shelf attached to the bottom of the screen.
//
// The bar is the one surface in the app that is glass rather than merely
// translucent, and it is glass for a reason the cards do not have: her own
// content scrolls underneath it. A card sits still over a still ground and
// can transmit it; a bar that transmitted would have her sentences sliding
// through it. Glass diffuses instead. Where there is no glass to be had, it
// falls back to the near opaque fill it has always used, which solves the
// same problem with less grace.
export function BottomNav({
  active,
  onTab,
  onTrack,
}: {
  active: Tab;
  onTab: (tab: Tab) => void;
  onTrack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    // Lower, as iOS floats its own tab bar: into the home indicator's
    // area rather than on top of it, with the indicator still clear below.
    <View style={[s.navWrap, { paddingBottom: Math.max(insets.bottom - 16, 8) }]} pointerEvents="box-none">
      {/*
        Two cards, not one bar with a fifth seat. Same material, same
        radius, same hairline, so they read as two objects of one kind with
        a gap between them rather than as a bar that grew a lump.
      */}
      <Card style={s.navGroup} role="tablist">
        {TABS.map((t) => (
          <TabButton key={t.key} tab={t} on={t.key === active} onPress={() => onTab(t.key)} />
        ))}
      </Card>
      <Pressable
        onPress={onTrack}
        accessibilityRole="button"
        accessibilityLabel="Track something"
        style={({ pressed }) => [s.track, pressed && s.pressed]}
      >
        <Icon name="plus" size={26} color={L.canvas} weight={2} />
      </Pressable>
    </View>
  );
}

// The shared surface of both cards. Glass where there is glass, the old
// near opaque fill where there is not.
function Card({ children, style, role }: { children: ReactNode; style: ViewStyle; role?: 'tablist' }) {
  const Surface = GLASS ? GlassView : View;
  return (
    <Surface
      style={[s.card, GLASS ? s.cardGlass : s.cardPainted, style]}
      accessibilityRole={role}
      // Ignored by the plain View fallback. Regular rather than clear: a
      // clear bar over a washed ground stops being a surface. The scheme
      // is pinned dark because the app is, so the glass cannot resolve
      // light under a system setting the rest of the app ignores.
      {...(GLASS ? ({ glassEffectStyle: 'regular', colorScheme: G.mode } as const) : {})}
    >
      {children}
    </Surface>
  );
}

function TabButton({
  tab,
  on,
  onPress,
  wide = false,
}: {
  tab: { key: Tab; label: string; icon: IconName };
  on: boolean;
  onPress: () => void;
  wide?: boolean;
}) {
  // Ink when selected, meta when not. The selected tab is also the only one
  // sitting on the lifted ground, so the state is carried by the ground
  // rather than by a colour spent on it.
  const color = on ? C.text : C.muted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={tab.label}
      style={[s.tab, wide && s.tabWide, on && s.tabOn]}
    >
      <Icon name={tab.icon} size={24} color={color} weight={1.5} />
      <Text style={[s.tabLabel, { color }]} maxFontSizeMultiplier={1.2}>
        {tab.label}
      </Text>
    </Pressable>
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
    borderRadius: TILE_RADIUS,
    padding: 16,
    overflow: 'hidden',
  },
  panelTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },

  iconSquare: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  groupHeader: { color: C.text, marginBottom: 8 },
  groupHeaderLight: { color: L.ink },
  groupLight: {
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
  },
  rowSepLight: { borderTopColor: L.rule },
  group: {
    backgroundColor: L.glass,
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
  },
  groupFooter: { color: C.secondary, marginTop: 6, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, minHeight: 44 },
  checkBlank: { width: 20 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 11, paddingRight: 16 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.separator },

  // The bar floats: the wrapper holds the safe area, lays the two cards out
  // in a row, and lets taps through to the screen either side of them.
  navWrap: { paddingHorizontal: 14, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  // The four, which share one card and divide its width between them.
  navGroup: { flex: 1 },
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
    backgroundColor: L.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
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
  // Glass brings its own material, so the bar adds no fill of its own: a
  // colour behind glass is a colour the glass then has to see through.
  cardGlass: {},
  // No glass: the old fill, which is nearly opaque because it has to stop
  // the content by itself rather than diffusing it.
  cardPainted: { backgroundColor: G.bar },

  tab: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 25 },
  // Alone in its card, Care has no siblings to divide width with, so it
  // sets its own instead of stretching to fill.
  tabWide: { flex: 0, paddingHorizontal: 16, minWidth: 72 },
  // The selected tab stands one step above the bar, the way the bar stands
  // one step above the page, and it is edged like a selected tile so the two
  // read as the same kind of selection.
  tabOn: {
    backgroundColor: L.fillSelected,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.edgeOn,
  },
  tabLabel: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 13 },
});
