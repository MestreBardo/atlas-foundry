import { AtlasImporterApplication } from './importer-application.js';
import { MODULE_ID } from './person-journal.js';
import { localizeSettings, registerSettings } from './settings.js';
import { AtlasPersonSheet, registerPersonSheet } from './person-sheet.js';
import { initializeLocalization, localize, registerLocalizationHelper } from './localization.js';
import { AtlasSettingsApplication } from './settings-application.js';
import { getActorLink } from './actor-links.js';
import { readScope } from './settings.js';
import { addActorDocumentsButton, AtlasActorDocumentsApplication, openActorDocuments } from './actor-documents-application.js';
import { schedulePermissionSync } from './permission-sync.js';

let importer = null;

const openImporter = async () => {
  const existing = Boolean(importer);
  importer ??= new AtlasImporterApplication();
  await importer.render({ force: true });
  if (existing) await importer.refreshSource();
};

const refreshModuleLanguage = () => {
  if (importer?.rendered) importer.render({ force: true });
  for (const sheet of AtlasPersonSheet.instances()) {
    if (sheet instanceof AtlasPersonSheet && sheet.rendered) sheet.render({ force: true });
  }
  for (const settings of AtlasSettingsApplication.instances()) {
    if (settings instanceof AtlasSettingsApplication && settings.rendered) settings.render({ force: true });
  }
  for (const window of AtlasActorDocumentsApplication.instances()) {
    if (window instanceof AtlasActorDocumentsApplication && window.rendered) window.render({ force: true });
  }
  document.querySelectorAll('.atlas-import-button span').forEach((label) => {
    label.textContent = localize('ATLAS.Importer.Open');
  });
};

Hooks.once('init', () => {
  registerSettings({
    onLanguageChange: refreshModuleLanguage,
    onSourceChange: () => { if (importer?.rendered) void importer.refreshSource(); },
    settingsApplication: AtlasSettingsApplication,
  });
  registerLocalizationHelper();
  registerPersonSheet();
  game.modules.get(MODULE_ID).api = {
    openImporter,
    openSettings: () => new AtlasSettingsApplication().render({ force: true }),
    getActorLink,
    openActorDocuments,
    getScope: readScope,
  };
  void initializeLocalization().then(() => {
    localizeSettings();
    refreshModuleLanguage();
  });
});

Hooks.once('ready', schedulePermissionSync);
Hooks.on('createJournalEntry', (entry) => {
  if (entry.getFlag(MODULE_ID, 'managedOwnership')) schedulePermissionSync();
});
for (const hook of ['renderActorSheet', 'renderActorSheetV2', 'renderApplicationV2']) {
  Hooks.on(hook, addActorDocumentsButton);
}
Hooks.on('updateActor', (_actor, changes) => {
  if (changes.ownership || changes.flags?.[MODULE_ID]?.adventurerLinks ||
    Object.hasOwn(changes.flags?.[MODULE_ID] ?? {}, '-=adventurerLinks') ||
    Object.keys(changes).some((key) => key.startsWith('ownership.') || key.includes('adventurerLinks'))) schedulePermissionSync();
});
for (const hook of ['createActor', 'deleteActor', 'createUser', 'deleteUser']) Hooks.on(hook, schedulePermissionSync);
Hooks.on('updateUser', (_user, changes) => { if (Object.hasOwn(changes, 'role')) schedulePermissionSync(); });

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
