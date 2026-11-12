import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDocumentPages } from '../scripts/document-journal.js';
import { MODULE_ID } from '../scripts/person-journal.js';
import { buildPersonSheetData } from '../scripts/person-sheet-data.js';
import { writePersonEntry } from '../scripts/journal-writer.js';

const labels = { profile: 'Profile', portrait: 'Portrait', author: 'Author', statuses: {} };
const document = { id: 'd1', title: 'Letter', subtitle: 'For Ada', text: 'A message.', ownerName: 'Bran', parameters: [['Year', '1024']], tags: ['letter'] };

test('imports document text, subtitle, author, parameters and tags as a private journal page', () => {
  const [page] = buildDocumentPages([document], { labels });
  assert.equal(page.name, 'Letter');
  assert.equal(page.type, 'text');
  assert.deepEqual(page.ownership, { default: 0 });
  assert.equal(page.flags[MODULE_ID].documentId, 'd1');
  assert.match(page.text.content, /For Ada/);
  assert.match(page.text.content, /Author:<\/strong> Bran/);
  assert.match(page.text.content, /<dt>Year<\/dt><dd>1024<\/dd>/);
  assert.match(page.text.content, /<p>A message\.<\/p>/);
  assert.match(page.text.content, /<li>letter<\/li>/);
});

test('escapes document metadata and fallback content, and uses the Markdown converter', () => {
  const source = { ...document, subtitle: '<img src=x>', ownerName: '<author>', parameters: [['<key>', '<value>']], tags: ['<tag>'], text: '<script>text</script>' };
  const [page] = buildDocumentPages([source], { labels });
  assert.doesNotMatch(page.text.content, /<img|<author>|<key>|<value>|<tag>|<script>/);
  assert.match(page.text.content, /&lt;img src=x&gt;/);
  const [converted] = buildDocumentPages([{ ...document, text: '**Hello**' }], {
    labels, converter: { makeHtml: (source) => { assert.equal(source, '**Hello**'); return '<p><strong>Hello</strong></p>'; } },
  });
  assert.match(converted.text.content, /<strong>Hello<\/strong>/);
});

test('rejects documents with missing or duplicate identifiers', () => {
  assert.throws(() => buildDocumentPages([{ ...document, id: null }], { labels }), /document ID/);
  assert.throws(() => buildDocumentPages([document, document], { labels }), /document ID/);
  assert.deepEqual(buildDocumentPages([], { labels }), []);
});

const makePage = (data, id) => ({ ...data, id, getFlag(scope, key) { return this.flags?.[scope]?.[key]; } });

test('sheet lists only authorized documents and keeps local pages distinct', () => {
  const [page] = buildDocumentPages([document], { labels });
  const visible = makePage(page, 'visible');
  const secret = makePage({ ...page, name: 'Secret', flags: { [MODULE_ID]: { part: 'document', documentId: 'secret' } } }, 'secret');
  const local = makePage({ name: 'Session notes' }, 'local');
  const entry = { name: 'Ada', pages: [visible, secret, local], getFlag: () => undefined };
  const data = buildPersonSheetData(entry, [visible, local]);
  assert.deepEqual(data.documents, [{ id: 'visible', name: 'Letter', subtitle: 'For Ada' }]);
  assert.deepEqual(data.localPages, [{ id: 'local', name: 'Session notes' }]);
  assert.doesNotMatch(JSON.stringify(data), /Secret|secret/);
});

test('reimports documents in place, preserves individual ownership and local notes, and removes stale imports', async () => {
  let nextId = 0;
  const initial = buildDocumentPages([
    document, { ...document, id: 'd2', title: 'Private' }, { ...document, id: 'd3', title: 'Removed' },
  ], { labels }).map((data, index) => makePage(data, `page${index}`));
  initial[0].ownership = { default: 0, player: 2 };
  const local = makePage({ name: 'Letter', text: { content: 'Local text' } }, 'local');
  const entry = {
    pages: [...initial, local], flags: { [MODULE_ID]: { personId: 'p1', scopeId: 'w1' } },
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; },
    async update(data) { this.flags = { ...this.flags, ...data.flags }; },
    async updateEmbeddedDocuments(_type, pages) { for (const page of pages) Object.assign(this.pages.find((old) => old.id === page._id), page); },
    async createEmbeddedDocuments(_type, pages) { this.pages.push(...pages.map((page) => makePage(page, `new${nextId++}`))); },
    async deleteEmbeddedDocuments(_type, ids) { this.pages = this.pages.filter((page) => !ids.includes(page.id)); },
  };
  globalThis.game = { journal: [entry] };
  const options = { folder: { id: 'folder' }, labels, documents: [
    { ...document, title: 'Updated letter', text: 'Updated content' },
    { ...document, id: 'd2', title: 'Private update' },
    { ...document, id: 'd4', title: 'New document' },
  ] };
  const person = { id: 'p1', name: 'Ada' };
  const scope = { type: 'world', id: 'w1', name: 'World' };
  await writePersonEntry(person, scope, options);
  const imported = () => entry.pages.filter((page) => page.getFlag(MODULE_ID, 'part') === 'document');
  assert.equal(imported().length, 3);
  assert.equal(imported()[0].id, 'page0');
  assert.match(imported()[0].text.content, /Updated content/);
  assert.deepEqual(imported()[0].ownership, { default: 0, player: 2 });
  assert.deepEqual(imported()[1].ownership, { default: 0 });
  assert.equal(entry.pages.some((page) => page.id === 'page2'), false);
  assert.equal(entry.pages.find((page) => page.id === 'local'), local);
  const ids = entry.pages.map((page) => page.id);
  await writePersonEntry(person, scope, options);
  assert.deepEqual(entry.pages.map((page) => page.id), ids);
  assert.equal(imported().length, 3);
  options.documents = [];
  await writePersonEntry(person, scope, options);
  assert.equal(imported().length, 0);
  assert.equal(entry.pages.find((page) => page.id === 'local').text.content, 'Local text');
});
