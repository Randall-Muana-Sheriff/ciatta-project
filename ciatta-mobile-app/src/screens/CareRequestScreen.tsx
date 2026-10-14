// A request of her own clinician: a refill, labs, her records, a referral
// or a question. Ciatta drafts it from her record; she reads it, changes
// it, sends it herself (Share opens her messages, mail or portal app), and
// marks where it stands. Ciatta never sends anything.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { labSuggestions } from '../lib/agent/labSuggest';
import { type CareRequest, careTeam, draftRequest, type RequestStatus, STATUS_LABEL } from '../lib/care';
import { takeRequest } from '../lib/careHandoff';
import { displayCopy } from '../lib/displayCopy';
import { userFacingError } from '../lib/userFacingError';
import { useNav } from '../navigation';
import { useAgentContext } from '../state/agentContext';
import { useData, useRepo } from '../state/session';
import { font } from '../theme';
import { DetailScreen, SaveBar, SecondaryButton, SegmentedControl } from '../ui/kit';
import { L, SPACE } from '../ui/surface';

const STATUSES: RequestStatus[] = ['draft', 'sent', 'answered', 'closed'];
const today = () => new Date().toISOString().slice(0, 10);
const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function CareRequestScreen() {
  const nav = useNav();
  const repo = useRepo();
  const { person } = useData();
  const { context, referrals } = useAgentContext();
  const [open] = useState(() => takeRequest());
  const [request, setRequest] = useState<CareRequest | null>(null);
  const [existing, setExisting] = useState(false);
  const [team, setTeam] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    repo
      .loadCareTeam()
      .then((rows) => setTeam(careTeam({ added: rows, providers: [], referrals, visits: [] }).map((c) => c.name)))
      .catch(() => {});
  }, [repo, referrals]);

  // An existing request, or a new one drafted from her record.
  useEffect(() => {
    if (open?.id) {
      repo
        .loadRequests()
        .then((rows) => {
          const found = rows.find((r) => r.id === open.id);
          if (found) {
            setRequest(found);
            setExisting(true);
          }
        })
        .catch(() => {});
      return;
    }
    const d = open?.draft ?? { kind: 'question' as const };
    const tests = d.tests ?? [];
    const picks = labSuggestions({ symptoms: context.symptoms, labs: context.labs, now: new Date() });
    const med = context.meds.medications.find((m) => d.medication?.toLowerCase().includes(m.name.toLowerCase()));
    const written = draftRequest(d.kind, {
      name: person?.firstName ?? null,
      clinician: d.clinician ?? null,
      medication: d.medication,
      last: med?.last ?? null,
      tests: tests.length ? tests : picks.map((p) => p.test),
      reasons: picks.filter((p) => !tests.length || tests.includes(p.test)).flatMap((p) => p.reasons.slice(0, 1)),
      specialty: referrals[0]?.specialty ?? 'a specialist',
    });
    setRequest({
      id: id(),
      kind: d.kind,
      title: written.title,
      body: written.body,
      clinician: d.clinician ?? null,
      status: 'draft',
      sentOn: null,
      answeredOn: null,
      createdAt: new Date().toISOString(),
    });
    // Drafted once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<CareRequest>) => setRequest((r) => (r ? { ...r, ...patch } : r));
  const statusLabels = useMemo(() => STATUSES.map((x) => STATUS_LABEL[x]), []);

  const save = async () => {
    if (!request) return;
    setSaving(true);
    setNote(null);
    try {
      await repo.saveRequest({
        ...request,
        sentOn: request.status !== 'draft' && !request.sentOn ? today() : request.sentOn,
        answeredOn: request.status === 'answered' && !request.answeredOn ? today() : request.answeredOn,
      });
      nav.back();
    } catch (e) {
      setNote(userFacingError(e, 'That did not save. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  // Sending is hers: the share sheet opens her own messages, mail or
  // portal app with the request in it.
  const send = async () => {
    if (!request) return;
    try {
      const done = await Share.share({ title: request.title, message: request.body });
      if (done.action === Share.sharedAction && request.status === 'draft') set({ status: 'sent', sentOn: today() });
    } catch {
      setNote('Sharing did not open. You can copy the message instead.');
    }
  };

  const remove = async () => {
    if (!request) return;
    setSaving(true);
    try {
      await repo.deleteRequest(request.id);
      nav.back();
    } catch (e) {
      setNote(userFacingError(e, 'That did not remove. Try again.'));
      setSaving(false);
    }
  };

  if (!request) return <DetailScreen title="Request" onBack={nav.back}>{null}</DetailScreen>;

  return (
    <DetailScreen
      title={existing ? 'Request' : 'New Request'}
      onBack={nav.back}
      footer={<SaveBar label={saving ? 'Saving' : 'Save'} disabled={saving || !request.title.trim()} onPress={() => void save()} />}
    >
      <Text style={[font('subhead'), s.lede]}>
        Ciatta drafted this from your record. Read it, change anything, and send it yourself. Ciatta never sends it for you.
      </Text>

      <Text style={[font('footnote'), s.label]}>To</Text>
      <TextInput
        value={request.clinician ?? ''}
        onChangeText={(v) => set({ clinician: v || null })}
        placeholder="Your clinician or their office"
        placeholderTextColor={L.meta}
        style={[font('body'), s.input]}
        accessibilityLabel="To"
      />
      {team.length ? (
        <View style={s.chips}>
          {team.map((name) => (
            <Pressable key={name} onPress={() => set({ clinician: name })} accessibilityRole="button" style={[s.chip, request.clinician === name && s.chipOn]}>
              <Text style={[font('footnote'), s.ink]}>{displayCopy(name)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={[font('footnote'), s.label]}>Subject</Text>
      <TextInput value={request.title} onChangeText={(v) => set({ title: v })} style={[font('body'), s.input]} accessibilityLabel="Subject" />

      <Text style={[font('footnote'), s.label]}>Message</Text>
      <TextInput
        value={request.body}
        onChangeText={(v) => set({ body: v })}
        multiline
        textAlignVertical="top"
        style={[font('body'), s.input, s.body]}
        accessibilityLabel="Message"
      />

      <View style={{ marginTop: SPACE.near }}>
        <SecondaryButton label="Send It Yourself" onPress={() => void send()} />
      </View>

      <Text style={[font('footnote'), s.label]}>Where it stands</Text>
      <SegmentedControl
        segments={statusLabels}
        active={STATUS_LABEL[request.status]}
        onChange={(l) => set({ status: STATUSES[statusLabels.indexOf(l)] })}
      />

      {existing ? (
        <View style={{ marginTop: SPACE.block }}>
          <SecondaryButton label="Remove Request" onPress={() => void remove()} />
        </View>
      ) : null}
      {note ? <Text style={[font('footnote'), s.note]}>{displayCopy(note)}</Text> : null}
    </DetailScreen>
  );
}

const s = StyleSheet.create({
  lede: { color: L.body, lineHeight: 21 },
  label: { color: L.meta, marginTop: SPACE.near, marginBottom: 6 },
  input: { color: L.ink, backgroundColor: L.recessed, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  body: { minHeight: 180 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: L.rule },
  chipOn: { backgroundColor: L.statement, borderColor: L.ink },
  ink: { color: L.ink },
  note: { color: L.meta, marginTop: 10, lineHeight: 18 },
});
