import { useNav } from '../navigation';
import { useData } from '../state/session';
import { DetailScreen, SourceFooter } from '../ui/kit';
import { RecordsView } from '../ui/RecordsView';

// The same records the Health tab's Records view shows, as a screen of its
// own for the places that link here (Evidence, Medications).
export function HealthRecordsScreen() {
  const nav = useNav();
  const { records } = useData();
  return (
    <DetailScreen
      title="Health Records"
      onBack={nav.back}
      footer={records ? <SourceFooter kind="lab" text={records.source} /> : undefined}
    >
      <RecordsView onOpen={nav.push} />
    </DetailScreen>
  );
}
