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
    return this.getAll(`${scopePath(scope)}/${kind}/${encodeURIComponent(id)}/documents`, {
      adventurerId: kind === 'adventurers' ? null : scope.adventurerId,
    });
  }
}

const checkEntityKind = (scope, kind) => {
  if (!['persons', 'adventurers', 'places', 'factions'].includes(kind) ||
    (kind === 'adventurers' && scope.type !== 'campaign')) {
    throw new AtlasRequestError(0, 'INVALID_IMPORT_KIND');
  }
};

export const scopePath = (scope) =>
  `/${scope.type === 'campaign' ? 'campaigns' : 'worlds'}/${encodeURIComponent(scope.id)}`;
