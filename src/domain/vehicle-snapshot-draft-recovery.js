function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

// Recover only the empty archive field introduced into historical closed rounds.
// Other historical changes must still go through the normal conflict flow.
export function recoverVehicleSnapshotDraft(draft, current) {
  const currentRounds = new Map((current?.inspectionRounds || []).map(round => [round.id, round]));
  let repaired = false;
  const rounds = (draft?.inspectionRounds || []).map(round => {
    const stored = currentRounds.get(round.id);
    if (stored?.status !== 'closed') return round;
    if (stable(round) === stable(stored)) return round;
    const { vehicleEvidenceArchive, ...withoutArchive } = round;
    if (!Object.hasOwn(stored, 'vehicleEvidenceArchive') && vehicleEvidenceArchive
      && Object.keys(vehicleEvidenceArchive).length === 0 && stable(withoutArchive) === stable(stored)) {
      repaired = true;
      return stored;
    }
    return round;
  });
  if (!repaired) return null;
  for (let index = 0; index < rounds.length; index++) {
    const round = rounds[index];
    if (round.status === 'closed') continue;
    const stored = currentRounds.get(round.id);
    const search = round.vehicleSearch;
    const night = search?.scopes?.night;
    const day = search?.scopes?.day;
    const previousDay = stored?.vehicleSearch?.scopes?.day;
    // A night query ending exactly at 06:00 previously cleared the day scope.
    if (night?.fetchedAt && night.rows?.length && day?.rows?.length === 0
      && previousDay?.rows?.length && day.fetchedAt === night.fetchedAt
      && stable(day.criteria) === stable(night.criteria)
      && /T18:00$/.test(night.criteria?.startAt || '') && /T06:00$/.test(night.criteria?.endAt || '')) {
      rounds[index] = { ...round, vehicleSearch: { ...search, scopes: { ...search.scopes, day: previousDay } } };
    }
  }
  return { ...draft, inspectionRounds: rounds };
}
