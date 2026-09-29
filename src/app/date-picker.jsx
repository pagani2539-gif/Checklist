import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AppIcon as Icon } from "./icon-system.jsx";
import CustomSelect from "./CustomSelect.jsx";
import { formatThaiDate, formatThaiDateTimeInput, getThaiNowDateTimeInput, normalizeThaiDateTimeInput, parseThaiDateTimeInput } from "../domain/date-time.js";

const THAI_WEEKDAYS = Object.freeze(["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"]);
const TIME_HOURS = Object.freeze(Array.from({ length: 24 }, (_, value) => value));
const TIME_MINUTES = Object.freeze(Array.from({ length: 60 }, (_, value) => value));

function dateTimePickerMonthLabel(year, month) {
  return new Intl.DateTimeFormat("th-TH", { calendar: "buddhist", timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month, 1)));
}

function dateTimePickerDateKey(parts) {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function getInitialViewMonth(selected, today) {
  const initial = selected || today;
  return { year: initial?.year || new Date().getFullYear(), month: (initial?.month || new Date().getMonth() + 1) - 1 };
}

function buildCalendarDays(viewMonth) {
  const firstDay = new Date(Date.UTC(viewMonth.year, viewMonth.month, 1)).getUTCDay();
  const totalDays = new Date(Date.UTC(viewMonth.year, viewMonth.month + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((firstDay + totalDays) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(Date.UTC(viewMonth.year, viewMonth.month, index - firstDay + 1));
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      inCurrentMonth: date.getUTCMonth() === viewMonth.month && date.getUTCFullYear() === viewMonth.year,
    };
  });
}

function CalendarPopover({ popoverRef, popoverStyle, accessibleLabel, viewMonth, calendarDays, selectedKey, todayKey, onNavigateMonth, onChooseDate, timePanel, actions, isDateOnly }) {
  if (!popoverStyle) return null;
  return createPortal(
      <div ref={popoverRef} className="ops-date-time-popover" role="dialog" aria-label={accessibleLabel} style={popoverStyle}>
      <div className="ops-date-time-popover-heading">
        <strong>{isDateOnly ? "เลือกวันที่" : "เลือกวันและเวลา"}</strong>
        <span>{isDateOnly ? "ปฏิทินไทย · พุทธศักราช" : "เวลาไทย (UTC+7) · รูปแบบ 24 ชั่วโมง"}</span>
      </div>
      <div className={`ops-date-time-picker-body${timePanel ? "" : " is-date-only"}`}>
        <div className="ops-date-time-calendar" aria-label="ปฏิทิน">
          <div className="ops-date-time-calendar-heading">
            <button type="button" className="ops-date-time-nav" aria-label="เดือนก่อนหน้า" onClick={() => onNavigateMonth(-1)}><Icon name="chevron-left" size="small" /></button>
            <strong aria-live="polite">{dateTimePickerMonthLabel(viewMonth.year, viewMonth.month)}</strong>
            <button type="button" className="ops-date-time-nav" aria-label="เดือนถัดไป" onClick={() => onNavigateMonth(1)}><Icon name="chevron-right" size="small" /></button>
          </div>
          <div className="ops-date-time-weekdays" aria-hidden="true">{THAI_WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="ops-date-time-calendar-grid" role="grid" aria-label={dateTimePickerMonthLabel(viewMonth.year, viewMonth.month)}>
            {calendarDays.map((date) => {
              const dateKey = dateTimePickerDateKey(date);
              const isSelected = dateKey === selectedKey;
              const isToday = dateKey === todayKey;
              return <button key={dateKey} type="button" role="gridcell" className={`ops-date-time-day${date.inCurrentMonth ? "" : " is-outside"}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`} aria-label={`${date.day} ${dateTimePickerMonthLabel(date.year, date.month - 1)}`} aria-current={isToday ? "date" : undefined} aria-pressed={isSelected} onClick={() => onChooseDate(date)}>{date.day}</button>;
            })}
          </div>
        </div>
        {timePanel}
      </div>
      <div className="ops-date-time-popover-actions">{actions}</div>
    </div>,
    document.body,
  );
}

function DatePickerShell({ mode, id, value, onChange, disabled = false, label = "เลือกวันและเวลา", "aria-label": ariaLabel }) {
  const generatedId = useId().replace(/:/g, "");
  const triggerId = id || `thai-date-${generatedId}`;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const selected = parseThaiDateTimeInput(normalizeThaiDateTimeInput(value));
  const today = parseThaiDateTimeInput(getThaiNowDateTimeInput());
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => getInitialViewMonth(selected, today));
  const [popoverStyle, setPopoverStyle] = useState(null);
  const isDateOnly = mode === "date";

  const updatePopoverPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(390, Math.max(280, window.innerWidth - 16));
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    const below = Math.max(0, window.innerHeight - rect.bottom - 12);
    const above = Math.max(0, rect.top - 12);
    const openUpward = below < 420 && above > below;
    setPopoverStyle({
      left: `${left}px`,
      width: `${width}px`,
      top: openUpward ? "auto" : `${rect.bottom + 6}px`,
      bottom: openUpward ? `${window.innerHeight - rect.top + 6}px` : "auto",
      maxHeight: `${Math.min(560, Math.max(300, openUpward ? above : below))}px`,
    });
  }, []);

  const closePicker = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPopoverStyle(null);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openPicker = () => {
    if (disabled) return;
    const basis = selected || today;
    if (basis) setViewMonth({ year: basis.year, month: basis.month - 1 });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    updatePopoverPosition();
    const handleOutsidePointer = (event) => {
      if (rootRef.current?.contains(event.target) || popoverRef.current?.contains(event.target) || event.target.closest?.(".ops-custom-select-menu")) return;
      closePicker();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker(true);
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [closePicker, open, updatePopoverPosition]);

  useEffect(() => {
    if (!open || !selected) return;
    setViewMonth((current) => current.year === selected.year && current.month === selected.month - 1 ? current : { year: selected.year, month: selected.month - 1 });
  }, [open, selected?.month, selected?.year]);

  const calendarDays = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);

  const updateValue = (parts) => {
    if (!parts) return;
    const dateKey = dateTimePickerDateKey(parts);
    if (isDateOnly) {
      onChange?.(dateKey);
      return;
    }
    onChange?.(`${dateKey}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`);
  };

  const chooseDate = (date) => {
    if (isDateOnly) {
      updateValue(date);
      setViewMonth({ year: date.year, month: date.month - 1 });
      closePicker(true);
      return;
    } else {
      const basis = selected || today;
      if (!basis) return;
      updateValue({ ...basis, year: date.year, month: date.month, day: date.day });
    }
    setViewMonth({ year: date.year, month: date.month - 1 });
  };

  const updateTime = (key, nextValue) => {
    const basis = selected || today;
    if (!basis) return;
    updateValue({ ...basis, [key]: Number(nextValue) });
  };

  const navigateMonth = (offset) => {
    const next = new Date(Date.UTC(viewMonth.year, viewMonth.month + offset, 1));
    setViewMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };

  const triggerValue = isDateOnly ? (value ? formatThaiDate(value) : "") : formatThaiDateTimeInput(value);
  const selectedKey = selected ? dateTimePickerDateKey(selected) : "";
  const todayKey = today ? dateTimePickerDateKey(today) : "";
  const accessibleLabel = ariaLabel || label;
  const timePanel = isDateOnly ? null : <div className="ops-date-time-time-panel">
    <span className="ops-date-time-time-label">เวลา</span>
    <div className="ops-date-time-time-controls">
      <label className="ops-date-time-time-control"><span>ชั่วโมง</span><CustomSelect id={`${triggerId}-hour`} value={String(selected?.hour ?? 0)} onChange={(event) => updateTime("hour", event.target.value)} aria-label={`${label} ชั่วโมง`} menuClassName="is-date-time-menu">{TIME_HOURS.map((hour) => <option key={hour} value={String(hour)}>{String(hour).padStart(2, "0")}</option>)}</CustomSelect></label>
      <label className="ops-date-time-time-control"><span>นาที</span><CustomSelect id={`${triggerId}-minute`} value={String(selected?.minute ?? 0)} onChange={(event) => updateTime("minute", event.target.value)} aria-label={`${label} นาที`} menuClassName="is-date-time-menu">{TIME_MINUTES.map((minute) => <option key={minute} value={String(minute)}>{String(minute).padStart(2, "0")}</option>)}</CustomSelect></label>
    </div>
    <strong className="ops-date-time-time-preview">{selected ? `${String(selected.hour).padStart(2, "0")}:${String(selected.minute).padStart(2, "0")} น.` : "ยังไม่ระบุเวลา"}</strong>
  </div>;
  const actions = isDateOnly ? <>
    <button type="button" className="ops-button ops-button-ghost" onClick={() => { onChange?.(""); closePicker(true); }}>ล้างค่า</button>
    <button type="button" className="ops-button ops-button-primary" onClick={() => { updateValue(today); closePicker(true); }}>วันนี้</button>
  </> : <>
    <button type="button" className="ops-button ops-button-ghost" onClick={() => onChange?.("")}>ล้างค่า</button>
    <button type="button" className="ops-button ops-button-primary" onClick={() => closePicker(true)}>เสร็จ</button>
  </>;
  const popover = open ? <CalendarPopover popoverRef={popoverRef} popoverStyle={popoverStyle} accessibleLabel={accessibleLabel} viewMonth={viewMonth} calendarDays={calendarDays} selectedKey={selectedKey} todayKey={todayKey} onNavigateMonth={navigateMonth} onChooseDate={chooseDate} timePanel={timePanel} actions={actions} isDateOnly={isDateOnly} /> : null;

  return <div ref={rootRef} className="ops-date-time-picker" data-datetime-picker data-picker-mode={mode} data-value={value || ""}>
    <button ref={triggerRef} id={triggerId} type="button" className={`ops-date-time-trigger${open ? " is-open" : ""}`} aria-label={accessibleLabel} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => (open ? closePicker() : openPicker())}>
      <span className={`ops-date-time-trigger-value${triggerValue ? "" : " is-placeholder"}`}>{triggerValue || (isDateOnly ? "เลือกวันที่" : "เลือกวันและเวลา")}</span>
      <Icon name="calendar" size="small" />
    </button>
    {popover}
  </div>;
}

export function ThaiDatePicker(props) {
  return <DatePickerShell {...props} mode="date" label={props.label || "เลือกวันที่"} />;
}

export function ThaiDateTimePicker(props) {
  return <DatePickerShell {...props} mode="datetime" />;
}
