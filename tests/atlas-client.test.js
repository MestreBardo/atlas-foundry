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
      return jsonResponse(200, { payload: { id: 'p1' } });
    },
  });

  const person = await client.findPerson({ type: 'campaign', id: 'c1', adventurerId: 'adv1' }, 'p1');

  assert.deepEqual(person, { id: 'p1' });
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

test('loads every person document page with the selected campaign viewpoint', async () => {
  const requests = [];
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test', token: 'atlas_pat_x',
    fetchImplementation: async (url, options) => {
      requests.push(url);
      assert.equal(options.headers['X-Adventurer-Id'], 'adv1');
      return jsonResponse(200, url.includes('cursor=')
        ? { payload: [{ id: 'd2', text: 'Second' }] }
        : { payload: [{ id: 'd1', text: 'First' }], links: { next: { href: '/campaigns/c1/persons/p1/documents?limit=50&cursor=d1' } } });
    },
  });
  const documents = await client.listPersonDocuments({ type: 'campaign', id: 'c1', adventurerId: 'adv1' }, 'p1');
  assert.equal(requests[0], 'https://api.test/campaigns/c1/persons/p1/documents?limit=50');
  assert.deepEqual(documents.map(({ id }) => id), ['d1', 'd2']);
});

test('uses the world document endpoint and encodes identifiers', async () => {
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test', token: 'atlas_pat_x',
    fetchImplementation: async (url, options) => {
      assert.equal(url, 'https://api.test/worlds/world%2F1/persons/person%201/documents?limit=50');
      assert.equal(options.headers['X-Adventurer-Id'], undefined);
      return jsonResponse(200, { payload: [] });
    },
  });
  assert.deepEqual(await client.listPersonDocuments({ type: 'world', id: 'world/1' }, 'person 1'), []);
});

test('fails an incomplete document list instead of treating it as empty', async () => {
  const client = new AtlasClient({
    apiBaseUrl: 'https://api.test', token: 'atlas_pat_x',
    fetchImplementation: async (url) => url.includes('cursor=')
      ? jsonResponse(403, {})
      : jsonResponse(200, { payload: [{ id: 'd1' }], links: { next: { href: '/worlds/w1/persons/p1/documents?cursor=next' } } }),
  });
  await assert.rejects(client.listPersonDocuments({ type: 'world', id: 'w1' }, 'p1'), { code: 'HTTP_403' });
});
