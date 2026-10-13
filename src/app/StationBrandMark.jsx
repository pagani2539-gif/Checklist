/** Station canopy, road lanes, and inspection check; inherits the screen theme. */
export default function StationBrandMark() {
  return <svg className="ops-station-brand-svg" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11 16 5l12 6H4Z" />
    <path d="M7 11v14m18-14v5M4 25h11M12 14v7m6-7v4" />
    <circle cx="23" cy="24" r="6" />
    <path d="m20 24 2 2 4-4" />
  </svg>;
}
