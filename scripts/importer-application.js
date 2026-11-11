import { AtlasClient } from './atlas-client.js';
import { ensureScopeFolder, writePersonEntry } from './journal-writer.js';
import { MODULE_ID } from './person-journal.js';
import { readConnection } from './settings.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PERSON_STATUSES = ['alive', 'dead', 'missing', 'imprisoned', 'exiled', 'unknown'];

const localize = (key, data = null) =>
  data ? game.i18n.format(`ATLAS.${key}`, data) : game.i18n.localize(`ATLAS.${key}`);

const describeError = (error) => {
  const code = error?.code ?? 'UNKNOWN';
  const knownKey = {
    NETWORK_ERROR: 'Errors.Network',
    HTTP_401: 'Errors.Unauthorized',
    HTTP_403: 'Errors.Forbidden',
  }[code];
  return knownKey ? localize(knownKey) : localize('Errors.Generic', { code });
};

const readPageLabels = () => ({
  portrait: localize('Journal.Portrait'),
  profile: localize('Journal.Profile'),
  nicknames: localize('Journal.Nicknames'),
  status: localize('Journal.Status'),
  age: localize('Journal.Age'),
  height: localize('Journal.Height'),
  positions: localize('Journal.Positions'),
  tags: localize('Journal.Tags'),
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

  #worlds = [];
  #campaigns = [];
  #adventurers = [];
  #persons = [];
  #selectedWorldId = '';
  #selectedCampaignId = '';
  #selectedAdventurerId = '';
  #selectedPersonIds = new Set();
  #filter = '';
  #status = 'loading';
  #errorMessage = '';
  #progress = { done: 0, total: 0 };
  #loadedScope = null;

  get #client() {
    return new AtlasClient(readConnection());
  }

  get #hasToken() {
    return readConnection().token.trim() !== '';
  }

  get #scope() {
    const world = this.#worlds.find((candidate) => candidate.id === this.#selectedWorldId);
    if (!world) {
      return null;
    }
    const campaign = this.#campaigns.find((candidate) => candidate.id === this.#selectedCampaignId);
    if (campaign) {
      return {
        type: 'campaign',
        id: campaign.id,
        name: campaign.name,
        adventurerId: this.#selectedAdventurerId || null,
      };
    }
    return { type: 'world', id: world.id, name: world.name, adventurerId: null };
  }

  async _prepareContext() {
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
      errorMessage: this.#errorMessage,
      progress: this.#progress,
      worlds: this.#worlds.map((world) => ({ ...world, selected: world.id === this.#selectedWorldId })),
      campaigns: this.#campaigns.map((campaign) => ({
        ...campaign,
        selected: campaign.id === this.#selectedCampaignId,
      })),
      adventurers: this.#adventurers.map((adventurer) => ({
        ...adventurer,
        selected: adventurer.id === this.#selectedAdventurerId,
      })),
      showAdventurers: this.#selectedCampaignId !== '' && this.#adventurers.length > 0,
      canLoad: this.#selectedWorldId !== '',
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

  async #initialize() {
    if (this.#hasToken) {
      await this.#loadWorlds();
      return;
    }
    this.#status = 'ready';
    await this.render();
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const element = this.element;
    element.querySelector('[name="worldId"]')?.addEventListener('change', (event) => {
      void this.#selectWorld(event.target.value);
    });
    element.querySelector('[name="campaignId"]')?.addEventListener('change', (event) => {
      void this.#selectCampaign(event.target.value);
    });
    element.querySelector('[name="adventurerId"]')?.addEventListener('change', (event) => {
      this.#selectedAdventurerId = event.target.value;
    });
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
    this.#status = 'loading';
    this.#errorMessage = '';
    await this.render();
    try {
      await action();
      this.#status = 'ready';
    } catch (error) {
      this.#status = 'error';
      this.#errorMessage = describeError(error);
    }
    await this.render();
  }

  async #loadWorlds() {
    await this.#run(async () => {
      this.#worlds = await this.#client.listWorlds();
    });
  }

  async #selectWorld(worldId) {
    this.#selectedWorldId = worldId;
    this.#selectedCampaignId = '';
    this.#selectedAdventurerId = '';
    this.#campaigns = [];
    this.#adventurers = [];
    if (!worldId) {
      await this.render();
      return;
    }
    await this.#run(async () => {
      this.#campaigns = await this.#client.listCampaigns(worldId);
    });
  }

  async #selectCampaign(campaignId) {
    this.#selectedCampaignId = campaignId;
    this.#selectedAdventurerId = '';
    this.#adventurers = [];
    if (!campaignId) {
      await this.render();
      return;
    }
    await this.#run(async () => {
      this.#adventurers = await this.#client.listMyAdventurers(campaignId);
    });
  }

  static async #onLoadPersons() {
    const scope = this.#scope;
    if (!scope) {
      return;
    }
    this.#selectedPersonIds.clear();
    this.#filter = '';
    await this.#run(async () => {
      const persons = await this.#client.listPersons(scope);
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
    if (!scope || personIds.length === 0) {
      return;
    }
    this.#status = 'importing';
    this.#errorMessage = '';
    this.#progress = { done: 0, total: personIds.length };
    await this.render();
    const counts = { created: 0, updated: 0, failed: 0 };
    const labels = readPageLabels();
    try {
      const folder = await ensureScopeFolder(scope);
      for (const personId of personIds) {
        try {
          const person = await this.#client.findPerson(scope, personId);
          counts[await writePersonEntry(person, scope, { folder, labels })] += 1;
        } catch (error) {
          counts.failed += 1;
          console.error(`${MODULE_ID} | ${personId}`, error);
        }
        this.#progress = { done: this.#progress.done + 1, total: personIds.length };
        await this.render();
      }
    } catch (error) {
      this.#errorMessage = describeError(error);
    }
    this.#selectedPersonIds.clear();
    this.#status = this.#errorMessage ? 'error' : 'ready';
    await this.render();
    const message = localize('Importer.Done', counts);
    if (counts.failed > 0) {
      ui.notifications.warn(message);
    } else {
      ui.notifications.info(message);
    }
  }

  static async #onRetry() {
    if (this.#worlds.length === 0) {
      await this.#loadWorlds();
      return;
    }
    this.#status = 'ready';
    this.#errorMessage = '';
    await this.render();
  }

  static async #onOpenSettings() {
    const SettingsConfig = foundry.applications.settings.SettingsConfig;
    await new SettingsConfig().render({ force: true });
  }
}
