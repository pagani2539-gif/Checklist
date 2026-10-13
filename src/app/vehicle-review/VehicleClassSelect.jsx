import CustomSelect from "../CustomSelect.jsx";
import { getVehicleClassIllustration } from "../../domain/vehicle-class-illustrations.js";
import "../../styles/vehicle-class-select.css";

function renderVehicleOption(option, { placement }) {
  const illustration = getVehicleClassIllustration(option.value);
  if (!illustration) return option.content;
  return <span className={`ops-vehicle-class-choice is-${placement}`}>
    <span className="ops-vehicle-class-thumbnail" aria-hidden="true">
      <img src={illustration.image} alt="" loading={placement === "trigger" ? "eager" : "lazy"} decoding="async" />
    </span>
    <span className="ops-vehicle-class-copy">
      <span className="ops-vehicle-class-label">{option.content}</span>
      {placement === "menu" && <small>{illustration.hint}</small>}
    </span>
  </span>;
}

export default function VehicleClassSelect({ children, value, ...props }) {
  const illustration = getVehicleClassIllustration(value);
  return <div className="ops-vehicle-class-field">
    <CustomSelect {...props} value={value} className="ops-vehicle-class-select" menuClassName="ops-vehicle-class-menu" renderOption={renderVehicleOption}>
      {children}
    </CustomSelect>
    <small className="ops-vehicle-class-note">ภาพตัวอย่างรูปแบบรถ · เทียบจำนวนเพลาและล้อของรถจริง</small>
    {illustration?.detail && <small className="ops-vehicle-class-detail">{illustration.detail}</small>}
  </div>;
}
