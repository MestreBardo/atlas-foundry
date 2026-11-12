import { MODULE_ID } from './person-journal.js';

/** Receives only pages the current user may observe. No requests to Atlas. */
export const buildPersonSheetData = (entry, visiblePages) => {
  const profile = visiblePages.find((page) => page.getFlag(MODULE_ID, 'part') === 'profile');
  const portrait = visiblePages.find((page) => page.getFlag(MODULE_ID, 'part') === 'portrait');
  const person = profile?.getFlag(MODULE_ID, 'person');
  return {
    name: entry.name,
    initial: entry.name?.trim().charAt(0).toLocaleUpperCase() || '?',
    portrait: portrait?.src || '',
    scopeName: entry.getFlag(MODULE_ID, 'scopeName') || entry.folder?.name || '',
    hasProfile: Boolean(profile),
    nicknames: (person?.nicknames ?? []).join(' · '),
    status: person?.status ?? '',
    facts: [
      { label: 'ATLAS.Journal.Age', value: person?.age },
      { label: 'ATLAS.Journal.Height', value: person?.height },
    ].filter(({ value }) => value !== undefined && value !== null && value !== ''),
    positions: (person?.positions ?? [])
      .map(({ levelName, ownerName }) => [levelName, ownerName].filter(Boolean).join(' · '))
      .filter(Boolean),
    tags: person?.tags ?? [],
    profileHtml: profile?.text?.content ?? '',
    documents: visiblePages
      .filter((page) => page.getFlag(MODULE_ID, 'part') === 'document')
      .map((page) => ({ id: page.id, name: page.name, subtitle: page.getFlag(MODULE_ID, 'subtitle') ?? '' })),
    localPages: visiblePages
      .filter((page) => !page.getFlag(MODULE_ID, 'part'))
      .map((page) => ({ id: page.id, name: page.name })),
  };
};
