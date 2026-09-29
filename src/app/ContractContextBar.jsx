import { AppIcon as Icon } from "./icon-system.jsx";
import { buildContractContextSnapshot, contractFor, getContractContextForRound, regionsForContract, workPackageFor } from "../domain/contracts.js";

export default function ContractContextBar({ state, route }) {
  let context = null;
  let pendingAssignments = [];
  if (["contractDetail", "contractEdit", "contractAgreementCover", "workPackage", "contractReportNew"].includes(route?.name)) {
    const contract = contractFor(state, route.id);
    const workPackage = workPackageFor(state, route.workPackageId);
    const station = state.stationProfiles?.find((profile) => profile.id === route.query?.stationId);
    context = buildContractContextSnapshot({ contract, workPackage, regions: regionsForContract(state, contract), station });
  } else if (route?.name === "newInspection") {
    const contract = contractFor(state, route.query?.contractId);
    const workPackage = workPackageFor(state, route.query?.workPackageId);
    const station = state.stationProfiles?.find((profile) => profile.id === route.query?.stationId);
    context = contract ? buildContractContextSnapshot({ contract, workPackage, regions: regionsForContract(state, contract), station }) : null;
  } else if (["checklist", "historyDetail", "historyVehicleApi", "historyRevise", "vehicleApi"].includes(route?.name)) {
    const round = state.inspectionRounds?.find((entry) => entry.id === route.id);
    context = getContractContextForRound(round, state);
  } else if (route?.name === "stationDetail") {
    const assignments = state.contractStationAssignments?.filter((entry) => entry.stationId === route.id && entry.status !== "inactive") || [];
    const assignment = assignments.filter((entry) => (!route.query?.contractId || entry.contractId === route.query.contractId) && (!route.query?.workPackageId || entry.workPackageId === route.query.workPackageId))[0] || (assignments.length === 1 ? assignments[0] : null);
    pendingAssignments = assignments.length > 1 && !assignment ? assignments : [];
    if (assignment) {
      const contract = contractFor(state, assignment.contractId);
      const workPackage = workPackageFor(state, assignment.workPackageId);
      const station = state.stationProfiles?.find((profile) => profile.id === route.id);
      context = buildContractContextSnapshot({ contract, workPackage, regions: regionsForContract(state, contract), station, assignment });
    }
  }
  if (pendingAssignments.length) return <div className="contract-context-bar contract-context-picker" role="status"><Icon name="archive" /><span className="contract-context-label">เลือกบริบทของสถานีนี้</span>{pendingAssignments.map((assignment) => { const contract = contractFor(state, assignment.contractId); const workPackage = workPackageFor(state, assignment.workPackageId); return <a key={assignment.id} href={`#/stations/${encodeURIComponent(route.id)}?contractId=${encodeURIComponent(assignment.contractId)}&workPackageId=${encodeURIComponent(assignment.workPackageId)}`}>{contract?.contractNo || "สัญญา"} · งวด {workPackage?.reportSequence || workPackage?.packageNo || "—"}</a>; })}</div>;
  if (!context || (!context.contractId && !context.contractNo)) return null;
  const contractHref = context.contractId ? `#/contracts/${encodeURIComponent(context.contractId)}` : null;
  const stationLabel = context.stationCode || context.stationName;
  return <div className="contract-context-bar" role="status"><Icon name="archive" /><span className="contract-context-label">บริบทงาน</span>{contractHref ? <a href={contractHref}>{context.contractNo || "สัญญา"}</a> : <span>{context.contractNo || "สัญญา"}</span>}{route?.name === "contractDetail" && context.contractId && <><span>·</span><a href={`#/contracts/${encodeURIComponent(context.contractId)}/cover`}>หน้าปกสัญญา</a></>}{context.reportSequence && context.contractId && context.workPackageId && <><span>·</span><a href={`#/contracts/${encodeURIComponent(context.contractId)}/work-packages/${encodeURIComponent(context.workPackageId)}`}>งวด {context.reportSequence}</a></>}{stationLabel && <><span>·</span><span>{stationLabel}</span></>}</div>;
}
