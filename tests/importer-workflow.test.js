import assert from 'node:assert/strict';
import { before, beforeEach, test } from 'node:test';
import { initializeLocalization } from '../scripts/localization.js';
import { setupFoundry } from './helpers/foundry.js';
import { MODULE_ID } from '../scripts/person-journal.js';

class Application {
  rendered = true;
  element = { querySelector: () => null, querySelectorAll: () => [] };
  async render() { return this; }
  async _onFirstRender() {}
  async _onRender() {}
}
setupFoundry();
foundry.applications = { api: { ApplicationV2: Application, HandlebarsApplicationMixin: (base) => base } };
const { AtlasImporterApplication } = await import('../scripts/importer-application.js');
const actions = AtlasImporterApplication.DEFAULT_OPTIONS.actions;
const data = {
  persons: { id: 'p1', name: 'The Queen', description: 'History', viewerIds: [] },
  adventurers: { id: 'a1', name: 'Aria', background: 'Secret past' },
  places: { id: 'l1', name: 'The City', description: 'Stone towers' },
  factions: { id: 'f1', name: 'The Order', description: 'A secret society' },
};
let source;
let notifications;

before(async () => { await initializeLocalization(async () => ({ ok: true, json: async () => ({}) })); });
beforeEach(() => {
  setupFoundry();
  source = { worldId: 'w1', worldName: 'World', campaignId: 'c1', campaignName: 'Campaign' };
  game.settings.get = (_module, key) => ({ source, token: 'atlas_pat_test', language: 'en' })[key];
  notifications = [];
  globalThis.ui = { notifications: { info: (text) => notifications.push(text), warn: (text) => notifications.push(text) } };
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    const kind = path.split('/')[3];
    const id = path.split('/')[4];
    assert.ok(data[kind], path);
    const payload = path.endsWith('/documents') || path.endsWith('/notes') ? [{ id: 'd1', title: 'Letter', text: 'Original' }]
      : !id || id === 'mine' ? [data[kind]] : data[kind];
    return { ok: true, json: async () => ({ payload }) };
  };
});

const change = async (app, name, value, checked = false) => {
  let handler;
  app.element = { querySelector: (selector) => selector === `[name="${name}"]`
    ? { addEventListener: (_event, callback) => { handler = callback; } } : null, querySelectorAll: () => [] };
  await app._onRender({}, {});
  handler({ target: { value, checked } });
  await app._prepareContext();
};

test('the category selector clears old selections and imports places and factions', async () => {
  const app = new AtlasImporterApplication();
  await app.refreshSource();
  let context = await app._prepareContext();
  assert.equal(context.kinds.length, 4);
  await actions.toggleAll.call(app);
  for (const kind of ['places', 'factions']) {
    await actions.changeKind.call(app, null, { dataset: { kind } });
    context = await app._prepareContext();
    assert.equal(context.selectedCount, 0);
    assert.equal(context.items[0].name, data[kind].name);
    await actions.toggleAll.call(app);
    await actions.importSelected.call(app);
    context = await app._prepareContext();
    assert.equal(context.results[0].failed, false);
  }
  assert.deepEqual(game.journal.map((entry) => entry.getFlag(MODULE_ID, 'entityType')), ['places', 'factions']);
});

test('world sources never offer adventurers and cannot switch into that category', async () => {
  source = { worldId: 'w1', worldName: 'World' };
  const app = new AtlasImporterApplication();
  await app.refreshSource();
  await actions.changeKind.call(app, null, { dataset: { kind: 'adventurers' } });
  const context = await app._prepareContext();
  assert.equal(context.kinds.some(({ id }) => id === 'adventurers'), false);
  assert.equal(context.items[0].id, 'p1');
});

test('the Actor and compendium controls create two private packs without world duplicates', async () => {
  const app = new AtlasImporterApplication();
  await app.refreshSource();
  await actions.changeKind.call(app, null, { dataset: { kind: 'adventurers' } });
  await change(app, 'destination', 'compendium');
  await change(app, 'createActors', '', true);
  await actions.toggleAll.call(app);
  await actions.importSelected.call(app);
  const context = await app._prepareContext();
  assert.equal(context.results[0].failed, false);
  assert.equal(game.packs.size, 2);
  assert.equal(game.journal.length, 0);
  assert.equal(game.actors.length, 0);
  const actorPack = [...game.packs.values()].find((pack) => pack.documentName === 'Actor');
  assert.equal(actorPack.documents[0].type, 'character');
  assert.equal(notifications.length, 1);
});

test('non-GM users cannot import even by invoking the application action directly', async () => {
  const app = new AtlasImporterApplication();
  await app.refreshSource();
  await actions.toggleAll.call(app);
  game.user = game.users[1];
  assert.equal((await app._prepareContext()).canImport, false);
  await actions.importSelected.call(app);
  assert.deepEqual(game.writes, []);
});
