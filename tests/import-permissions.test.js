import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { adventurerAudience, documentPermissionSource, ownershipForSource, ownershipUpdate, profilePermissionSource } from '../scripts/import-permissions.js';
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

test('permission updates remove stale readers instead of relying on a recursive merge', () => {
  assert.deepEqual(ownershipUpdate({ default: 2, alice: 2, bob: 2 }, { default: 0, alice: 2 }),
    { default: 0, alice: 2, '-=bob': null });
});

test('forging an owner-editable Actor flag cannot claim an unlinked adventurer’s documents', () => {
  const bob = game.actors[1];
  bob.flags['atlas-foundry'].adventurerLinks = [{ campaignId: 'c1', adventurerId: 'unlinked' }];
  assert.deepEqual(adventurerAudience('c1', ['unlinked']), { default: 0 });
  const source = documentPermissionSource('adventurers', { id: 'unlinked' }, scope, {});
  assert.deepEqual(ownershipForSource(source), { default: 0 });
  assert.deepEqual(adventurerAudience('c1', ['a1']), { default: 0, alice: 2 });
});
