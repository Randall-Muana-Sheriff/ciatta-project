// One curve, for every line in the app.
//
// Today's day chart has drawn a Catmull Rom spline since it was built, and
// every other chart has drawn straight segments between points. The
// difference was never a decision, only the order things were written in,
// and it showed: the same woman's sleep looked considered on one screen
// and like a seismograph on the next.
//
// The property that makes this spline the right one here is that the curve
// passes through every point. A curve that merely approaches its points
// would be drawing a reading she never had, which is the same failure as
// inventing a number, done with geometry instead of arithmetic. Nothing in
// this file moves a point; it only decides how the ink travels between
// them.

export type Pt = { x: number; y: number };

// A Catmull Rom spline written as cubic beziers.
//
// Lowering the tension is not enough to stop it overshooting. After a
// steep drop into a flat run, the spline's control point falls below both
// ends of the next segment and the curve follows it: on a four point
// series dropping 60 to 10, it reached 6.67 while her lowest reading was
// 10. That is a value she never recorded, drawn with geometry instead of
// arithmetic, and it is the same failure as inventing a number.
//
// So each segment's control points are clamped to that segment's own
// range. A cubic bezier lies inside the convex hull of its control
// points, so clamping the controls guarantees the curve cannot leave the
// band between the two readings it joins. Only y is clamped: x carries
// the smoothness and cannot overshoot into a wrong value.
export function smooth(points: readonly Pt[], tension = 0.9): string {
  if (points.length < 2) return '';
  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    const hold = (v: number) => Math.min(hi, Math.max(lo, v));
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const c1y = hold(p1.y + ((p2.y - p0.y) / 6) * tension);
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const c2y = hold(p2.y - ((p3.y - p1.y) / 6) * tension);
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

// The same curve, for a series with holes in it.
//
// Each run of real values is smoothed on its own and the gaps stay gaps. A
// single spline across a missing week would draw a confident line through
// days that have no reading, which is exactly the thing the gap exists to
// say. A run of one point produces nothing: there is no line through a
// single reading, and a dot is the chart's job rather than the curve's.
export function smoothSegments(points: readonly (Pt | null)[]): string[] {
  const out: string[] = [];
  let run: Pt[] = [];
  for (const p of points) {
    if (p) {
      run.push(p);
      continue;
    }
    if (run.length > 1) out.push(smooth(run));
    run = [];
  }
  if (run.length > 1) out.push(smooth(run));
  return out;
}

// The curve closed down to a baseline, for a wash underneath the line.
export function closed(points: readonly Pt[], baseline: number): string {
  if (points.length < 2) return '';
  const last = points[points.length - 1];
  const first = points[0];
  return `${smooth(points)}L${last.x.toFixed(2)},${baseline.toFixed(2)}L${first.x.toFixed(2)},${baseline.toFixed(2)}Z`;
}
