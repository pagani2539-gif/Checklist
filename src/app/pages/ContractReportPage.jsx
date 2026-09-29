import ContractWorkReportCover from "../ContractWorkReportCover.jsx";

function buildModel({ contract, workPackage, station, regions, report }) {
  return {
    agency: contract?.agency,
    reportCompanyId: contract?.reportCompanyId,
    context: {
      contractId: contract?.id,
      contractNo: contract?.contractNo,
      contractDate: contract?.contractDate,
      projectName: contract?.projectName || contract?.title,
      contractor: contract?.contractor,
      regionNames: (regions || []).map((region) => region.name),
      workPackageId: workPackage?.id,
      workPackageNo: workPackage?.packageNo || workPackage?.reportSequence,
      workPackageTitle: workPackage?.title,
      reportSequence: report?.reportSequence || workPackage?.reportSequence || workPackage?.packageNo,
      periodStart: workPackage?.periodStart,
      periodEnd: workPackage?.periodEnd,
      stationId: station?.id,
      stationCode: station?.stationCode,
      stationName: station?.stationName,
      province: station?.province,
    },
  };
}

export function createContractReportPage(runtime) {
  const { Button, EmptyState, Icon, MasterSelect, PageHeader, buildContractContextSnapshot, contractFor, createContractWorkReport, navigate, regionsForContract, useMemo, useState, workPackageFor } = runtime;
  return function ContractReportPage({ state, update, notify, route }) {
    const contract = contractFor(state, route.id);
    const workPackage = workPackageFor(state, route.workPackageId);
    const assigned = (state.contractStationAssignments || []).filter((entry) => entry.workPackageId === route.workPackageId && entry.status !== "inactive");
    const stations = assigned.map((assignment) => state.stationProfiles.find((profile) => profile.id === assignment.stationId)).filter(Boolean);
    const stationOptions = stations.map((entry) => ({ id: entry.id, code: entry.stationCode, name: `${entry.stationName} · ${entry.province || "ไม่ระบุจังหวัด"}` }));
    const [stationId, setStationId] = useState(() => route.query.stationId || stations[0]?.id || "");
    const station = stations.find((entry) => entry.id === stationId) || null;
    const model = useMemo(() => buildModel({ contract, workPackage, station, regions: regionsForContract(state, contract) }), [contract, state, station, workPackage]);
    if (!contract || !workPackage || workPackage.contractId !== contract.id) return <section className="ops-page"><EmptyState title="ไม่พบข้อมูลหน้าปก" action={<Button href="#/dashboard" variant="primary">กลับภาพรวม</Button>}>กรุณาเปิดหน้าปกจากงวดงานที่อยู่ภายใต้สัญญา</EmptyState></section>;
    const save = () => {
      if (!station) { notify("เลือกสถานีที่จะออกหน้าปกก่อน"); return; }
      const assignment = assigned.find((entry) => entry.stationId === station.id);
      const context = buildContractContextSnapshot({ contract, workPackage, regions: regionsForContract(state, contract), station, assignment });
      const report = createContractWorkReport({ contractId: contract.id, workPackageId: workPackage.id, stationId: station.id, reportSequence: context.reportSequence, snapshot: context });
      update((current) => ({ ...current, contractWorkReports: [report, ...(current.contractWorkReports || [])] }), "บันทึกหน้าปกงานสัญญาแล้ว");
    };
    return <section className="ops-page contracts-page contract-report-page"><PageHeader eyebrow="CONTRACT WORK REPORT" title="หน้าปกงานของสัญญา" description="รายงานชนิดนี้แยกจาก Station Inspection Report และยึด context ของสัญญา/งวดที่เปิดอยู่" actions={<Button href={`#/contracts/${encodeURIComponent(contract.id)}/work-packages/${encodeURIComponent(workPackage.id)}`} icon="arrow">กลับงวดงาน</Button>} /><div className="contract-context-strip"><span><Icon name="archive" />{contract.contractNo || "ยังไม่มีเลขสัญญา"}</span><span><Icon name="list" />งวด {workPackage.reportSequence || workPackage.packageNo || "—"}</span><span><Icon name="building" />{station?.stationCode || "เลือกสถานี"}</span></div><section className="contract-report-controls"><MasterSelect options={stationOptions} value={stationId} onChange={(event) => setStationId(event.target.value)} label="สถานีในหน้าปก" placeholder="เลือกเฉพาะสถานีในงวด" /><div className="ops-report-type-note"><Icon name="info" /><span><strong>Contract Work Report</strong> แสดงเลขสัญญา งวด ภาค สถานี และจังหวัดจากข้อมูลชุดเดียวกัน</span></div><Button onClick={save} variant="primary" icon="check">บันทึกหน้าปก</Button></section><div className="contract-cover-preview"><ContractWorkReportCover model={model} /></div></section>;
  };
}
