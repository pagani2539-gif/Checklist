import { isSystemVehicleRound, projectVehicleRound } from "../../domain/vehicle-review-systems.js";
import { VehicleTestReport } from '../reports/VehicleTestReport.jsx';
import { EmptyState, PageHeader } from '../PagePrimitives.jsx';

export function createVehicleApiReportPage() {
  return function VehicleApiReportPage({ state, route }) {
    const sourceRound = state?.inspectionRounds?.find(item => item.id === route.id);
    const context = route.context === "classification" ? "classification" : "plate";
    const systemKey = route.query?.system || sourceRound?.snapshot?.vehicleReviewSystems?.[0]?.key;
    const round = isSystemVehicleRound(sourceRound) ? projectVehicleRound(sourceRound, systemKey, context) : sourceRound;
    if (!round) return <section className="ops-page"><PageHeader title="ไม่พบรอบการตรวจ" /><EmptyState title="เปิดรายงานไม่ได้">ไม่พบข้อมูลรอบการตรวจนี้</EmptyState></section>;
    const scope = context === 'classification' ? 'day' : ['day', 'night'].includes(route.query?.scope) ? route.query.scope : 'all';
    const parent = route.name === 'historyVehicleApiReport' || round.status === 'closed' ? 'history' : 'inspections';
    const backHref = `#/${parent}/${encodeURIComponent(round.id)}/vehicle-api/${context}?${new URLSearchParams({ ...(systemKey ? { system: systemKey } : {}), ...(scope !== 'all' ? { scope } : {}) })}`;
    return <VehicleTestReport round={round} state={state} context={context} scope={scope} backHref={backHref} />;
  };
}
