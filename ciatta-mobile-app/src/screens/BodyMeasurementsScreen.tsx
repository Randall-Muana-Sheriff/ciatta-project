// Body measurements: blood type, height, weight and ethnicity, one row
// each, each opening its own sheet. Height and weight show in her units
// (set in Settings or at onboarding); stored once in centimetres and
// kilograms, with the conversions in lib/units.ts.

import { useEffect, useState } from 'react';

import { ethnicityLabel } from '../lib/ethnicity';
import { sexAtBirthLabel } from '../lib/personal';
import { bloodTypeLabel } from '../lib/healthFacts';
import type { BodyManual } from '../lib/overviewFacts';
import { formatHeight, formatWeight } from '../lib/units';
import { useNav } from '../navigation';
import { useRepo } from '../state/session';
import { useUnits } from '../state/units';
import { type BodyField, BodySheet } from '../ui/BodySheet';
import { ListGroup, ListRow } from '../ui/chrome';
import { DetailScreen } from '../ui/kit';

export function BodyMeasurementsScreen() {
  const nav = useNav();
  const repo = useRepo();
  const { units } = useUnits();
  const [body, setBody] = useState<BodyManual | null>(null);
  const [open, setOpen] = useState<BodyField | null>(null);

  useEffect(() => {
    repo.loadBody().then(setBody).catch(() => {});
  }, [repo]);

  const add = 'Add';
  return (
    <DetailScreen title="Body Measurements" onBack={nav.back}>
      <ListGroup footer="Only you can see these. Ciatta uses them to read your ranges and readings in context.">
        <ListRow first title="Sex at Birth" value={sexAtBirthLabel(body?.sex_at_birth) ?? add} onPress={() => setOpen('sex')} />
        <ListRow title="Language" value={body?.language ?? add} onPress={() => setOpen('language')} />
        <ListRow title="Blood Type" value={bloodTypeLabel(body?.blood_type) ?? add} onPress={() => setOpen('blood')} />
        <ListRow title="Height" value={body?.height_cm != null ? formatHeight(body.height_cm, units).value : add} onPress={() => setOpen('height')} />
        <ListRow title="Weight" value={body?.weight_kg != null ? formatWeight(body.weight_kg, units).value : add} onPress={() => setOpen('weight')} />
        <ListRow title="Ethnicity" value={ethnicityLabel(body?.ethnicity) ?? add} onPress={() => setOpen('ethnicity')} />
      </ListGroup>
      <BodySheet field={open} onClose={() => setOpen(null)} onSaved={setBody} />
    </DetailScreen>
  );
}
