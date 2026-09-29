// Presentation configuration only. Never persisted into an inspection Snapshot.
// Values in this registry are document/template constants; inspection values
// must continue to come from the renderer-neutral report model.
import { getCentralChecklistSectionName, formatCentralNameEnglishFirst } from "./equipment-names.js";
import { BOQ_CHECKLIST_GROUPS } from "./boq-checklist-groups.js";

const reportSectionTitle = (code, fallback) => formatCentralNameEnglishFirst(getCentralChecklistSectionName(code)) || fallback;

export const REPORT_COPY = Object.freeze({
  projectFallback: 'รายงานตรวจหน้างาน',
  coverTitles: Object.freeze({
    standard: 'รายงานตรวจอุปกรณ์ประจำสถานี',
    quick: 'รายงานตรวจงานเฉพาะกิจ',
  }),
  systemTitle: 'Weigh-In-Motion (WIM) · ระบบชั่งน้ำหนักรถขณะเคลื่อนที่',
  systemDescription: 'ตรวจวัดน้ำหนักเพลาและน้ำหนักรวมขณะรถวิ่งผ่านจุดตรวจวัด',
  overviewTitle: 'WIM System Overview · ภาพรวมระบบ WIM',
  footerPrefix: 'รายงานตรวจหน้างาน',
  labels: Object.freeze({
    station: 'สถานี',
    inspectionDate: 'วันที่ตรวจ',
    status: 'ผลตรวจ',
    evidence: 'หลักฐาน',
    details: 'รายละเอียด',
    serial: 'Serial / หมายเลขอุปกรณ์',
    coverAria: 'หน้าปกรายงาน',
    referenceAlt: 'ภาพประกอบรถบรรทุก 6 เพลาผ่านระบบ WIM',
  }),
  status: Object.freeze({
    normal: 'ปกติ',
    issue: 'ต้องติดตาม',
    pending: 'ยังตรวจไม่ครบ',
    empty: 'ไม่มีรายการตรวจ',
    presentationPending: 'อยู่ระหว่างตรวจ',
    presentationComplete: 'เสร็จสมบูรณ์',
    notApplicable: 'ไม่เกี่ยวข้อง',
  }),
  report: Object.freeze({
    aria: Object.freeze({
      standard: 'รายงานผลการตรวจ',
      presentation: 'รายงานพรีเซนต์ผลการตรวจ',
      cover: 'หน้าปกรายงานพรีเซนต์',
      summary: 'สรุปผลรายงานพรีเซนต์',
      scope: 'ขอบเขตการตรวจสอบ',
      gallery: 'ภาพหลักฐานรวม',
    }),
    placeholder: Object.freeze({
      missing: 'ยังไม่ระบุ',
      station: 'ยังไม่ระบุสถานี',
      date: 'ยังไม่ระบุวันที่',
      equipment: 'ยังไม่ระบุอุปกรณ์ / ช่องจราจร',
      note: 'ยังไม่ระบุหมายเหตุ',
      evidenceStatus: 'ยังไม่ได้ระบุ',
      noEvidenceFile: 'ยังไม่มีไฟล์ภาพ',
      noAttachment: 'ไม่มีหลักฐานแนบ',
      noActiveItems: 'ไม่มี BOQ ที่เปิดใช้งานใน Snapshot นี้',
    }),
    attachment: Object.freeze({
      videoAlt: 'วิดีโอแนบหลักฐาน',
      imageAlt: 'ภาพแนบหลักฐาน',
      missingFile: 'ไม่พบไฟล์หลักฐานในเครื่องนี้',
      documentFile: 'ไฟล์เอกสารแนบ',
      attachedFile: 'มีไฟล์หลักฐานแนบ',
      caption: 'หลักฐานแนบ',
      itemImageSource: 'ภาพแนบรายการ',
      pdfReference: 'อ้างอิง PDF:',
    }),
    table: Object.freeze({
      scopeEyebrow: 'CHECKLIST SCOPE',
      scopeTitle: 'ภาพรวมหมวดตรวจ',
      itemCount: 'รายการที่เปิดใช้งาน',
      number: 'ลำดับ',
      description: 'รายการตรวจสอบ',
      status: 'สถานะ',
      details: 'รายละเอียด/หมายเหตุ',
      evidence: 'หลักฐานภาพ',
      enabled: 'เปิดใช้งาน',
      note: 'หมายเหตุ:',
      lanePrefix: 'Lane',
      serialPrefix: 'S/N',
    }),
    summary: Object.freeze({
      aria: 'สรุปผลการตรวจ',
      progress: 'ความคืบหน้า',
      checked: 'ตรวจแล้ว',
      checkedDetail: 'รายการที่บันทึกสถานะแล้ว',
      followUp: 'รายการที่ต้องติดตาม',
      followUpDetail: 'ต้องติดตามต่อ',
      noFollowUp: 'ยังไม่พบรายการที่ต้องติดตาม',
      evidenceComplete: 'หลักฐานครบถ้วน',
    }),
    presentation: Object.freeze({
      brandEyebrow: 'Checklist Operations Hub',
      title: 'รายงานการตรวจสอบภาคสนาม',
      subtitle: 'สรุปหลักฐานและสถานะการปฏิบัติงาน',
      station: 'สถานี',
      inspectionDate: 'วันที่ตรวจสอบ',
      inspectionStatus: 'สถานะการตรวจสอบ',
      progress: 'ความคืบหน้า',
      checkedItems: 'รายการที่ตรวจสอบแล้ว',
      progressDetail: 'รายการที่บันทึกสถานะแล้ว',
      evidenceRecorded: 'หลักฐานที่บันทึก',
      categoryCount: 'หมวดหมู่การตรวจสอบ',
      categoryDetail: 'หมวดที่เปิดใช้งาน',
      scopeTitle: 'ขอบเขตการตรวจสอบ (Checklist Scope)',
      moreCategories: 'หมวด',
      galleryFileCount: 'ไฟล์ภาพ/วิดีโอ',
      noActiveItemsDetail: 'รายงานพรีเซนต์จะแสดงเฉพาะรายการที่เกี่ยวข้องและเปิดใช้งานไว้เท่านั้น',
      reportByStation: 'รายงานตรวจอุปกรณ์ประจำสถานี',
      assetNo: 'Asset No.',
      referenceStation: 'สถานี:',
      referenceDate: 'วันที่ตรวจสอบ:',
      itemPrefix: 'รายการ',
      continuation: 'ต่อ',
      summary: 'สรุปผลรายการตรวจ',
      note: 'หมายเหตุ:',
      snapshotFooter: 'ข้อมูลจาก Inspection Snapshot · ไม่เปลี่ยนแปลงประวัติการตรวจ',
      evidenceCaption: 'หลักฐานตามขั้นตอนการตรวจ',
      evidenceSummary: 'หลักฐานครบ',
      evidenceIncomplete: 'ยังมีช่องที่ต้องติดตาม',
      evidenceComplete: 'หลักฐานครบถ้วน',
      result: 'ผลการตรวจสอบ',
      itemDetails: 'รายละเอียดรายการ',
      equipmentLane: 'อุปกรณ์ / ช่องจราจร',
      serialNote: 'Serial / หมายเหตุ',
      recordedValue: 'ค่าจากรายการตรวจ',
    }),
    document: Object.freeze({
      kicker: 'รอบการตรวจ',
      title: 'รายงานตรวจอุปกรณ์ประจำสถานี',
      brandEyebrow: 'CHECKLIST OPERATIONS HUB',
      formTitle: 'แบบฟอร์มตรวจหน้างาน',
      formCodePrefix: 'รหัสแบบฟอร์ม',
      controlLabels: Object.freeze({
        documentNo: 'เลขที่เอกสาร',
        round: 'รอบการตรวจ',
        inspectionDate: 'วันที่ตรวจ',
        stationCode: 'รหัสสถานี',
        createdAt: 'วันที่จัดทำรายงาน',
      }),
      metadataLabels: Object.freeze({
        project: 'โครงการ',
        station: 'ชื่อสถานี',
        contractNo: 'เลขที่สัญญา',
        closedAt: 'ปิดรอบเมื่อ',
      }),
      noActiveItemsDetail: 'รายงานจะแสดงเฉพาะรายการที่เกี่ยวข้องกับสถานีและเปิดใช้งานไว้เท่านั้น',
      modeA4: 'A4 แนวตั้ง',
      modePresentation: '16:9 แนวนอน',
      presentationTemplateId: 'checklist-report-16x9-presentation-v1',
    }),
  }),
});

// Cover-only presentation metadata. These labels and icons are deliberately
// fixed so user-edited Checklist copy cannot change the visual system legend.
// The cover still filters this catalog through the sections in the selected
// report model, preserving the scope of each immutable Snapshot.
export const REPORT_COVER_SECTION_META = Object.freeze({
  '1.1': Object.freeze({ title: reportSectionTitle('1.1', 'Site Personnel, Vehicles and Work Tools'), icon: 'tools' }),
  '2.1': Object.freeze({ title: reportSectionTitle('2.1', 'WIM Sorting System'), icon: 'sensor' }),
  '2.2': Object.freeze({ title: reportSectionTitle('2.2', 'WIM Control System'), icon: 'settings' }),
  '2.3': Object.freeze({ title: reportSectionTitle('2.3', 'WIM Electronics System'), icon: 'circuit' }),
  '3.1': Object.freeze({ title: reportSectionTitle('3.1', 'License Plate Recognition Control System'), icon: 'scan' }),
  '3.2': Object.freeze({ title: reportSectionTitle('3.2', 'LPR Camera'), icon: 'camera' }),
  '4.1': Object.freeze({ title: reportSectionTitle('4.1', 'CCTV Camera System'), icon: 'video' }),
  '4.2': Object.freeze({ title: reportSectionTitle('4.2', 'Network Video Recorder'), icon: 'server' }),
  '5.1': Object.freeze({ title: reportSectionTitle('5.1', 'Database Management and Reporting System'), icon: 'database' }),
  '5.2': Object.freeze({ title: reportSectionTitle('5.2', 'Display and Data Processing System'), icon: 'chart' }),
  '6.1': Object.freeze({ title: reportSectionTitle('6.1', 'Data Management and Reporting Software'), icon: 'clipboard' }),
  '6.2': Object.freeze({ title: reportSectionTitle('6.2', 'Control Room Cleaning'), icon: 'sparkles' }),
  '6.3': Object.freeze({ title: reportSectionTitle('6.3', 'Control Cabinet and Surrounding Area Cleaning'), icon: 'brush' }),
  '7.1': Object.freeze({ title: reportSectionTitle('7.1', 'Variable Message Sign'), icon: 'display' }),
});

const REPORT_COVER_FORMAT_GROUP_META = Object.freeze({
  SC: Object.freeze({
    "01": "sensor", "02": "display", "03": "scan", "04": "sensor", "05": "display", "06": "database",
  }),
  IMPS: Object.freeze({
    "01": "camera", "02": "sensor", "03": "scan", "04": "scan", "05": "video", "06": "database",
  }),
});

function getFormatQualifiedCoverMeta(code) {
  const match = String(code || "").match(/^(SC|IMPS)-(\d{2})\.(01|02)$/);
  if (!match) return null;
  const [, format, groupNumber, minor] = match;
  const group = BOQ_CHECKLIST_GROUPS[format]?.find((entry) => entry.groupNumber === groupNumber);
  if (!group) return null;
  return {
    title: `${group.title} - ${minor === "01" ? "Equipment" : "Systems & Software"}`,
    icon: REPORT_COVER_FORMAT_GROUP_META[format]?.[groupNumber] || "clipboard",
  };
}

export const REPORT_COVER_STANDARD = Object.freeze({
  // A4-like landscape cover composition from the approved LTP reference.
  // The rest of the standard report remains the existing A4 document flow.
  canvas: Object.freeze({ width: 1672, height: 1188 }),
  aspectRatio: '1672 / 1188',
  maxMastheadTitleLines: 2,
  requiredZones: Object.freeze(['title', 'subtitle', 'description', 'sectionTitle', 'photo', 'sectionList']),
});

export function getReportCoverSections(model) {
  const seen = new Set();
  return (model?.sections || []).flatMap((section) => {
    const code = String(section?.code || '').trim();
    if (!code || seen.has(code)) return [];
    seen.add(code);
    const fixed = REPORT_COVER_SECTION_META[code] || getFormatQualifiedCoverMeta(code);
    return [{
      code,
      title: fixed?.title || section?.title || code,
      icon: fixed?.icon || 'clipboard',
    }];
  });
}

const COMMON_LAYOUT = Object.freeze({
  title: [322, 49, 790, 155],
  subtitle: [322, 180, 790, 48],
  description: [322, 235, 790, 30],
  sectionTitle: [278, 310, 820, 44],
  photo: [278, 354, 820, 598],
  sectionList: [1124, 666, 480, 258],
  logo: [30, 45, 205, 135],
});

export const REPORT_COMPANIES = [
  {
    id: 'ntr',
    name: 'NTR',
    aliases: ['NTR', 'NTR Engineer', 'NTR Engineer Co Ltd', 'เอ็นทีอาร์'],
    logo: 'ntr-logo.jpg',
    coverVariant: 'ntr',
    cover: { ...COMMON_LAYOUT },
    heroCrop: { x: 620, y: 264, width: 1019, height: 643 },
    theme: { ink: '#071d4c', heading: '#102847', accent: '#2d74d8', paper: '#f7fbff', line: '#a5b9d7', accentSoft: '#e8f0fa' },
  },
  {
    id: 'ltp',
    name: 'LTP',
    aliases: ['LTP', 'LTP Engineering', 'แอลทีพี'],
    logo: 'ltp-logo.png',
    coverVariant: 'ltp',
    cover: { ...COMMON_LAYOUT },
    heroCrop: { x: 33, y: 246, width: 945, height: 606 },
    theme: { ink: '#052d5b', heading: '#082e5f', accent: '#ed1b2f', paper: '#fff', line: '#cbd8e8', accentSoft: '#fff0f1' },
  },
  {
    id: 'is8',
    name: 'iSMART',
    aliases: ['IS8', 'iSmart', 'i-SMART', 'ไอสมาร์ท'],
    logo: 'is8-logo.png',
    coverVariant: 'is8',
    cover: { ...COMMON_LAYOUT },
    heroCrop: { x: 42, y: 244, width: 984, height: 549 },
    theme: { ink: '#075394', heading: '#050d18', accent: '#ff741d', paper: '#f7fbff', line: '#799abf', accentSoft: '#eef7ff' },
  },
];

function normalizedCompanyText(value) {
  return String(value || '').toLocaleLowerCase('th-TH').replace(/[^\p{L}\p{N}]+/gu, '');
}

export function getReportCompany(id) {
  return REPORT_COMPANIES.find(company => company.id === id) || REPORT_COMPANIES[0];
}

export function getCompanyContractorMatch(companyId, contractor) {
  const company = getReportCompany(companyId);
  const normalizedContractor = normalizedCompanyText(contractor);
  if (!normalizedContractor) return { status: 'unknown', company, contractor: '' };
  const aliases = [company.name, ...(company.aliases || [])].map(normalizedCompanyText).filter(Boolean);
  const matched = aliases.some((alias) => normalizedContractor.includes(alias) || alias.includes(normalizedContractor));
  return { status: matched ? 'match' : 'mismatch', company, contractor: String(contractor).trim() };
}

export function getCompanyCoverData(model) {
  const { metadata: m, summary: s } = model;
  const items = model.sections.flatMap(section => section.items);
  const reportCover = model.reportCover || {};
  const status = !s.total ? REPORT_COPY.status.empty : s.issues ? REPORT_COPY.status.issue : s.pending ? REPORT_COPY.status.pending : REPORT_COPY.status.normal;
  // Only use recorded notes; a normal status is not an authored inspection note.
  const notes = [...new Set(items.map(item => item.note).filter(Boolean))];
  return {
    station: [m.stationCode, m.stationName].filter(Boolean).join(' · ') || 'ยังไม่ระบุสถานี',
    date: m.inspectionDate || '',
    status,
    tone: !s.total ? 'pending' : s.issues ? 'issue' : s.pending ? 'pending' : 'normal',
    evidence: `${s.evidenceComplete} / ${s.evidenceTotal} ช่อง`,
    details: notes.join(' · ') || 'ไม่ได้ระบุรายละเอียด',
    // A cover represents a whole round, not one arbitrarily selected asset.
    serial: [...new Set(items.map(item => item.serialNo).filter(Boolean))].join(' · ') || 'ยังไม่ระบุ',
    preparedBy: m.preparedBy || 'ยังไม่ระบุ',
    reviewedBy: m.inspector || 'ยังไม่ระบุ',
    project: reportCover.projectName || "",
    reportTitle: reportCover.reportTitle || "",
    isQuickField: Boolean(reportCover.isQuickField),
    coverMeta: reportCover,
    stationCode: m.stationCode || '—',
    stationName: m.stationName || '—',
    province: m.regionNames?.[0] || '—',
    round: m.reportSequence || (m.roundId ? `รอบ ${String(m.roundId).slice(-6)}` : '—'),
    scopeCount: model.sections.length,
    itemCount: s.total || items.length,
    evidenceCount: s.evidenceComplete || 0,
  };
}
