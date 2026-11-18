export const ATLAS_PAGE_LIMIT = 50;

export class AtlasRequestError extends Error {
  constructor(status, code) {
    super(code ?? `HTTP_${status}`);
    this.status = status;
    this.code = code ?? `HTTP_${status}`;
  }
}

export class AtlasClient {
  constructor({ apiBaseUrl, token, fetchImplementation = globalThis.fetch.bind(globalThis) }) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
    this.token = token.trim();
    this.fetchImplementation = fetchImplementation;
  }

  async get(path, { adventurerId = null } = {}) {
    const headers = { Authorization: `Bearer ${this.token}`, 'X-Atlas-Client': 'foundry' };
    if (adventurerId) {
      headers['X-Adventurer-Id'] = adventurerId;
    }
    let response;
    try {
      response = await this.fetchImplementation(`${this.apiBaseUrl}${path}`, {
        headers,
        credentials: 'omit',
      });
    } catch {
      throw new AtlasRequestError(0, 'NETWORK_ERROR');
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AtlasRequestError(response.status, body?.errors?.[0]?.code);
    }
    return body;
  }

  async getAll(path, options = {}) {
    const items = [];
    const separator = path.includes('?') ? '&' : '?';
    let nextPath = `${path}${separator}limit=${ATLAS_PAGE_LIMIT}`;
    while (nextPath) {
      const body = await this.get(nextPath, options);
      items.push(...(body?.payload ?? []));
      nextPath = body?.links?.next?.href ?? null;
    }
    return items;
  }

  listWorlds() {
    return this.getAll('/worlds');
  }

  listCampaigns(worldId) {
    return this.getAll(`/worlds/${encodeURIComponent(worldId)}/campaigns`);
  }

  listMyAdventurers(campaignId) {
    return this.getAll(`/campaigns/${encodeURIComponent(campaignId)}/adventurers/mine`);
  }

  async listAdventurerNames(campaignId) {
    const body = await this.get(`/campaigns/${encodeURIComponent(campaignId)}/adventurers/names`);
    return body?.payload ?? [];
  }

  listPersons(scope) {
    return this.getAll(`${scopePath(scope)}/persons`, { adventurerId: scope.adventurerId });
  }

  listPersonDocuments(scope, personId) {
    return this.getAll(`${scopePath(scope)}/persons/${encodeURIComponent(personId)}/documents`, {
      adventurerId: scope.adventurerId,
    });
  }

  async findPerson(scope, personId) {
    const body = await this.get(`${scopePath(scope)}/persons/${encodeURIComponent(personId)}`, {
      adventurerId: scope.adventurerId,
    });
    return body.payload;
  }

  async listEntities(scope, kind) {
    checkEntityKind(scope, kind);
    if (kind === 'adventurers') {
      const items = await this.listMyAdventurers(scope.id);
      return scope.adventurerId ? items.filter(({ id }) => id === scope.adventurerId) : items;
    }
    return this.getAll(`${scopePath(scope)}/${kind}`, { adventurerId: scope.adventurerId });
  }

  async findEntity(scope, kind, id) {
    checkEntityKind(scope, kind);
    const body = await this.get(`${scopePath(scope)}/${kind}/${encodeURIComponent(id)}`, {
      adventurerId: kind === 'adventurers' ? null : scope.adventurerId,
    });
    return body.payload;
  }

  listEntityDocuments(scope, kind, id) {
    checkEntityKind(scope, kind);
    if (kind === 'adventurers') return this.listAdventurerNotes(scope.id, id);
    return this.getAll(`${scopePath(scope)}/${kind}/${encodeURIComponent(id)}/documents`, {
      adventurerId: scope.adventurerId,
    });
  }

  /**
   * Adventurers have notes instead of documents. Acting as the adventurer lists the notes of the
   * game master on the sheet, the ones the adventurer wrote and the ones others shared and the
   * adventurer accepted; a game master who cannot act as the adventurer only gets their own notes.
   */
  async listAdventurerNotes(campaignId, adventurerId) {
    const path = `/campaigns/${encodeURIComponent(campaignId)}/adventurers/${encodeURIComponent(adventurerId)}/notes`;
    let notes;
    try {
      notes = (await this.get(path, { adventurerId }))?.payload ?? [];
    } catch (error) {
      if (error?.status !== 403) throw error;
      notes = (await this.get(path))?.payload ?? [];
    }
    return notes.map(noteToDocument);
  }
}

const NOTE_TITLE_LENGTH = 60;

export const noteToDocument = (note) => {
  const firstLine = (note.text ?? '').trim().split('\n')[0].replace(/[#>*_`~]/g, '').trim();
  const title = note.title?.trim() || (firstLine.length > NOTE_TITLE_LENGTH
    ? `${firstLine.slice(0, NOTE_TITLE_LENGTH - 1)}…` : firstLine) || note.id;
  return {
    id: note.id,
    title,
    subtitle: note.ownerName ?? null,
    text: note.text ?? '',
    parameters: [],
    tags: [],
    ownerId: note.ownerId ?? null,
    viewerIds: [...(note.viewerIds ?? [])],
    pendingIds: [...(note.pendingIds ?? [])],
  };
};

const checkEntityKind = (scope, kind) => {
  if (!['persons', 'adventurers', 'places', 'factions'].includes(kind) ||
    (kind === 'adventurers' && scope.type !== 'campaign')) {
    throw new AtlasRequestError(0, 'INVALID_IMPORT_KIND');
  }
};

export const scopePath = (scope) =>
  `/${scope.type === 'campaign' ? 'campaigns' : 'worlds'}/${encodeURIComponent(scope.id)}`;
