// Ciatta on Today: one card for everything Ciatta says here.
//
// First the check in, when today gives a reason (lib checkIn, shared with
// the push): what changed against her usual, one question, three taps. An
// answer is saved to her timeline and the card says so. Then what Ciatta
// noticed and what she could try, passed in as children so they render
// exactly as they always have.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CheckIn } from '../../supabase/functions/_shared/checkIn';
import { displayCopy } from '../lib/displayCopy';
import { font } from '../theme';
import { AgentAvatar } from './AgentAvatar';
import { CardFill } from './cardFill';
import { L, SPACE, TILE_RADIUS, BLEED } from './surface';

export function CiattaCard({
  checkIn,
  onAnswer,
  answered,
  children,
}: {
  checkIn: CheckIn | null;
  onAnswer: (answer: string | null) => void;
  // What the card says once she has answered, until the day turns.
  answered: string | null;
  children?: ReactNode;
}) {
  return (
    <View style={c.wrap}>
      <View style={c.head}>
        <AgentAvatar size={28} />
        <Text style={[font('subhead', 'semibold'), c.name]}>Ciatta</Text>
      </View>

      {checkIn ? (
        <View style={c.card}>
          <CardFill />
          <Text style={[font('footnote'), c.line]}>{displayCopy(checkIn.line)}</Text>
          <Text style={[font('headline'), c.question]}>{displayCopy(checkIn.question)}</Text>
          <View style={c.answers}>
            {checkIn.answers.map((a) => (
              <Pressable
                key={a}
                onPress={() => onAnswer(a)}
                accessibilityRole="button"
                accessibilityLabel={`${checkIn.question} ${a}`}
                style={({ pressed }) => [c.answer, pressed && c.pressed]}
              >
                <Text style={[font('subhead', 'semibold'), c.answerText]}>{a}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => onAnswer(null)} accessibilityRole="button" hitSlop={8} style={c.later}>
            <Text style={[font('footnote'), c.line]}>Not now</Text>
          </Pressable>
        </View>
      ) : answered ? (
        <View style={c.card}>
          <CardFill />
          <Text style={[font('subhead'), c.question]}>{displayCopy(answered)}</Text>
        </View>
      ) : null}

      {children}
    </View>
  );
}

const c = StyleSheet.create({
  wrap: { marginTop: SPACE.near },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  name: { color: L.ink },
  card: { backgroundColor: L.glass, padding: 16, overflow: 'hidden', ...BLEED },
  line: { color: L.meta, lineHeight: 18 },
  question: { color: L.ink, marginTop: 6, lineHeight: 24 },
  answers: { flexDirection: 'row', gap: 8, marginTop: 14 },
  answer: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: L.rule,
    backgroundColor: L.statement,
  },
  answerText: { color: L.ink },
  later: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 4 },
  pressed: { opacity: 0.55 },
});
