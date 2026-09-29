import {
  createDefaultStationProfile,
  createInspectionRound,
  createSnapshot,
  MASTER_TEMPLATE_VERSION,
  getItemsForSnapshot,
} from "./master-checklist.js";
import { createVehicleReviewState, VEHICLE_API_REVIEW_VERSION, VEHICLE_REVIEW_SCOPE_VERSION } from "./vehicle-search.js";

export const UI_DEMO_ROUND_ID = "round-mtmeabs2-x7ng1";
export const UI_DEMO_FIXTURE_VERSION = "ui-queue-v1";
export const UI_VEHICLE_DEMO_ROUND_ID = "round-mtmevehicle-x7ng1";
export const UI_VEHICLE_DEMO_FIXTURE_VERSION = "ui-vehicle-decision-dock-v1";

const UI_DEMO_CREATED_AT = "2026-09-04T03:55:00.000Z";
const UI_DEMO_DISABLED_ITEM_IDS = ["2.1.road-02", "2.1.road-03"];

function demoInspectionItems(round) {
  const items = getItemsForSnapshot(round.snapshot, round.templateVersion);
  const applicableIds = items.filter((item) => item.applicable !== false).map((item) => item.id);
  const doneIds = new Set(applicableIds.slice(0, 48));
  const damagedIds = new Set(applicableIds.slice(42, 45));
  const waitingIds = new Set(applicableIds.slice(45, 48));
  const evidenceSlots = items
    .filter((item) => item.applicable !== false)
    .flatMap((item) => (item.evidenceSlots || []).map((slot) => ({ itemId: item.id, slotId: slot.id, cleaningStage: slot.cleaningStage })));
  const completeEvidence = new Set(evidenceSlots.filter((slot) => !slot.cleaningStage).slice(0, 38).map(({ itemId, slotId }) => `${itemId}::${slotId}`));

  return Object.fromEntries(Object.entries(round.inspectionItems).map(([itemId, value]) => {
    const status = damagedIds.has(itemId)
      ? "damaged"
      : waitingIds.has(itemId)
        ? "waiting"
        : doneIds.has(itemId)
          ? "normal"
          : value.status;
    const evidence = Object.fromEntries(Object.entries(value.evidence || {}).map(([slotId, slotValue]) => [
      slotId,
      completeEvidence.has(`${itemId}::${slotId}`) ? { ...slotValue, status: "complete" } : slotValue,
    ]));
    return [itemId, { ...value, status, evidence }];
  }));
}

export function createUiDemoRound() {
  const profile = createDefaultStationProfile();
  profile.equipment = profile.equipment.filter((equipment) => !/^sensor-[123]$/.test(equipment.id));
  profile.checklistConfig = {
    ...profile.checklistConfig,
    disabledTemplateIds: [...new Set([...(profile.checklistConfig?.disabledTemplateIds || []), ...UI_DEMO_DISABLED_ITEM_IDS])],
  };
  const round = createInspectionRound(profile, {
    projectName: "ตัวอย่าง UI · รอบตรวจและหลักฐาน",
    inspectionDate: "2026-09-04",
    contractor: "ทีมทดสอบ UI",
    inspector: "ผู้ตรวจสอบตัวอย่าง",
  }, {
    // This dated demo is a frozen pre-item-controls round, not a new station preview.
    snapshot: { ...createSnapshot(profile), vehicleReviewVersion: null, vehicleReviewScopeVersion: null, templateVersion: MASTER_TEMPLATE_VERSION, checklistPolicyVersion: null, checklistConfig: profile.checklistConfig },
    id: UI_DEMO_ROUND_ID,
    createdAt: UI_DEMO_CREATED_AT,
    updatedAt: UI_DEMO_CREATED_AT,
  });

  return {
    ...round,
    isDemoFixture: true,
    fixtureVersion: UI_DEMO_FIXTURE_VERSION,
    inspectionItems: demoInspectionItems(round),
  };
}

function createUiVehicleDemoRows() {
  const plates = [
    ["70-7644", "ราชบุรี"],
    ["71-2086", "กาญจนบุรี"],
    ["72-9150", "นครปฐม"],
    ["73-4421", "สุพรรณบุรี"],
    ["74-0318", "เพชรบุรี"],
    ["75-8820", "ราชบุรี"],
    ["76-5402", "กาญจนบุรี"],
    ["77-1164", "นครปฐม"],
    ["78-6099", "สุพรรณบุรี"],
    ["79-3340", "ราชบุรี"],
  ];

  return plates.map(([plateNumber, province], index) => ({
    id: `vehicle-demo-${index + 1}`,
    plateNumber,
    province,
    plateImage: index === 0 ? "/demo/vehicle-plate-70-7644.png" : null,
    overviewImage: null,
    occurredAt: index < 5
      ? `2026-09-13T08:${String(index).padStart(2, "0")}:00+07:00`
      : `2026-09-13T20:${String(index - 5).padStart(2, "0")}:00+07:00`,
    lane: index % 2 === 0 ? "TH1" : "TH2",
    vehicleClassId: "10",
    vehicleClassLabel: "รถ 10 ล้อ (25 ตัน)",
    axleCount: 5,
    grossWeight: 22000 + index * 120,
    grossWeightLimit: 25000,
    leftWeight: 11000 + index * 60,
    rightWeight: 11000 + index * 60,
    isOverweight: false,
    review: {
      plate: "pending",
      classification: "pending",
      axle: "pending",
      grossWeight: "pending",
      integrity: "pending",
    },
  }));
}

export function createUiVehicleDemoRound() {
  const baseRound = createUiDemoRound();
  const rows = createUiVehicleDemoRows();
  const vehicleReview = createVehicleReviewState({ dateFrom: "2026-09-13", dateTo: "2026-09-13" });
  const stationName = "สถานีตรวจสอบน้ำหนักน้อย ทล.323";
  const sourceStation = { id: "Sc-323", name: stationName };
  const scopeState = (scopeKey, scopeRows) => ({
    ...vehicleReview.scopes[scopeKey],
    fetchedAt: "2026-09-13T22:11:00+07:00",
    sourceStation,
    rows: scopeRows,
    pagination: { page: 1, pageSize: 200, totalItems: scopeRows.length, totalPages: 1 },
    error: null,
  });

  return {
    ...baseRound,
    id: UI_VEHICLE_DEMO_ROUND_ID,
    fixtureVersion: UI_VEHICLE_DEMO_FIXTURE_VERSION,
    snapshot: {
      ...baseRound.snapshot,
      stationCode: "Sc-323",
      stationName,
      vehicleReviewVersion: VEHICLE_API_REVIEW_VERSION,
      vehicleReviewScopeVersion: VEHICLE_REVIEW_SCOPE_VERSION,
      vehicleSearchConfig: {
        ...baseRound.snapshot.vehicleSearchConfig,
        baseUrl: "https://demo.vehicle-api.local",
        stationId: "Sc-323",
        stationName,
      },
    },
    vehicleSearch: {
      ...vehicleReview,
      scopes: {
        day: scopeState("day", rows.slice(0, 5)),
        night: scopeState("night", rows.slice(5)),
      },
    },
  };
}
