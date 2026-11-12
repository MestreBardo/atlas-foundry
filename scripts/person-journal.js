export const MODULE_ID = 'atlas-foundry';
export const PERSON_SHEET_ID = `${MODULE_ID}.AtlasPersonSheet`;

const MENTION_PATTERN =
  /@\[([^\]\n]+)\]\((?:person|place|faction|entry|adventurer|quest|event|map|house):[0-9a-f]{24}\)/g;

export const replaceMentions = (markdown) =>
  (markdown ?? '').replace(MENTION_PATTERN, (_match, label) => `**${label}**`);

export const escapeHtml = (text) =>
  String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const fallbackMarkdownToHtml = (markdown) =>
  markdown
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`)
    .join('');

export const markdownToHtml = (markdown, converter = null) => {
  const source = replaceMentions(markdown);
  return converter ? converter.makeHtml(source) : fallbackMarkdownToHtml(source);
};

const buildFactsHtml = (person, labels) => {
  const facts = [
    [labels.nicknames, (person.nicknames ?? []).join(', ')],
    [labels.status, person.status ? labels.statuses[person.status] ?? person.status : ''],
    [labels.age, person.age ?? ''],
    [labels.height, person.height ?? ''],
    [labels.positions, (person.positions ?? [])
        .map((position) => [position.levelName, position.ownerName].filter(Boolean).join(' · '))
        .filter(Boolean)
        .join(', ')],
    [labels.tags, (person.tags ?? []).map((tag) => `#${tag}`).join(' ')],
  ].filter(([, value]) => value !== '' && value !== null);
  if (facts.length === 0) {
    return '';
  }
  const rows = facts
    .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
    .join('');
  return `<ul class="atlas-person-facts">${rows}</ul>`;
};

export const buildPersonPages = (person, { labels, converter = null }) => {
  const pages = [];
  const image = person.portrait ?? person.image ?? null;
  if (image) {
    pages.push({
      name: labels.portrait,
      type: 'image',
      src: image,
      image: { caption: person.name },
      flags: { [MODULE_ID]: { part: 'portrait' } },
    });
  }
  const description = person.description ?? '';
  pages.push({
    name: labels.profile,
    type: 'text',
    text: {
      format: 1,
      content: `${buildFactsHtml(person, labels)}<div class="atlas-person-description">${markdownToHtml(description, converter)}</div>`,
    },
    flags: {
      [MODULE_ID]: {
        part: 'profile',
        // Keep the snapshot on the page so page ownership also protects its facts.
        person: {
          nicknames: person.nicknames ?? [],
          status: person.status ?? '',
          age: person.age ?? '',
          height: person.height ?? '',
          positions: (person.positions ?? []).map(({ levelName, ownerName }) => ({ levelName, ownerName })),
          tags: person.tags ?? [],
        },
      },
    },
  });
  return pages;
};

export const buildPersonFlags = (person, scope) => ({
  [MODULE_ID]: {
    personId: person.id,
    scopeType: scope.type,
    scopeId: scope.id,
    scopeName: scope.name,
    importedAt: new Date().toISOString(),
  },
});

export const buildScopeKey = (scope) => `${scope.type}:${scope.id}`;
