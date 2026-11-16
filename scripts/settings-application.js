import { AtlasClient } from './atlas-client.js';
import { buildActorLinkUpdates, getActorLink } from './actor-links.js';
import { describeError } from './errors.js';
import { initializeLocalization, localize } from './localization.js';
import { MODULE_ID } from './person-journal.js';
import { readConnection, readSource } from './settings.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AtlasSettingsApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'atlas-source-settings', tag: 'form', classes: ['atlas-importer', 'atlas-settings'],
    window: { title: 'ATLAS.Settings.Source.Name', icon: 'fa-solid fa-book-atlas', resizable: true },
    position: { width: 600, height: 680 },
    form: { handler: AtlasSettingsApplication.#onSubmit, closeOnSubmit: false },
    actions: {
      retry: AtlasSettingsApplication.#onRetry,
      openConnectionSettings: AtlasSettingsApplication.#onOpenConnectionSettings,
    },
  };

  static PARTS = { body: { template: `modules/${MODULE_ID}/templates/settings.hbs`, scrollable: ['.atlas-settings-body'] } };

  #source = { ...readSource() };
  #worlds = [];
  #campaigns = [];
  #adventurers = [];
  #viewpoints = [];
  #assignments = {};
  #loading = true;
  #saving = false;
  #error = null;
  #loaded = false;
  #ready = false;
  #revision = 0;

  get title() { return localize('ATLAS.Settings.Source.Name'); }
  get #client() { return new AtlasClient(readConnection()); }

  async _prepareContext() {
    await initializeLocalization();
    const actors = [...game.actors].sort((a, b) => a.name.localeCompare(b.name));
    return {
      hasToken: Boolean(readConnection().token.trim()), loading: this.#loading, saving: this.#saving,
      busy: this.#loading || this.#saving, errorMessage: this.#error ? describeError(this.#error) : '',
      worlds: this.#worlds.map((world) => ({ ...world, selected: world.id === this.#source.worldId })),
      campaigns: this.#campaigns.map((campaign) => ({ ...campaign, selected: campaign.id === this.#source.campaignId })),
      hasWorld: Boolean(this.#source.worldId), hasCampaign: Boolean(this.#source.campaignId),
      viewpoints: this.#viewpoints.map((adventurer) => ({ ...adventurer, selected: adventurer.id === this.#source.adventurerId })),
      assignments: this.#adventurers.map((adventurer) => ({
        ...adventurer,
        actors: actors.map((actor) => ({ id: actor.id, name: actor.name, selected: this.#assignments[adventurer.id] === actor.id })),
      })),
      canSave: this.#loaded && this.#ready && !this.#loading && !this.#saving,
    };
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    queueMicrotask(() => void this.#initialize());
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelector('[name="worldId"]')?.addEventListener('change', (event) => {
      this.#source = { worldId: event.target.value, campaignId: '', adventurerId: '' };
      this.#campaigns = [];
      this.#adventurers = [];
      this.#viewpoints = [];
      this.#assignments = {};
      void this.#run(async () => {
        const campaigns = this.#source.worldId ? await this.#client.listCampaigns(this.#source.worldId) : [];
        return () => { this.#campaigns = campaigns; };
      });
    });
    this.element.querySelector('[name="campaignId"]')?.addEventListener('change', (event) => {
      this.#source.campaignId = event.target.value;
      this.#source.adventurerId = '';
      this.#adventurers = [];
      this.#viewpoints = [];
      this.#assignments = {};
      void this.#run(() => this.#loadCampaign());
    });
    this.element.querySelector('[name="adventurerId"]')?.addEventListener('change', (event) => {
      this.#source.adventurerId = event.target.value;
    });
    this.element.querySelectorAll('[data-adventurer-id]').forEach((select) => {
      select.addEventListener('change', () => { this.#assignments[select.dataset.adventurerId] = select.value; });
    });
  }

  async #run(action) {
    const revision = ++this.#revision;
    this.#loading = true;
    this.#ready = false;
    this.#error = null;
    await this.render();
    try {
      const apply = await action();
      if (revision !== this.#revision) return;
      apply?.();
      this.#ready = true;
    } catch (error) {
      if (revision !== this.#revision) return;
      this.#error = error;
    }
    this.#loading = false;
    await this.render();
  }

  async #initialize() {
    if (!readConnection().token.trim()) {
      this.#loading = false;
      await this.render();
      return;
    }
    await this.#run(async () => {
      const worlds = await this.#client.listWorlds();
      const campaigns = this.#source.worldId ? await this.#client.listCampaigns(this.#source.worldId) : [];
      const applyCampaign = await this.#loadCampaign();
      return () => {
        this.#worlds = worlds;
        this.#campaigns = campaigns;
        this.#loaded = true;
        applyCampaign();
      };
    });
  }

  async #loadCampaign() {
    const campaignId = this.#source.campaignId;
    if (!campaignId) return () => {};
    const [adventurers, viewpoints] = await Promise.all([
      this.#client.listAdventurerNames(campaignId), this.#client.listMyAdventurers(campaignId),
    ]);
    const assignments = Object.fromEntries(adventurers.map(({ id }) => [id,
      game.actors.find((actor) => getActorLink(actor, campaignId)?.adventurerId === id)?.id ?? '',
    ]));
    return () => { this.#adventurers = adventurers; this.#viewpoints = viewpoints; this.#assignments = assignments; };
  }

  static async #onRetry() { await this.#initialize(); }

  static async #onOpenConnectionSettings() {
    await new foundry.applications.settings.SettingsConfig().render({ force: true });
  }

  static async #onSubmit(_event, _form, formData) {
    if (!game.user.isGM || this.#loading || this.#saving || !this.#loaded || !this.#ready) return;
    // Read the final form values too (including a change immediately before submit).
    this.#source.adventurerId = formData.object.adventurerId ?? '';
    for (const adventurer of this.#adventurers) {
      this.#assignments[adventurer.id] = formData.object[`actor-${adventurer.id}`] ?? '';
    }
    this.#saving = true;
    this.#error = null;
    await this.render();
    try {
      const world = this.#worlds.find(({ id }) => id === this.#source.worldId);
      const campaign = this.#campaigns.find(({ id }) => id === this.#source.campaignId);
      if ((this.#source.worldId && !world) || (this.#source.campaignId && (!world || !campaign)) ||
        (this.#source.adventurerId && !this.#viewpoints.some(({ id }) => id === this.#source.adventurerId))) {
        throw Object.assign(new Error('SOURCE_NOT_FOUND'), { code: 'SOURCE_NOT_FOUND' });
      }
      const source = {
        worldId: world?.id ?? '', worldName: world?.name ?? '',
        campaignId: campaign?.id ?? '', campaignName: campaign?.name ?? '',
        adventurerId: campaign ? this.#source.adventurerId : '',
      };
      const updates = campaign ? buildActorLinkUpdates({
        actors: [...game.actors], source, adventurers: this.#adventurers, assignments: this.#assignments,
      }) : [];
      if (updates.length) await foundry.documents.Actor.updateDocuments(updates);
      await game.settings.set(MODULE_ID, 'source', source);
      ui.notifications.info(localize('ATLAS.Settings.Source.Saved'));
      await this.close();
    } catch (error) {
      this.#error = error;
    } finally {
      this.#saving = false;
    }
    if (this.rendered) await this.render();
  }
}
