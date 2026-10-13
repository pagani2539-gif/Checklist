import CustomSelect from './CustomSelect.jsx';

export default function PowerSupplyFields({ asset, onChange, disabled = false }) {
  if (!['WIM_TRANSFORMER_24VAC', 'WIM_SWITCHING_DC'].includes(asset?.type)) return null;
  return <fieldset className="ops-serial-fieldset" disabled={disabled}>
    <legend>ชนิดไฟตามป้ายเครื่องจริง</legend>
    {[['powerInputType', 'ไฟขาเข้า']].map(([field, label]) =>
      <label className="ops-field" key={field}><span>{label}</span>
        <CustomSelect aria-label={label} value={asset[field] || ''} disabled={disabled} onChange={event => onChange(field, event.target.value)}>
          <option value="">ยังไม่ระบุ · ตรวจตามป้ายเครื่อง</option>
          <option value="AC">AC · ไฟสลับ</option><option value="DC">DC · ไฟตรง</option>
        </CustomSelect>
      </label>)}
    <p>ไฟขาออก: {asset.type === 'WIM_TRANSFORMER_24VAC' ? 'AC 24VAC' : 'DC ตาม Output ที่เลือก'}</p>
  </fieldset>;
}
