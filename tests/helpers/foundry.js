import { MODULE_ID } from '../../scripts/person-journal.js';

const levels = { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 };
const merge = (object, changes) => {
  for (const [key, value] of Object.entries(changes)) {
    if (key.startsWith('-=')) delete object[key.slice(2)];
    else if (value && typeof value === 'object' && !Array.isArray(value)) merge(object[key] ??= {}, value);
    else object[key] = structuredClone(value);
  }
};
let sequence = 0;
export class MockDocument {
  constructor(data, documentName, { parent = null, pack = null } = {}) {
    Object.assign(this, structuredClone(data));
    this.id = data.id ?? `id${sequence++}`;
    this.documentName = documentName;
    this.parent = parent;
    this.pack = pack;
    this.flags ??= {};
    this.ownership ??= { default: 0 };
    this.uuid = parent ? `${parent.uuid}.JournalEntryPage.${this.id}`
      : pack ? `Compendium.${pack}.${this.id}` : `${documentName}.${this.id}`;
    game.uuidDocuments.set(this.uuid, this);
    if (documentName === 'JournalEntry') {
      this.pages = (data.pages ?? []).map((page) => new MockDocument(page, 'JournalEntryPage', { parent: this }));
    }
  }
  getFlag(module, key) { return this.flags[module]?.[key]; }
  testUserPermission(user, level) {
    if (user.isGM) return true;
    let own = this.ownership[user.id] ?? this.ownership.default ?? 0;
    if (own === -1) return this.parent?.testUserPermission(user, level) ?? false;
    return own >= (levels[level] ?? level);
  }
  get hasPlayerOwner() { return game.users.some((user) => !user.isGM && user.role > 0 && this.testUserPermission(user, 3)); }
  async update(changes) { game.writes.push({ type: this.documentName, id: this.id, changes }); merge(this, changes); return this; }
  async updateEmbeddedDocuments(_type, changes) {
    for (const change of changes) await this.pages.find(({ id }) => id === change._id).update(change);
  }
  async createEmbeddedDocuments(_type, pages) {
    for (const data of pages) this.pages.push(new MockDocument(data, 'JournalEntryPage', { parent: this }));
  }
  async deleteEmbeddedDocuments(_type, ids) { this.pages = this.pages.filter(({ id }) => !ids.includes(id)); }
}

export const setupFoundry = () => {
  sequence = 0;
  const users = [
    { id: 'gm', name: 'GM', isGM: true, role: 4 },
    { id: 'alice', name: 'Alice', isGM: false, role: 1 },
    { id: 'bob', name: 'Bob', isGM: false, role: 1 },
    { id: 'pending', name: 'Pending', isGM: false, role: 1 },
    { id: 'spectator', name: 'Spectator', isGM: false, role: 1 },
  ];
  globalThis.game = {
    users, user: users[0], journal: [], actors: [], folders: [], packs: new Map(), writes: [], packEvents: [],
    approvedLinks: {}, uuidDocuments: new Map(), documentTypes: { Actor: ['character', 'npc', 'group'] },
    i18n: { localize: (key) => key },
    settings: { get: (_module, key) => ({ source: { worldId: 'w1', campaignId: 'c1', campaignName: 'Campaign' }, actorLinks: game.approvedLinks, language: 'en' })[key] },
  };
  const create = (documentName, collection) => async (data, options = {}) => {
    if (options.pack) {
      const pack = game.packs.get(options.pack);
      game.packEvents.push(`write:${options.pack}`);
      if (pack.ownership.PLAYER !== 'NONE' || pack.ownership.TRUSTED !== 'NONE') throw new Error('Pack was not secured before a write');
    }
    const document = new MockDocument(data, documentName, { pack: options.pack });
    (options.pack ? game.packs.get(options.pack).documents : collection).push(document);
    game.writes.push({ type: documentName, id: document.id, changes: data, pack: options.pack });
    return document;
  };
  globalThis.foundry = { documents: {
    JournalEntry: { create: create('JournalEntry', game.journal) },
    Actor: { create: create('Actor', game.actors) },
    Folder: { create: create('Folder', game.folders) },
    collections: { CompendiumCollection: { createCompendium: async (metadata) => {
      const pack = {
        collection: `world.${metadata.name}`, metadata, documentName: metadata.type, documents: [], locked: false,
        ownership: { PLAYER: 'OBSERVER', TRUSTED: 'OBSERVER' },
        async configure(config) { Object.assign(this, config); game.packEvents.push(`secure:${this.collection}`); },
        async getDocuments() { return [...this.documents]; },
      };
      game.packs.set(pack.collection, pack);
      return pack;
    } } },
  } };
  globalThis.CONFIG = { Actor: { typeLabels: {} } };
  globalThis.fromUuid = async (uuid) => game.uuidDocuments.get(uuid) ?? null;
  return { users };
};

export const addLinkedActor = (adventurerId, userId, campaignId = 'c1', extra = {}) => {
  const actor = new MockDocument({ name: adventurerId, type: 'character', system: { hp: 42 },
    ownership: { default: 0, [userId]: 3, spectator: 2 },
    flags: { [MODULE_ID]: { adventurerLinks: [{ worldId: 'w1', campaignId, adventurerId }] } }, ...extra,
  }, 'Actor');
  game.actors.push(actor);
  (game.approvedLinks[campaignId] ??= {})[actor.id] = { worldId: 'w1', campaignId, adventurerId };
  return actor;
};

export const labels = { portrait: 'Portrait', profile: 'Profile', history: 'History', age: 'Age',
  nicknames: 'Nicknames', status: 'Status', height: 'Height', positions: 'Positions', tags: 'Tags', author: 'Author', statuses: {},
};
export const scope = { type: 'campaign', id: 'c1', name: 'Campaign', adventurerId: null };
