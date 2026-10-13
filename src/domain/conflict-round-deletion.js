export function removeInspectionRoundFromState(state, round) {
  const remainingRounds = (state.inspectionRounds || []).filter((entry) => entry.id !== round.id);
  const removedSnapshotId = round.snapshot?.id;
  const removeLegacyReference = (entries) => Array.isArray(entries)
    ? entries.filter((entry) => {
      const snapshot = entry?.snapshot || entry?.stationSnapshot || entry?.inspectionSnapshot;
      return entry?.id !== round.id && (!removedSnapshotId || snapshot?.id !== removedSnapshotId);
    })
    : entries;
  const deletedRoundIds = [...new Set([...(Array.isArray(state.deletedRoundIds) ? state.deletedRoundIds : []), round.id])];
  const deletingActive = state.activeRoundId === round.id;
  const nextActive = deletingActive
    ? (remainingRounds.find((entry) => entry.status === "draft") || remainingRounds[0] || null)
    : remainingRounds.find((entry) => entry.id === state.activeRoundId) || null;
  return {
    ...state,
    inspectionRounds: remainingRounds,
    stationInspectionReports: (state.stationInspectionReports || []).filter((entry) => entry.roundId !== round.id),
    inspectionRoundContextLinks: (state.inspectionRoundContextLinks || []).filter((entry) => entry.roundId !== round.id),
    deletedRoundIds,
    inspectionHistory: removeLegacyReference(state.inspectionHistory),
    inspectionWorkspaces: removeLegacyReference(state.inspectionWorkspaces),
    ...(deletingActive ? {
      activeRoundId: nextActive?.id || null,
      activeStationId: nextActive?.stationId || state.stationProfiles[0]?.id || null,
      items: nextActive?.inspectionItems || {},
      inspectionSnapshot: nextActive?.snapshot || null,
      meta: nextActive?.meta || state.meta,
    } : {}),
  };
}

export function findConflictDraftDeletedRounds(currentState, draftState) {
  const draftRoundIds = new Set((Array.isArray(draftState?.inspectionRounds) ? draftState.inspectionRounds : []).map((round) => String(round?.id || "")));
  const deletedRoundIds = new Set((Array.isArray(draftState?.deletedRoundIds) ? draftState.deletedRoundIds : []).map(String));
  return (Array.isArray(currentState?.inspectionRounds) ? currentState.inspectionRounds : []).filter((round) => {
    const id = String(round?.id || "");
    return id && deletedRoundIds.has(id) && !draftRoundIds.has(id);
  });
}

export function applyConflictDraftRoundDeletions(currentState, draftState, selectedRoundIds = []) {
  const selected = new Set(selectedRoundIds.map(String));
  return findConflictDraftDeletedRounds(currentState, draftState)
    .filter((round) => selected.has(String(round.id)))
    .reduce(removeInspectionRoundFromState, currentState);
}
