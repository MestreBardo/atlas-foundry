import { MODULE_ID } from './person-journal.js';

export const DEFAULT_API_BASE_URL = 'https://atlas-mocha-beta-12.vercel.app';

export const registerSettings = () => {
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
