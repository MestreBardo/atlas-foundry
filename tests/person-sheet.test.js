import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPersonPages, MODULE_ID, PERSON_SHEET_ID } from '../scripts/person-journal.js';
import { buildPersonSheetData } from '../scripts/person-sheet-data.js';
import { writePersonEntry } from '../scripts/journal-writer.js';

const labels = { portrait: 'Portrait', profile: 'Profile', statuses: {} };
const person = {
  id: 'p1', name: 'Ada', age: 0, height: '', status: 'alive',
  nicknames: ['The Grey'], tags: ['royal'],
  positions: [{ levelName: 'Queen', ownerName: 'Northreach' }],
  description: 'History', portrait: 'ada.webp',
};
const pageDocument = (data, id = 'page') => ({
  ...data, id, getFlag: (scope, key) => data.flags?.[scope]?.[key],
});
const entryDocument = (pages) => ({
  name: person.name, pages,
  getFlag: (scope, key) => scope === MODULE_ID && key === 'scopeName' ? 'Northreach' : undefined,
});

test('dossier uses imported facts, keeps zero age and lists local pages', () => {
  const pages = buildPersonPages(person, { labels }).map(pageDocument);
  pages.push(pageDocument({ name: 'Table notes', type: 'text' }, 'notes'));
  const data = buildPersonSheetData(entryDocument(pages), pages);
  assert.equal(data.portrait, 'ada.webp');
  assert.deepEqual(data.facts, [{ label: 'ATLAS.Journal.Age', value: 0 }]);
  assert.deepEqual(data.positions, ['Queen · Northreach']);
  assert.deepEqual(data.localPages, [{ id: 'notes', name: 'Table notes' }]);
  assert.match(data.profileHtml, /atlas-person-description/);
  assert.equal(pages[1].getFlag(MODULE_ID, 'person').descriptionHtml, undefined);
});

test('a hidden profile never supplies facts, tags or history to the dossier', () => {
  const pages = buildPersonPages(person, { labels }).map(pageDocument);
  const data = buildPersonSheetData(entryDocument(pages), [pages[0]]);
  assert.equal(data.hasProfile, false);
  assert.deepEqual(data.facts, []);
  assert.deepEqual(data.tags, []);
  assert.equal(data.profileHtml, '');
  assert.equal(data.status, '');
});

test('old imports still expose their native profile content', () => {
  const profile = pageDocument({
    type: 'text', text: { content: '<p>Old history</p>' },
    flags: { [MODULE_ID]: { part: 'profile' } },
  });
  const data = buildPersonSheetData(entryDocument([profile]), [profile]);
  assert.equal(data.profileHtml, '<p>Old history</p>');
});

test('new imports choose the Atlas sheet without changing default ownership', async () => {
  let created;
  globalThis.game = { journal: [] };
  globalThis.foundry = { documents: { JournalEntry: { create: async (data) => { created = data; } } } };
  const result = await writePersonEntry(person, { id: 'w1', type: 'world', name: 'World' }, {
    folder: { id: 'folder' }, labels,
  });
  assert.equal(result, 'created');
  assert.equal(created.flags.core.sheetClass, PERSON_SHEET_ID);
  assert.equal(created.ownership, undefined);
});

test('reimport upgrades older entries, preserves local pages and explicit sheet choices', async () => {
  for (const chosenSheet of [undefined, 'other.CustomSheet']) {
    let update;
    let removed;
    let added;
    const entry = {
      pages: [
        pageDocument({ flags: { [MODULE_ID]: { part: 'profile' } }, ownership: { default: 0, player: 2 } }, 'imported'),
        pageDocument({ name: 'Local' }, 'local'),
      ],
      getFlag: (scope, key) => scope === 'core' ? chosenSheet : { personId: 'p1', scopeId: 'w1' }[key],
      update: async (data) => { update = data; },
      deleteEmbeddedDocuments: async (_type, ids) => { removed = ids; },
      createEmbeddedDocuments: async (_type, pages) => { added = pages; },
    };
    globalThis.game = { journal: [entry] };
    const result = await writePersonEntry(person, { id: 'w1', type: 'world', name: 'World' }, {
      folder: { id: 'folder' }, labels,
    });
    assert.equal(result, 'updated');
    assert.deepEqual(removed, ['imported']);
    assert.equal(added.length, 2);
    assert.deepEqual(added[1].ownership, { default: 0, player: 2 });
    assert.equal(update.flags.core?.sheetClass, chosenSheet ? undefined : PERSON_SHEET_ID);
    assert.equal(update.ownership, undefined);
  }
});
