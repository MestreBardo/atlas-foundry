import { AtlasClient } from './atlas-client.js';
import { MODULE_ID } from './person-journal.js';
import { readConnection, readScope } from './settings.js';
import { AtlasSettingsApplication } from './settings-application.js';
import { describeError } from './errors.js';
import { initializeLocalization, localize as atlasLocalize } from './localization.js';
import { availableActorTypes } from './actor-writer.js';
import { createImportTarget, findEntityEntry } from './import-target.js';
import { importEntity } from './import-service.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const localize = (key, data = {}) => atlasLocalize(`ATLAS.${key}`, data);
const KINDS = [
  ['persons', 'fa-solid fa-user'], ['adventurers', 'fa-solid fa-hat-wizard'],
  ['places', 'fa-solid fa-location-dot'], ['factions', 'fa-solid fa-flag'],
];
const PERSON_STATUSES = ['alive', 'dead', 'missing', 'imprisoned', 'exiled', 'unknown'];
const readPageLabels = () => ({
  ...Object.fromEntries(['portrait', 'profile', 'nicknames', 'status', 'age', 'height', 'positions', 'tags', 'author']
    .map((key) => [key, localize(`Journal.${key.charAt(0).toUpperCase()}${key.slice(1)}`)])),
  history: localize('Sheet.History'),
  statuses: Object.fromEntries(PERSON_STATUSES.map((status) => [status, localize(`Journal.Statuses.${status}`)])),
});

export class AtlasImporterApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'atlas-importer', classes: ['atlas-importer', 'atlas-import-workbench'],
    window: { title: 'ATLAS.Importer.Title', icon: 'fa-solid fa-book-atlas', resizable: true },
    position: { width: 760, height: 760 },
    actions: {
      loadEntities: AtlasImporterApplication.#onLoadEntities,
      changeKind: AtlasImporterApplication.#onChangeKind,
      toggleAll: AtlasImporterApplication.#onToggleAll,
      importSelected: AtlasImporterApplication.#onImportSelected,
      retry: AtlasImporterApplication.#onRetry,
      openSettings: AtlasImporterApplication.#onOpenSettings,
    },
  };
  static PARTS = { body: {
    template: `modules/${MODULE_ID}/templates/importer.hbs`, scrollable: ['.atlas-person-list'],
  } };

  #kind = 'persons';
  #entities = [];
  #selectedIds = new Set();
  #importedIds = new Set();
  #filter = '';
  #status = 'loading';
  #error = null;
  #progress = { done: 0, total: 0 };
  #loadedScope = null;
  #loadRevision = 0;
  #destination = 'world';
  #createActors = false;
  #actorType = '';
  #results = [];

  get title() { return localize('Importer.Title'); }
  get #client() { return new AtlasClient(readConnection()); }
  get #hasToken() { return readConnection().token.trim() !== ''; }
  get #scope() { return readScope(); }
  get #busy() { return ['loading', 'importing'].includes(this.#status); }

  #updateImportedIds() {
    this.#importedIds.clear();
    if (this.#destination === 'world' && this.#loadedScope) {
      for (const entity of this.#entities) {
        if (findEntityEntry(game.journal, this.#loadedScope, this.#kind, entity.id)) this.#importedIds.add(entity.id);
      }
    }
  }

  async refreshSource() {
    if (this.#status === 'importing') return;
    ++this.#loadRevision;
    this.#entities = [];
    this.#loadedScope = null;
    this.#selectedIds.clear();
    this.#filter = '';
    this.#results = [];
    this.#error = null;
    if (this.#kind === 'adventurers' && this.#scope?.type !== 'campaign') this.#kind = 'persons';
    if (this.#hasToken && this.#scope) await AtlasImporterApplication.#onLoadEntities.call(this);
    else { this.#status = 'ready'; await this.render(); }
  }

  async _prepareContext() {
    await initializeLocalization();
    const filter = this.#filter.trim().toLocaleLowerCase();
    const actorTypes = availableActorTypes();
    if (!actorTypes.some(({ id }) => id === this.#actorType)) {
      const preferred = this.#kind === 'adventurers' ? 'character' : 'npc';
      this.#actorType = actorTypes.find(({ id }) => id === preferred)?.id ?? actorTypes[0]?.id ?? '';
    }
    const items = this.#entities.filter((entity) => !filter || entity.name.toLocaleLowerCase().includes(filter))
      .map((entity) => ({ id: entity.id, name: entity.name, image: entity.portrait ?? entity.image ?? null,
        initial: entity.name.trim().charAt(0).toLocaleUpperCase(),
        alreadyImported: this.#importedIds.has(entity.id), selected: this.#selectedIds.has(entity.id) }));
    return {
      hasToken: this.#hasToken, busy: this.#busy, loading: this.#status === 'loading', importing: this.#status === 'importing',
      errorMessage: this.#error ? describeError(this.#error) : '', progress: this.#progress,
      canLoad: this.#scope !== null && !this.#busy, scopeName: this.#scope?.name ?? '',
      scopeType: localize(this.#scope?.type === 'campaign' ? 'Importer.Campaign' : 'Importer.World'),
      itemsLoaded: this.#loadedScope !== null, items, filter: this.#filter,
      kinds: KINDS.filter(([id]) => id !== 'adventurers' || this.#scope?.type === 'campaign')
        .map(([id, icon]) => ({ id, icon, label: localize(`Importer.Kinds.${id}`), active: this.#kind === id })),
      kindLabel: localize(`Importer.Kinds.${this.#kind}`), selectedCount: this.#selectedIds.size,
      visibleCount: items.length, totalCount: this.#entities.length,
      destination: this.#destination, inWorld: this.#destination === 'world', inCompendium: this.#destination === 'compendium',
      createActors: this.#createActors, actorCreationAvailable: actorTypes.length > 0,
      actorTypes: actorTypes.map((type) => ({ ...type, selected: this.#actorType === type.id })),
      canImport: game.user.isGM && this.#selectedIds.size > 0 && this.#status === 'ready' &&
        (!this.#createActors || actorTypes.some(({ id }) => id === this.#actorType)),
      results: this.#results,
    };
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    queueMicrotask(() => void this.refreshSource());
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector('[name="filter"]')?.addEventListener('input', async (event) => {
      this.#filter = event.target.value;
      await this.render();
      const input = this.element.querySelector('[name="filter"]');
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
    this.element.querySelectorAll('[name="entityId"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        if (this.#busy) return;
        if (checkbox.checked) this.#selectedIds.add(checkbox.value);
        else this.#selectedIds.delete(checkbox.value);
        void this.render();
      });
    });
    this.element.querySelector('[name="destination"]')?.addEventListener('change', (event) => {
      if (this.#busy) return;
      this.#destination = event.target.value === 'compendium' ? 'compendium' : 'world';
      this.#updateImportedIds();
      void this.render();
    });
    this.element.querySelector('[name="createActors"]')?.addEventListener('change', (event) => {
      if (this.#busy) return;
      this.#createActors = event.target.checked;
      void this.render();
    });
    this.element.querySelector('[name="actorType"]')?.addEventListener('change', (event) => {
      if (!this.#busy) this.#actorType = event.target.value;
    });
  }

  static async #onChangeKind(_event, target) {
    const kind = target.dataset.kind;
    if (this.#busy || !KINDS.some(([id]) => id === kind) || (kind === 'adventurers' && this.#scope?.type !== 'campaign')) return;
    this.#kind = kind;
    this.#actorType = '';
    await this.refreshSource();
  }

  static async #onLoadEntities() {
    const scope = this.#scope;
    if (!scope || this.#status === 'importing') return;
    this.#selectedIds.clear();
    this.#entities = [];
    this.#loadedScope = null;
    this.#filter = '';
    this.#error = null;
    this.#status = 'loading';
    const revision = ++this.#loadRevision;
    await this.render();
    try {
      const entities = await this.#client.listEntities(scope, this.#kind);
      if (revision !== this.#loadRevision) return;
      this.#entities = entities.sort((a, b) => a.name.localeCompare(b.name));
      this.#loadedScope = scope;
      this.#status = 'ready';
      this.#updateImportedIds();
    } catch (error) {
      if (revision !== this.#loadRevision) return;
      this.#status = 'error';
      this.#error = error;
    }
    await this.render();
  }

  static async #onToggleAll() {
    if (this.#busy) return;
    const filter = this.#filter.trim().toLocaleLowerCase();
    const ids = this.#entities.filter((entity) => !filter || entity.name.toLocaleLowerCase().includes(filter)).map(({ id }) => id);
    const allSelected = ids.every((id) => this.#selectedIds.has(id));
    for (const id of ids) if (allSelected) this.#selectedIds.delete(id); else this.#selectedIds.add(id);
    await this.render();
  }

  static async #onImportSelected() {
    const scope = this.#loadedScope;
    const ids = [...this.#selectedIds];
    if (!game.user.isGM || !scope || !ids.length || this.#status !== 'ready') return;
    if (JSON.stringify(scope) !== JSON.stringify(this.#scope)) { await this.refreshSource(); return; }
    this.#status = 'importing';
    this.#error = null;
    this.#results = [];
    this.#progress = { done: 0, total: ids.length };
    const counts = { created: 0, updated: 0, failed: 0, actors: 0 };
    await this.render();
    try {
      const target = await createImportTarget(scope, { destination: this.#destination, createActors: this.#createActors });
      const client = this.#client;
      const labels = readPageLabels();
      for (const id of ids) {
        const name = this.#entities.find((entity) => entity.id === id)?.name ?? id;
        try {
          const result = await importEntity({ client, scope, kind: this.#kind, id, target, labels,
            createActors: this.#createActors, actorType: this.#actorType });
          counts[result.status] += 1;
          if (result.actor?.status === 'created') counts.actors += 1;
          this.#importedIds.add(id);
          this.#results.push({ name, message: localize(`Importer.Result.${result.status}`), failed: false });
        } catch (error) {
          counts.failed += 1;
          this.#results.push({ name, message: describeError(error), failed: true });
          console.error(`${MODULE_ID} | ${this.#kind}:${id}`, error);
        }
        this.#progress.done += 1;
        await this.render();
      }
    } catch (error) { this.#error = error; }
    this.#selectedIds.clear();
    this.#status = this.#error ? 'error' : 'ready';
    await this.render();
    const message = localize('Importer.Done', counts);
    if (this.#error || counts.failed) ui.notifications.warn(this.#error ? describeError(this.#error) : message);
    else ui.notifications.info(message);
    if (JSON.stringify(scope) !== JSON.stringify(this.#scope)) await this.refreshSource();
  }

  static async #onRetry() { await this.refreshSource(); }
  static async #onOpenSettings() {
    const Settings = this.#hasToken ? AtlasSettingsApplication : foundry.applications.settings.SettingsConfig;
    await new Settings().render({ force: true });
  }
}
