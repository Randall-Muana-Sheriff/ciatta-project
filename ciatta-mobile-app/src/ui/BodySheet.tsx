// One body measure at a time, each in its own sheet: blood type, height,
// weight, ethnicity, and the units everything is shown in. Opened from
// Body Measurements and from the facts on Profile.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { ETHNICITIES } from '../lib/ethnicity';
import { bloodTypeLabel } from '../lib/healthFacts';
import { askForCharacteristics } from '../lib/healthKit';
import type { BodyManual } from '../lib/overviewFacts';
import { heightFromInput, UNIT_LABEL, UNIT_SUB, type Units, weightFromInput } from '../lib/units';
import { userFacingError } from '../lib/userFacingError';
import { useRepo } from '../state/session';
import { useUnits } from '../state/units';
import { font } from '../theme';
import { ListGroup, ListRow } from './chrome';
import { PrimaryButton } from './kit';
import { G } from './scheme';
import { Sheet } from './Sheet';
import { TILE_RADIUS } from './surface';

export type BodyField = 'blood' | 'height' | 'weight' | 'ethnicity' | 'units';

const TITLE: Record<BodyField, string> = { blood: 'Blood Type', height: 'Height', weight: 'Weight', ethnicity: 'Ethnicity', units: 'Units' };
const BLOOD_CODES = [1, 2, 3, 4, 5, 6, 7, 8];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

export function BodySheet({ field, onClose, onSaved }: { field: BodyField | null; onClose: () => void; onSaved?: (b: BodyManual) => void }) {
  const repo = useRepo();
  const { units, choose } = useUnits();
  const [body, setBody] = useState<BodyManual>({});
  const [h, setH] = useState({ cm: '', ft: '', in: '' });
  const [w, setW] = useState({ kg: '', lb: '' });
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!field) return;
    setNote(null);
    repo
      .loadBody()
      .then((b) => {
        const next = b ?? {};
        setBody(next);
        if (next.height_cm != null) {
          const inches = Math.round(next.height_cm / 2.54);
          setH({ cm: String(Math.round(next.height_cm)), ft: String(Math.floor(inches / 12)), in: String(inches % 12) });
        }
        if (next.weight_kg != null) setW({ kg: String(round1(next.weight_kg)), lb: String(round1(next.weight_kg * 2.20462)) });
      })
      .catch(() => {});
  }, [field, repo]);

  const save = async (patch: BodyManual) => {
    const next = { ...body, ...patch };
    try {
      await repo.saveBody(next);
      onSaved?.(next);
      onClose();
    } catch (e) {
      setNote(userFacingError(e, 'That did not save. Try again.'));
    }
  };

  const heightCm = units === 'metric' ? heightFromInput({ cm: h.cm }) : heightFromInput({ ft: h.ft, in: h.in });
  const weightKg = units === 'metric' ? weightFromInput({ kg: w.kg }) : weightFromInput({ lb: w.lb });

  const field_ = (value: string, onChange: (v: string) => void, label: string) => (
    <View style={{ flex: 1 }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder={label}
        placeholderTextColor={G.meta}
        style={[font('title3'), s.input]}
        accessibilityLabel={label}
        autoFocus={label === 'cm' || label === 'ft' || label === 'kg' || label === 'lb'}
      />
      <Text style={[font('footnote'), s.unit]}>{label}</Text>
    </View>
  );

  return (
    <Sheet visible={field !== null} title={field ? TITLE[field] : ''} onDone={onClose}>
      {field === 'blood' ? (
        <ListGroup footer="From a test result, a donor card or Apple Health.">
          {BLOOD_CODES.map((code, n) => (
            <ListRow key={code} first={n === 0} title={bloodTypeLabel(code) ?? ''} selected={body.blood_type === code} onPress={() => void save({ blood_type: code })} />
          ))}
          <ListRow
            title="Read from Apple Health"
            onPress={async () => {
              const t = await askForCharacteristics().catch(() => null);
              if (t?.bloodType) void save({ blood_type: t.bloodType });
              else setNote('Apple Health has no blood type for you. Choose it above.');
            }}
          />
        </ListGroup>
      ) : null}

      {field === 'height' ? (
        <View>
          <View style={s.row}>{units === 'metric' ? field_(h.cm, (cm) => setH((x) => ({ ...x, cm })), 'cm') : (
            <>
              {field_(h.ft, (ft) => setH((x) => ({ ...x, ft })), 'ft')}
              {field_(h.in, (i) => setH((x) => ({ ...x, in: i })), 'in')}
            </>
          )}</View>
          <View style={s.save}>
            <PrimaryButton label="Save" disabled={heightCm == null} onPress={() => heightCm != null && void save({ height_cm: round1(heightCm) })} />
          </View>
        </View>
      ) : null}

      {field === 'weight' ? (
        <View>
          <View style={s.row}>
            {units === 'metric' ? field_(w.kg, (kg) => setW((x) => ({ ...x, kg })), 'kg') : field_(w.lb, (lb) => setW((x) => ({ ...x, lb })), 'lb')}
          </View>
          <View style={s.save}>
            <PrimaryButton
              label="Save"
              disabled={weightKg == null}
              onPress={() => {
                if (weightKg == null) return;
                const changed = body.weight_kg == null || Math.abs(body.weight_kg - weightKg) >= 0.05;
                void save({ weight_kg: round1(weightKg), weight_on: changed ? today() : (body.weight_on ?? today()) });
              }}
            />
          </View>
        </View>
      ) : null}

      {field === 'ethnicity' ? (
        <ListGroup footer="Some reference ranges and risks differ by ancestry. Ciatta uses this only for those.">
          {ETHNICITIES.map((e, n) => (
            <ListRow key={e.id} first={n === 0} title={e.label} selected={body.ethnicity === e.id} onPress={() => void save({ ethnicity: e.id })} />
          ))}
        </ListGroup>
      ) : null}

      {field === 'units' ? (
        <ListGroup footer="Every measure in Ciatta follows this: height, weight, temperature and distance.">
          {(['metric', 'imperial'] as Units[]).map((u, n) => (
            <ListRow
              key={u}
              first={n === 0}
              title={UNIT_LABEL[u]}
              sub={UNIT_SUB[u]}
              selected={units === u}
              onPress={() => {
                void choose(u).then(onClose);
              }}
            />
          ))}
        </ListGroup>
      ) : null}

      {note ? <Text style={[font('footnote'), { color: G.body, marginTop: 10 }]}>{note}</Text> : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  input: { color: G.ink, backgroundColor: G.card, borderRadius: TILE_RADIUS, paddingVertical: 14, paddingHorizontal: 16 },
  unit: { color: G.meta, marginTop: 6, marginLeft: 4 },
  save: { marginTop: 24 },
});
