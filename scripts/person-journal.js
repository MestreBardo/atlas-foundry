export const MODULE_ID = 'atlas-foundry';

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
      content: `${buildFactsHtml(person, labels)}${markdownToHtml(description, converter)}`,
    },
    flags: { [MODULE_ID]: { part: 'profile' } },
  });
  return pages;
};

export const buildPersonFlags = (person, scope) => ({
  [MODULE_ID]: {
    personId: person.id,
    scopeType: scope.type,
    scopeId: scope.id,
    importedAt: new Date().toISOString(),
  },
});

export const buildScopeKey = (scope) => `${scope.type}:${scope.id}`;
