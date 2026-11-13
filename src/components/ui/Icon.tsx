import type { LucideIcon, LucideProps } from "lucide-react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarPlus,
  ChartColumn,
  ChartLine,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  CircleQuestionMark,
  Clock,
  Ellipsis,
  Equal,
  ExternalLink,
  Folder,
  FolderPlus,
  Heart,
  Lightbulb,
  Link,
  LoaderCircle,
  Menu,
  Mic,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Square,
  Star,
  StickyNote,
  Trash2,
  Trophy,
  Undo2,
  Video,
  Wallet,
  ArrowDownLeft,
  ArrowLeftRight,
  Banknote,
  Bus,
  CircleDollarSign,
  Clapperboard,
  CreditCard,
  Dumbbell,
  Eye,
  Flame,
  Timer,
  ChevronDown,
  ChevronUp,
  Minus,
  Play,
  EyeOff,
  GraduationCap,
  HeartPulse,
  House,
  PiggyBank,
  Receipt,
  Repeat,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  UtensilsCrossed,
  X,
} from "lucide-react";

/**
 * Ícones do app (lucide). Sempre importe daqui, nunca de "lucide-react" direto,
 * e nunca use emoji como ícone.
 *
 * Padrão: 20 px, traço 2, `aria-hidden` (decorativo). Passe `label` só quando o
 * ícone sozinho carrega significado (vira role="img" + aria-label). Num botão,
 * quem dá o nome é o botão (IconButton `label`), não o ícone.
 */
export interface IconProps extends Omit<LucideProps, "ref"> {
  /** Nome acessível; sem ele o ícone é decorativo. */
  label?: string;
}

export type IconComponent = ((props: IconProps) => React.JSX.Element) & { displayName?: string };

function make(Lucide: LucideIcon, name: string): IconComponent {
  const C = ({ size = 20, strokeWidth = 2, label, className, ...rest }: IconProps) => (
    <Lucide
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
      className={className ? `shrink-0 ${className}` : "shrink-0"}
      {...rest}
    />
  );
  C.displayName = name;
  return C;
}

// Navegação e abas
export const CalendarIcon = make(Calendar, "CalendarIcon");
export const LightbulbIcon = make(Lightbulb, "LightbulbIcon");
export const ChevronLeftIcon = make(ChevronLeft, "ChevronLeftIcon");
export const ChevronRightIcon = make(ChevronRight, "ChevronRightIcon");
export const ArrowRightIcon = make(ArrowRight, "ArrowRightIcon");
export const CloseIcon = make(X, "CloseIcon");
export const MoreIcon = make(Ellipsis, "MoreIcon");
export const MenuIcon = make(Menu, "MenuIcon");
export const WalletIcon = make(Wallet, "WalletIcon");
export const SettingsIcon = make(Settings, "SettingsIcon");
export const HelpIcon = make(CircleQuestionMark, "HelpIcon");
export const ShieldIcon = make(Shield, "ShieldIcon");
export const DumbbellIcon = make(Dumbbell, "DumbbellIcon");

// Treino (descanso e sequência de semanas)
export const TimerIcon = make(Timer, "TimerIcon");
export const FlameIcon = make(Flame, "FlameIcon");
export const PlayIcon = make(Play, "PlayIcon");
export const MinusIcon = make(Minus, "MinusIcon");
export const ChevronUpIcon = make(ChevronUp, "ChevronUpIcon");
export const ChevronDownIcon = make(ChevronDown, "ChevronDownIcon");

// Captura
export const MicIcon = make(Mic, "MicIcon");
export const SendIcon = make(ArrowUp, "SendIcon");
export const PlusIcon = make(Plus, "PlusIcon");
export const SearchIcon = make(Search, "SearchIcon");

// Ações
export const CheckIcon = make(Check, "CheckIcon");
export const TrashIcon = make(Trash2, "TrashIcon");
export const PencilIcon = make(Pencil, "PencilIcon");
export const PinIcon = make(Pin, "PinIcon");
export const PinOffIcon = make(PinOff, "PinOffIcon");
export const UndoIcon = make(Undo2, "UndoIcon");
export const CalendarPlusIcon = make(CalendarPlus, "CalendarPlusIcon");
export const SpinnerIcon = make(LoaderCircle, "SpinnerIcon");
export const SquareIcon = make(Square, "SquareIcon");

// Conteúdo
export const LinkIcon = make(Link, "LinkIcon");
export const ExternalLinkIcon = make(ExternalLink, "ExternalLinkIcon");
export const ReportIcon = make(ChartLine, "ReportIcon");
export const ChartIcon = make(ChartColumn, "ChartIcon");
export const ClockIcon = make(Clock, "ClockIcon");
export const NoteIcon = make(StickyNote, "NoteIcon");
export const VideoIcon = make(Video, "VideoIcon");
export const FolderIcon = make(Folder, "FolderIcon");
export const FolderPlusIcon = make(FolderPlus, "FolderPlusIcon");

// Áreas (use via AreaTag/areaMeta)
export const BriefcaseIcon = make(Briefcase, "BriefcaseIcon");
export const BookOpenIcon = make(BookOpen, "BookOpenIcon");
export const HeartIcon = make(Heart, "HeartIcon");

// Jogo (dificuldade, nível, medalhas)
export const ArrowDownIcon = make(ArrowDown, "ArrowDownIcon");
export const EqualIcon = make(Equal, "EqualIcon");
export const ArrowUpIcon = make(ArrowUp, "ArrowUpIcon");
export const TrophyIcon = make(Trophy, "TrophyIcon");
export const StarIcon = make(Star, "StarIcon");
export const SparklesIcon = make(Sparkles, "SparklesIcon");
export const ChevronsUpIcon = make(ChevronsUp, "ChevronsUpIcon");

// Financeiro (olho e categorias das movimentações; o mapa categoria → ícone mora em Finance.tsx)
export const EyeIcon = make(Eye, "EyeIcon");
export const EyeOffIcon = make(EyeOff, "EyeOffIcon");
export const UtensilsIcon = make(UtensilsCrossed, "UtensilsIcon");
export const CartIcon = make(ShoppingCart, "CartIcon");
export const HouseIcon = make(House, "HouseIcon");
export const BusIcon = make(Bus, "BusIcon");
export const HealthIcon = make(HeartPulse, "HealthIcon");
export const LeisureIcon = make(Clapperboard, "LeisureIcon");
export const ShoppingBagIcon = make(ShoppingBag, "ShoppingBagIcon");
export const SubscriptionIcon = make(Repeat, "SubscriptionIcon");
export const EducationIcon = make(GraduationCap, "EducationIcon");
export const ReceiptIcon = make(Receipt, "ReceiptIcon");
export const BanknoteIcon = make(Banknote, "BanknoteIcon");
export const IncomeIcon = make(ArrowDownLeft, "IncomeIcon");
export const PiggyBankIcon = make(PiggyBank, "PiggyBankIcon");
export const TransferIcon = make(ArrowLeftRight, "TransferIcon");
export const CreditCardIcon = make(CreditCard, "CreditCardIcon");
export const RefundIcon = make(RotateCcw, "RefundIcon");
export const AdjustIcon = make(SlidersHorizontal, "AdjustIcon");
export const InvestIcon = make(TrendingUp, "InvestIcon");
export const MoneyIcon = make(CircleDollarSign, "MoneyIcon");
