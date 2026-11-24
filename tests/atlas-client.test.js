import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AtlasClient, AtlasRequestError } from '../scripts/atlas-client.js';

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

test('follows the next links until the last page', async () => {
  const requestedUrls = [];
  const pages = {
    'https://api.test/worlds/w1/persons?limit=50': {
      payload: [{ id: 'a' }],
      links: { next: { href: '/worlds/w1/persons?limit=50&cursor=a' } },
    },
    'https://api.test/worlds/w1/persons?limit=50&cursor=a': { payload: [{ id: 'b' }], links: {} },
  };
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test/',
    token: ' atlas_pat_x ',
    fetchImplementation: async (url, options) => {
      requestedUrls.push(url);
      assert.equal(options.headers.Authorization, 'Bearer atlas_pat_x');
      assert.equal(options.headers['X-Atlas-Client'], 'foundry');
      assert.equal(options.credentials, 'omit');
      return jsonResponse(200, pages[url]);
    },
  });

  const persons = await client.listPersons({ type: 'world', id: 'w1', adventurerId: null });

  assert.deepEqual(persons, [{ id: 'a' }, { id: 'b' }]);
  assert.equal(requestedUrls.length, 2);
});

test('sends the adventurer header inside a campaign', async () => {
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test',
    token: 'atlas_pat_x',
    fetchImplementation: async (url, options) => {
      assert.equal(url, 'https://api.test/campaigns/c1/persons/p1');
      assert.equal(options.headers['X-Adventurer-Id'], 'adv1');
      assert.equal(options.headers['X-Atlas-Client'], 'foundry');
      return jsonResponse(200, { payload: { id: 'p1' } });
    },
  });

  const person = await client.findPerson({ type: 'campaign', id: 'c1', adventurerId: 'adv1' }, 'p1');

  assert.deepEqual(person, { id: 'p1' });
});

test('loads only campaign adventurer names for player Actor assignments', async () => {
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test', token: 'atlas_pat_x',
    fetchImplementation: async (url, options) => {
      assert.equal(url, 'https://api.test/campaigns/c%2F1/adventurers/names');
      assert.equal(options.headers['X-Atlas-Client'], 'foundry');
      assert.equal(options.headers['X-Adventurer-Id'], undefined);
      return jsonResponse(200, { payload: [{ id: 'adv1', name: 'Ada' }] });
    },
  });
  assert.deepEqual(await client.listAdventurerNames('c/1'), [{ id: 'adv1', name: 'Ada' }]);
});

test('turns an error answer into the error code of the API', async () => {
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test',
    token: 'atlas_pat_x',
    fetchImplementation: async () =>
      jsonResponse(404, { errors: [{ code: 'PERSON_NOT_FOUND' }] }),
  });

  await assert.rejects(client.findPerson({ type: 'world', id: 'w1' }, 'p1'), (error) => {
    assert.ok(error instanceof AtlasRequestError);
    assert.equal(error.code, 'PERSON_NOT_FOUND');
    return true;
  });
});

test('answers a network failure with its own code', async () => {
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test',
    token: 'atlas_pat_x',
    fetchImplementation: async () => {
      throw new TypeError('Failed to fetch');
    },
  });

  await assert.rejects(client.listWorlds(), { code: 'NETWORK_ERROR' });
});

test('imports the person notes with the selected campaign viewpoint', async () => {
  const requests = [];
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test', token: 'atlas_pat_x',
    fetchImplementation: async (url, options) => {
      requests.push(url);
      assert.equal(options.headers['X-Adventurer-Id'], 'adv1');
      return jsonResponse(200, { payload: [
        { id: 'n1', title: 'Rumor', text: 'First', ownerId: 'adv1', viewerIds: ['adv2'] },
        { id: 'n2', title: null, text: '# Second line\nMore', ownerId: null, ownerName: 'Mestre' },
      ] });
    },
  });
  const documents = await client.listEntityDocuments({ type: 'campaign', id: 'c1', adventurerId: 'adv1' }, 'persons', 'p1');
  assert.deepEqual(requests, ['https://api.test/campaigns/c1/persons/p1/notes']);
  assert.deepEqual(documents.map(({ id, title, ownerId, viewerIds }) => ({ id, title, ownerId, viewerIds })), [
    { id: 'n1', title: 'Rumor', ownerId: 'adv1', viewerIds: ['adv2'] },
    { id: 'n2', title: 'Second line', ownerId: null, viewerIds: [] },
  ]);
});

test('uses the world person notes endpoint and encodes identifiers', async () => {
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test', token: 'atlas_pat_x',
    fetchImplementation: async (url, options) => {
      assert.equal(url, 'https://api.test/worlds/world%2F1/persons/person%201/notes');
      assert.equal(options.headers['X-Adventurer-Id'], undefined);
      return jsonResponse(200, { payload: [] });
    },
  });
  assert.deepEqual(await client.listPersonNotes({ type: 'world', id: 'world/1' }, 'person 1'), []);
});

test('fails the person import when the notes cannot be read', async () => {
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test', token: 'atlas_pat_x',
    fetchImplementation: async () => jsonResponse(403, { errors: [{ code: 'PERSON_FORBIDDEN' }] }),
  });
  await assert.rejects(client.listPersonNotes({ type: 'world', id: 'w1' }, 'p1'), { code: 'PERSON_FORBIDDEN' });
});

test('lists and finds places and factions with encoded scope IDs and the selected viewpoint', async () => {
  const paths = [];
  const client = new AtlasClient({ apiBaseUrl: 'https://api.test', token: 'atlas_pat_x',
    fetchImplementation: async (url, options) => {
      paths.push(url);
      assert.equal(options.headers['X-Adventurer-Id'], 'adv1');
      return jsonResponse(200, { payload: url.includes('limit=') ? [] : { id: 'entity' } });
    },
  });
  const scope = { type: 'campaign', id: 'c/1', adventurerId: 'adv1' };
  for (const kind of ['places', 'factions']) {
    await client.listEntities(scope, kind);
    await client.findEntity(scope, kind, 'e/1');
    await client.listEntityDocuments(scope, kind, 'e/1');
  }
  assert.ok(paths.includes('https://api.test/campaigns/c%2F1/places/e%2F1/documents?limit=50'));
  assert.ok(paths.includes('https://api.test/campaigns/c%2F1/factions/e%2F1'));
});

test('adventurer imports read the notes of the adventurer acting as them and keep accepted and pending shares distinct', async () => {
  const requests = [];
  const client = new AtlasClient({ apiBaseUrl: 'https://api.test', token: 'atlas_pat_x',
    fetchImplementation: async (url, options) => {
      requests.push({ url, adventurerId: options.headers['X-Adventurer-Id'] });
      return jsonResponse(200, { payload: url.includes('/mine')
        ? [{ id: 'a1' }, { id: 'a2' }]
        : [{ id: 'n1', title: '', text: '# Plano\nSeguir o mapa', ownerId: 'a1', ownerName: 'Gandalf', viewerIds: ['a2'], pendingIds: ['a3'] }] });
    },
  });
  const scope = { type: 'campaign', id: 'c1', adventurerId: 'a1' };
  assert.deepEqual(await client.listEntities(scope, 'adventurers'), [{ id: 'a1' }]);
  assert.deepEqual(await client.listEntityDocuments(scope, 'adventurers', 'a1'), [{
    id: 'n1', title: 'Plano', subtitle: 'Gandalf', text: '# Plano\nSeguir o mapa', parameters: [], tags: [],
    ownerId: 'a1', viewerIds: ['a2'], pendingIds: ['a3'],
  }]);
  assert.deepEqual(requests.at(-1), { url: 'https://api.test/campaigns/c1/adventurers/a1/notes', adventurerId: 'a1' });
  await assert.rejects(client.listEntities({ type: 'world', id: 'w1' }, 'adventurers'), { code: 'INVALID_IMPORT_KIND' });
});

test('a game master who cannot act as the adventurer imports only their own notes', async () => {
  const headers = [];
  const client = new AtlasClient({ apiBaseUrl: 'https://api.test', token: 'atlas_pat_x',
    fetchImplementation: async (_url, options) => {
      headers.push(options.headers['X-Adventurer-Id']);
      return options.headers['X-Adventurer-Id']
        ? jsonResponse(403, { errors: [{ code: 'ADVENTURER_FORBIDDEN' }] })
        : jsonResponse(200, { payload: [{ id: 'n2', title: 'Segredo', text: 'Texto', ownerId: null }] });
    },
  });
  const notes = await client.listEntityDocuments({ type: 'campaign', id: 'c1' }, 'adventurers', 'a9');
  assert.deepEqual(headers, ['a9', undefined]);
  assert.deepEqual(notes.map(({ title, ownerId }) => ({ title, ownerId })), [{ title: 'Segredo', ownerId: null }]);
});
