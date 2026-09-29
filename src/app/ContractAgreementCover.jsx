import "../styles/contracts.css";

function displayDate(value) {
  if (!value) return "ยังไม่ระบุวันที่";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function displayMoney(value) {
  if (value === null || value === undefined || value === "") return "ยังไม่ระบุ";
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed)
    : value;
}

function displayText(value, fallback = "ยังไม่ระบุ") {
  return String(value || "").trim() || fallback;
}

export default function ContractAgreementCover({ snapshot = {}, version, mode = "draft" }) {
  const scopeItems = Array.isArray(snapshot.scopeItems) ? snapshot.scopeItems : [];
  const committeeMembers = Array.isArray(snapshot.committeeMembers) ? snapshot.committeeMembers : [];
  const emblemPath = snapshot.emblemPath || snapshot.logoPath;
  return <section className="contract-agreement-cover" aria-label="หน้าปกสัญญา">
    <header className="contract-agreement-cover-header">
      <div className="contract-agreement-emblem">
        {emblemPath ? <img src={emblemPath} alt="ตราหน่วยงาน" /> : <span>ตรา<br />หน่วยงาน</span>}
      </div>
      <div className="contract-agreement-identifiers">
        <div>สัญญาเลขที่ <strong>{displayText(snapshot.contractNo)}</strong></div>
        <div>ลงวันที่ <strong>{displayDate(snapshot.contractDate)}</strong></div>
      </div>
    </header>

    <div className="contract-agreement-cover-content">
      <p className="contract-agreement-kicker">สัญญาจ้างก่อสร้าง / จ้างบำรุงรักษาและปรับปรุง</p>
      <h1>{displayText(snapshot.title || snapshot.projectName, "ยังไม่ระบุชื่อสัญญา")}</h1>
      {snapshot.projectName && snapshot.projectName !== snapshot.title && <p className="contract-agreement-project">{snapshot.projectName}</p>}
      <div className="contract-agreement-scope" aria-label="ขอบเขตงาน">
        {scopeItems.length ? scopeItems.map((item, index) => <p key={item.id || index}>{item.description}</p>) : <p>ยังไม่ระบุขอบเขตงาน</p>}
      </div>

      <div className="contract-agreement-parties">
        <p>ระหว่าง</p>
        <strong>{displayText(snapshot.agency, "หน่วยงานเจ้าของงาน")}</strong>
        <p>กับ</p>
        <strong>{displayText(snapshot.contractor, "ผู้รับจ้าง")}</strong>
      </div>
    </div>

    <div className="contract-agreement-bottom">
      <dl className="contract-agreement-facts">
        <div><dt>วันเริ่มต้นสัญญา</dt><dd>{displayDate(snapshot.startDate)}</dd></div>
        <div><dt>วันสิ้นสุดสัญญา</dt><dd>{displayDate(snapshot.endDate)}</dd></div>
        <div><dt>ระยะเวลาตามเอกสาร</dt><dd>{snapshot.durationDays ? `${snapshot.durationDays} วัน` : "ยังไม่ระบุ"}</dd></div>
        <div><dt>มูลค่าสัญญา</dt><dd>{displayMoney(snapshot.contractValue)} บาท</dd></div>
        <div><dt>ค่าปรับวันละ</dt><dd>{displayMoney(snapshot.penaltyPerDay)} บาท</dd></div>
      </dl>

      <section className="contract-agreement-committee" aria-label="คณะกรรมการหรือผู้เกี่ยวข้อง">
        <div className="contract-agreement-committee-heading"><strong>คณะกรรมการตรวจรับพัสดุ / ผู้เกี่ยวข้อง</strong>{mode === "issued" && <span>ฉบับที่ {version || "—"}</span>}</div>
        <table>
          <thead><tr><th scope="col">ลำดับ</th><th scope="col">ชื่อ</th><th scope="col">บทบาท</th></tr></thead>
          <tbody>{committeeMembers.length ? committeeMembers.map((member, index) => <tr key={member.id || index}><td>{index + 1}</td><td>{displayText(member.name)}</td><td>{displayText(member.role)}</td></tr>) : <tr><td colSpan="3">ยังไม่ระบุคณะกรรมการหรือผู้เกี่ยวข้อง</td></tr>}</tbody>
        </table>
      </section>
    </div>
  </section>;
}
