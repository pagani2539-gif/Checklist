import { Component, createElement, lazy, Suspense } from "react";

export function createLazyPage(loadPage) {
  return lazy(async () => {
    const Page = await loadPage();
    if (typeof Page !== "function") throw new TypeError("Lazy page loader must resolve to a React component");
    return { default: Page };
  });
}

export class AsyncModuleErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return createElement("section", { className: "ops-empty-state", role: "alert" },
      createElement("strong", null, this.props.title || "เปิดส่วนนี้ไม่สำเร็จ"),
      createElement("span", null, "ตรวจสอบการเชื่อมต่อ แล้วลองโหลดหน้าใหม่"),
      createElement("button", { className: "ops-button ops-button-secondary", type: "button", onClick: () => window.location.reload() }, "โหลดหน้าใหม่"),
    );
  }
}

export function renderPage(route, pageComponents, propsByRoute) {
  const routeName = route?.name || "inspections";
  const Page = pageComponents[routeName] || pageComponents.inspections;
  const props = propsByRoute[routeName] || propsByRoute.inspections || {};
  const isRoundPage = ['checklist', 'historyDetail', 'vehicleApi', 'historyVehicleApi'].includes(routeName);
  const roundStatus = isRoundPage ? (props.state?.inspectionRounds?.find(round => round.id === route?.id)?.status || 'missing') : '';
  const pageKey = `${routeName}:${route?.id || route?.contractId || ''}:${roundStatus}`;
  return createElement(AsyncModuleErrorBoundary, { key: pageKey },
    createElement(Suspense, {
      fallback: createElement("div", { className: "ops-empty-state", role: "status", "aria-live": "polite" },
        createElement("span", null, "กำลังเปิดหน้าที่เลือก…"),
      ),
    }, createElement(Page, { ...props, key: pageKey })),
  );
}
