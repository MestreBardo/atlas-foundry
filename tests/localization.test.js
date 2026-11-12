import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, test } from 'node:test';
import { initializeLocalization, localize, registerLocalizationHelper } from '../scripts/localization.js';
import { localizeSettings, registerSettings } from '../scripts/settings.js';

const dictionaries = Object.fromEntries(await Promise.all(['en', 'pt-BR'].map(async (language) => [
  language, JSON.parse(await readFile(new URL(`../languages/${language}.json`, import.meta.url), 'utf8')),
])));
const lookup = (language, key) => key.split('.').reduce((value, part) => value?.[part], dictionaries[language]);
const setup = (selected = 'auto', native = 'en') => {
  const configs = new Map();
  const values = new Map([['atlas-foundry.language', selected]]);
  globalThis.game = {
    settings: {
      settings: configs,
      register(module, key, config) { configs.set(`${module}.${key}`, config); },
      get(module, key) { return values.get(`${module}.${key}`) ?? configs.get(`${module}.${key}`)?.default; },
    },
    i18n: { lang: native, localize(key) { return lookup(this.lang, key) ?? key; } },
  };
  return { configs, values };
};

before(async () => {
  await initializeLocalization(async (url) => {
    const language = url.endsWith('/pt-BR.json') ? 'pt-BR' : 'en';
    return { ok: true, json: async () => dictionaries[language] };
  });
});

test('defaults to following Foundry and offers explicit per-client language choices', () => {
  const { configs } = setup();
  registerSettings();
  const language = configs.get('atlas-foundry.language');
  assert.equal(language.default, 'auto');
  assert.equal(language.scope, 'client');
  assert.equal(language.config, true);
  assert.deepEqual(Object.keys(language.choices), ['auto', 'pt-BR', 'en']);
});

test('initial language loading tolerates settings that have not been registered yet', () => {
  setup();
  assert.doesNotThrow(() => localizeSettings());
});

test('manual Portuguese overrides English Foundry without changing the native translator', () => {
  setup('pt-BR', 'en');
  const original = game.i18n.localize;
  assert.equal(localize('ATLAS.Journal.Statuses.alive'), 'Viva');
  assert.equal(localize('ATLAS.Journal.Age'), 'Idade');
  assert.equal(game.i18n.localize('ATLAS.Journal.Statuses.alive'), 'Alive');
  assert.equal(game.i18n.localize, original);
  assert.equal(game.i18n.lang, 'en');
});

test('manual English overrides Portuguese Foundry', () => {
  setup('en', 'pt-BR');
  assert.equal(localize('ATLAS.Sheet.History'), 'History');
  assert.equal(localize('ATLAS.Journal.Statuses.alive'), 'Alive');
  assert.equal(game.i18n.lang, 'pt-BR');
});

test('follow mode uses the current Foundry language rather than the previous manual choice', () => {
  const { values } = setup('en', 'pt-BR');
  assert.equal(localize('ATLAS.Journal.Age'), 'Age');
  values.set('atlas-foundry.language', 'auto');
  assert.equal(localize('ATLAS.Journal.Age'), 'Idade');
  game.i18n.lang = 'en';
  assert.equal(localize('ATLAS.Journal.Age'), 'Age');
});

test('formats counts including zero and preserves unknown placeholders and keys', () => {
  setup('pt-BR');
  assert.equal(localize('ATLAS.Importer.Import', { count: 0 }), 'Importar (0)');
  assert.equal(localize('ATLAS.Importer.Import'), 'Importar ({count})');
  assert.equal(localize('ATLAS.Missing'), 'ATLAS.Missing');
  assert.equal(localize('ATLAS.Importer.Done', { created: 2, updated: 1, failed: 0 }), 'Atlas: 2 criadas, 1 atualizadas, 0 com erro.');
});

test('saving a preference updates module setting labels and refreshes module UI', async () => {
  const { configs, values } = setup('auto', 'en');
  let refreshes = 0;
  registerSettings({ onLanguageChange: () => { refreshes += 1; } });
  localizeSettings();
  assert.equal(configs.get('atlas-foundry.language').name, 'Atlas language');
  values.set('atlas-foundry.language', 'pt-BR');
  await configs.get('atlas-foundry.language').onChange('pt-BR');
  assert.equal(configs.get('atlas-foundry.language').name, 'Idioma do Atlas');
  assert.equal(configs.get('atlas-foundry.language').choices.auto, 'Seguir o idioma do Foundry');
  assert.equal(refreshes, 1);
  assert.equal(configs.get('atlas-foundry.apiBaseUrl').scope, 'world');
});

test('registers a module-specific Handlebars helper and formats its hash arguments', () => {
  setup('pt-BR');
  const helpers = new Map();
  globalThis.Handlebars = { registerHelper: (name, helper) => helpers.set(name, helper) };
  registerLocalizationHelper();
  assert.deepEqual([...helpers.keys()], ['atlasLocalize']);
  assert.equal(helpers.get('atlasLocalize')('ATLAS.Importer.Import', { hash: { count: 3 } }), 'Importar (3)');
});

test('both supported dictionaries cover the same module translation keys', () => {
  const keys = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  ).sort();
  assert.deepEqual(keys(dictionaries['pt-BR']), keys(dictionaries.en));
});
