import { buildPersonPages, escapeHtml, markdownToHtml, MODULE_ID } from './person-journal.js';
import { buildDocumentPages } from './document-journal.js';
import { documentPermissionSource, ownershipForSource, profilePermissionSource } from './import-permissions.js';

const detailsList = (items) => items.filter(Boolean).map((item) => `<li>${escapeHtml(item)}</li>`).join('');

export const buildEntityPages = (kind, entity, documents, { labels, scope, converter = null }) => {
  let pages;
  if (kind === 'persons') pages = buildPersonPages(entity, { labels, converter });
  else {
    const image = entity.portrait ?? entity.image;
    const fields = kind === 'adventurers'
      ? [entity.ancestry, entity.age != null ? `${labels.age}: ${entity.age}` : null]
      : kind === 'places'
        ? [entity.type, ...(entity.factions ?? []).map((faction) => faction.factionName)]
        : (entity.places ?? []).map((place) => place.placeName);
    const profile = kind === 'adventurers' ? entity.personality ?? '' : entity.description ?? '';
    pages = [
      ...(image ? [{ name: labels.portrait, type: 'image', src: image, image: { caption: entity.name },
        flags: { [MODULE_ID]: { part: 'portrait', imageAlt: entity.imageAlt ?? '' } } }] : []),
      { name: labels.profile, type: 'text', text: { format: 1, content:
        `<ul class="atlas-person-facts">${detailsList(fields)}</ul><div class="atlas-person-description">${markdownToHtml(profile, converter)}</div>` +
        ((entity.tags ?? []).length ? `<p>${(entity.tags ?? []).map((tag) => escapeHtml(`#${tag}`)).join(' ')}</p>` : '') },
        flags: { [MODULE_ID]: { part: 'profile' } } },
      ...(kind === 'adventurers' && entity.background ? [{ name: labels.history, type: 'text',
        text: { format: 1, content: `<div class="atlas-person-description">${markdownToHtml(entity.background, converter)}</div>` },
        flags: { [MODULE_ID]: { part: 'background' } } }] : []),
    ];
  }
  const source = profilePermissionSource(kind, entity, scope);
  for (const page of pages) {
    page.ownership = ownershipForSource(source);
    page.flags[MODULE_ID].permissionSource = source;
  }
  const documentPages = buildDocumentPages(documents, { labels, converter });
  for (let index = 0; index < documentPages.length; index += 1) {
    const permission = documentPermissionSource(kind, entity, scope, documents[index]);
    documentPages[index].ownership = ownershipForSource(permission);
    documentPages[index].flags[MODULE_ID].permissionSource = permission;
  }
  return [...pages, ...documentPages];
};
