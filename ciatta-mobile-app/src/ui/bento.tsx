// The bento grid, as a few small pieces the whole app can be rebuilt on.
//
// A bento is not a grid of cards. The difference is that the tiles are
// different sizes on purpose, and the size says what matters: one thing is
// the point of the screen, two or three support it, the rest are places to
// go. A page where every tile is the same size is a list with corners.
//
// So Tile takes a span rather than a width, Row lays spans out, and nothing
// here knows what a cycle or a reading is. Screens compose meaning; this
// file only knows about edges, gaps and weight.
//
// Editorial, as used here, means three things: one typographic voice per
// level, real space between blocks, and an eyebrow that tells her where she
// is rather than decorating the heading.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { font, GUTTER } from '../theme';
import { Icon, type IconName } from './icons';
import { L, TILE_RADIUS } from './surface';
import { G } from './scheme';

export const BENTO_GAP = 10;

// The eyebrow above a section. Small, spaced, and quiet: it labels the
// block without competing with the heading under it.
export function Eyebrow({ children }: { children: string }) {
  return <Text style={[font('caption1'), s.eyebrow]}>{children.toUpperCase()}</Text>;
}

// The editorial header of a screen: where she is, then what it says.
export function Masthead({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <View style={s.masthead}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Text style={[font('largeTitle'), s.title]} accessibilityRole="header">
        {title}
      </Text>
      {sub ? <Text style={[font('body'), s.sub]}>{sub}</Text> : null}
    </View>
  );
}

// A row of tiles. Children carry their own spans; this only sets the gap,
// so a row of one, two or three tiles needs no special case.
export function BentoRow({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export type TileProps = {
  children: ReactNode;
  // 1 is half the row, 2 is the whole row. Two numbers rather than a
  // flexible scale, because a third size on a phone makes tiles that are
  // too narrow to hold a figure.
  span?: 1 | 2;
  // A tile with somewhere to go reads as pressable and announces itself.
  onPress?: () => void;
  accessibilityLabel?: string;
  // The system's surface.statement: full bleed behind one sentence,
  // sparingly, never a card fill. For the one tile that is the point of the
  // screen, and never for two of them. Pale rather than inked, because the
  // system's emphasis is a change of ground and not a change of weight.
  emphasis?: boolean;
  style?: ViewStyle;
};

export function Tile({ children, span = 1, onPress, accessibilityLabel, emphasis, style }: TileProps) {
  const body = (
    <View style={[s.tileInner, emphasis && s.tileInnerOn]}>{children}</View>
  );
  const common = [s.tile, span === 2 ? s.span2 : s.span1, emphasis && s.tileOn, style];

  if (!onPress) return <View style={common}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [...common, pressed && s.pressed]}
    >
      {body}
    </Pressable>
  );
}

// A label over a figure, which is most of what a bento tile holds.
export function Figure({
  label,
  value,
  note,
  tint,
}: {
  label: string;
  value: string;
  note?: string;
  tint?: string;
}) {
  return (
    <View>
      <Text style={[font('footnote'), s.figureLabel]}>{label}</Text>
      <Text style={[font('title1'), s.figureValue, tint ? { color: tint } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {note ? <Text style={[font('caption1'), s.figureNote]}>{note}</Text> : null}
    </View>
  );
}

// A place to go. The glyph is small and inked rather than tinted: seven
// coloured circles on one screen is the look this redesign is leaving.
export function ActionTile({
  icon,
  title,
  sub,
  span = 1,
  onPress,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  span?: 1 | 2;
  onPress?: () => void;
}) {
  return (
    <Tile span={span} onPress={onPress} accessibilityLabel={sub ? `${title}. ${sub}` : title}>
      <Icon name={icon} size={20} color={L.ink} />
      <Text style={[font('subhead', 'semibold'), s.actionTitle]}>{title}</Text>
      {sub ? (
        <Text style={[font('caption1'), s.actionSub]} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </Tile>
  );
}

const s = StyleSheet.create({
  masthead: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 18 },
  eyebrow: { color: G.meta, letterSpacing: 1.1 },
  title: { color: G.ink, letterSpacing: -0.8, marginTop: 6 },
  sub: { color: G.meta, marginTop: 8, lineHeight: 24 },

  row: { flexDirection: 'row', gap: BENTO_GAP, marginTop: BENTO_GAP },
  tile: {
    borderRadius: TILE_RADIUS,
    backgroundColor: L.recessed,
    overflow: 'hidden',
    // Translucency gives up the edge a solid fill had, so the edge is
    // drawn. Without it a tile has no shape on a ground that varies
    // underneath it.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
  },
  // Half of a row, accounting for the gap between the two.
  span1: { flex: 1, minHeight: 112 },
  span2: { width: '100%' },
  tileOn: { backgroundColor: L.statement, borderColor: L.edgeOn },
  tileInner: { padding: 16, gap: 6 },
  tileInnerOn: {},
  pressed: { opacity: 0.6 },

  figureLabel: { color: L.meta },
  figureValue: { color: L.ink, letterSpacing: -0.6, marginTop: 2 },
  figureNote: { color: L.meta, marginTop: 2 },

  actionTitle: { color: L.ink, marginTop: 4 },
  actionSub: { color: L.meta, lineHeight: 17 },
});
