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
