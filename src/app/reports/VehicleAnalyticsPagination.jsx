import { useEffect, useRef, useState } from 'react';
import { packVehicleAnalyticsRows } from '../../domain/vehicle-analytics-pagination.js';

export function VehicleAnalyticsPagination({ page, presentation, renderPage }) {
  const probe = useRef(null);
  const [layout, setLayout] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const measure = async () => {
      await document.fonts.ready;
      if (cancelled || !probe.current) return;
      await Promise.all([...probe.current.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
      if (cancelled) return;
      try {
        const node = probe.current.querySelector('.snapshot-vehicle-page');
        const table = node.querySelector('table');
        const rows = [...table.querySelectorAll('tbody > tr')];
        const heights = rows.map(row => row.getBoundingClientRect().height);
        const bounds = node.getBoundingClientRect();
        if (!bounds.width) return;
        const ruler = probe.current.querySelector('[data-page-ruler]');
        const outer = node.parentElement;
        // Presentation wrappers reserve their own padding inside the slide.
        const wrapped = outer !== probe.current;
        const outerStyle = wrapped ? getComputedStyle(outer) : null;
        const height = presentation ? (wrapped ? outer.getBoundingClientRect().width * 9 / 16 - parseFloat(outerStyle.paddingTop) - parseFloat(outerStyle.paddingBottom) : bounds.width * 9 / 16) : ruler.getBoundingClientRect().height;
        const overhead = bounds.height - heights.reduce((sum, value) => sum + value, 0);
        const chunks = packVehicleAnalyticsRows(heights, height - overhead - 2);
        setLayout({ chunks });
      } catch (error) { setLayout({ error: error.message }); }
    };
    setLayout(null);
    measure();
    const observer = new ResizeObserver(() => { if (!cancelled) measure(); });
    observer.observe(probe.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [page, presentation]);
  return <>
    <div ref={probe} className="vehicle-analytics-measure" aria-hidden="true">
      <div data-page-ruler />
      {renderPage({ ...page, page: 999, pageCount: 999 })}
    </div>
    {!layout && <p className="no-print" data-analytics-layout="pending">กำลังจัดหน้าตาราง…</p>}
    {layout?.error && <p role="alert" data-analytics-layout="error">{layout.error}</p>}
    {layout?.chunks?.map(([start, end], index) => <div className="vehicle-analytics-rendered-page" key={index}>{renderPage({ ...page, page: index + 1, pageCount: layout.chunks.length, analytics: { ...page.analytics, rows: page.analytics.rows.slice(start, end) } })}</div>)}
  </>;
}
