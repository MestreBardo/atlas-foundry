import { AtlasImporterApplication } from './importer-application.js';
import { MODULE_ID } from './person-journal.js';
import { localizeSettings, registerSettings } from './settings.js';
import { AtlasPersonSheet, registerPersonSheet } from './person-sheet.js';
import { initializeLocalization, localize, registerLocalizationHelper } from './localization.js';

let importer = null;

const openImporter = () => {
  importer ??= new AtlasImporterApplication();
  importer.render({ force: true });
};

const refreshModuleLanguage = () => {
  if (importer?.rendered) importer.render({ force: true });
  for (const sheet of AtlasPersonSheet.instances()) {
    if (sheet instanceof AtlasPersonSheet && sheet.rendered) sheet.render({ force: true });
  }
  document.querySelectorAll('.atlas-import-button span').forEach((label) => {
    label.textContent = localize('ATLAS.Importer.Open');
  });
};

Hooks.once('init', () => {
  registerSettings({ onLanguageChange: refreshModuleLanguage });
  registerLocalizationHelper();
  registerPersonSheet();
  game.modules.get(MODULE_ID).api = { openImporter };
  void initializeLocalization().then(() => {
    localizeSettings();
    refreshModuleLanguage();
  });
});

Hooks.on('i18nInit', () => {
  void initializeLocalization().then(() => {
    localizeSettings();
    refreshModuleLanguage();
  });
});

Hooks.on('renderJournalDirectory', async (application, element) => {
  if (!game.user.isGM || element.querySelector('.atlas-import-button')) {
    return;
  }
  const actions = element.querySelector('.header-actions');
  if (!actions) {
    return;
  }
  await initializeLocalization();
  if (element.querySelector('.atlas-import-button')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'atlas-import-button';
  button.innerHTML = `<i class="fa-solid fa-book-atlas" inert></i> <span></span>`;
  button.querySelector('span').textContent = localize('ATLAS.Importer.Open');
  button.addEventListener('click', openImporter);
  actions.append(button);
});
