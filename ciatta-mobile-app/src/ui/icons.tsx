import Svg, { Circle, Path } from 'react-native-svg';

import { C } from '../theme';

// Thin line icons drawn on a 24pt grid to match the reference screens.
type Shape = { d: string } | { c: [number, number, number]; fill?: boolean };

const p = (d: string): Shape => ({ d });
const o = (x: number, y: number, r: number): Shape => ({ c: [x, y, r] });
const dot = (x: number, y: number, r: number): Shape => ({ c: [x, y, r], fill: true });

const ICONS = {
  sparkle: [p('M11 3l1.7 5.3L18 10l-5.3 1.7L11 17l-1.7-5.3L4 10l5.3-1.7z'), p('M18.5 3v4M16.5 5h4'), p('M18 16v4M16 18h4')],
  target: [o(12, 12, 9), o(12, 12, 5), dot(12, 12, 1.6)],
  today: [o(12, 12, 9), dot(12, 12, 1.8)],
  bars: [
    p('M4.5 20v-5a1.5 1.5 0 0 1 3 0v5'),
    p('M9 20v-9a1.5 1.5 0 0 1 3 0v9'),
    p('M13.5 20v-6.5a1.5 1.5 0 0 1 3 0V20'),
    p('M18 20V5.5a1.5 1.5 0 0 1 3 0V20'),
    p('M3 20h19'),
  ],
  journey: [o(4, 17, 2), o(10, 8, 2), o(15, 15, 2), o(20, 6, 2), p('M5.2 15.4l3.6-5.8M11.3 9.6l2.4 3.8M16.1 13.3l2.8-5.6')],
  person: [o(12, 8, 4), p('M4.5 21c.8-4 3.8-6.5 7.5-6.5s6.7 2.5 7.5 6.5')],
  chevronLeft: [p('M15 5l-7 7 7 7')],
  chevronRight: [p('M9 5l7 7-7 7')],
  chevronDown: [p('M5 9l7 7 7-7')],
  arrowRight: [p('M4 12h16M14 6l6 6-6 6')],
  moon: [p('M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z')],
  triangle: [p('M12 4l9 16H3z'), dot(12, 16.5, 0.8)],
  pill: [p('M10.5 20.5a4.95 4.95 0 0 1-7-7l6-6a4.95 4.95 0 0 1 7 7z'), p('M7.5 11.5l5 5')],
  doc: [p('M7 3h7l4 4v14H7z'), p('M14 3v4h4'), p('M10 12h5M10 16h5')],
  chat: [p('M4 5h16v11H10l-4 4v-4H4z'), dot(9, 10.5, 0.9), dot(12, 10.5, 0.9), dot(15, 10.5, 0.9)],
  layers: [p('M12 3l9 4.5-9 4.5-9-4.5z'), p('M3 12l9 4.5 9-4.5'), p('M3 16.5L12 21l9-4.5')],
  plus: [p('M12 5v14M5 12h14')],
  calendar: [p('M4 6h16v15H4z'), p('M4 10h16M8 3v5M16 3v5')],
  calendarPlus: [p('M4 6h16v15H4z'), p('M4 10h16M8 3v5M16 3v5'), p('M12 13v5M9.5 15.5h5')],
  notebook: [p('M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z'), p('M3.5 7h4M3.5 12h4M3.5 17h4'), p('M10 8h6M10 12h6M10 16h4')],
  ringDevice: [p('M12 5c2.8 0 4 1.5 4 4v6c0 2.5-1.2 4-4 4s-4-1.5-4-4V9c0-2.5 1.2-4 4-4z')],
  ruler: [p('M12 3v18'), p('M9 3h6M9 21h6'), p('M12 8h2.5M12 12h3.5M12 16h2.5')],
  drop: [p('M12 3.5s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11z')],
  shield: [p('M12 3l7.5 3v5.5c0 4.8-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.7-7.5-9.5V6z'), p('M12 9v6M9 12h6')],
  stethoscope: [p('M6 3.5H5v5a4 4 0 0 0 8 0v-5h-1'), p('M9 12.5v2.5a4.5 4.5 0 0 0 9 0v-2'), o(18, 11, 2)],
  people: [
    o(12, 7.5, 3),
    o(5.5, 9.5, 2.2),
    o(18.5, 9.5, 2.2),
    p('M7 20c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5'),
    p('M2 18.5c0-2 1.4-3.6 3.5-3.6'),
    p('M22 18.5c0-2-1.4-3.6-3.5-3.6'),
  ],
  bandage: [p('M4.6 14.1l9.5-9.5a3.5 3.5 0 0 1 5 5l-9.5 9.5a3.5 3.5 0 0 1-5-5z'), p('M9.5 9.5l5 5'), dot(11, 13, 0.7), dot(13, 11, 0.7)],
  flower: [o(8, 6, 2.3), o(16, 6, 2.3), o(12, 10.5, 2.3), p('M12 13v8M8 8.5l4 5M16 8.5l-4 5')],
  syringe: [p('M17 3l4 4M19 5l-3 3'), p('M16 8l-9 9-3 1 1-3 9-9z'), p('M3 21l2-2'), p('M10 11l1.5 1.5M12.5 8.5L14 10')],
  hourglass: [p('M6 3h12M6 21h12'), p('M7.5 3c0 4.5 9 5 9 9s-9 4.5-9 9'), p('M16.5 3c0 4.5-9 5-9 9s9 4.5 9 9')],
  leaf: [p('M20 4C11 4 5 8.5 5 15.5c0 1.8.5 3.5.5 3.5s1.8.2 3.5 0C16.5 18 20 12 20 4z'), p('M4 20c3-5 7.5-9 12-12')],
  heart: [p('M12 20s-8-4.8-8-10.8A4.3 4.3 0 0 1 12 6.6a4.3 4.3 0 0 1 8 2.6C20 15.2 12 20 12 20z')],
  kidney: [
    p('M9.5 4C6 4 4 7 4 11s2 9 5 9c2 0 2.5-2 1.5-4s-1-3 .5-4.5S12 4 9.5 4z'),
    p('M14.5 4C18 4 20 7 20 11s-2 9-5 9c-2 0-2.5-2-1.5-4s1-3-.5-4.5S12 4 14.5 4z'),
  ],
  liver: [p('M3 8.5C6 5 15 4 21 6c0 5.5-4.5 11-9.5 11-2 0-2.2-2.8-4.2-3S3 12 3 8.5z')],
  gut: [p('M7 4.5h8.5a3 3 0 0 1 0 6h-7a3 3 0 0 0 0 6h7.5a2.5 2.5 0 0 1 0 5H11')],
  molecule: [o(12, 5, 2), o(5.5, 17, 2), o(18.5, 17, 2), p('M11 6.8l-4.5 8.4M13 6.8l4.5 8.4M7.5 17h9')],
  uterus: [
    p('M8 6c0 3 1.5 4.5 3 5.5V15a1 1 0 0 0 2 0v-3.5c1.5-1 3-2.5 3-5.5'),
    p('M8 6C8 4 6 3.5 4.5 4.5S3.5 8 5 8.5'),
    p('M16 6c0-2 2-2.5 3.5-1.5S20.5 8 19 8.5'),
    p('M12 16v4'),
  ],
  bone: [p('M8 16l8-8'), p('M8 16a2 2 0 1 1-2.6 1A2 2 0 1 1 7 13.4'), p('M16 8a2 2 0 1 1 2.6-1A2 2 0 1 1 17 10.6')],
  thyroid: [p('M12 7v11'), p('M12 10C10 5 4 5 4 10s4 8 8 5c4 3 8 0 8-5s-6-5-8 0')],
  sun: [o(12, 12, 4), p('M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1')],
  virus: [
    o(12, 12, 5.5),
    p('M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M5.6 18.4l2.5-2.5M15.9 8.1l2.5-2.5'),
    dot(10.5, 10.5, 1),
    dot(13.5, 13.5, 1),
  ],
  flask: [p('M9 3h6M10 3v6l-5.4 9.6A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.4-2.4L14 9V3'), p('M7.5 15h9')],
  panels: [p('M4 4h16v16H4z'), p('M4 12h16M12 4v8'), p('M8 16h3')],
  info: [o(12, 12, 9), p('M12 11v5'), dot(12, 8, 0.9)],
  body: [o(12, 5, 2), p('M5 9.5h14'), p('M12 9.5v5.5'), p('M12 15l-3.5 6M12 15l3.5 6')],
  wave: [p('M3 15c2-5 4-5 6-1s4 4 6 0 4-5 6-1')],
  ring: [o(12, 12, 6)],
  // Outline runs around the door, so the filled version keeps it open.
  home: [p('M3.5 11L12 3.8l8.5 7.2V20a1 1 0 0 1-1 1H15v-6.2H9V21H4.5a1 1 0 0 1-1-1z')],
  check: [p('M5 12.5l4.5 4.5L19 7')],
  xmark: [p('M6.5 6.5l11 11M17.5 6.5l-11 11')],
  minus: [p('M5 12h14')],
  clock: [o(12, 12, 9), p('M12 7v5l3.5 2')],
  flame: [p('M12 21c-3.9 0-7-2.8-7-6.6 0-3 2-5.2 3.6-6.8.5 1.6 1.4 2.6 2.4 3.1C11 6.8 12.8 4.4 15 3c-.3 2.7.8 4.6 2.2 6.3C18.4 10.8 19 12.4 19 14.4 19 18.2 15.9 21 12 21z')],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

// `filled` fills closed shapes, the HIG's preferred style for tab bar icons.
export function Icon({
  name,
  size = 22,
  color = C.text,
  weight = 1.5,
  filled = false,
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: number;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {(ICONS[name] as Shape[]).map((s, i) =>
        'c' in s ? (
          <Circle
            key={i}
            cx={s.c[0]}
            cy={s.c[1]}
            r={s.c[2]}
            fill={s.fill || filled ? color : 'none'}
            stroke={s.fill ? 'none' : color}
            strokeWidth={weight}
          />
        ) : (
          <Path
            key={i}
            d={s.d}
            fill={filled ? color : 'none'}
            stroke={color}
            strokeWidth={weight}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </Svg>
  );
}
