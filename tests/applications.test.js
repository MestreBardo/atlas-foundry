import assert from 'node:assert/strict';
import { before, beforeEach, test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { initializeLocalization } from '../scripts/localization.js';

// Exercise application workflows with Foundry's document, settings and lifecycle boundaries stubbed.
class Application {
  rendered = true;
  element = { querySelector: () => null, querySelectorAll: () => [] };
  async render() { return this; }
  async close() { this.rendered = false; }
  async _onFirstRender() {}
  async _onRender() {}
}
let updates;
globalThis.foundry = {
  applications: { api: { ApplicationV2: Application, HandlebarsApplicationMixin: (base) => base } },
  documents: { Actor: { updateDocuments: async (data) => { updates.push(...data); } } },
};
const { AtlasSettingsApplication } = await import('../scripts/settings-application.js');
const { AtlasImporterApplication } = await import('../scripts/importer-application.js');
let source;
let actorLinks;
let requests;
let saves;
const responses = {
  '/personal-token': {
    kind: 'world',
    world: { id: 'w1', name: 'World', permissions: { persons: 'read' } },
    campaigns: [{ id: 'c1', name: 'Campaign', worldId: 'w1', worldName: 'World', permissions: { persons: 'read' } }],
  },
  '/campaigns/c1/adventurers/names': [{ id: 'adv1', name: 'Ada' }, { id: 'adv2', name: 'Bob' }],
  '/campaigns/c1/adventurers/mine?limit=50': [{ id: 'adv1', name: 'Ada' }],
  '/worlds/w1/persons?limit=50': [{ id: 'p1', name: 'World Person' }],
  '/campaigns/c1/persons?limit=50': [{ id: 'p2', name: 'Campaign Person' }],
};

before(async () => {
  await initializeLocalization(async () => ({ ok: true, json: async () => ({}) }));
});

beforeEach(() => {
  source = { worldId: 'w1', worldName: 'World', campaignId: 'c1', campaignName: 'Campaign', adventurerId: 'adv1' };
  actorLinks = { c1: { a1: { worldId: 'w1', campaignId: 'c1', adventurerId: 'adv1', name: 'Ada' } } };
  updates = []; requests = []; saves = [];
  const actors = [
    { id: 'a1', name: 'Actor One', hasPlayerOwner: true, getFlag: () => [{ worldId: 'w1', campaignId: 'c1', adventurerId: 'adv1', name: 'Ada' }] },
    { id: 'a2', name: 'Actor Two', hasPlayerOwner: true, getFlag: () => [] },
    { id: 'npc', name: 'GM NPC', hasPlayerOwner: false, getFlag: () => [] },
  ];
  globalThis.game = {
    user: { isGM: true }, actors, journal: [],
    settings: {
      get: (_module, key) => ({ source, actorLinks, token: 'atlas_pat_test', language: 'auto' })[key],
      set: async (_module, key, value) => { saves.push({ key, value }); if (key === 'source') source = value; if (key === 'actorLinks') actorLinks = value; },
    },
    i18n: { localize: (key) => key },
  };
  globalThis.ui = { notifications: { info() {}, warn() {} } };
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname + new URL(url).search;
    requests.push({ path, options });
    assert.ok(Object.hasOwn(responses, path), `Unexpected request ${path}`);
    return { ok: true, json: async () => ({ payload: responses[path] }) };
  };
});

const initialize = async (application) => {
  await application._onFirstRender({}, {});
  await setImmediate();
  return application._prepareContext();
};
const change = async (application, name, value) => {
  let listener;
  application.element = {
    querySelector: (selector) => selector === `[name="${name}"]` ? { addEventListener: (_event, fn) => { listener = fn; } } : null,
    querySelectorAll: () => [],
  };
  await application._onRender({}, {});
  assert.ok(listener);
  listener({ target: { value } });
  await setImmediate();
};
const submit = (application, object) => AtlasSettingsApplication.DEFAULT_OPTIONS.form.handler.call(application, null, null, { object });

test('settings restore source and links, then persist a reassignment only on save', async () => {
  const application = new AtlasSettingsApplication();
  const context = await initialize(application);
  assert.equal(context.canSave, true);
  assert.equal(context.worlds[0].selected, true);
  assert.equal(context.campaigns[0].selected, true);
  assert.equal(context.viewpoints[0].selected, true);
  assert.equal(context.assignments[0].adventurers[0].selected, true);
  assert.deepEqual(updates, []);
  assert.deepEqual(saves, []);
  await submit(application, { adventurerId: 'adv1', 'adventurer-a1': '', 'adventurer-a2': 'adv1' });
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[0]['flags.atlas-foundry.adventurerLinks'], []);
  assert.equal(updates[1]['flags.atlas-foundry.adventurerLinks'][0].adventurerId, 'adv1');
  assert.equal(source.campaignId, 'c1');
  assert.deepEqual(actorLinks.c1.a2, { worldId: 'w1', campaignId: 'c1', adventurerId: 'adv1', name: 'Ada' });
  assert.equal(actorLinks.c1.a1, undefined);
  assert.equal(application.rendered, false);
});

test('legacy Actor flags are only proposals until the GM reviews and saves settings', async () => {
  actorLinks = {};
  const { getActorLink } = await import('../scripts/actor-links.js');
  assert.equal(getActorLink(game.actors[0], 'c1'), null);
  const application = new AtlasSettingsApplication();
  const context = await initialize(application);
  assert.equal(context.linksNeedSave, true);
  assert.equal(context.assignments[0].adventurers[0].selected, true);
  assert.equal(getActorLink(game.actors[0], 'c1'), null);
  await submit(application, { 'adventurer-a1': 'adv1' });
  assert.equal(getActorLink(game.actors[0], 'c1').adventurerId, 'adv1');
});

test('settings list player-owned Actors and only adventurers from the selected campaign', async () => {
  game.journal.push({ id: 'person1', name: 'Atlas Person' });
  const application = new AtlasSettingsApplication();
  const context = await initialize(application);
  assert.deepEqual(context.assignments.map(({ id }) => id), ['a1', 'a2']);
  for (const assignment of context.assignments) {
    assert.deepEqual(assignment.adventurers.map(({ id }) => id), ['adv1', 'adv2']);
  }
  assert.equal(requests.some(({ path }) => path.includes('/persons')), false);
  await submit(application, { 'adventurer-a1': 'person1' });
  assert.deepEqual(updates, []);
  assert.deepEqual(saves, []);
});

test('ownership revoked while settings are open prevents persisting the old player link', async () => {
  const application = new AtlasSettingsApplication();
  await initialize(application);
  game.actors[0].hasPlayerOwner = false;
  await submit(application, { 'adventurer-a1': 'adv1' });
  assert.deepEqual(updates, []);
  assert.deepEqual(saves, []);
  assert.equal(application.rendered, true);
});

test('a campaign without player-owned Actors offers no Actor assignments', async () => {
  game.actors.forEach((actor) => { actor.hasPlayerOwner = false; });
  const context = await initialize(new AtlasSettingsApplication());
  assert.equal(context.hasCampaign, true);
  assert.deepEqual(context.assignments, []);
});

test('clearing the campaign saves world access and preserves existing actor links', async () => {
  const application = new AtlasSettingsApplication();
  await initialize(application);
  await change(application, 'campaignId', '');
  const context = await application._prepareContext();
  assert.equal(context.hasCampaign, false);
  assert.deepEqual(context.assignments, []);
  await submit(application, {});
  assert.equal(source.campaignId, '');
  assert.equal(source.adventurerId, '');
  assert.equal(source.worldId, 'w1');
  assert.deepEqual(updates, []);
});

test('changing worlds clears the old campaign and viewpoint before saving', async (testContext) => {
  const context = responses['/personal-token'];
  responses['/personal-token'] = {
    kind: 'world', world: { id: 'w2', name: 'Other World', permissions: { persons: 'read' } }, campaigns: [],
  };
  testContext.after(() => { responses['/personal-token'] = context; });
  const application = new AtlasSettingsApplication();
  await initialize(application);
  await change(application, 'worldId', 'w2');
  await submit(application, {});
  assert.deepEqual(source, { worldId: 'w2', worldName: 'Other World', campaignId: '', campaignName: '', adventurerId: '' });
  assert.deepEqual(updates, []);
});

test('duplicate adventurer assignments cause no writes and can be corrected in the same window', async () => {
  const application = new AtlasSettingsApplication();
  await initialize(application);
  await submit(application, { 'adventurer-a1': 'adv1', 'adventurer-a2': 'adv1' });
  assert.deepEqual(updates, []);
  assert.deepEqual(saves, []);
  assert.equal(application.rendered, true);
  assert.equal((await application._prepareContext()).canSave, true);
  await submit(application, { 'adventurer-a1': 'adv1', 'adventurer-a2': 'adv2' });
  assert.equal(updates.length, 1);
  assert.equal(saves.length, 2);
});

test('failed campaign requests disable saving instead of removing previous links', async () => {
  globalThis.fetch = async () => { throw new TypeError('Offline'); };
  const application = new AtlasSettingsApplication();
  const context = await initialize(application);
  assert.equal(context.canSave, false);
  await submit(application, {});
  assert.deepEqual(updates, []);
  assert.deepEqual(saves, []);
});

test('non-GM users cannot submit source or actor changes', async () => {
  const application = new AtlasSettingsApplication();
  await initialize(application);
  game.user.isGM = false;
  await submit(application, { 'adventurer-a2': 'adv1' });
  assert.deepEqual(updates, []);
  assert.deepEqual(saves, []);
});

test('importer loads the saved campaign and refreshes from world scope after settings change', async () => {
  const application = new AtlasImporterApplication();
  const context = await initialize(application);
  assert.equal(context.scopeName, 'Campaign');
  assert.equal(context.items[0].name, 'Campaign Person');
  assert.equal(requests[0].options.headers['X-Adventurer-Id'], 'adv1');
  source = { worldId: 'w1', worldName: 'World', adventurerId: 'stale' };
  await application.refreshSource();
  const worldContext = await application._prepareContext();
  assert.equal(worldContext.scopeName, 'World');
  assert.equal(worldContext.items[0].name, 'World Person');
  assert.equal(requests[1].options.headers['X-Adventurer-Id'], undefined);
});

test('late campaign response cannot repopulate an importer whose source was cleared', async () => {
  let resolve;
  globalThis.fetch = () => new Promise((complete) => { resolve = complete; });
  const application = new AtlasImporterApplication();
  const pending = application.refreshSource();
  await setImmediate();
  source = {};
  await application.refreshSource();
  resolve({ ok: true, json: async () => ({ payload: [{ id: 'stale', name: 'Stale' }] }) });
  await pending;
  const context = await application._prepareContext();
  assert.equal(context.canLoad, false);
  assert.equal(context.itemsLoaded, false);
  assert.deepEqual(context.items, []);
});
