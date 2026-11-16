import { MODULE_ID } from './person-journal.js';
import { mergeOwnership, ownershipForSource, ownershipUpdate, privateOwnership, snapshotLocalOwnership } from './import-permissions.js';
import { withJournalLock } from './journal-lock.js';

export const syncEntryPermissions = (entry) => withJournalLock(entry, async () => {
  if (!entry.getFlag(MODULE_ID, 'managedOwnership')) return;
  const ownerships = [];
  const updates = [];
  for (const page of entry.pages) {
    const source = page.getFlag(MODULE_ID, 'permissionSource');
    const desired = source ? ownershipForSource(source)
      : page.getFlag(MODULE_ID, 'part') ? privateOwnership() : snapshotLocalOwnership(page);
    ownerships.push(desired);
    if (JSON.stringify(page.ownership) !== JSON.stringify(desired)) {
      updates.push({ _id: page.id, ownership: ownershipUpdate(page.ownership, desired) });
    }
  }
  if (updates.length) await entry.updateEmbeddedDocuments('JournalEntryPage', updates);
  const desired = mergeOwnership(ownerships);
  if (JSON.stringify(entry.ownership) !== JSON.stringify(desired)) {
    await entry.update({ ownership: ownershipUpdate(entry.ownership, desired) });
  }
});

let pending = null;
let running = false;
let dirty = false;
export const schedulePermissionSync = () => {
  if (!game.user.isGM || (game.users.activeGM && game.users.activeGM.id !== game.user.id)) return;
  dirty = true;
  if (pending || running) return;
  pending = setTimeout(async () => {
    pending = null;
    running = true;
    try {
      do {
        dirty = false;
        for (const entry of game.journal) await syncEntryPermissions(entry);
      } while (dirty);
    } catch (error) {
      console.error(`${MODULE_ID} | Permission sync failed`, error);
      ui.notifications.error(game.i18n.localize('ATLAS.Errors.PermissionSync'));
    } finally { running = false; }
  }, 100);
};
