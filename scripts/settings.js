import { MODULE_ID } from './person-journal.js';
import { initializeLocalization, localize } from './localization.js';

export const DEFAULT_API_BASE_URL = 'https://atlas-mocha-beta-12.vercel.app';

export const localizeSettings = () => {
  for (const [setting, path] of [['language', 'Language'], ['apiBaseUrl', 'ApiBaseUrl'], ['token', 'Token']]) {
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
};

export const registerSettings = ({ onLanguageChange = () => {} } = {}) => {
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
  game.settings.register(MODULE_ID, 'apiBaseUrl', {
    name: 'ATLAS.Settings.ApiBaseUrl.Name',
    hint: 'ATLAS.Settings.ApiBaseUrl.Hint',
    scope: 'world',
    config: true,
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
  });
};

export const readConnection = () => ({
  apiBaseUrl: game.settings.get(MODULE_ID, 'apiBaseUrl') || DEFAULT_API_BASE_URL,
  token: game.settings.get(MODULE_ID, 'token') ?? '',
});
