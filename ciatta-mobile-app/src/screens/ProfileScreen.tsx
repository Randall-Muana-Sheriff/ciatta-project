import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { expo } from '../../app.json';
import { aboutYou, person, sources, type SourceKind } from '../data/sample';
import { useNav, type Screen } from '../navigation';
import { C, GUTTER, sans, serif } from '../theme';
import { Card, Expandable, Facts, LinkButton, Row, SecLabel, SecondaryButton, Tag } from '../ui/kit';

const KIND_LABEL: Record<SourceKind, string> = { measured: 'Measured', lab: 'Lab', logged: 'You logged' };

// Where each source's link goes. Devices have no screen of their own yet.
const SOURCE_LINK: Partial<Record<SourceKind, { label: string; screen: Screen }>> = {
  lab: { label: 'See health records', screen: 'healthrecords' },
  logged: { label: 'See what you told Ciatta', screen: 'journal' },
};

// Account, export and sharing flows arrive with the data layer.
const notYet = () => {};

function ToggleRow({
  title,
  sub,
  value,
  onChange,
  first = false,
}: {
  title: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  first?: boolean;
}) {
  return (
    <View style={[p.toggle, !first && p.toggleBorder]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[sans(15), { color: C.text }]}>{title}</Text>
        <Text style={[sans(12), { color: C.muted, marginTop: 2 }]}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.border, true: C.blue }}
        thumbColor={C.white}
        activeThumbColor={C.white}
        ios_backgroundColor={C.border}
        accessibilityLabel={title}
      />
    </View>
  );
}

export function ProfileScreen() {
  const nav = useNav();
  const [open, setOpen] = useState<string | null>(null);
  const [newFindings, setNewFindings] = useState(true);
  const [appointments, setAppointments] = useState(false);

  return (
    <ScrollView style={p.fill} contentContainerStyle={p.body}>
      <Text style={[serif(24), { color: C.text, marginBottom: 20 }]} accessibilityRole="header">
        Profile
      </Text>

      <Card style={p.identity}>
        <View style={p.avatar}>
          <Text style={[serif(26), { color: C.rose }]}>{person.initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[sans(17, 600), { color: C.text }]}>{person.fullName}</Text>
          <Text style={[sans(13), { color: C.secondary }]}>{person.email}</Text>
          <Text style={[sans(12), { color: C.muted, marginTop: 2 }]}>Member since {person.memberSince}</Text>
        </View>
      </Card>

      <SecLabel right={`${sources.length} connected`}>Your sources</SecLabel>
      {sources.map((src, n) => {
        const link = SOURCE_LINK[src.kind];
        return (
          <Expandable
            key={src.name}
            first={n === 0}
            title={src.name}
            sub={`${KIND_LABEL[src.kind]} · ${src.status}`}
            open={open === src.name}
            onToggle={() => setOpen(open === src.name ? null : src.name)}
          >
            <View style={{ marginBottom: 8 }}>
              <Tag label={KIND_LABEL[src.kind]} tone={src.kind} size={10} />
            </View>
            <Facts rows={src.facts} />
            {link ? (
              <LinkButton label={link.label} onPress={() => nav.push(link.screen)} />
            ) : (
              <LinkButton label="Manage access" onPress={notYet} />
            )}
          </Expandable>
        );
      })}
      <View style={p.gapAfterList}>
        <SecondaryButton label="Connect a source" onPress={notYet} />
      </View>

      <SecLabel right="Helps Ciatta read your data">About you</SecLabel>
      {aboutYou.map((row, n) => (
        <Row key={row.label} first={n === 0} title={row.label} value={row.value} valueColor={C.secondary} onPress={notYet} />
      ))}
      <View style={p.section} />

      <SecLabel>Notifications</SecLabel>
      <ToggleRow
        first
        title="When something new is found"
        sub="Only once Ciatta has seen it more than once"
        value={newFindings}
        onChange={setNewFindings}
      />
      <ToggleRow
        title="Before an appointment"
        sub="The day before, so you can prepare"
        value={appointments}
        onChange={setAppointments}
      />
      <Text style={[sans(12), { color: C.muted, marginTop: 8 }]}>
        Ciatta never nudges you to log, and never reminds you to take anything.
      </Text>
      <View style={p.section} />

      <SecLabel>Privacy and data</SecLabel>
      <Row first title="Who can see this" sub="Only you. Nothing is sold or shared." onPress={notYet} />
      <Row title="Share with a clinician" sub="A summary to bring to an appointment" onPress={notYet} />
      <Row title="Download your data" sub="Everything you and your sources gave Ciatta" onPress={notYet} />
      <View style={p.section} />

      <SecLabel>Account</SecLabel>
      <Row first title="Sign out" onPress={notYet} />
      <Row title="Delete account and data" titleColor={C.pinkSevere} onPress={notYet} />

      <Text style={[sans(12), p.version]}>Ciatta {expo.version}</Text>
    </ScrollView>
  );
}

const p = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 32 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.loggedBg + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapAfterList: { paddingTop: 16, marginBottom: 28 },
  section: { height: 28 },
  toggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  toggleBorder: { borderTopWidth: 1, borderTopColor: C.borderSub },
  version: { color: C.muted, textAlign: 'center', marginTop: 32 },
});
