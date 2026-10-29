// Bound the portal to the viewport even when neither side fits a full calendar.
export function getDatePopoverPosition(rect, viewportWidth, viewportHeight) {
  const inset = 8;
  const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
  const width = Math.max(0, Math.min(390, viewportWidth - inset * 2));
  const edge = Math.max(inset, viewportHeight - inset);
  const top = clamp(rect.bottom + 6, inset, edge);
  const bottom = clamp(rect.top - 6, inset, edge);
  const below = Math.max(0, viewportHeight - inset - top);
  const above = Math.max(0, bottom - inset);
  const upward = below < 420 && above > below;
  return {
    left: `${clamp(rect.left, inset, Math.max(inset, viewportWidth - width - inset))}px`,
    width: `${width}px`,
    top: upward ? 'auto' : `${top}px`,
    bottom: upward ? `${viewportHeight - bottom}px` : 'auto',
    maxHeight: `${Math.min(560, upward ? above : below)}px`,
  };
}
