import { createElement } from "react";

export function renderPage(route, pageComponents, propsByRoute) {
  const routeName = route?.name || "dashboard";
  const Page = pageComponents[routeName] || pageComponents.dashboard;
  const props = propsByRoute[routeName] || propsByRoute.dashboard || {};
  return createElement(Page, props);
}

