import { getVehicleReportScore, VEHICLE_REPORT_STATUS_LABELS } from '../../domain/vehicle-report-summary.js';
import { getVehicleChartMaximum } from '../../domain/vehicle-snapshot-evidence.js';
import { AppIcon } from '../icon-system.jsx';

const VEHICLE_REPORT_STATUS_ORDER = ['correct', 'incorrect', 'unable-to-verify', 'pending'];
const VEHICLE_REPORT_STATUS_COLORS = {
  correct: '#16a36a',
  incorrect: '#e05260',
  'unable-to-verify': '#e7a22c',
  pending: '#8a9bb3',
};

export function VehicleReportGeometry() {
  return <svg className="vehicle-report-geometry" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true"><g fill="#e8f5ff" stroke="#cce8fc" strokeWidth="1"><path d="M0 0H120L170 80 120 160H20L0 120Z" /><path d="M60 0H160L210 80 160 160H60L10 80Z" fill="none" /><path d="M1100 0H1200V130L1150 160 1050 100Z" /><path d="M0 670 70 630 140 670V750L70 790 0 750Z" /><path d="M1060 680 1130 640 1200 680V760L1130 800 1060 760Z" /><path d="M1150 580 1200 550V660L1150 690 1100 660V610Z" fill="none" /></g><path d="M0 220 150 130M0 250 180 145M1020 800 1200 690" stroke="#d8edfc" fill="none" /></svg>;
}

export function VehicleHexSummary({ page }) {
  const periods = page.periods || [page];
  const maximum = getVehicleChartMaximum(periods);
  const ticks = Array.from({ length: 6 }, (_, index) => maximum * index / 5);
  const classification = page.dimension === 'classification';

  return <div className={`vehicle-period-summary${periods.length === 1 ? ' is-single' : ''}${classification ? ' is-classification' : ''}`} data-vehicle-dimension={page.dimension || 'plate'}>
    {periods.map(period => {
      const periodKey = period.period.key;
      const night = periodKey === 'night';
      const knownPeriod = periodKey === 'day' || night;
      const periodClass = classification ? 'is-classification' : night ? 'is-night' : periodKey === 'day' ? 'is-day' : 'is-unknown';
      const { correct, decided, pending, evidencePolicy, accuracy, display, status, reason } = getVehicleReportScore(period);
      const groups = VEHICLE_REPORT_STATUS_ORDER.map(key => period.groups?.find(group => group.key === key) || { key, color: VEHICLE_REPORT_STATUS_COLORS[key], entries: [] });
      const percentage = count => period.total ? `${(count / period.total * 100).toFixed(2)}%` : '—';
      const groupCount = group => group.entries?.length || 0;
      const periodIcon = classification ? 'truck' : night ? 'moon-stars' : knownPeriod ? 'sun-filled' : 'clock';
      const summaryTitle = classification ? 'ผลคัดแยกประเภทรถ' : period.period.label;
      const chartDescription = `${summaryTitle}: ${groups.map(group => `${VEHICLE_REPORT_STATUS_LABELS[group.key]} ${groupCount(group)} รายการ (${percentage(groupCount(group))})`).join(', ')}; สเกล 0 ถึง ${maximum} รายการ`;
      return <section key={periodKey} className={`vehicle-period-analysis ${periodClass}`} aria-label={classification ? summaryTitle : `ผลตรวจ${period.period.label}`}>
        <header className={`vehicle-summary-heading${classification ? ' is-classification' : ''}`}>
          {classification
            ? <div className="vehicle-summary-period is-classification">
                <AppIcon name={periodIcon} size="large" />
                <div className="vehicle-summary-period-copy">
                  <span>{summaryTitle}</span>
                </div>
              </div>
            : <div className="vehicle-summary-period">
                <AppIcon name={periodIcon} size="large" />
                <span>{period.period.label}</span>
              </div>}
          <div className={`vehicle-summary-score${classification ? ' is-classification' : ''}`}>
            <span>{classification ? 'ความถูกต้องในการคัดแยก' : 'ความถูกต้อง'}</span>
            <strong>{display}</strong>
            <p>{accuracy === null ? 'ยังไม่มีผลตัดสิน' : `ถูกต้อง ${correct} จาก ${period.total} รายการ`}</p>
          </div>
        </header>

        <div className="vehicle-count-chart" role="img" aria-label={chartDescription}>
          {groups.map(group => {
            const count = groupCount(group);
            const barWidth = period.total ? `${count / maximum * 100}%` : '0%';
            return <div className={`vehicle-count-row is-${group.key}`} key={group.key}>
              <span>{VEHICLE_REPORT_STATUS_LABELS[group.key]}</span>
              <div className="vehicle-count-track" aria-hidden="true">
                <div className="vehicle-count-bar" style={{ width: barWidth, backgroundColor: group.color || VEHICLE_REPORT_STATUS_COLORS[group.key] }} />
              </div>
              <strong className="vehicle-count-value">{count} รายการ · {percentage(count)}</strong>
            </div>;
          })}
          <div className="vehicle-count-axis" aria-hidden="true">
            <span />
            <div>{ticks.map(tick => <span key={tick}>{tick}</span>)}</div>
            <span />
          </div>
          <p className="vehicle-count-unit">สัดส่วนแต่ละกลุ่มเทียบกับรายการทั้งหมดในชุดนี้</p>
        </div>

        <div className="vehicle-accuracy-caption">
          <strong>{status}</strong>
          <span>เกณฑ์ ≥ {Number(period.threshold).toFixed(2)}% · ฐานคำนวณถูกต้อง {correct} / {period.total} รายการ (รวมตรวจไม่ได้และรอตรวจสอบ)</span>
          {reason && <span>{reason}</span>}
          <small>{evidencePolicy ? 'ต้องมีข้อมูลพร้อมคิดคะแนนอย่างน้อย 100 รายการจึงมีสิทธิ์ผ่าน' : 'การผ่านรอบยังต้องพิจารณาจำนวน/เวลาและรายการที่ไม่สามารถตรวจสอบได้'}</small>
        </div>
      </section>;
    })}
  </div>;
}
