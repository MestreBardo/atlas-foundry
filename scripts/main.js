import { AtlasImporterApplication } from './importer-application.js';
import { MODULE_ID } from './person-journal.js';
import { registerSettings } from './settings.js';

let importer = null;

const openImporter = () => {
  importer ??= new AtlasImporterApplication();
  importer.render({ force: true });
};

Hooks.once('init', () => {
  registerSettings();
  game.modules.get(MODULE_ID).api = { openImporter };
});

Hooks.on('renderJournalDirectory', (application, element) => {
  if (!game.user.isGM || element.querySelector('.atlas-import-button')) {
    return;
  }
  const actions = element.querySelector('.header-actions');
  if (!actions) {
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'atlas-import-button';
  button.innerHTML = `<i class="fa-solid fa-book-atlas" inert></i> <span></span>`;
  button.querySelector('span').textContent = game.i18n.localize('ATLAS.Importer.Open');
  button.addEventListener('click', openImporter);
  actions.append(button);
});
