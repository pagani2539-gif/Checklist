export async function attachmentIdsForRoundAndAliases(state, round) {
  const [annotation, vehicleEvidence, storage, evidence] = await Promise.all([
    import("../domain/image-annotation.js"),
    import("../domain/vehicle-evidence-images.js"),
    import("../domain/storage.js"),
    import("../domain/evidence-checklist.js"),
  ]);

  const attachmentIdsForRound = (record) => [
    ...annotation.collectAnnotationAttachmentIds(record),
    ...vehicleEvidence.vehicleEvidenceAttachmentIds(record?.vehicleEvidenceArchive),
    ...storage.attachmentIdsForState({ inspectionRounds: [record] }),
    ...evidence.evidenceAttachmentIds(record),
    ...Object.values(record?.inspectionItems || {}).map((item) => item?.attachment?.id).filter(Boolean),
  ];
  const attachmentIdsForRecord = (record) => [
    ...attachmentIdsForRound(record),
    ...annotation.collectAnnotationAttachmentIds(record?.items),
    ...Object.values(record?.items || {}).map((item) => item?.attachment?.id).filter(Boolean),
  ];
  const aliases = [
    ...(state.inspectionHistory || []),
    ...(state.archivedRounds || []),
    ...(state.reports || []),
  ].filter((record) => record?.id === round.id || record?.sourceRoundId === round.id);

  return [...new Set([attachmentIdsForRecord(round), ...aliases.map(attachmentIdsForRecord)].flat())];
}
