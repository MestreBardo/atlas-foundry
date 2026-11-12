import { buildPersonFlags, buildPersonPages, buildScopeKey, MODULE_ID, PERSON_SHEET_ID } from './person-journal.js';
import { formatDropCapHtml } from './drop-cap.js';
import { buildDocumentPages } from './document-journal.js';

const findScopeFolder = (scope) =>
  game.folders.find(
    (folder) =>
      folder.type === 'JournalEntry' && folder.getFlag(MODULE_ID, 'scopeKey') === buildScopeKey(scope),
  );

export const ensureScopeFolder = async (scope) => {
  const existing = findScopeFolder(scope);
  if (existing) {
    return existing;
  }
  return foundry.documents.Folder.create({
    name: `Atlas · ${scope.name}`,
    type: 'JournalEntry',
    flags: { [MODULE_ID]: { scopeKey: buildScopeKey(scope) } },
  });
};

const findImportedEntry = (person, scope) =>
  game.journal.find(
    (entry) =>
      entry.getFlag(MODULE_ID, 'personId') === person.id &&
      entry.getFlag(MODULE_ID, 'scopeId') === scope.id,
  );

const createMarkdownConverter = () => {
  const Converter = globalThis.showdown?.Converter;
  return Converter ? new Converter({ tables: true, strikethrough: true, simpleLineBreaks: true }) : null;
};

const importedPageKey = (page) => {
  const flags = page.flags?.[MODULE_ID];
  if (!flags?.part) return null;
  return flags.part === 'document' ? `document:${flags.documentId}` : flags.part;
};

export const writePersonEntry = async (person, scope, { folder, labels, documents = [] }) => {
  const converter = createMarkdownConverter();
  const pages = [
    ...buildPersonPages(person, { labels, converter }),
    ...buildDocumentPages(documents, { labels, converter }),
  ];
  for (const page of pages) {
    if (page.type === 'text') page.text.content = formatDropCapHtml(page.text.content);
  }
  const flags = buildPersonFlags(person, scope);
  const existing = findImportedEntry(person, scope);
  if (!existing) {
    flags.core = { sheetClass: PERSON_SHEET_ID };
    await foundry.documents.JournalEntry.create({ name: person.name, folder: folder.id, pages, flags });
    return 'created';
  }
  // Upgrade older imports, preserving any sheet explicitly chosen by the user.
  if (!existing.getFlag('core', 'sheetClass')) {
    flags.core = { sheetClass: PERSON_SHEET_ID };
  }
  const previousPages = new Map();
  for (const previous of existing.pages) {
    const part = previous.getFlag(MODULE_ID, 'part');
    if (!part) continue;
    const key = part === 'document' ? `document:${previous.getFlag(MODULE_ID, 'documentId')}` : part;
    previousPages.set(key, previous);
  }
  const updates = [];
  const additions = [];
  const retainedIds = new Set();
  // Update imported pages in place, retaining UUIDs and each page's permissions.
  for (const page of pages) {
    const previous = previousPages.get(importedPageKey(page));
    if (!previous) {
      additions.push(page);
      continue;
    }
    if (previous.ownership) page.ownership = structuredClone(previous.ownership);
    updates.push({ ...page, _id: previous.id });
    retainedIds.add(previous.id);
  }
  const oldPageIds = existing.pages
    .filter((page) => page.getFlag(MODULE_ID, 'part') && !retainedIds.has(page.id))
    .map((page) => page.id);
  await existing.update({ name: person.name, flags });
  if (updates.length) await existing.updateEmbeddedDocuments('JournalEntryPage', updates);
  if (additions.length) await existing.createEmbeddedDocuments('JournalEntryPage', additions);
  if (oldPageIds.length > 0) {
    await existing.deleteEmbeddedDocuments('JournalEntryPage', oldPageIds);
  }
  return 'updated';
};
