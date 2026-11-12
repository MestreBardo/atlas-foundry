import { MODULE_ID } from './person-journal.js';
import { buildPersonSheetData } from './person-sheet-data.js';

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AtlasPersonSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['atlas-person-sheet'],
    tag: 'div',
    viewPermission: 1,
    position: { width: 960, height: 740 },
    window: { icon: 'fa-solid fa-book-atlas', resizable: true },
    actions: { openJournal: AtlasPersonSheet.#onOpenJournal },
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/person-sheet.hbs`,
      scrollable: ['.atlas-dossier'],
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const canObserve = this.document.testUserPermission(game.user, 'OBSERVER');
    const pages = this.document.pages.filter((page) =>
      canObserve && page.testUserPermission(game.user, 'OBSERVER'),
    );
    const person = buildPersonSheetData(this.document, pages);
    // A limited user sees only the portrait they have permission to view.
    if (!canObserve) {
      person.portrait = this.document.pages.find((page) =>
        page.getFlag(MODULE_ID, 'part') === 'portrait' &&
        page.testUserPermission(game.user, 'LIMITED'),
      )?.src || '';
      person.scopeName = '';
    }
    const statusKey = `ATLAS.Journal.Statuses.${person.status}`;
    person.statusLabel = game.i18n.has(statusKey) ? game.i18n.localize(statusKey) : person.status;
    // Read from the native HTML field, sanitized by Foundry when the page is saved.
    const html = new DOMParser().parseFromString(person.profileHtml, 'text/html');
    const description = html.querySelector('.atlas-person-description');
    person.descriptionHtml = await foundry.applications.ux.TextEditor.enrichHTML(description?.innerHTML ?? person.profileHtml, {
      secrets: this.document.isOwner,
      relativeTo: this.document,
    });
    return { ...context, person, canObserve };
  }

  static #onOpenJournal(_event, target) {
    if (!this.document.testUserPermission(game.user, 'OBSERVER')) return;
    const pageId = target.dataset.pageId;
    const sheet = new foundry.applications.sheets.journal.JournalEntrySheet({ document: this.document });
    return sheet.render({ force: true, ...(pageId ? { pageId } : {}) });
  }
}

export const registerPersonSheet = () => {
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.JournalEntry,
    MODULE_ID,
    AtlasPersonSheet,
    { label: 'ATLAS.Sheet.Title', makeDefault: false },
  );
};
