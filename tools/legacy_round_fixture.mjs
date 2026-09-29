import { createSnapshot, createInspectionRound, MASTER_TEMPLATE_VERSION } from "../src/domain/master-checklist.js";
import { getEvidenceCatalogForSnapshot } from "../src/domain/evidence-checklist.js";

// Explicit fixture for regression tests of pre-item-control rounds. These tests
// keep their original PDF-position/N/A expectations; new rounds are exercised
// in test_station_checklist_controls.mjs with the real creation API.
export function createLegacyInspectionRound(profile, meta = {}, overrides = {}) {
  if (overrides.snapshot) return createInspectionRound(profile, meta, overrides);
  const createdSnapshot = createSnapshot(profile, overrides);
  const legacyVehicleLabels = {
    "5.1.plate-document": "เอกสารผลการจำแนกป้ายทะเบียน",
    "5.1.vehicle-document": "เอกสารผลการจำแนกประเภทรถ",
  };
  const legacyChecklistCopy = {
    ...createdSnapshot.checklistCopy,
    sections: createdSnapshot.checklistCopy.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => legacyVehicleLabels[item.id]
        ? { ...item, label: legacyVehicleLabels[item.id], helper: "ตรวจและบันทึกตามช่องในเอกสารแนบ", evidenceSlots: item.evidenceSlots.map((slot) => ({ ...slot, displayLabel: legacyVehicleLabels[item.id] })) }
        : item),
    })),
  };
  const snapshot = { ...createdSnapshot, checklistCopy: legacyChecklistCopy, checklistPolicyVersion: null,
    checklistPresentationVersion: null,
    templateVersion: profile.templateVersion || MASTER_TEMPLATE_VERSION,
    equipment: structuredClone(profile.equipment.filter((asset) => asset.active !== false)),
    checklistConfig: structuredClone(profile.checklistConfig || { disabledTemplateIds: [] }) };
  snapshot.evidenceCatalog = getEvidenceCatalogForSnapshot(snapshot);
  return createInspectionRound(profile, meta, { ...overrides, snapshot });
}
