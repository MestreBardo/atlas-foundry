'use strict';

/*
 * Shared contract of the Atlas API client. The same file lives in atlas-foundry and in
 * atlas-talespire (tests/helpers/atlas-client-contract.cjs); change both together.
 */
const assert = require('node:assert/strict');
const { test } = require('node:test');

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const describeAtlasClientContract = ({ AtlasClient, AtlasRequestError, clientHeader }) => {
  const createClient = (fetchImplementation) =>
    new AtlasClient({ apiBaseUrl: 'https://api.test/', token: ' atlas_pat_x ', fetchImplementation });

  test('contract: sends the trimmed token without cookies and with the client header', async () => {
    const client = createClient(async (url, options) => {
      assert.equal(url, 'https://api.test/personal-token');
      assert.equal(options.headers.Authorization, 'Bearer atlas_pat_x');
      assert.equal(options.headers['X-Atlas-Client'], clientHeader);
      assert.equal(options.headers['X-Adventurer-Id'], undefined);
      assert.equal(options.credentials, 'omit');
      return jsonResponse(200, { payload: null });
    });
    assert.deepEqual(await client.get('/personal-token'), { payload: null });
  });

  test('contract: sends the adventurer header only when there is one', async () => {
    const client = createClient(async (url, options) => {
      assert.equal(url, 'https://api.test/campaigns/c%2F1/persons/p%2F1');
      assert.equal(options.headers['X-Adventurer-Id'], 'adv1');
      return jsonResponse(200, { payload: { id: 'p/1' } });
    });
    const person = await client.findPerson({ type: 'campaign', id: 'c/1', adventurerId: 'adv1' }, 'p/1');
    assert.deepEqual(person, { id: 'p/1' });
  });

  test('contract: turns network failures and error answers into request errors', async () => {
    const offline = createClient(async () => {
      throw new TypeError('Failed to fetch');
    });
    await assert.rejects(offline.get('/worlds'), (error) => {
      assert.ok(error instanceof AtlasRequestError);
      assert.equal(error.status, 0);
      assert.equal(error.code, 'NETWORK_ERROR');
      return true;
    });

    const refused = createClient(async () => jsonResponse(403, { errors: [{ code: 'PERSONAL_TOKEN_FORBIDDEN' }] }));
    await assert.rejects(refused.get('/worlds'), { status: 403, code: 'PERSONAL_TOKEN_FORBIDDEN' });

    const broken = createClient(async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError(); } }));
    await assert.rejects(broken.get('/worlds'), { status: 502, code: 'HTTP_502' });
  });

  test('contract: follows the next links with the page limit', async () => {
    const requestedUrls = [];
    const pages = {
      'https://api.test/worlds/w1/persons?limit=50': {
        payload: [{ id: 'a' }],
        links: { next: { href: '/worlds/w1/persons?limit=50&cursor=a' } },
      },
      'https://api.test/worlds/w1/persons?limit=50&cursor=a': { payload: [{ id: 'b' }], links: {} },
      'https://api.test/worlds/w1/persons?name=a&limit=50': { payload: [{ id: 'a' }] },
    };
    const client = createClient(async (url) => {
      requestedUrls.push(url);
      return jsonResponse(200, pages[url]);
    });
    assert.deepEqual(await client.listPersons({ type: 'world', id: 'w1', adventurerId: null }), [
      { id: 'a' },
      { id: 'b' },
    ]);
    assert.deepEqual(await client.getAll('/worlds/w1/persons?name=a'), [{ id: 'a' }]);
    assert.equal(requestedUrls.length, 3);
  });

  test('contract: reads the token context once and tries again after a failure', async () => {
    let calls = 0;
    const client = createClient(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse(500, null);
      return jsonResponse(200, { payload: { world: null, campaigns: [] } });
    });
    await assert.rejects(client.findTokenContext(), { code: 'HTTP_500' });
    await client.findTokenContext();
    await client.findTokenContext();
    assert.equal(calls, 2);
  });

  test('contract: lists the worlds and campaigns the token reaches', async () => {
    const client = createClient(async () =>
      jsonResponse(200, {
        payload: {
          world: { id: 'w1', name: 'Norte' },
          campaigns: [
            { id: 'c1', name: 'Gelo', worldId: 'w1', worldName: 'Norte' },
            { id: 'c2', name: null, worldId: 'w2', worldName: null },
          ],
        },
      }),
    );
    assert.deepEqual(await client.listWorlds(), [
      { id: 'w1', name: 'Norte' },
      { id: 'w2', name: 'w2' },
    ]);
    assert.deepEqual(await client.listCampaigns('w2'), [{ id: 'c2', name: 'c2', worldId: 'w2' }]);
  });
};

module.exports = { describeAtlasClientContract, jsonResponse };
