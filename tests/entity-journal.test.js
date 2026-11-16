import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { buildEntityPages } from '../scripts/entity-journal.js';
import { labels, scope, setupFoundry } from './helpers/foundry.js';

beforeEach(setupFoundry);

test('places include their image, type, factions, tags, description and documents', () => {
  const pages = buildEntityPages('places', { id: 'p1', name: 'The City', type: 'city', image: 'city.webp',
    description: 'Stone towers', factions: [{ factionName: 'The Order' }], tags: ['north'],
  }, [{ id: 'd1', title: 'Charter', text: 'Laws' }], { labels, scope });
  assert.equal(pages[0].src, 'city.webp');
  assert.match(pages[1].text.content, /city|The Order|#north|Stone towers/);
  assert.equal(pages[2].name, 'Charter');
});

test('factions use the place names returned by the Atlas API and escape metadata', () => {
  const pages = buildEntityPages('factions', { id: 'f1', name: 'The Order', description: 'A brotherhood',
    places: [{ placeName: 'North Castle' }, { placeName: '<Secret>' }],
  }, [], { labels, scope });
  assert.match(pages[0].text.content, /North Castle/);
  assert.match(pages[0].text.content, /&lt;Secret&gt;/);
  assert.doesNotMatch(pages[0].text.content, /<Secret>/);
});

test('adventurer background stays on its own permissioned page', () => {
  const pages = buildEntityPages('adventurers', { id: 'a1', name: 'Aria', personality: 'Kind', background: 'A secret' },
    [], { labels, scope });
  assert.equal(pages.length, 2);
  assert.equal(pages[0].name, 'Profile');
  assert.equal(pages[1].name, 'History');
  assert.deepEqual(pages[1].ownership, { default: 0 });
});
