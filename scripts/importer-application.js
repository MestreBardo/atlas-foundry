import { AtlasClient } from './atlas-client.js';
import { ensureScopeFolder, writePersonEntry } from './journal-writer.js';
import { MODULE_ID } from './person-journal.js';
import { readConnection, readScope } from './settings.js';
import { AtlasSettingsApplication } from './settings-application.js';
import { describeError } from './errors.js';
import { initializeLocalization, localize as atlasLocalize } from './localization.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PERSON_STATUSES = ['alive', 'dead', 'missing', 'imprisoned', 'exiled', 'unknown'];

const localize = (key, data = null) =>
  atlasLocalize(`ATLAS.${key}`, data);

const readPageLabels = () => ({
  portrait: localize('Journal.Portrait'),
  profile: localize('Journal.Profile'),
  nicknames: localize('Journal.Nicknames'),
  status: localize('Journal.Status'),
  age: localize('Journal.Age'),
  height: localize('Journal.Height'),
  positions: localize('Journal.Positions'),
  tags: localize('Journal.Tags'),
  author: localize('Journal.Author'),
  statuses: Object.fromEntries(
    PERSON_STATUSES.map((status) => [status, localize(`Journal.Statuses.${status}`)]),
  ),
});

export class AtlasImporterApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'atlas-importer',
    classes: ['atlas-importer'],
    window: {
      title: 'ATLAS.Importer.Title',
      icon: 'fa-solid fa-book-atlas',
      resizable: true,
    },
    position: { width: 520, height: 640 },
    actions: {
      loadPersons: AtlasImporterApplication.#onLoadPersons,
      toggleAll: AtlasImporterApplication.#onToggleAll,
      importSelected: AtlasImporterApplication.#onImportSelected,
      retry: AtlasImporterApplication.#onRetry,
      openSettings: AtlasImporterApplication.#onOpenSettings,
    },
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/importer.hbs`,
      scrollable: ['.atlas-person-list'],
    },
  };

  #persons = [];
  #selectedPersonIds = new Set();
  #filter = '';
  #status = 'loading';
  #error = null;
  #progress = { done: 0, total: 0 };
  #loadedScope = null;
  #loadRevision = 0;

  get title() {
    return localize('Importer.Title');
  }

  get #client() {
    return new AtlasClient(readConnection());
  }

  get #hasToken() {
    return readConnection().token.trim() !== '';
  }

  get #scope() { return readScope(); }

  async refreshSource() {
    if (this.#status === 'importing') return;
    ++this.#loadRevision;
    this.#persons = [];
    this.#loadedScope = null;
    this.#selectedPersonIds.clear();
    this.#filter = '';
    this.#error = null;
    if (this.#hasToken && this.#scope) await AtlasImporterApplication.#onLoadPersons.call(this);
    else { this.#status = 'ready'; await this.render(); }
  }

  async _prepareContext() {
    await initializeLocalization();
    const filter = this.#filter.trim().toLocaleLowerCase();
    const visiblePersons = this.#persons
      .filter((person) => filter === '' || person.name.toLocaleLowerCase().includes(filter))
      .map((person) => ({
        id: person.id,
        name: person.name,
        image: person.portrait ?? person.image ?? null,
        initial: person.name.trim().charAt(0).toLocaleUpperCase(),
        alreadyImported: this.#isImported(person.id),
        selected: this.#selectedPersonIds.has(person.id),
      }));
    return {
      hasToken: this.#hasToken,
      status: this.#status,
      loading: this.#status === 'loading',
      importing: this.#status === 'importing',
      errorMessage: this.#error ? describeError(this.#error) : '',
      progress: this.#progress,
      canLoad: this.#scope !== null && this.#status !== 'loading' && this.#status !== 'importing',
      scopeName: this.#scope?.name ?? '',
      personsLoaded: this.#loadedScope !== null,
      loadedScopeName: this.#loadedScope?.name ?? '',
      persons: visiblePersons,
      filter: this.#filter,
      selectedCount: this.#selectedPersonIds.size,
      canImport: this.#selectedPersonIds.size > 0 && this.#status === 'ready',
    };
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    queueMicrotask(() => void this.#initialize());
  }

  async #initialize() { await this.refreshSource(); }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const element = this.element;
    element.querySelector('[name="filter"]')?.addEventListener('input', (event) => {
      this.#filter = event.target.value;
      void this.#renderKeepingFilterFocus();
    });
    element.querySelectorAll('[name="personId"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.#selectedPersonIds.add(checkbox.value);
        } else {
          this.#selectedPersonIds.delete(checkbox.value);
        }
        void this.render();
      });
    });
  }

  async #renderKeepingFilterFocus() {
    await this.render();
    const input = this.element.querySelector('[name="filter"]');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  #isImported(personId) {
    return game.journal.some(
      (entry) =>
        entry.getFlag(MODULE_ID, 'personId') === personId &&
        entry.getFlag(MODULE_ID, 'scopeId') === this.#loadedScope?.id,
    );
  }

  async #run(action) {
    const revision = this.#loadRevision;
    this.#status = 'loading';
    this.#error = null;
    await this.render();
    try {
      await action();
      if (revision !== this.#loadRevision) return;
      this.#status = 'ready';
    } catch (error) {
      if (revision !== this.#loadRevision) return;
      this.#status = 'error';
      this.#error = error;
    }
    await this.render();
  }

  static async #onLoadPersons() {
    const scope = this.#scope;
    if (!scope || this.#status === 'importing') {
      return;
    }
    this.#selectedPersonIds.clear();
    this.#persons = [];
    this.#loadedScope = null;
    this.#filter = '';
    const request = ++this.#loadRevision;
    await this.#run(async () => {
      const persons = await this.#client.listPersons(scope);
      if (request !== this.#loadRevision) return;
      this.#persons = persons.sort((first, second) => first.name.localeCompare(second.name));
      this.#loadedScope = scope;
    });
  }

  static async #onToggleAll() {
    const filter = this.#filter.trim().toLocaleLowerCase();
    const visibleIds = this.#persons
      .filter((person) => filter === '' || person.name.toLocaleLowerCase().includes(filter))
      .map((person) => person.id);
    const allSelected = visibleIds.every((personId) => this.#selectedPersonIds.has(personId));
    visibleIds.forEach((personId) =>
      allSelected ? this.#selectedPersonIds.delete(personId) : this.#selectedPersonIds.add(personId),
    );
    await this.render();
  }

  static async #onImportSelected() {
    const scope = this.#loadedScope;
    const personIds = [...this.#selectedPersonIds];
    if (!scope || personIds.length === 0 || this.#status !== 'ready') {
      return;
    }
    if (JSON.stringify(scope) !== JSON.stringify(this.#scope)) {
      await this.refreshSource();
      return;
    }
    this.#status = 'importing';
    this.#error = null;
    this.#progress = { done: 0, total: personIds.length };
    await this.render();
    const counts = { created: 0, updated: 0, failed: 0 };
    const labels = readPageLabels();
    try {
      const folder = await ensureScopeFolder(scope);
      const client = this.#client;
      for (const personId of personIds) {
        try {
          // Do not replace a previous import if any document page cannot be read.
          const [person, documents] = await Promise.all([
            client.findPerson(scope, personId),
            client.listPersonDocuments(scope, personId),
          ]);
          counts[await writePersonEntry(person, scope, { folder, labels, documents })] += 1;
        } catch (error) {
          counts.failed += 1;
          console.error(`${MODULE_ID} | ${personId}`, error);
        }
        this.#progress = { done: this.#progress.done + 1, total: personIds.length };
        await this.render();
      }
    } catch (error) {
      this.#error = error;
    }
    this.#selectedPersonIds.clear();
    this.#status = this.#error ? 'error' : 'ready';
    await this.render();
    const message = localize('Importer.Done', counts);
    if (counts.failed > 0) {
      ui.notifications.warn(message);
    } else {
      ui.notifications.info(message);
    }
    if (JSON.stringify(scope) !== JSON.stringify(this.#scope)) await this.refreshSource();
  }

  static async #onRetry() { await this.refreshSource(); }

  static async #onOpenSettings() {
    const Settings = this.#hasToken ? AtlasSettingsApplication : foundry.applications.settings.SettingsConfig;
    await new Settings().render({ force: true });
  }
}
