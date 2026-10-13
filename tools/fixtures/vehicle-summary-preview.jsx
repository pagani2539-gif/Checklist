import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/foundation.css';
import '../../src/styles/vehicle-report.css';
import '../../src/styles/report-page-rules.css';
import '../../src/styles/vehicle-snapshot-evidence.css';
import '../../src/styles/vehicle-analytics.css';
import { buildVehicleSnapshotEvidencePages } from '../../src/domain/vehicle-snapshot-evidence.js';
import { VehicleSnapshotEvidencePage } from '../../src/app/reports/VehicleSnapshotEvidence.jsx';
import { VehicleAnalyticsPanel } from '../../src/app/reports/VehicleAnalyticsPanel.jsx';
import './vehicle-summary-preview.css';

const plateRows = [];
const add = (periodHour, status, count, prefix) => {
  for (let index = 0; index < count; index += 1) {
    plateRows.push({
      id: `${prefix}-${index + 1}`,
      occurredAt: `2026-10-12T${periodHour}:00:00+07:00`,
      reviewStatus: status,
    });
  }
};

add('12', 'correct', 99, 'day-correct');
add('12', 'unable-to-verify', 1, 'day-unable');
add('22', 'correct', 81, 'night-correct');
add('22', 'incorrect', 1, 'night-incorrect');
add('22', 'unable-to-verify', 11, 'night-unable');
add('22', 'pending', 7, 'night-pending');

const platePages = buildVehicleSnapshotEvidencePages({ rows: plateRows, outcome: { status: 'passed' } }, { context: 'plate' });
const platePage = platePages
  .find((entry) => entry.kind === 'summary' && entry.period.key === 'all');

const classificationRows = Array.from({ length: 100 }, (_, index) => ({
  id: `class-${index + 1}`,
  occurredAt: '2026-10-12T12:00:00+07:00',
  vehicleClassLabel: index < 60 ? 'รถ 6 ล้อ (15 ตัน)' : 'รถ 10 ล้อ (25 ตัน)',
  classificationReviewStatus: index === 99 ? 'unable-to-verify' : 'correct',
  reviewDetails: { classification: { reasonCode: index === 99 ? 'class-not-visible' : null } },
}));
const classificationPages = buildVehicleSnapshotEvidencePages({ rows: classificationRows, outcome: { status: 'passed' }, supportsClassification: true }, { context: 'classification' });
const classificationPage = classificationPages.find((entry) => entry.kind === 'summary');

function Preview() {
  const [view, setView] = useState('plate');
  const classification = view === 'classification';
  const pages = classification ? classificationPages : platePages;
  const page = classification ? classificationPage : platePage;
  const metadata = classification
    ? { stationName: 'HS · ผลทดสอบการคัดแยกประเภทรถ', documentNo: 'ตัวอย่าง', inspectionDate: '12 ต.ค. 2569' }
    : { stationName: 'IMPS · ผลทดสอบการอ่านป้ายทะเบียน', documentNo: 'ตัวอย่าง', inspectionDate: '12 ต.ค. 2569' };

  return (
    <main className="vehicle-summary-preview">
      <p className="vehicle-summary-preview-label">ตัวอย่างรูปแบบรายงาน · ข้อมูลจำลอง</p>
      <nav className="vehicle-summary-preview-switch" aria-label="เลือกตัวอย่างรายงาน">
        <button type="button" className={view === 'plate' ? 'is-current' : ''} aria-pressed={view === 'plate'} onClick={() => setView('plate')}>ป้ายทะเบียน · กลางวัน/กลางคืน</button>
        <button type="button" className={view === 'classification' ? 'is-current' : ''} aria-pressed={view === 'classification'} onClick={() => setView('classification')}>คัดแยกประเภทรถ</button>
      </nav>
      <div className="ops-print-report vehicle-summary-preview-report" data-report-mode="standard">
        <VehicleSnapshotEvidencePage
          page={page}
          metadata={metadata}
        />
        {classification && <VehicleAnalyticsPanel pages={pages} metadata={metadata} roundId="ตัวอย่าง" />}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Preview />);
