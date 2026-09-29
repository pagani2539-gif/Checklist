import { Children, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon as Icon } from "./icon-system.jsx";

function optionText(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(optionText).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return "";
}

function normalizeCustomSelectOptions(children) {
  const options = [];
  const addOption = (child, groupLabel = "") => {
    if (!isValidElement(child) || child.type !== "option") return;
    options.push({
      value: child.props.value == null ? "" : String(child.props.value),
      content: child.props.children,
      text: optionText(child.props.children),
      groupLabel,
      disabled: Boolean(child.props.disabled),
    });
  };
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "optgroup") {
      Children.forEach(child.props.children, (option) => addOption(option, child.props.label || ""));
      return;
    }
    addOption(child);
  });
  return options.map((option, index) => ({ ...option, key: `${option.value || "empty"}-${index}` }));
}

function getFirstEnabledOptionIndex(options) {
  return options.findIndex((option) => !option.disabled);
}

function getNextEnabledOptionIndex(options, startIndex, direction) {
  if (!options.length) return -1;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (startIndex + (direction * offset) + options.length) % options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
}

export default function CustomSelect({ id, value, onChange, disabled = false, children, label = "", className = "", menuClassName = "", "aria-label": ariaLabel, ...rest }) {
  const generatedId = useId().replace(/:/g, "");
  const triggerId = id || `custom-select-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;
  const options = useMemo(() => normalizeCustomSelectOptions(children), [children]);
  const normalizedValue = value == null ? "" : String(value);
  const selectedIndex = options.findIndex((option) => option.value === normalizedValue);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex >= 0 ? selectedIndex : getFirstEnabledOptionIndex(options));
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef({});

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = Math.max(0, window.innerHeight - rect.bottom - 12);
    const above = Math.max(0, rect.top - 12);
    const openUpward = below < 220 && above > below;
    const available = openUpward ? above : below;
    setMenuStyle({
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      top: openUpward ? "auto" : `${rect.bottom + 6}px`,
      bottom: openUpward ? `${window.innerHeight - rect.top + 6}px` : "auto",
      maxHeight: `${Math.min(320, Math.max(140, available))}px`,
    });
  }, []);

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    setMenuStyle(null);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : getFirstEnabledOptionIndex(options));
    setOpen(true);
  }, [disabled, options, selectedIndex]);

  const chooseOption = useCallback((index) => {
    const option = options[index];
    if (!option || option.disabled) return;
    const nextValue = option.value;
    onChange?.({ target: { value: nextValue }, currentTarget: { value: nextValue } });
    closeMenu(true);
  }, [closeMenu, onChange, options]);

  const moveHighlight = useCallback((direction) => {
    const currentIndex = highlightedIndex >= 0 ? highlightedIndex : getFirstEnabledOptionIndex(options);
    const nextIndex = getNextEnabledOptionIndex(options, currentIndex < 0 ? 0 : currentIndex, direction);
    if (nextIndex < 0) return;
    setHighlightedIndex(nextIndex);
    requestAnimationFrame(() => optionRefs.current[nextIndex]?.scrollIntoView({ block: "nearest" }));
  }, [highlightedIndex, options]);

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : getFirstEnabledOptionIndex(options));
      return undefined;
    }
    updateMenuPosition();
    const handleOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) closeMenu();
    };
    const handleViewportChange = () => updateMenuPosition();
    document.addEventListener("pointerdown", handleOutsidePointer);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [closeMenu, open, options, selectedIndex, updateMenuPosition]);

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      if (!open) openMenu();
      else moveHighlight(1);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      if (!open) openMenu();
      else moveHighlight(-1);
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setHighlightedIndex(getFirstEnabledOptionIndex(options));
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setHighlightedIndex([...options].map((option) => !option.disabled).lastIndexOf(true));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) chooseOption(highlightedIndex);
      else openMenu();
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu(true);
    }
  };

  const rootClasses = ["ops-custom-select", className].filter(Boolean).join(" ");
  const accessibleLabel = ariaLabel || label || selectedOption?.text || "เลือกตัวเลือก";
  const menu = open && menuStyle ? createPortal(
    <div ref={menuRef} id={listboxId} className={`ops-custom-select-menu${menuClassName ? ` ${menuClassName}` : ""}`} role="listbox" aria-label={accessibleLabel} style={menuStyle}>
      {options.map((option, index) => {
        const showGroupLabel = option.groupLabel && (index === 0 || options[index - 1].groupLabel !== option.groupLabel);
        const isSelected = index === selectedIndex;
        const isHighlighted = index === highlightedIndex;
        return <div key={option.key}>
          {showGroupLabel && <div className="ops-custom-select-group" role="presentation">{option.groupLabel}</div>}
          <div
            id={`${listboxId}-option-${index}`}
            ref={(node) => { optionRefs.current[index] = node; }}
            className={`ops-custom-select-option${isHighlighted ? " is-highlighted" : ""}`}
            role="option"
            aria-selected={isSelected}
            aria-disabled={option.disabled || undefined}
            onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => chooseOption(index)}
          >
            <span className="ops-custom-select-option-copy">{option.content}</span>
            {isSelected && <Icon name="check" size="small" />}
          </div>
        </div>;
      })}
    </div>,
    document.body,
  ) : null;

  return <div ref={rootRef} className={rootClasses}>
    <button
      {...rest}
      ref={triggerRef}
      id={triggerId}
      type="button"
      className="ops-custom-select-trigger"
      role="combobox"
      aria-label={accessibleLabel}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={open ? listboxId : undefined}
      aria-activedescendant={open && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
      disabled={disabled}
      onClick={() => (open ? closeMenu() : openMenu())}
      onKeyDown={handleKeyDown}
    >
      <span className={`ops-custom-select-value${selectedOption ? "" : " is-placeholder"}`}>{selectedOption?.content || `เลือก${label || "รายการ"}`}</span>
      <Icon name="chevron-down" size="small" />
    </button>
    {menu}
  </div>;
}
