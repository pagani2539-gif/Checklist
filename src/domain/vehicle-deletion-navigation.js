// Use the queue before deletion so removed rows retain their ordering position.
export function getVehicleAfterDeletion(orderedRows, deletedIds, isPending) {
  const deleted = new Set(deletedIds);
  const anchor = orderedRows.reduce((last, row, index) => deleted.has(row.id) ? index : last, -1);
  const remainingRows = orderedRows.filter(row => !deleted.has(row.id));
  const nextRow = [...orderedRows.slice(anchor + 1), ...orderedRows.slice(0, anchor + 1)]
    .find(row => !deleted.has(row.id) && isPending(row)) || null;
  return { nextRow, remainingRows, complete: remainingRows.length > 0 && !nextRow };
}
