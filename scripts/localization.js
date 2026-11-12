import { MODULE_ID } from './person-journal.js';

const dictionaries = new Map();
let loading = null;

export const initializeLocalization = (fetchImplementation = globalThis.fetch.bind(globalThis)) => {
  loading ??= Promise.all(['en', 'pt-BR'].map(async (language) => {
    try {
      const response = await fetchImplementation(new URL(`../languages/${language}.json`, import.meta.url).href);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      dictionaries.set(language, await response.json());
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not load ${language} translations`, error);
    }
  }));
  return loading;
};

const lookup = (dictionary, key) =>
  key.split('.').reduce((value, part) => value?.[part], dictionary);

/** This preference affects Atlas only; Foundry's global translator stays intact. */
export const localize = (key, data = {}) => {
  const selected = game.settings.get(MODULE_ID, 'language');
  const language = ['en', 'pt-BR'].includes(selected) ? selected : 'auto';
  const native = () => game.i18n.localize(key);
  let value = language === 'auto' ? native() : lookup(dictionaries.get(language), key);
  if (typeof value !== 'string' || value === key) {
    value = lookup(dictionaries.get('en'), key) ?? native();
  }
  return value.replace(/\{([^{}]+)\}/g, (match, name) =>
    Object.hasOwn(data ?? {}, name) ? String(data[name]) : match,
  );
};

export const registerLocalizationHelper = () => {
  Handlebars.registerHelper('atlasLocalize', (key, options) => localize(key, options.hash));
};
