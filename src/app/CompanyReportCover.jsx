import { AppIcon as Icon, getReportSectionIconName } from './icon-system.jsx';
import { REPORT_COPY, REPORT_COVER_STANDARD, getReportCompany, getCompanyCoverData, getReportCoverSections } from '../domain/report-companies.js';
import '../styles/company-report.css';

function valueOrDash(value) { return value || '—'; }

function CoverFact({ icon, label, value, tone = '', className = '' }) {
  return <div className={`company-cover-fact ${className} ${tone ? `tone-${tone}` : ''}`.trim()}>
    <Icon name={icon} className="company-cover-fact-icon" />
    <div><dt>{label}</dt><dd>{valueOrDash(value)}</dd></div>
  </div>;
}

function CoverMetric({ icon, value, label, detail, tone = '' }) {
  return <div className={`company-cover-metric ${tone ? `tone-${tone}` : ''}`.trim()}>
    <span className="company-cover-metric-icon"><Icon name={icon} /></span>
    <div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div>
  </div>;
}

function CompanyBrandRail({ company }) {
  return <aside className="company-cover-rail" aria-label={`Brand ${company.name}`}>
    <div className="company-rail-logo"><img data-company-asset src={`/report/companies/${company.logo}`} alt={company.name} /></div>
    <p className="company-rail-kicker">WEIGH-IN-MOTION<br />SOLUTIONS</p>
    <span className="company-rail-rule" aria-hidden="true" />
    <div className="company-rail-values"><span>PEOPLE</span><span>TECHNOLOGY</span><span>ROAD SAFETY</span></div>
    <span className="company-rail-rule" aria-hidden="true" />
    <p className="company-rail-slogan">Accurate Data<br />Safer Roads<br />Stronger Tomorrow</p>
    <Icon name="lane" className="company-rail-mark" aria-hidden="true" />
    <small className="company-rail-footer">{company.name} ENGINEERING<br />THAILAND</small>
  </aside>;
}

function CompanyReportHeader({ company, data, metadata, presentation = false }) {
  const standard = !data.isQuickField;
  return <header className="company-cover-heading">
    <p className="company-cover-lead">{standard ? 'ข้อมูลจริง จากการตรวจอุปกรณ์ประจำสถานี' : 'ข้อมูลจริง เพื่อพื้นที่ปลอดภัยกว่า'}</p>
    <h1>{data.reportTitle}</h1>
    <h2>{standard ? 'WIM Station Equipment Inspection' : 'Independent WIM Field Inspection'}</h2>
    <p className="company-cover-description">{REPORT_COPY.systemDescription}</p>
    {!presentation && <div className={`company-cover-contract${standard ? '' : ' is-quick'}`} aria-label="บริบทหน้าปกรายงาน">
      <span><b>{standard ? 'โครงการ' : 'รายการงาน'}</b>{valueOrDash(data.coverMeta.projectName || data.project || metadata.projectName)}</span>
      {standard ? <span><b>เลขที่สัญญา</b>{valueOrDash(data.coverMeta.contractNo)}</span> : <span>งานเฉพาะกิจ · ไม่ผูกสัญญา</span>}
    </div>}
    <span className="company-cover-heading-rule" aria-hidden="true" />
    <span className="company-cover-company-caption">{company.name} · CHECKLIST OPERATIONS HUB</span>
  </header>;
}

function CoverProjectContractFact({ data, metadata }) {
  const projectName = data.coverMeta.projectName || data.project || metadata.projectName;
  const fields = data.isQuickField
    ? [
      { label: 'รายการงาน', value: projectName },
      { label: 'ประเภท', value: 'งานเฉพาะกิจ · ไม่ผูกสัญญ' },
    ]
    : [
      { label: 'โครงการ', value: projectName },
      { label: 'เลขที่สัญญา', value: data.coverMeta.contractNo },
    ];

  return <div className="company-cover-fact company-cover-project-contract">
    <Icon name="archive" className="company-cover-fact-icon" />
    <div className="company-cover-project-contract-fields">
      {fields.map((field) => <div key={field.label}>
        <dt>{field.label}</dt>
        <dd>{valueOrDash(field.value)}</dd>
      </div>)}
    </div>
  </div>;
}

export default function CompanyReportCover({ model, companyId = 'ntr', draft = false, presentation = false }) {
  const company = getReportCompany(companyId);
  const data = getCompanyCoverData(model);
  const metadata = model.metadata || {};
  const summary = model.summary || {};
  const coverSections = getReportCoverSections(model);
  const crop = company.heroCrop || { x: 0, y: 0, width: 1672, height: 941 };
  const heroStyle = {
    width: `${1672 / crop.width * 100}%`,
    height: `${941 / crop.height * 100}%`,
    left: `${-crop.x / crop.width * 100}%`,
    top: `${-crop.y / crop.height * 100}%`,
  };
  const themeStyle = {
    '--company-ink': company.theme.ink,
    '--company-heading': company.theme.heading || company.theme.ink,
    '--company-accent': company.theme.accent,
    '--company-paper': company.theme.paper,
    '--company-line': company.theme.line,
    '--company-accent-soft': company.theme.accentSoft,
  };
  const metrics = [
    { icon: 'clipboard', value: `${summary.done || 0}/${summary.total || 0}`, label: 'รายการตรวจ', detail: 'รายการที่บันทึกสถานะแล้ว' },
    { icon: 'evidence', value: `${summary.evidenceComplete || 0}/${summary.evidenceTotal || 0}`, label: 'หลักฐานครบ', detail: 'ช่องหลักฐานจาก Snapshot' },
    { icon: 'grid', value: coverSections.length, label: 'หมวดตรวจ', detail: 'หมวดที่เปิดใช้งานในรอบนี้' },
    { icon: 'check', value: `${summary.progress || 0}%`, label: 'ดำเนินการครบถ้วน', detail: summary.issues ? `${summary.issues} รายการต้องติดตาม` : 'ตามขอบเขตการตรวจ' },
  ];
  return <section className={`company-cover company-${company.id} company-cover-${company.coverVariant}${presentation ? ' company-cover-presentation' : ''}`} data-company={company.id} data-cover-standard={REPORT_COVER_STANDARD.aspectRatio} style={{ ...themeStyle, '--company-cover-aspect': REPORT_COVER_STANDARD.aspectRatio, '--company-section-count': Math.max(1, coverSections.length) }} aria-label={`${REPORT_COPY.labels.coverAria} ${company.name}`}>
    <div className="company-canvas">
      <CompanyBrandRail company={company} />
      <CompanyReportHeader company={company} data={data} metadata={metadata} presentation={presentation} />
      <div className={`company-cover-mode-badge${draft ? ' is-draft' : ''}`}><Icon name={draft ? 'edit' : data.isQuickField ? 'checklist' : 'archive'} /><div><strong>{draft ? 'ฉบับร่าง · รอบยังไม่ปิด' : data.isQuickField ? 'งานเฉพาะกิจ · ไม่ผูกสัญญา' : 'รายงานตรวจสถานี'}</strong><small>{draft ? 'DRAFT · INSPECTION IN PROGRESS' : data.isQuickField ? 'AD-HOC INSPECTION · NON-CONTRACT' : 'STATION INSPECTION REPORT'}</small></div></div>
      <section className="company-cover-photo" aria-label={`${REPORT_COPY.labels.referenceAlt} สำหรับ ${company.name} ไม่ใช่ภาพหลักฐาน`}>
        <img data-company-asset alt="" src={`/report/companies/${company.id}-reference.png`} style={heroStyle} />
        <div className="company-cover-photo-caption"><strong>{REPORT_COPY.overviewTitle}</strong><span>ภาพประกอบระบบ WIM · ไม่ใช่ภาพหลักฐาน</span></div>
      </section>
      <aside className="company-cover-facts" aria-label={presentation ? 'ข้อมูลสถานีและสัญญา' : 'ข้อมูลสถานี'}>
          <CoverFact icon="pin" label="รหัสสถานี / ชื่อสถานี" value={`${data.stationCode} · ${data.stationName}`} className={presentation ? 'company-cover-station-fact' : ''} />
          <CoverFact icon="grid" label="จังหวัด / พื้นที่" value={data.province} />
          {presentation && <CoverProjectContractFact data={data} metadata={metadata} />}
      </aside>
      <section className="company-cover-scope" aria-label="ขอบเขตการตรวจ">
        <div className="company-cover-scope-heading"><Icon name="report" /><div><strong>ขอบเขตการตรวจ</strong><small>INSPECTION SCOPE</small></div></div>
        <div className="company-cover-scope-list">
          {coverSections.slice(0, 3).map((section, index) => <div className="company-cover-scope-item" key={section.code}><span>{String(index + 1).padStart(2, '0')}</span><Icon name={getReportSectionIconName(section.icon)} /><strong>{section.title}</strong></div>)}
          {coverSections.length > 3 && <small className="company-cover-scope-more">+ อีก {coverSections.length - 3} หมวดจาก Snapshot</small>}
        </div>
      </section>
      <section className="company-cover-summary" aria-label="สรุปหลักฐานการตรวจ">
        <div className="company-cover-summary-heading"><span><Icon name="search" /></span><div><strong>สรุปหลักฐานการตรวจ</strong><small>EVIDENCE SUMMARY</small></div></div>
        {metrics.map((metric) => <CoverMetric key={metric.label} {...metric} tone={metric.label === 'ดำเนินการครบถ้วน' && summary.issues ? 'issue' : ''} />)}
      </section>
      <footer className="company-cover-footer"><span>ข้อมูลผลตรวจจาก Snapshot · ข้อมูลหน้าปกกรอกแยก</span><span>{company.name} · {data.isQuickField ? 'AD-HOC' : 'STATION INSPECTION'} REPORT</span></footer>
    </div>
  </section>;
}
