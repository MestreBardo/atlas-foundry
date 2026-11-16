import { MODULE_ID } from './person-journal.js';
import { initializeLocalization, localize } from './localization.js';

export const DEFAULT_API_BASE_URL = 'https://atlas-mocha-beta-12.vercel.app';

export const localizeSettings = () => {
  for (const [setting, path] of [['language', 'Language'], ['token', 'Token']]) {
    const config = game.settings.settings.get(`${MODULE_ID}.${setting}`);
    if (!config) continue;
    config.name = localize(`ATLAS.Settings.${path}.Name`);
    config.hint = localize(`ATLAS.Settings.${path}.Hint`);
    if (setting === 'language') config.choices = {
      auto: localize('ATLAS.Settings.Language.FollowFoundry'),
      'pt-BR': 'Português (Brasil)',
      en: 'English',
    };
  }
  const menu = game.settings.menus?.get(`${MODULE_ID}.source`);
  if (menu) {
    menu.name = localize('ATLAS.Settings.Source.Name');
    menu.label = localize('ATLAS.Settings.Source.Label');
    menu.hint = localize('ATLAS.Settings.Source.Hint');
  }
};

export const registerSettings = ({ onLanguageChange = () => {}, onSourceChange = () => {}, settingsApplication } = {}) => {
  game.settings.register(MODULE_ID, 'language', {
    name: 'ATLAS.Settings.Language.Name',
    hint: 'ATLAS.Settings.Language.Hint',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      auto: 'ATLAS.Settings.Language.FollowFoundry',
      'pt-BR': 'Português (Brasil)',
      en: 'English',
    },
    default: 'auto',
    onChange: async () => {
      await initializeLocalization();
      localizeSettings();
      onLanguageChange();
    },
  });
  // Keep the legacy key registered for existing worlds; connections always use the internal URL.
  game.settings.register(MODULE_ID, 'apiBaseUrl', {
    scope: 'world',
    config: false,
    type: String,
    default: DEFAULT_API_BASE_URL,
  });
  game.settings.register(MODULE_ID, 'token', {
    name: 'ATLAS.Settings.Token.Name',
    hint: 'ATLAS.Settings.Token.Hint',
    scope: 'client',
    config: true,
    type: String,
    default: '',
    onChange: onSourceChange,
  });
  game.settings.register(MODULE_ID, 'source', {
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: onSourceChange,
  });
  if (settingsApplication) game.settings.registerMenu(MODULE_ID, 'source', {
    name: 'ATLAS.Settings.Source.Name',
    label: 'ATLAS.Settings.Source.Label',
    hint: 'ATLAS.Settings.Source.Hint',
    icon: 'fa-solid fa-book-atlas',
    type: settingsApplication,
    restricted: true,
  });
};

export const readConnection = () => ({
  apiBaseUrl: DEFAULT_API_BASE_URL,
  token: game.settings.get(MODULE_ID, 'token') ?? '',
});

export const readSource = () => game.settings.get(MODULE_ID, 'source') ?? {};

export const readScope = () => {
  const source = readSource();
  if (!source.worldId) return null;
  return source.campaignId
    ? { type: 'campaign', id: source.campaignId, name: source.campaignName, adventurerId: source.adventurerId || null }
    : { type: 'world', id: source.worldId, name: source.worldName, adventurerId: null };
};
