import { MODULE_ID } from './person-journal.js';
import { buildPersonSheetData } from './person-sheet-data.js';

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AtlasPersonSheet extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['atlas-person-sheet'],
    tag: 'div',
    viewPermission: 1,
    position: { width: 760, height: 660 },
    window: { icon: 'fa-solid fa-book-atlas', resizable: true },
    actions: { openJournal: AtlasPersonSheet.#onOpenJournal },
  };

  static TABS = {
    primary: {
      initial: 'biography',
      tabs: [
        { id: 'details', label: 'ATLAS.Sheet.Details', icon: 'fa-solid fa-address-card' },
        { id: 'biography', label: 'ATLAS.Sheet.History', icon: 'fa-solid fa-feather-pointed' },
        { id: 'notes', label: 'ATLAS.Sheet.LocalPages', icon: 'fa-regular fa-file-lines' },
      ],
    },
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/person-sheet.hbs`,
      scrollable: ['.atlas-sheet-body'],
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
    const available = person.hasProfile ? ['details', 'biography', 'notes'] : canObserve ? ['notes'] : [];
    if (!available.includes(this.tabGroups.primary)) {
      this.tabGroups.primary = available.includes('biography') ? 'biography' : available[0] ?? null;
    }
    const tabs = Object.fromEntries(Object.entries(this._prepareTabs('primary'))
      .filter(([id]) => available.includes(id)));
    return {
      ...context, person, canObserve, tabs, tabList: Object.values(tabs),
      showTabs: available.length > 1, sheetId: this.id,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#syncTabAccessibility();
    this.element.querySelector('[role="tablist"]')?.addEventListener('keydown', (event) => {
      const controls = [...this.element.querySelectorAll('[role="tab"]')];
      const index = controls.indexOf(event.target);
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + controls.length) % controls.length;
      this.changeTab(controls[next].dataset.tab, 'primary');
      controls[next].focus();
    });
  }

  changeTab(tab, group, options = {}) {
    super.changeTab(tab, group, options);
    this.#syncTabAccessibility();
  }

  #syncTabAccessibility() {
    if (!this.element) return;
    const active = this.tabGroups.primary;
    this.element.querySelectorAll('[role="tab"]').forEach((button) => {
      const selected = button.dataset.tab === active;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    this.element.querySelectorAll('[role="tabpanel"]').forEach((panel) => {
      panel.hidden = panel.dataset.tab !== active;
    });
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
