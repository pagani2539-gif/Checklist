import { createVehicleReviewComponents } from "../vehicle-review/ReviewPanels.jsx";
import { AttachmentField, EvidenceField } from "../AttachmentFields.jsx";

export function createVehicleApiRuntime(runtime, { ThaiDateTimePicker }) {
  return {
    AttachmentField,
    EvidenceField,
    ...createVehicleReviewComponents({
      AttachmentField,
      EvidenceField,
      StatusBadge: runtime.StatusBadge,
      ThaiDateTimePicker,
    }),
  };
}
