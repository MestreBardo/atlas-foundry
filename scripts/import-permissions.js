import { getActorLink } from './actor-links.js';

export const privateOwnership = () => ({ default: 0 });

export const findLinkedActor = (campaignId, adventurerId, actors = [...(game.actors ?? [])]) => {
  const matches = actors.filter((actor) => getActorLink(actor, campaignId)?.adventurerId === adventurerId);
  return matches.length === 1 ? matches[0] : null;
};

export const adventurerAudience = (campaignId, ids) => {
  const ownership = privateOwnership();
  for (const id of new Set(ids ?? [])) {
    const actor = findLinkedActor(campaignId, id);
    if (!actor) continue;
    for (const user of game.users ?? []) {
      if (!user.isGM && user.role !== 0 && actor.testUserPermission(user, 'OWNER')) ownership[user.id] = 2;
    }
  }
  return ownership;
};

/** Store only access metadata here. Document text stays on the protected journal page. */
export const profilePermissionSource = (kind, entity, scope) => ({
  type: 'profile', kind, campaignId: scope.type === 'campaign' ? scope.id : null,
  adventurerId: kind === 'adventurers' ? entity.id : null,
  viewerIds: [...(entity.viewerIds ?? [])],
});

export const documentPermissionSource = (kind, entity, scope, document) => ({
  type: 'document', kind, campaignId: scope.type === 'campaign' ? scope.id : null,
  adventurerId: kind === 'adventurers' ? entity.id : null,
  entryViewerIds: [...(entity.viewerIds ?? [])],
  ownerId: document.ownerId ?? null,
  viewerIds: [...(document.viewerIds ?? [])],
  // Pending invitations are deliberately excluded from the audience.
});

export const ownershipForSource = (source) => {
  if (!source?.campaignId) return privateOwnership();
  if (source.kind === 'adventurers') {
    if (!findLinkedActor(source.campaignId, source.adventurerId)) return privateOwnership();
    const ids = source.type === 'document'
      ? [source.adventurerId, ...(source.viewerIds ?? [])] : [source.adventurerId];
    return adventurerAudience(source.campaignId, ids);
  }
  if (source.type === 'profile') return adventurerAudience(source.campaignId, source.viewerIds);
  if (source.ownerId && !findLinkedActor(source.campaignId, source.ownerId)) return privateOwnership();
  const candidates = source.ownerId
    ? [source.ownerId, ...(source.viewerIds ?? [])]
    : source.kind === 'persons' ? source.viewerIds ?? [] : source.entryViewerIds ?? [];
  const ids = candidates.filter((id) => (source.entryViewerIds ?? []).includes(id));
  return adventurerAudience(source.campaignId, ids);
};

export const mergeOwnership = (ownerships) => {
  const result = privateOwnership();
  for (const ownership of ownerships) {
    for (const [id, level] of Object.entries(ownership ?? {})) {
      if (id !== 'default' && level > 0) result[id] = Math.max(result[id] ?? 0, level);
    }
  }
  return result;
};

/** Foundry merges update objects; explicitly delete readers removed by Atlas or by a link change. */
export const ownershipUpdate = (previous = {}, desired) => ({
  ...desired,
  ...Object.fromEntries(Object.keys(previous).filter((id) => !Object.hasOwn(desired, id)).map((id) => [`-=${id}`, null])),
});

export const snapshotLocalOwnership = (page) => {
  const ownership = privateOwnership();
  for (const user of game.users ?? []) {
    if (user.isGM || user.role === 0) continue;
    const level = [3, 2, 1].find((value) => page.testUserPermission?.(user, value)) ?? 0;
    if (level) ownership[user.id] = level;
  }
  return ownership;
};
