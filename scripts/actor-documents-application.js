import { actorDocumentData, openReadableJournal } from './actor-documents.js';
import { getActorLink } from './actor-links.js';
import { initializeLocalization, localize } from './localization.js';
import { MODULE_ID } from './person-journal.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AtlasActorDocumentsApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['atlas-actor-documents'], position: { width: 580, height: 540 },
    window: { icon: 'fa-solid fa-file-lines', resizable: true },
    actions: { openDocument: AtlasActorDocumentsApplication.#onOpenDocument },
  };
  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/actor-documents.hbs`, scrollable: ['.atlas-actor-document-list'] } };
  #actor;
  constructor(actor, options = {}) { super(options); this.#actor = actor; }
  get title() { return `${localize('ATLAS.ActorDocuments.Title')} · ${this.#actor.name}`; }
  async _prepareContext() {
    await initializeLocalization();
    return { actorName: this.#actor.name, ...(await actorDocumentData(this.#actor)) };
  }
  static async #onOpenDocument(_event, target) { await openReadableJournal(target.dataset.uuid); }
}

export const openActorDocuments = (actor) => {
  if (!actor?.testUserPermission(game.user, 'OBSERVER')) return;
  return new AtlasActorDocumentsApplication(actor).render({ force: true });
};

export const addActorDocumentsButton = (application, element) => {
  const actor = application.document ?? application.actor;
  if (actor?.documentName !== 'Actor' || !actor.testUserPermission(game.user, 'OBSERVER') ||
    (!getActorLink(actor) && !actor.getFlag(MODULE_ID, 'journalUuid'))) return;
  const root = application.element?.[0] ?? application.element ?? element?.[0] ?? element;
  const header = root?.querySelector('.window-header');
  if (!header || header.querySelector('.atlas-actor-document-button')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'header-control atlas-actor-document-button';
  button.title = localize('ATLAS.ActorDocuments.Title');
  button.setAttribute('aria-label', button.title);
  button.innerHTML = '<i class="fa-solid fa-file-lines" aria-hidden="true"></i>';
  button.addEventListener('click', () => void openActorDocuments(actor));
  header.append(button);
};
