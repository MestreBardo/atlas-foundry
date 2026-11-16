import { buildScopeKey, MODULE_ID } from './person-journal.js';
import { ensureScopeFolder } from './journal-writer.js';
import { localize } from './localization.js';

export const PRIVATE_PACK_OWNERSHIP = { PLAYER: 'NONE', TRUSTED: 'NONE', ASSISTANT: 'OWNER', GAMEMASTER: 'OWNER' };

const error = (code) => { throw Object.assign(new Error(code), { code }); };

export const ensureImportPack = async (scope, documentName, label) => {
  const name = `atlas-${scope.type}-${scope.id}-${documentName.toLowerCase()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  let pack = game.packs.get(`world.${name}`);
  if (!pack) {
    pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
      name, label: `${label || `Atlas · ${scope.name}`} · ${localize(documentName === 'Actor' ? 'ATLAS.Importer.ActorPack' : 'ATLAS.Importer.JournalPack')}`,
      type: documentName, package: 'world',
    });
    // Keep the pack empty until its role permissions have been set and verified.
    await pack.configure({ ownership: PRIVATE_PACK_OWNERSHIP, locked: false });
  }
  if (pack.documentName !== documentName) error('INVALID_PACK_TYPE');
  if (pack.ownership.PLAYER !== 'NONE' || pack.ownership.TRUSTED !== 'NONE') error('PACK_NOT_PRIVATE');
  if (pack.locked) error('PACK_LOCKED');
  return pack;
};

export const createImportTarget = async (scope, { destination = 'world', createActors = false, packLabel = '' } = {}) => {
  if (destination !== 'world' && destination !== 'compendium') error('INVALID_DESTINATION');
  if (destination === 'world') return {
    destination, folder: await ensureScopeFolder(scope), entries: game.journal, actors: game.actors,
    journalPack: null, actorPack: null,
  };
  const journalPack = await ensureImportPack(scope, 'JournalEntry', packLabel);
  const actorPack = createActors ? await ensureImportPack(scope, 'Actor', packLabel) : null;
  return {
    destination, folder: null, journalPack, actorPack,
    entries: await journalPack.getDocuments(), actors: actorPack ? await actorPack.getDocuments() : [],
  };
};

export const importedEntityKey = (scope, kind, id) => `${buildScopeKey(scope)}:${kind}:${id}`;

export const findEntityEntry = (entries, scope, kind, id) => entries.find((entry) =>
  entry.getFlag(MODULE_ID, 'importKey') === importedEntityKey(scope, kind, id) ||
  (kind === 'persons' && entry.getFlag(MODULE_ID, 'personId') === id &&
    entry.getFlag(MODULE_ID, 'scopeId') === scope.id),
);
