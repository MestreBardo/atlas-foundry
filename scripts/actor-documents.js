import { MODULE_ID } from './person-journal.js';
import { getActorLink } from './actor-links.js';

const canRead = (document, user) => {
  // Atlas compendiums are private archives; per-page ownership never bypasses pack access.
  if ((document?.pack || document?.parent?.pack) && !user.isGM) return false;
  return document?.testUserPermission(user, 'OBSERVER') === true;
};

const includesAdventurer = (source, id) => {
  if (!source || source.type !== 'document') return false;
  if (source.kind === 'adventurers') return source.adventurerId === id || source.viewerIds?.includes(id);
  if (source.ownerId) return source.ownerId === id || source.viewerIds?.includes(id);
  return (source.kind === 'persons' ? source.viewerIds : source.entryViewerIds)?.includes(id);
};

/** Resolve on each render. A character flag never grants access to a journal or page. */
export const actorDocumentData = async (actor, user = game.user) => {
  if (!canRead(actor, user)) return { records: [], documents: [] };
  const linked = getActorLink(actor);
  const entries = new Map();
  const importKey = actor.getFlag(MODULE_ID, 'importKey');
  const worldEntry = importKey ? game.journal.find((entry) => entry.getFlag(MODULE_ID, 'importKey') === importKey && canRead(entry, user)) : null;
  const directUuid = actor.getFlag(MODULE_ID, 'journalUuid');
  if (worldEntry) entries.set(worldEntry.uuid, { entry: worldEntry, direct: true });
  else if (directUuid) {
    const entry = await fromUuid(directUuid).catch(() => null);
    if (entry?.documentName === 'JournalEntry' && canRead(entry, user)) entries.set(entry.uuid, { entry, direct: true });
  }
  if (linked) {
    for (const entry of game.journal) {
      if (entry.getFlag(MODULE_ID, 'scopeType') !== 'campaign' ||
        entry.getFlag(MODULE_ID, 'scopeId') !== linked.campaignId || !canRead(entry, user)) continue;
      const relevant = (entry.getFlag(MODULE_ID, 'entityType') === 'adventurers' &&
        entry.getFlag(MODULE_ID, 'entityId') === linked.adventurerId) || [...entry.pages].some((page) => {
        const permission = page.getFlag(MODULE_ID, 'permissionSource');
        return includesAdventurer(permission, linked.adventurerId) && canRead(page, user);
      });
      if (relevant) entries.set(entry.uuid, { entry, direct: false });
    }
  }
  const records = [];
  const documents = [];
  for (const { entry, direct } of entries.values()) {
    records.push({ name: entry.name, uuid: entry.uuid });
    for (const page of entry.pages) {
      if (page.getFlag(MODULE_ID, 'part') !== 'document' || !canRead(page, user)) continue;
      const permission = page.getFlag(MODULE_ID, 'permissionSource');
      if (!direct && linked && !includesAdventurer(permission, linked.adventurerId)) continue;
      documents.push({ name: page.name, uuid: page.uuid, sourceName: entry.name,
        subtitle: page.getFlag(MODULE_ID, 'subtitle') ?? '' });
    }
  }
  documents.sort((a, b) => a.name.localeCompare(b.name));
  return { records, documents };
};

export const openReadableJournal = async (uuid) => {
  const document = await fromUuid(uuid).catch(() => null);
  const page = document?.documentName === 'JournalEntryPage' ? document : null;
  const entry = page ? page.parent : document;
  if (entry?.documentName !== 'JournalEntry' || !canRead(entry, game.user) || (page && !canRead(page, game.user))) return;
  return new foundry.applications.sheets.journal.JournalEntrySheet({ document: entry })
    .render({ force: true, ...(page ? { pageId: page.id } : {}) });
};
