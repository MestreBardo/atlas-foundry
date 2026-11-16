import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { actorDocumentData, openReadableJournal } from '../scripts/actor-documents.js';
import { writeEntityEntry } from '../scripts/entity-writer.js';
import { createImportTarget } from '../scripts/import-target.js';
import { MODULE_ID } from '../scripts/person-journal.js';
import { MockDocument, addLinkedActor, labels, scope, setupFoundry } from './helpers/foundry.js';

let aliceActor;
let bobActor;
let pendingActor;
beforeEach(() => {
  setupFoundry();
  aliceActor = addLinkedActor('a1', 'alice'); bobActor = addLinkedActor('a2', 'bob'); pendingActor = addLinkedActor('a3', 'pending');
});

const importDocuments = async () => writeEntityEntry('adventurers', { id: 'a1', name: 'Aria', background: 'Private past' }, [
  { id: 'private', title: 'Private letter', text: 'Secret' },
  { id: 'shared', title: 'Shared letter', text: 'Shared text', viewerIds: ['a2'], pendingIds: ['a3'] },
], scope, await createImportTarget(scope), labels);

test('a linked character lists its own documents, and recipients see only accepted shares', async () => {
  await importDocuments();
  const owner = await actorDocumentData(aliceActor, game.users[1]);
  const shared = await actorDocumentData(bobActor, game.users[2]);
  const pending = await actorDocumentData(pendingActor, game.users[3]);
  assert.deepEqual(owner.documents.map(({ name }) => name), ['Private letter', 'Shared letter']);
  assert.deepEqual(shared.documents.map(({ name }) => name), ['Shared letter']);
  assert.doesNotMatch(JSON.stringify(shared), /Private letter|Private past|Secret/);
  assert.deepEqual(pending, { records: [], documents: [] });
});

test('documents authored by adventurers on persons are also available from their character sheets', async () => {
  await writeEntityEntry('persons', { id: 'person1', name: 'The King', viewerIds: ['a1', 'a2', 'a3'] }, [
    { id: 'd1', title: 'Aria’s notes', text: 'Shared notes', ownerId: 'a1', viewerIds: ['a2'], pendingIds: ['a3'] },
  ], scope, await createImportTarget(scope), labels);
  assert.equal((await actorDocumentData(aliceActor, game.users[1])).documents[0].name, 'Aria’s notes');
  assert.equal((await actorDocumentData(bobActor, game.users[2])).documents[0].name, 'Aria’s notes');
  assert.deepEqual((await actorDocumentData(pendingActor, game.users[3])).documents, []);
});

test('a forged journal reference on an Actor cannot reveal an unauthorized page or title', async () => {
  const privateEntry = new MockDocument({ name: 'Secret journal', ownership: { default: 0 }, pages: [
    { name: 'Secret title', flags: { [MODULE_ID]: { part: 'document' } }, ownership: { default: 0 } },
  ] }, 'JournalEntry');
  bobActor.flags[MODULE_ID].journalUuid = privateEntry.uuid;
  assert.deepEqual(await actorDocumentData(bobActor, game.users[2]), { records: [], documents: [] });
});

test('compendium references stay private even if a stored page lists the current player', async () => {
  const target = await createImportTarget(scope, { destination: 'compendium' });
  const { entry } = await writeEntityEntry('adventurers', { id: 'a1', name: 'Aria' }, [
    { id: 'd1', title: 'Pack document', text: 'Private archive', viewerIds: ['a2'] },
  ], scope, target, labels);
  aliceActor.flags[MODULE_ID].journalUuid = entry.uuid;
  assert.deepEqual(await actorDocumentData(aliceActor, game.users[1]), { records: [], documents: [] });
  assert.equal((await actorDocumentData(aliceActor, game.user)).documents.length, 1);
});

test('opening a document rechecks permissions after a previously visible link was revoked', async () => {
  const { entry } = await importDocuments();
  const page = entry.pages.find((page) => page.getFlag(MODULE_ID, 'documentId') === 'shared');
  let opened = 0;
  foundry.applications = { sheets: { journal: { JournalEntrySheet: class { render() { opened += 1; } } } } };
  game.user = game.users[2];
  await openReadableJournal(page.uuid);
  assert.equal(opened, 1);
  page.ownership = { default: 0, alice: 2 };
  await openReadableJournal(page.uuid);
  assert.equal(opened, 1);
});

test('an Actor imported from a pack resolves its matching world journal before its archived UUID', async () => {
  const target = await createImportTarget(scope, { destination: 'compendium' });
  const entity = { id: 'person', name: 'An NPC', viewerIds: ['a1'] };
  const docs = [{ id: 'shared', title: 'Visible in world', text: 'Read', viewerIds: ['a1'] }];
  const archived = await writeEntityEntry('persons', entity, docs, scope, target, labels);
  const world = await writeEntityEntry('persons', entity, docs, scope, await createImportTarget(scope), labels);
  aliceActor.flags[MODULE_ID].journalUuid = archived.entry.uuid;
  aliceActor.flags[MODULE_ID].importKey = archived.entry.getFlag(MODULE_ID, 'importKey');
  const data = await actorDocumentData(aliceActor, game.users[1]);
  assert.equal(data.documents[0].uuid, world.entry.pages.find((page) => page.name === 'Visible in world').uuid);
  assert.equal(data.records[0].uuid, world.entry.uuid);
});
