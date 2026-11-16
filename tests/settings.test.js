import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { DEFAULT_API_BASE_URL, readConnection, readScope, registerSettings } from '../scripts/settings.js';
import { buildActorLinkUpdates, getActorLink } from '../scripts/actor-links.js';

let source;
beforeEach(() => {
  source = { worldId: 'w1', worldName: 'World' };
  globalThis.game = { settings: { get: (_module, key) => ({
    source, apiBaseUrl: 'https://old-custom-url.test', token: 'atlas_pat_test',
  })[key] } };
});

const actor = (id, links = []) => ({ id, getFlag: () => links });
const campaign = { worldId: 'w1', campaignId: 'c1' };
const adventurers = [{ id: 'adv1', name: 'Ada' }, { id: 'adv2', name: 'Bob' }];

test('a blank campaign grants world scope and never carries a campaign viewpoint', () => {
  source.adventurerId = 'old-viewpoint';
  assert.deepEqual(readScope(), { type: 'world', id: 'w1', name: 'World', adventurerId: null });
  source = {};
  assert.equal(readScope(), null);
});

test('campaign scope uses the selected viewpoint and keeps the fixed internal URL', () => {
  Object.assign(source, { campaignId: 'c1', campaignName: 'Campaign', adventurerId: 'adv1' });
  assert.deepEqual(readScope(), { type: 'campaign', id: 'c1', name: 'Campaign', adventurerId: 'adv1' });
  assert.equal(readConnection().apiBaseUrl, DEFAULT_API_BASE_URL);
});

test('registers a GM settings menu, shared source and an invisible legacy URL', () => {
  const configs = new Map();
  const menus = new Map();
  game.settings.register = (_module, key, config) => configs.set(key, config);
  game.settings.registerMenu = (_module, key, config) => menus.set(key, config);
  class SettingsApplication {}
  registerSettings({ settingsApplication: SettingsApplication });
  assert.equal(configs.get('apiBaseUrl').config, false);
  assert.equal(configs.get('source').scope, 'world');
  assert.equal(configs.get('source').config, false);
  assert.equal(configs.get('token').scope, 'client');
  assert.equal(menus.get('source').restricted, true);
  assert.equal(menus.get('source').type, SettingsApplication);
});

test('moves a character between actors, preserves other campaigns and supports unlinking', () => {
  const oldLink = { ...campaign, adventurerId: 'adv1', name: 'Ada' };
  const otherLink = { worldId: 'w2', campaignId: 'c2', adventurerId: 'other', name: 'Other' };
  const actors = [actor('a1', [oldLink, otherLink]), actor('a2')];
  const updates = buildActorLinkUpdates({ actors, source: campaign, adventurers, assignments: { adv1: 'a2' } });
  assert.deepEqual(updates, [
    { _id: 'a1', 'flags.atlas-foundry.adventurerLinks': [otherLink] },
    { _id: 'a2', 'flags.atlas-foundry.adventurerLinks': [oldLink] },
  ]);
  const unlinked = buildActorLinkUpdates({ actors, source: campaign, adventurers, assignments: {} });
  assert.deepEqual(unlinked, [{ _id: 'a1', 'flags.atlas-foundry.adventurerLinks': [otherLink] }]);
  assert.deepEqual(actors[0].getFlag(), [oldLink, otherLink]);
});

test('rejects duplicate actors, deleted actors and foreign campaign characters before writes', () => {
  const build = (assignments) => buildActorLinkUpdates({ actors: [actor('a1')], source: campaign, adventurers, assignments });
  assert.throws(() => build({ adv1: 'a1', adv2: 'a1' }), { code: 'DUPLICATE_ACTOR' });
  assert.throws(() => build({ adv1: 'deleted' }), { code: 'INVALID_LINK' });
  assert.throws(() => build({ foreign: 'a1' }), { code: 'INVALID_LINK' });
});

test('exposes only the link for the current campaign and no link in world scope', () => {
  const link = { ...campaign, adventurerId: 'adv1', name: 'Ada' };
  const linkedActor = actor('a1', [link]);
  assert.equal(getActorLink(linkedActor), null);
  source.campaignId = 'c1';
  assert.deepEqual(getActorLink(linkedActor), link);
  source.campaignId = 'c2';
  assert.equal(getActorLink(linkedActor), null);
  assert.deepEqual(getActorLink(linkedActor, 'c1'), link);
});
