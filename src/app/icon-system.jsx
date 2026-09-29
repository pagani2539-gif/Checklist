import {
  IconAlertTriangle,
  IconArchive,
  IconArrowRight,
  IconBox,
  IconBrush,
  IconBuilding,
  IconCalendarCheck,
  IconCamera,
  IconChartBar,
  IconCircuitAmmeter,
  IconDeviceCctv,
  IconDeviceGamepad2,
  IconCheck,
  IconChecklist,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconClipboardCheck,
  IconClock,
  IconCpu,
  IconDatabase,
  IconDeviceDesktop,
  IconDeviceDesktopAnalytics,
  IconDeviceFloppy,
  IconDeviceTv,
  IconDots,
  IconEdit,
  IconEye,
  IconFile,
  IconFileDescription,
  IconFilter,
  IconHome,
  IconInfoCircle,
  IconLink,
  IconLayoutGrid,
  IconList,
  IconMapPin,
  IconPhoto,
  IconPlus,
  IconPlugConnected,
  IconPower,
  IconPrinter,
  IconRadar,
  IconRefresh,
  IconRoad,
  IconRouter,
  IconScan,
  IconSearch,
  IconServer,
  IconSettings,
  IconSparkles,
  IconTag,
  IconTargetArrow,
  IconTools,
  IconTrash,
  IconVideo,
  IconWaveSine,
  IconX,
} from "@tabler/icons-react";

const ICON_COMPONENTS = Object.freeze({
  alert: IconAlertTriangle,
  archive: IconArchive,
  arrow: IconArrowRight,
  analytics: IconDeviceDesktopAnalytics,
  brush: IconBrush,
  broom: IconBrush,
  building: IconBuilding,
  calendar: IconCalendarCheck,
  camera: IconCamera,
  chart: IconChartBar,
  check: IconCheck,
  checklist: IconChecklist,
  "chevron-down": IconChevronDown,
  "chevron-left": IconChevronLeft,
  "chevron-right": IconChevronRight,
  circleCheck: IconCircleCheck,
  clipboard: IconClipboardCheck,
  clock: IconClock,
  circuit: IconCircuitAmmeter,
  close: IconX,
  database: IconDatabase,
  delete: IconTrash,
  display: IconDeviceDesktop,
  dots: IconDots,
  edit: IconEdit,
  equipment: IconBox,
  evidence: IconCamera,
  cctv: IconDeviceCctv,
  eye: IconEye,
  file: IconFile,
  filter: IconFilter,
  grid: IconLayoutGrid,
  home: IconHome,
  info: IconInfoCircle,
  lane: IconRoad,
  link: IconLink,
  list: IconList,
  loop: IconLink,
  pin: IconMapPin,
  photo: IconPhoto,
  plus: IconPlus,
  plug: IconPlugConnected,
  power: IconPower,
  preview: IconEye,
  print: IconPrinter,
  refresh: IconRefresh,
  report: IconFileDescription,
  save: IconDeviceFloppy,
  scan: IconScan,
  search: IconSearch,
  sensor: IconRadar,
  joystick: IconDeviceGamepad2,
  router: IconRouter,
  server: IconServer,
  settings: IconSettings,
  sign: IconDeviceTv,
  sparkles: IconSparkles,
  system: IconServer,
  tag: IconTag,
  target: IconTargetArrow,
  tools: IconTools,
  trash: IconTrash,
  video: IconVideo,
  wave: IconWaveSine,
});

const SC_CATEGORY_ICON_NAMES = Object.freeze({
  "2.1": "sensor",
  "2.2": "display",
  "2.3": "circuit",
  "3.1": "settings",
  "3.2": "camera",
  "4.1": "cctv",
  "4.2": "server",
  "5.1": "database",
  "5.2": "analytics",
  "7.1": "sign",
});

const SC_SYSTEM_ICON_NAMES = Object.freeze({
  "wim-sorting": "system",
  "wim-electronics-system": "circuit",
  "wim-control": "display",
});

const SC_TYPE_ICON_NAMES = Object.freeze({
  WIM_SENSOR: "sensor",
  WIM_LOOP: "loop",
  LANE: "lane",
  CABINET: "circuit",
  CONTROL_COMPUTER: "display",
  CONTROL_CABINET: "circuit",
  WIM_AC_DC_POWER_SUPPLY: "plug",
  WIM_NETWORK_EQUIPMENT: "router",
  WIM_CONTROLLER: "display",
  WIM_PHASE_PROTECTION: "power",
  WIM_SUB_BREAKER: "power",
  WIM_SWITCHING_DC: "power",
  WIM_TRANSFORMER_24VAC: "plug",
  LPR_CONTROL_SYSTEM: "system",
  LPR_CAMERA: "camera",
  FIXED_CAMERA: "cctv",
  PTZ_CAMERA: "video",
  NVR: "server",
  DATABASE_SERVER: "database",
  LASER_SCANNER: "scan",
  DIMENSION_CONTROLLER: "scan",
  IMAGE_PROCESSOR: "analytics",
  IMPS_DISPLAY_PROCESSING: "analytics",
  VMS_SIGN: "sign",
  VMS_LIGHT_SENSOR: "wave",
  VMS_DISPLAY: "display",
  JOYSTICK: "joystick",
});

const REPORT_SECTION_ICON_NAMES = Object.freeze({
  tools: "tools",
  sensor: "sensor",
  settings: "settings",
  circuit: "circuit",
  scan: "scan",
  camera: "camera",
  video: "video",
  server: "server",
  database: "database",
  chart: "chart",
  clipboard: "clipboard",
  sparkles: "sparkles",
  brush: "brush",
  display: "display",
});

const REPORT_STATUS_ICON_NAMES = Object.freeze({
  normal: "circleCheck",
  issue: "alert",
  pending: "clock",
});

const SIZE_CLASSES = Object.freeze({
  small: "ops-icon-small",
  large: "ops-icon-large",
});

export function getIconComponent(name) {
  return ICON_COMPONENTS[name] || null;
}

export function getScIconName(name) {
  return SC_TYPE_ICON_NAMES[name] || SC_SYSTEM_ICON_NAMES[name] || SC_CATEGORY_ICON_NAMES[name] || "equipment";
}

export function getEquipmentIconName(type) {
  return SC_TYPE_ICON_NAMES[type] || "equipment";
}

export function getReportSectionIconName(name) {
  return REPORT_SECTION_ICON_NAMES[name] || "clipboard";
}

export function getReportStatusIconName(tone) {
  return REPORT_STATUS_ICON_NAMES[tone] || "clock";
}

export function AppIcon({ name, size = "normal", pixelSize, className = "", stroke = 1.8, style, "aria-label": ariaLabel, ...props }) {
  const Component = getIconComponent(name) || IconAlertTriangle;
  const isMissing = !getIconComponent(name);
  const classes = ["ops-icon", SIZE_CLASSES[size], className].filter(Boolean).join(" ");

  if (isMissing && import.meta.env.DEV) {
    console.warn(`[icon-system] Unknown icon name: ${String(name)}`);
  }

  return <Component
    {...props}
    className={classes}
    size={pixelSize}
    style={{ ...style, ...(pixelSize ? { width: `${pixelSize}px`, height: `${pixelSize}px` } : {}) }}
    stroke={stroke}
    aria-hidden={ariaLabel ? undefined : true}
    aria-label={ariaLabel}
    data-icon-name={name || "unknown"}
    data-icon-missing={isMissing ? String(name || "unknown") : undefined}
  />;
}
