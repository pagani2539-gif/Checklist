export const PRIMARY_ROUTES = [
  { key: "dashboard", hash: "#/dashboard", label: "ภาพรวม" },
  { key: "stations", hash: "#/stations", label: "ทะเบียนสถานี" },
  { key: "inspections", hash: "#/inspections", label: "รอบการตรวจ" },
  { key: "history", hash: "#/history", label: "ประวัติและรายงาน" },
];

export const ROUTE_META = Object.freeze({
  dashboard: ["ภาพรวม", "ดูสถานี ความคืบหน้า และรายการที่ต้องติดตาม"],
  newContract: ["สร้างสัญญา", "เพิ่มสัญญาและพื้นที่ภาคที่สัญญาครอบคลุม"],
  contractDetail: ["รายละเอียดสัญญา", "ดูภาพรวม งวดงาน สถานี รายงาน และเอกสารของสัญญา"],
  contractEdit: ["แก้ไขข้อมูลสัญญา", "แก้ไขข้อมูลหลักของสัญญาก่อนจัดทำหน้าปก"],
  contractAgreementCover: ["หน้าปกสัญญา", "จัดทำหน้าปกสัญญาหลักจากข้อมูลคู่สัญญา ขอบเขตงาน และเงื่อนไขตามเอกสารจริง"],
  workPackage: ["งวดงาน", "จัดสถานีในงวดงานและเริ่มรอบตรวจจากบริบทที่ถูกต้อง"],
  contractReportNew: ["หน้าปกงานสัญญา", "จัดทำ Contract Work Report จากสัญญาและงวดงานที่เลือก"],
  referenceData: ["จัดการ Master Data", "จัดการรายการผู้รับจ้างและหน่วยงานมาตรฐาน"],
  stations: ["ทะเบียนสถานี", "จัดการข้อมูลแม่ของสถานี อุปกรณ์ Lane และความพร้อมสำหรับรอบการตรวจถัดไป"],
  stationDetail: ["รายละเอียดสถานี", "แก้ไขทะเบียนปัจจุบันและกติกาสำหรับรอบการตรวจถัดไป"],
  inspections: ["รอบการตรวจ", "สร้าง เปิด และติดตามรอบการตรวจแยกตามสถานี"],
  newInspection: ["สร้างรอบการตรวจใหม่", "เลือกสัญญา งวดงาน และสถานีจากบริบทเดียวกันก่อนเริ่มตรวจ"],
  newStation: ["สร้างสถานีใหม่", "สร้างข้อมูลประจำสถานี (Station Profile) และทะเบียนอุปกรณ์ก่อนเริ่มรอบการตรวจ"],
  checklist: ["รายการตรวจและหลักฐาน", "กรอกข้อมูลเฉพาะรอบการตรวจที่เลือก"],
  vehicleApi: ["ตรวจผล Vehicle API", "ตรวจป้ายทะเบียนหรือการคัดแยกประเภทรถแยกตามบริบท"],
  vehicleApiReport: ["รายงานผล Vehicle API", "สรุปผล ตัวอย่าง และสาเหตุจากข้อมูลในรอบการตรวจ"],
  history: ["ประวัติ / พิมพ์รายงาน", "ดูรอบการตรวจที่ปิดแล้วแบบอ่านอย่างเดียว"],
  historyDetail: ["รายละเอียดประวัติ", "อ่าน Snapshot เดิมและพิมพ์รายงาน"],
  historyVehicleApi: ["ตรวจผล Vehicle API ในประวัติ", "อ่านผลป้ายทะเบียนหรือการคัดแยกประเภทรถจาก Snapshot เดิม"],
  historyVehicleApiReport: ["รายงานผล Vehicle API ในประวัติ", "อ่านรายงานผลและตัวอย่างจาก Snapshot เดิม"],
  historyRevise: ["จัดทำฉบับแก้ไข", "สร้างรอบการตรวจใหม่จากข้อมูล ณ วันที่เริ่มรอบการตรวจเดิมโดยไม่เขียนทับประวัติ"],
  adminUsers: ["จัดการบัญชีผู้ใช้", "สร้างบัญชี กำหนด role และสถานี รวมถึงระงับหรือกู้คืนการเข้าใช้งาน"],
});

export function parseHash(hash = window.location.hash) {
  const raw = (hash || "#/dashboard").replace(/^#\/?/, "");
  const [path, queryString = ""] = raw.split("?");
  const segments = path.split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryString));

  if (!segments.length || segments[0] === "dashboard") return { name: "dashboard", query };
  if (segments[0] === "contracts" && segments[1] === "new") return { name: "newContract", query };
  if (segments[0] === "contracts" && segments[1] && segments[2] === "edit") return { name: "contractEdit", id: decodeURIComponent(segments[1]), query };
  if (segments[0] === "contracts" && segments[1] && segments[2] === "cover") return { name: "contractAgreementCover", id: decodeURIComponent(segments[1]), query };
  if (segments[0] === "contracts" && segments[1] && segments[2] === "work-packages" && segments[3] && segments[4] === "reports" && segments[5] === "new") return { name: "contractReportNew", id: decodeURIComponent(segments[1]), workPackageId: decodeURIComponent(segments[3]), query };
  if (segments[0] === "contracts" && segments[1] && segments[2] === "work-packages" && segments[3]) return { name: "workPackage", id: decodeURIComponent(segments[1]), workPackageId: decodeURIComponent(segments[3]), query };
  if (segments[0] === "contracts" && segments[1]) return { name: "contractDetail", id: decodeURIComponent(segments[1]), query };
  if (segments[0] === "contracts") return { name: "dashboard", query, redirectTo: "#/dashboard" };
  if (segments[0] === "reference-data") return { name: "referenceData", query };
  if (segments[0] === "admin" && segments[1] === "users") return { name: "adminUsers", query };
  if (segments[0] === "stations" && segments[1] === "new") return { name: "newStation", query };
  if (segments[0] === "stations" && segments[1]) return { name: "stationDetail", id: decodeURIComponent(segments[1]), query };
  if (segments[0] === "stations") return { name: "stations", query };
  if (segments[0] === "inspections" && segments[1] === "new") return { name: "newInspection", query };
  if (segments[0] === "inspections" && segments[1] && segments[2] === "vehicle-api-report") return { name: "vehicleApiReport", id: decodeURIComponent(segments[1]), context: segments[3] || "plate", query };
  if (segments[0] === "inspections" && segments[1] && segments[2] === "vehicle-api") return { name: "vehicleApi", id: decodeURIComponent(segments[1]), context: segments[3] || "plate", query };
  if (segments[0] === "inspections" && segments[1]) return { name: "checklist", id: decodeURIComponent(segments[1]), query };
  if (segments[0] === "inspections") return { name: "inspections", query };
  if (segments[0] === "history" && segments[1] && segments[2] === "revise") return { name: "historyRevise", id: decodeURIComponent(segments[1]), query };
  if (segments[0] === "history" && segments[1] && segments[2] === "vehicle-api-report") return { name: "historyVehicleApiReport", id: decodeURIComponent(segments[1]), context: segments[3] || "plate", query };
  if (segments[0] === "history" && segments[1] && segments[2] === "vehicle-api") return { name: "historyVehicleApi", id: decodeURIComponent(segments[1]), context: segments[3] || "plate", query };
  if (segments[0] === "history" && segments[1]) return { name: "historyDetail", id: decodeURIComponent(segments[1]), query };
  if (segments[0] === "history") return { name: "history", query };
  return { name: "dashboard", query, invalid: true };
}

export function primaryRouteFor(routeName) {
  if (routeName === "adminUsers") return "adminUsers";
  if (["contracts", "newContract", "contractEdit", "contractDetail", "contractAgreementCover", "workPackage", "contractReportNew", "referenceData"].includes(routeName)) return null;
  if (routeName === "newStation" || routeName === "stationDetail") return "stations";
  if (routeName === "newInspection" || routeName === "checklist" || routeName === "vehicleApi" || routeName === "vehicleApiReport") return "inspections";
  if (routeName === "historyDetail" || routeName === "historyRevise" || routeName === "historyVehicleApi" || routeName === "historyVehicleApiReport") return "history";
  return routeName;
}

export function getBackFallbackTarget(route) {
  if (!route?.name || route.name === "dashboard") return null;
  if (["stations", "stationDetail", "newStation"].includes(route.name)) return "#/stations";
  if (["inspections", "newInspection", "checklist"].includes(route.name)) return "#/inspections";
  if (route.name === "vehicleApi" && route.id) return "#/inspections/" + encodeURIComponent(route.id);
  if (route.name === "vehicleApiReport" && route.id) return `#/inspections/${encodeURIComponent(route.id)}/vehicle-api/${encodeURIComponent(route.context || "plate")}${route.query?.scope ? `?scope=${encodeURIComponent(route.query.scope)}` : ""}`;
  if (route.name === "history") return "#/dashboard";
  if (route.name === "historyDetail" && route.id) return "#/history";
  if (route.name === "historyVehicleApiReport" && route.id) return `#/history/${encodeURIComponent(route.id)}/vehicle-api/${encodeURIComponent(route.context || "plate")}${route.query?.scope ? `?scope=${encodeURIComponent(route.query.scope)}` : ""}`;
  if (["historyVehicleApi", "historyRevise"].includes(route.name) && route.id) {
    return "#/history/" + encodeURIComponent(route.id);
  }
  if (["contractEdit", "contractAgreementCover", "workPackage", "contractReportNew"].includes(route.name) && route.id) {
    return "#/contracts/" + encodeURIComponent(route.id);
  }
  if (route.name === "referenceData") return "#/dashboard";
  return "#/dashboard";
}
