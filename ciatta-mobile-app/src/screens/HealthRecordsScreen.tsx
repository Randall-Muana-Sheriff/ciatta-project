import { useNav } from '../navigation';
import { useData } from '../state/session';
import { DetailScreen, SourceFooter } from '../ui/kit';
import { RecordsView } from '../ui/RecordsView';

// The same records the Health tab's Records view shows, as a screen of its
// own for the places that link here (Evidence, Medications).
export function HealthRecordsScreen() {
  const nav = useNav();
  return (
    <DetailScreen
      title="Health Records"
      onBack={nav.back}
      footer={<SourceFooter kind="lab" text="From your providers, and the lab reports and records you added." />}
    >
      <RecordsView onOpen={nav.push} />
    </DetailScreen>
  );
}
