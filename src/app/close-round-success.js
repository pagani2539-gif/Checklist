export function completeCloseRound(outcome, roundId, onSuccess, navigate) {
  if (outcome === null) return false;
  onSuccess(roundId);
  navigate(`#/history/${encodeURIComponent(roundId)}`);
  return true;
}

export function shouldShowCloseSuccess(roundId, route) {
  return Boolean(roundId && route?.name === "historyDetail" && route.id === roundId);
}
