const pending = new WeakMap();

/** Serialize reimports and live permission refreshes on the same document. */
export const withJournalLock = (entry, action) => {
  const operation = (pending.get(entry) ?? Promise.resolve()).then(action);
  pending.set(entry, operation.catch(() => {}));
  return operation;
};
