// The screen between connecting and seeing what Ciatta has.
//
// It exists because there is real work to do at that moment, not to make a
// wait look busy. Her answers are written, the readings are counted, and the
// profile is assembled, and each line below ticks when the thing it names
// has actually finished. A progress list that advances on a timer while
// nothing happens is a lie told with a spinner, and it is the easiest lie in
// an app to tell by accident.
//
// So the stages are the real steps in order, and the screen drives them from
// the work rather than from a clock.

export type StageId = 'readings' | 'answers' | 'saved' | 'profile';

export type Stage = { id: StageId; label: string };

function readingsLabel(readings: number): string {
  if (readings === 0) {
    // Nothing came from Apple Health, which is not a failure and must not
    // tick as though data arrived. Most often it means the phone simply
    // holds nothing for these types yet.
    return 'No measurements from Apple Health yet';
  }
  const unit = readings === 1 ? 'measurement' : 'measurements';
  return `Read ${readings.toLocaleString('en-US')} ${unit} from Apple Health`;
}

export function compileStages(readings: number): Stage[] {
  return [
    { id: 'readings', label: readingsLabel(readings) },
    { id: 'answers', label: 'Noted what you told Ciatta today' },
    { id: 'saved', label: 'Saved it to your record' },
    { id: 'profile', label: 'Building your first health profile' },
  ];
}

// The count as she reads it. Separated from the stage copy because the
// screen shows it on its own, large, and a number with no separators at
// five digits is harder to read than the thing it is meant to reassure her
// about.
export function readingsHeadline(readings: number): string {
  return readings.toLocaleString('en-US');
}

// Whether a stage has finished, given how far the work has got. Stages are
// ordered, so one index carries the whole state and no stage can tick before
// the one above it.
export function stageState(stage: StageId, done: StageId | null): 'done' | 'running' | 'waiting' {
  const order: StageId[] = ['readings', 'answers', 'saved', 'profile'];
  const at = order.indexOf(stage);
  const reached = done === null ? -1 : order.indexOf(done);
  if (at <= reached) return 'done';
  if (at === reached + 1) return 'running';
  return 'waiting';
}
