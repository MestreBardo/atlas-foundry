import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPersonPages, markdownToHtml, replaceMentions } from '../scripts/person-journal.js';

const labels = {
  portrait: 'Portrait',
  profile: 'Profile',
  nicknames: 'Nicknames',
  status: 'Status',
  age: 'Age',
  height: 'Height',
  positions: 'Positions',
  tags: 'Tags',
  statuses: { dead: 'Dead' },
};

test('turns Atlas mentions into bold names', () => {
  assert.equal(
    replaceMentions('Friend of @[Ada](person:0123456789abcdef01234567).'),
    'Friend of **Ada**.',
  );
});

test('escapes HTML when no markdown converter is available', () => {
  assert.equal(markdownToHtml('<script>x</script>\n\nSecond'), '<p>&lt;script&gt;x&lt;/script&gt;</p><p>Second</p>');
});

test('builds a portrait page and a profile page with the facts', () => {
  const pages = buildPersonPages(
    {
      id: 'p1',
      name: 'Ada',
      nicknames: ['The Grey'],
      status: 'dead',
      age: 40,
      height: null,
      positions: [{ levelName: 'Queen', ownerName: 'Northreach' }],
      tags: ['royal'],
      portrait: 'https://res.cloudinary.com/demo/image/upload/ada.png',
      description: 'Ruled the north.',
    },
    { labels },
  );

  assert.equal(pages.length, 2);
  assert.equal(pages[0].type, 'image');
  assert.equal(pages[0].src, 'https://res.cloudinary.com/demo/image/upload/ada.png');
  assert.equal(pages[1].type, 'text');
  assert.match(pages[1].text.content, /<strong>Status:<\/strong> Dead/);
  assert.match(pages[1].text.content, /Queen · Northreach/);
  assert.match(pages[1].text.content, /#royal/);
  assert.doesNotMatch(pages[1].text.content, /Height/);
  assert.match(pages[1].text.content, /<p>Ruled the north\.<\/p>/);
});

test('skips the portrait page for a person without image', () => {
  const pages = buildPersonPages({ id: 'p2', name: 'Bran', description: '' }, { labels });

  assert.deepEqual(
    pages.map((page) => page.type),
    ['text'],
  );
});
