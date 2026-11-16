import { MODULE_ID, PERSON_SHEET_ID } from './person-journal.js';
import { buildEntityPages } from './entity-journal.js';
import { formatDropCapHtml } from './drop-cap.js';
import { findEntityEntry, importedEntityKey } from './import-target.js';
import { mergeOwnership, ownershipForSource, ownershipUpdate, snapshotLocalOwnership } from './import-permissions.js';
import { withJournalLock } from './journal-lock.js';

const pageKey = (page) => {
  const flags = page.flags?.[MODULE_ID] ?? { part: page.getFlag?.(MODULE_ID, 'part'), documentId: page.getFlag?.(MODULE_ID, 'documentId') };
  return flags.part === 'document' ? `document:${flags.documentId}` : flags.part;
};

export const writeEntityEntry = async (kind, entity, documents, scope, target, labels) => {
  const Converter = globalThis.showdown?.Converter;
  const converter = Converter ? new Converter({ tables: true, strikethrough: true, simpleLineBreaks: true }) : null;
  const pages = buildEntityPages(kind, entity, documents, { labels, scope, converter });
  for (const page of pages) if (page.type === 'text') page.text.content = formatDropCapHtml(page.text.content);
  const flags = { [MODULE_ID]: {
    importKey: importedEntityKey(scope, kind, entity.id), entityType: kind, entityId: entity.id,
    ...(kind === 'persons' ? { personId: entity.id } : {}),
    scopeType: scope.type, scopeId: scope.id, scopeName: scope.name,
    managedOwnership: true, importedAt: new Date().toISOString(),
  } };
  const existing = findEntityEntry(target.entries, scope, kind, entity.id);
  if (kind === 'persons' && !existing?.getFlag('core', 'sheetClass')) flags.core = { sheetClass: PERSON_SHEET_ID };
  if (!existing) {
    const entry = await foundry.documents.JournalEntry.create({
      name: entity.name, folder: target.folder?.id ?? null, pages, flags,
      ownership: mergeOwnership(pages.map((page) => page.ownership)),
    }, target.journalPack ? { pack: target.journalPack.collection } : {});
    if (Array.isArray(target.entries) && !target.entries.some(({ id }) => id === entry.id)) target.entries.push(entry);
    return { status: 'created', entry };
  }
  return withJournalLock(existing, async () => {
    // A link may have changed while another reimport was holding the document lock.
    for (const page of pages) page.ownership = ownershipForSource(page.flags[MODULE_ID].permissionSource);
    const previousPages = new Map([...existing.pages].filter((page) => pageKey(page)).map((page) => [pageKey(page), page]));
    const updates = [];
    const additions = [];
    const retainedIds = new Set();
    for (const page of pages) {
      const previous = previousPages.get(pageKey(page));
      if (!previous) additions.push(page);
      else {
        updates.push({ ...page, _id: previous.id, ownership: ownershipUpdate(previous.ownership, page.ownership) });
        retainedIds.add(previous.id);
      }
    }
    // Freeze local notes at their current effective permissions before changing the parent audience.
    const localOwnerships = [];
    for (const page of existing.pages) {
      if (pageKey(page)) continue;
      const ownership = snapshotLocalOwnership(page);
      localOwnerships.push(ownership);
      updates.push({ _id: page.id, ownership: ownershipUpdate(page.ownership, ownership) });
    }
    const deleted = [...existing.pages].filter((page) => pageKey(page) && !retainedIds.has(page.id)).map((page) => page.id);
    // Tighten individual pages before making any new reader able to open the parent.
    if (updates.length) await existing.updateEmbeddedDocuments('JournalEntryPage', updates);
    if (additions.length) await existing.createEmbeddedDocuments('JournalEntryPage', additions);
    if (deleted.length) await existing.deleteEmbeddedDocuments('JournalEntryPage', deleted);
    await existing.update({ name: entity.name, flags,
      ownership: ownershipUpdate(existing.ownership, mergeOwnership([...pages.map((page) => page.ownership), ...localOwnerships])),
    });
    return { status: 'updated', entry: existing };
  });
};
