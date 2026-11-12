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
    const headers = { Authorization: `Bearer ${this.token}` };
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
}

export const scopePath = (scope) =>
  `/${scope.type === 'campaign' ? 'campaigns' : 'worlds'}/${encodeURIComponent(scope.id)}`;
