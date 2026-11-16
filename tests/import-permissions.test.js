import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { adventurerAudience, documentPermissionSource, ownershipForSource, ownershipMatches, ownershipUpdate, profilePermissionSource } from '../scripts/import-permissions.js';
import { MockDocument } from './helpers/foundry.js';
import { addLinkedActor, setupFoundry, scope } from './helpers/foundry.js';

beforeEach(() => {
  setupFoundry();
  addLinkedActor('a1', 'alice'); addLinkedActor('a2', 'bob'); addLinkedActor('a3', 'pending');
});

test('adventurer documents grant read access to the character owner and accepted shares only', () => {
  const source = documentPermissionSource('adventurers', { id: 'a1' }, scope, { viewerIds: ['a2'], pendingIds: ['a3'] });
  assert.deepEqual(ownershipForSource(source), { default: 0, alice: 2, bob: 2 });
  assert.equal(Object.hasOwn(source, 'pendingIds'), false);
  assert.deepEqual(ownershipForSource(profilePermissionSource('adventurers', { id: 'a1' }, scope)), { default: 0, alice: 2 });
});

test('unlinked adventurers remain GM-only even when a shared recipient has a linked character', () => {
  const source = documentPermissionSource('adventurers', { id: 'unlinked' }, scope, { viewerIds: ['a2'] });
  assert.deepEqual(ownershipForSource(source), { default: 0 });
});

test('a reader on a character sheet does not gain its owner’s Atlas documents', () => {
  assert.deepEqual(adventurerAudience('c1', ['a1']), { default: 0, alice: 2 });
});

test('world scope and links from another campaign cannot grant access', () => {
  assert.deepEqual(adventurerAudience('other', ['a1']), { default: 0 });
  const source = documentPermissionSource('adventurers', { id: 'a1' }, { type: 'world', id: 'w1' }, { viewerIds: ['a2'] });
  assert.deepEqual(ownershipForSource(source), { default: 0 });
});

test('ambiguous duplicate character links fail closed', () => {
  addLinkedActor('a1', 'bob');
  assert.deepEqual(adventurerAudience('c1', ['a1']), { default: 0 });
});

test('person documents need explicit sharing while GM place documents inherit entry visibility', () => {
  const entity = { id: 'e1', viewerIds: ['a1', 'a2'] };
  assert.deepEqual(ownershipForSource(documentPermissionSource('persons', entity, scope, { ownerId: null, viewerIds: [] })), { default: 0 });
  assert.deepEqual(ownershipForSource(documentPermissionSource('places', entity, scope, { ownerId: null })), { default: 0, alice: 2, bob: 2 });
  assert.deepEqual(ownershipForSource(documentPermissionSource('factions', entity, scope, { ownerId: 'a1', viewerIds: ['a3'] })), { default: 0, alice: 2 });
});

test('a scoped document written by an unlinked adventurer is GM-only', () => {
  const entity = { id: 'e1', viewerIds: ['a1', 'a2'] };
  assert.deepEqual(ownershipForSource(documentPermissionSource('persons', entity, scope, {
    ownerId: 'unlinked', viewerIds: ['a2'],
  })), { default: 0 });
});

test('permission updates revoke stale readers with numeric NONE levels', () => {
  assert.deepEqual(ownershipUpdate({ default: 2, alice: 2, bob: 2 }, { default: 0, alice: 2 }),
    { default: 0, alice: 2, bob: 0 });
});

test('ownership updates use only valid permission levels for native-format user IDs', async () => {
  const retained = 'AbCdEfGhIjKlMn01';
  const revoked = 'AbCdEfGhIjKlMn02';
  const previous = { default: 0, [retained]: 2, [revoked]: 2 };
  const desired = { default: 0, [retained]: 2 };
  const entry = new MockDocument({ ownership: previous }, 'JournalEntry');
  await assert.rejects(entry.update({ ownership: { ...desired, [`-=${revoked}`]: null } }), /ownership: is not a mapping/);
  const update = ownershipUpdate(previous, desired);
  assert.ok(Object.keys(update).every((key) => key === 'default' || /^[a-zA-Z0-9]{16}$/.test(key)));
  assert.ok(Object.values(update).every((level) => Number.isInteger(level) && level >= -1 && level <= 3));
  await entry.update({ ownership: update });
  assert.equal(entry.ownership[retained], 2);
  assert.equal(entry.ownership[revoked], 0);
});

test('ownership comparison ignores revoked NONE entries and key order without ignoring active readers', () => {
  assert.equal(ownershipMatches({ alice: 2, bob: 0, default: 0 }, { default: 0, alice: 2 }), true);
  assert.equal(ownershipMatches({ default: 0, bob: 2 }, { default: 0 }), false);
  assert.equal(ownershipMatches({ default: -1 }, { default: 0 }), false);
  assert.equal(ownershipMatches({ default: 0, bob: -1 }, { default: 0 }), false);
});

test('forging an owner-editable Actor flag cannot claim an unlinked adventurer’s documents', () => {
  const bob = game.actors[1];
  bob.flags['atlas-foundry'].adventurerLinks = [{ campaignId: 'c1', adventurerId: 'unlinked' }];
  assert.deepEqual(adventurerAudience('c1', ['unlinked']), { default: 0 });
  const source = documentPermissionSource('adventurers', { id: 'unlinked' }, scope, {});
  assert.deepEqual(ownershipForSource(source), { default: 0 });
  assert.deepEqual(adventurerAudience('c1', ['a1']), { default: 0, alice: 2 });
});
