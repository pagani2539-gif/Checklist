const statuses = { pending: 'ยังไม่ได้ตรวจ', normal: 'ปกติ', damaged: 'ชำรุด', waiting: 'รอเปลี่ยนทดแทน', 'not-installed': 'ไม่ได้ติดตั้ง', na: 'ไม่เกี่ยวข้อง' };

export default function AcDcLegacyArchive({ archive, renderEvidence, print = false }) {
  if (!archive?.entries?.length) return null;
  const content = <>
    <p>ข้อมูลก่อนเลิกใช้รายการรวม · อ่านอย่างเดียว · ไม่รวมในความคืบหน้าปัจจุบัน</p>
    {archive.entries.map(({ item, value }) => <article key={item.id} className="ops-acdc-archive-entry">
      <h4>{item.displayLabel || item.label}</h4>
      <p>ผลเดิม: {statuses[value.status] || value.status || 'ยังไม่ได้ตรวจ'}{value.value !== '' && value.value != null ? ` · ค่าที่บันทึก ${value.value} ${item.unit || ''}` : ''}</p>
      {value.note && <p>หมายเหตุ: {value.note}</p>}
      {renderEvidence(item, value)}
    </article>)}
  </>;
  return print
    ? <section className="ops-print-section ops-acdc-archive"><h3>รายการเดิมก่อนแยก AC/DC</h3>{content}</section>
    : <details className="ops-panel ops-acdc-archive"><summary>รายการเดิมก่อนแยก AC/DC · {archive.entries.length} รายการ</summary>{content}</details>;
}
