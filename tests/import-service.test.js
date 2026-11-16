import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { importEntity } from '../scripts/import-service.js';
import { createImportTarget } from '../scripts/import-target.js';
import { writeEntityEntry } from '../scripts/entity-writer.js';
import { writeEntityActor } from '../scripts/actor-writer.js';
import { syncEntryPermissions } from '../scripts/permission-sync.js';
import { MODULE_ID } from '../scripts/person-journal.js';
import { MockDocument, addLinkedActor, labels, scope, setupFoundry } from './helpers/foundry.js';

beforeEach(setupFoundry);
const adventurer = { id: 'a1', name: 'Aria', personality: 'Public profile', background: 'Private past', image: 'aria.webp' };
const documents = [{ id: 'd1', title: 'Secret letter', text: 'Sensitive text', viewerIds: ['a2'], pendingIds: ['a3'] }];
const world = () => createImportTarget(scope);

test('adventurer documents attach to a journal with different profile and document audiences', async () => {
  addLinkedActor('a1', 'alice'); addLinkedActor('a2', 'bob'); addLinkedActor('a3', 'pending');
  const { entry } = await writeEntityEntry('adventurers', adventurer, documents, scope, await world(), labels);
  assert.deepEqual(entry.ownership, { default: 0, alice: 2, bob: 2 });
  assert.equal(entry.pages.find((page) => page.getFlag(MODULE_ID, 'part') === 'background').testUserPermission(game.users[2], 2), false);
  assert.deepEqual(entry.pages.find((page) => page.getFlag(MODULE_ID, 'part') === 'document').ownership, { default: 0, alice: 2, bob: 2 });
  assert.equal(entry.pages.some((page) => page.ownership.pending), false);
});

test('reimport keeps page IDs, removes revoked readers and documents, and preserves local notes', async () => {
  addLinkedActor('a1', 'alice'); addLinkedActor('a2', 'bob');
  const target = await world();
  const initial = await writeEntityEntry('adventurers', adventurer, documents, scope, target, labels);
  const page = initial.entry.pages.find((page) => page.getFlag(MODULE_ID, 'documentId') === 'd1');
  await initial.entry.createEmbeddedDocuments('JournalEntryPage', [{ name: 'Local note', text: { content: 'Keep me' }, ownership: { default: 0 } }]);
  const id = page.id;
  const updated = await writeEntityEntry('adventurers', adventurer, [{ ...documents[0], viewerIds: [], text: 'Updated' }], scope, target, labels);
  assert.equal(updated.status, 'updated');
  assert.equal(page.id, id);
  assert.equal(page.testUserPermission(game.users[2], 2), false);
  assert.equal(updated.entry.testUserPermission(game.users[2], 2), false);
  assert.equal(game.journal.length, 1);
  await writeEntityEntry('adventurers', adventurer, [], scope, target, labels);
  assert.equal(initial.entry.pages.some((page) => page.id === id), false);
  assert.equal(initial.entry.pages.find((page) => page.name === 'Local note').text.content, 'Keep me');
});

test('linking a previously private import never exposes inherited local notes', async () => {
  const target = await world();
  const { entry } = await writeEntityEntry('adventurers', adventurer, documents, scope, target, labels);
  await entry.createEmbeddedDocuments('JournalEntryPage', [{ name: 'GM note', ownership: { default: -1 } }]);
  addLinkedActor('a1', 'alice');
  await writeEntityEntry('adventurers', adventurer, documents, scope, target, labels);
  assert.equal(entry.testUserPermission(game.users[1], 2), true);
  assert.equal(entry.pages.find((page) => page.name === 'GM note').testUserPermission(game.users[1], 1), false);
});

test('losing a character link revokes document access without another Atlas request', async () => {
  const actor = addLinkedActor('a1', 'alice'); addLinkedActor('a2', 'bob');
  const { entry } = await writeEntityEntry('adventurers', adventurer, documents, scope, await world(), labels);
  actor.flags[MODULE_ID].adventurerLinks = [];
  await syncEntryPermissions(entry);
  assert.deepEqual(entry.ownership, { default: 0 });
  assert.equal(entry.pages.every((page) => JSON.stringify(page.ownership) === '{"default":0}'), true);
});

test('ownership changes transfer access to the new player and revoke the previous player', async () => {
  const actor = addLinkedActor('a1', 'alice');
  const { entry } = await writeEntityEntry('adventurers', adventurer, [], scope, await world(), labels);
  actor.ownership = { default: 0, bob: 3 };
  await syncEntryPermissions(entry);
  assert.deepEqual(entry.ownership, { default: 0, bob: 2 });
});

test('places and factions keep different import identities even when their IDs coincide', async () => {
  const target = await world();
  for (const kind of ['places', 'factions']) {
    const entity = { id: 'same', name: kind, description: 'History', image: 'image.webp', tags: ['tag'] };
    await writeEntityEntry(kind, entity, [], scope, target, labels);
    await writeEntityEntry(kind, entity, [], scope, target, labels);
  }
  assert.equal(game.journal.length, 2);
  assert.deepEqual(game.journal.map((entry) => entry.getFlag(MODULE_ID, 'entityType')), ['places', 'factions']);
});

test('creates and reuses separate GM-private journal and Actor compendiums', async () => {
  let target = await createImportTarget(scope, { destination: 'compendium', createActors: true });
  const { entry } = await writeEntityEntry('persons', { id: 'p1', name: 'NPC' }, [], scope, target, labels);
  const first = await writeEntityActor('persons', { id: 'p1', name: 'NPC' }, scope, target, entry, 'npc');
  assert.ok(first.actor.pack);
  target = await createImportTarget(scope, { destination: 'compendium', createActors: true });
  const second = await writeEntityEntry('persons', { id: 'p1', name: 'Updated NPC' }, [], scope, target, labels);
  const actor = await writeEntityActor('persons', { id: 'p1', name: 'Updated NPC' }, scope, target, second.entry, 'npc');
  assert.equal(actor.status, 'updated');
  assert.equal(game.packs.size, 2);
  assert.equal(game.journal.length, 0);
  assert.equal(game.actors.length, 0);
  for (const pack of game.packs.values()) {
    assert.equal(pack.documents.length, 1);
    assert.equal(pack.ownership.PLAYER, 'NONE');
    assert.ok(game.packEvents.indexOf(`secure:${pack.collection}`) < game.packEvents.indexOf(`write:${pack.collection}`));
  }
});

test('a manually shared or locked compendium cannot receive private imports', async () => {
  const target = await createImportTarget(scope, { destination: 'compendium' });
  target.journalPack.ownership.PLAYER = 'OBSERVER';
  await assert.rejects(createImportTarget(scope, { destination: 'compendium' }), { code: 'PACK_NOT_PRIVATE' });
  target.journalPack.ownership.PLAYER = 'NONE'; target.journalPack.locked = true;
  await assert.rejects(createImportTarget(scope, { destination: 'compendium' }), { code: 'PACK_LOCKED' });
});

test('optional Actor creation reuses linked player sheets without changing their data', async () => {
  const actor = addLinkedActor('a1', 'alice', 'c1', { name: 'Live sheet' });
  const target = await world();
  const { entry } = await writeEntityEntry('adventurers', adventurer, documents, scope, target, labels);
  const before = { name: actor.name, type: actor.type, system: structuredClone(actor.system), ownership: structuredClone(actor.ownership) };
  const result = await writeEntityActor('adventurers', adventurer, scope, target, entry, 'npc');
  assert.equal(result.status, 'linked');
  assert.equal(result.actor, actor);
  assert.deepEqual({ name: actor.name, type: actor.type, system: actor.system, ownership: actor.ownership }, before);
});

test('new Actors contain a journal reference and no private document text or game statistics', async () => {
  const target = await world();
  const { entry } = await writeEntityEntry('adventurers', adventurer, documents, scope, target, labels);
  const { actor } = await writeEntityActor('adventurers', adventurer, scope, target, entry, 'character');
  assert.equal(actor.getFlag(MODULE_ID, 'journalUuid'), entry.uuid);
  assert.equal(actor.system, undefined);
  assert.doesNotMatch(JSON.stringify(actor.flags), /Sensitive text|Private past/);
  assert.deepEqual(actor.ownership, { default: 0 });
  actor.system = { hp: 99 }; actor.ownership = { default: 0, alice: 3 };
  await writeEntityActor('adventurers', adventurer, scope, target, entry, 'npc');
  assert.equal(actor.system.hp, 99);
  assert.equal(actor.type, 'character');
  assert.equal(actor.ownership.alice, 3);
});

test('an incomplete API document list or unsupported Actor type causes no document mutation', async () => {
  const target = await world();
  const before = game.writes.length;
  const client = { findEntity: async () => adventurer, listEntityDocuments: async () => { throw new Error('Later page failed'); } };
  await assert.rejects(importEntity({ client, scope, kind: 'adventurers', id: 'a1', target, labels }), /Later page failed/);
  assert.equal(game.writes.length, before);
  await assert.rejects(importEntity({ client, scope, kind: 'adventurers', id: 'a1', target, labels, createActors: true, actorType: 'unsupported' }), { code: 'INVALID_ACTOR_TYPE' });
  assert.equal(game.writes.length, before);
});

test('a concurrent owner refresh cannot restore an Atlas share revoked by a reimport', async () => {
  const actor = addLinkedActor('a1', 'alice'); addLinkedActor('a2', 'bob');
  const target = await world();
  const { entry } = await writeEntityEntry('adventurers', adventurer, documents, scope, target, labels);
  actor.ownership = { default: 0, pending: 3 };
  const originalUpdate = entry.updateEmbeddedDocuments.bind(entry);
  let release;
  let entered = false;
  const gate = new Promise((resolve) => { release = resolve; });
  entry.updateEmbeddedDocuments = async (...args) => {
    if (!entered) { entered = true; await gate; }
    return originalUpdate(...args);
  };
  const refresh = syncEntryPermissions(entry);
  await setImmediate();
  assert.equal(entered, true);
  const reimport = writeEntityEntry('adventurers', adventurer, [{ ...documents[0], viewerIds: [] }], scope, target, labels);
  release();
  await Promise.all([refresh, reimport]);
  const page = entry.pages.find((page) => page.getFlag(MODULE_ID, 'part') === 'document');
  assert.deepEqual(page.ownership, { default: 0, pending: 2 });
  assert.deepEqual(page.getFlag(MODULE_ID, 'permissionSource').viewerIds, []);
  assert.deepEqual(entry.ownership, { default: 0, pending: 2 });
});
