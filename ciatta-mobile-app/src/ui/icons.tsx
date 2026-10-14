// Lucide, thin stroke, everywhere. One component so every screen moves
// at once; the names are Ciatta's own, mapped to the nearest Lucide glyph.
// Lucide has no organ set, so the body systems take the closest symbol:
// Venus for reproductive, a bean for kidney, a funnel for liver, a bowl for
// gut, wind for lungs, a spark for thyroid.

import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react-native';

import ActivityIcon from 'lucide-react-native/icons/activity';
import ArrowRightIcon from 'lucide-react-native/icons/arrow-right';
import AtomIcon from 'lucide-react-native/icons/atom';
import AudioWaveformIcon from 'lucide-react-native/icons/audio-waveform';
import BandageIcon from 'lucide-react-native/icons/bandage';
import BeanIcon from 'lucide-react-native/icons/bean';
import BedIcon from 'lucide-react-native/icons/bed';
import BoneIcon from 'lucide-react-native/icons/bone';
import BookmarkIcon from 'lucide-react-native/icons/bookmark';
import BrainIcon from 'lucide-react-native/icons/brain';
import BugIcon from 'lucide-react-native/icons/bug';
import CalendarIcon from 'lucide-react-native/icons/calendar';
import CalendarPlusIcon from 'lucide-react-native/icons/calendar-plus';
import CameraIcon from 'lucide-react-native/icons/camera';
import ChartColumnIcon from 'lucide-react-native/icons/chart-column';
import CheckIcon from 'lucide-react-native/icons/check';
import ChevronDownIcon from 'lucide-react-native/icons/chevron-down';
import ChevronLeftIcon from 'lucide-react-native/icons/chevron-left';
import ChevronRightIcon from 'lucide-react-native/icons/chevron-right';
import CircleIcon from 'lucide-react-native/icons/circle';
import CircleDotIcon from 'lucide-react-native/icons/circle-dot';
import ClockIcon from 'lucide-react-native/icons/clock';
import CloudIcon from 'lucide-react-native/icons/cloud';
import CoffeeIcon from 'lucide-react-native/icons/coffee';
import DropletIcon from 'lucide-react-native/icons/droplet';
import DropletsIcon from 'lucide-react-native/icons/droplets';
import DumbbellIcon from 'lucide-react-native/icons/dumbbell';
import FileTextIcon from 'lucide-react-native/icons/file-text';
import FunnelIcon from 'lucide-react-native/icons/funnel';
import FlameIcon from 'lucide-react-native/icons/flame';
import FlaskConicalIcon from 'lucide-react-native/icons/flask-conical';
import Flower2Icon from 'lucide-react-native/icons/flower-2';
import FootprintsIcon from 'lucide-react-native/icons/footprints';
import GlassWaterIcon from 'lucide-react-native/icons/glass-water';
import HeartIcon from 'lucide-react-native/icons/heart';
import HeartPulseIcon from 'lucide-react-native/icons/heart-pulse';
import HourglassIcon from 'lucide-react-native/icons/hourglass';
import HouseIcon from 'lucide-react-native/icons/house';
import ImageIcon from 'lucide-react-native/icons/image';
import InfoIcon from 'lucide-react-native/icons/info';
import LayersIcon from 'lucide-react-native/icons/layers';
import LayoutPanelLeftIcon from 'lucide-react-native/icons/layout-panel-left';
import LeafIcon from 'lucide-react-native/icons/leaf';
import MenuIcon from 'lucide-react-native/icons/menu';
import MessageCircleIcon from 'lucide-react-native/icons/message-circle';
import MicIcon from 'lucide-react-native/icons/mic';
import MinusIcon from 'lucide-react-native/icons/minus';
import MoonIcon from 'lucide-react-native/icons/moon';
import NotebookPenIcon from 'lucide-react-native/icons/notebook-pen';
import PersonStandingIcon from 'lucide-react-native/icons/person-standing';
import PillIcon from 'lucide-react-native/icons/pill';
import PlaneIcon from 'lucide-react-native/icons/plane';
import PlusIcon from 'lucide-react-native/icons/plus';
import RouteIcon from 'lucide-react-native/icons/route';
import RulerIcon from 'lucide-react-native/icons/ruler';
import SearchIcon from 'lucide-react-native/icons/search';
import SendIcon from 'lucide-react-native/icons/send';
import ShieldIcon from 'lucide-react-native/icons/shield';
import SoupIcon from 'lucide-react-native/icons/soup';
import SparklesIcon from 'lucide-react-native/icons/sparkles';
import SquareIcon from 'lucide-react-native/icons/square';
import StethoscopeIcon from 'lucide-react-native/icons/stethoscope';
import SunIcon from 'lucide-react-native/icons/sun';
import SyringeIcon from 'lucide-react-native/icons/syringe';
import TargetIcon from 'lucide-react-native/icons/target';
import ThermometerIcon from 'lucide-react-native/icons/thermometer';
import ThumbsDownIcon from 'lucide-react-native/icons/thumbs-down';
import ThumbsUpIcon from 'lucide-react-native/icons/thumbs-up';
import ToiletIcon from 'lucide-react-native/icons/toilet';
import TimelineIcon from 'lucide-react-native/icons/timeline';
import ConciergeBellIcon from 'lucide-react-native/icons/concierge-bell';
import TriangleIcon from 'lucide-react-native/icons/triangle';
import UserIcon from 'lucide-react-native/icons/user';
import UsersIcon from 'lucide-react-native/icons/users';
import UtensilsIcon from 'lucide-react-native/icons/utensils';
import VenusIcon from 'lucide-react-native/icons/venus';
import VideoIcon from 'lucide-react-native/icons/video';
import WatchIcon from 'lucide-react-native/icons/watch';
import WavesHorizontalIcon from 'lucide-react-native/icons/waves-horizontal';
import WindIcon from 'lucide-react-native/icons/wind';
import XIcon from 'lucide-react-native/icons/x';
import ZapIcon from 'lucide-react-native/icons/zap';

import { C } from '../theme';

const ICONS = {
  sparkle: SparklesIcon,
  target: TargetIcon,
  today: CircleDotIcon,
  bars: ChartColumnIcon,
  journey: RouteIcon,
  person: UserIcon,
  mic: MicIcon,
  stopSquare: SquareIcon,
  send: SendIcon,
  camera: CameraIcon,
  image: ImageIcon,
  video: VideoIcon,
  chevronLeft: ChevronLeftIcon,
  chevronRight: ChevronRightIcon,
  chevronDown: ChevronDownIcon,
  arrowRight: ArrowRightIcon,
  moon: MoonIcon,
  thumbUp: ThumbsUpIcon,
  thumbDown: ThumbsDownIcon,
  bookmark: BookmarkIcon,
  cup: CoffeeIcon,
  glass: GlassWaterIcon,
  utensils: UtensilsIcon,
  plane: PlaneIcon,
  dumbbell: DumbbellIcon,
  cloud: CloudIcon,
  zigzag: ActivityIcon,
  bubbles: WavesHorizontalIcon,
  toilet: ToiletIcon,
  sleep: BedIcon,
  steps: FootprintsIcon,
  heartPulse: HeartPulseIcon,
  dropPulse: DropletsIcon,
  thermometer: ThermometerIcon,
  oxygen: WindIcon,
  triangle: TriangleIcon,
  pill: PillIcon,
  doc: FileTextIcon,
  chat: MessageCircleIcon,
  layers: LayersIcon,
  plus: PlusIcon,
  menu: MenuIcon,
  search: SearchIcon,
  calendar: CalendarIcon,
  calendarPlus: CalendarPlusIcon,
  notebook: NotebookPenIcon,
  ringDevice: WatchIcon,
  ruler: RulerIcon,
  drop: DropletIcon,
  shield: ShieldIcon,
  stethoscope: StethoscopeIcon,
  people: UsersIcon,
  bandage: BandageIcon,
  flower: Flower2Icon,
  syringe: SyringeIcon,
  hourglass: HourglassIcon,
  leaf: LeafIcon,
  lungs: WindIcon,
  brain: BrainIcon,
  heart: HeartIcon,
  kidney: BeanIcon,
  liver: FunnelIcon,
  gut: SoupIcon,
  molecule: AtomIcon,
  uterus: VenusIcon,
  bone: BoneIcon,
  thyroid: ZapIcon,
  sun: SunIcon,
  virus: BugIcon,
  flask: FlaskConicalIcon,
  panels: LayoutPanelLeftIcon,
  info: InfoIcon,
  body: PersonStandingIcon,
  wave: AudioWaveformIcon,
  ring: CircleIcon,
  home: HouseIcon,
  check: CheckIcon,
  xmark: XIcon,
  minus: MinusIcon,
  clock: ClockIcon,
  flame: FlameIcon,
  timeline: TimelineIcon,
  concierge: ConciergeBellIcon,
} satisfies Record<string, ComponentType<LucideProps>>;

export type IconName = keyof typeof ICONS;

// `filled` fills closed shapes, for a selected tab or a saved bookmark.
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
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} strokeWidth={weight} fill={filled ? color : 'none'} absoluteStrokeWidth={false} />;
}
