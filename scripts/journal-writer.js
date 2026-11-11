import { buildPersonFlags, buildPersonPages, buildScopeKey, MODULE_ID } from './person-journal.js';

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

export const writePersonEntry = async (person, scope, { folder, labels }) => {
  const pages = buildPersonPages(person, { labels, converter: createMarkdownConverter() });
  const flags = buildPersonFlags(person, scope);
  const existing = findImportedEntry(person, scope);
  if (!existing) {
    await foundry.documents.JournalEntry.create({ name: person.name, folder: folder.id, pages, flags });
    return 'created';
  }
  await existing.update({ name: person.name, flags });
  const oldPageIds = existing.pages
    .filter((page) => page.getFlag(MODULE_ID, 'part'))
    .map((page) => page.id);
  if (oldPageIds.length > 0) {
    await existing.deleteEmbeddedDocuments('JournalEntryPage', oldPageIds);
  }
  await existing.createEmbeddedDocuments('JournalEntryPage', pages);
  return 'updated';
};
