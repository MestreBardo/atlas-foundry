import { MODULE_ID } from './person-journal.js';
import { readSource } from './settings.js';

/** Use Foundry's ownership model, independently of the game system's Actor types. */
export const isPlayerActor = (actor) => actor.hasPlayerOwner === true;

/** Only player-owned Actors can represent campaign adventurers. */
export const getActorLink = (actor, campaignId = readSource().campaignId) =>
  campaignId && isPlayerActor(actor)
    ? actor.getFlag(MODULE_ID, 'adventurerLinks')?.find((link) => link.campaignId === campaignId) ?? null
    : null;

export const buildActorLinkUpdates = ({ actors, source, adventurers, assignments }) => {
  const availableIds = new Set(adventurers.map(({ id }) => id));
  const playerActorIds = new Set(actors.filter(isPlayerActor).map(({ id }) => id));
  const assignedAdventurers = new Set();
  const fail = (code) => { throw Object.assign(new Error(code), { code }); };
  if (!source.worldId || !source.campaignId) fail('INVALID_LINK');
  for (const [actorId, adventurerId] of Object.entries(assignments)) {
    if (!playerActorIds.has(actorId) || (adventurerId && !availableIds.has(adventurerId))) fail('INVALID_LINK');
    if (!adventurerId) continue;
    if (assignedAdventurers.has(adventurerId)) fail('DUPLICATE_ADVENTURER');
    assignedAdventurers.add(adventurerId);
  }
  return actors.flatMap((actor) => {
    const previous = actor.getFlag(MODULE_ID, 'adventurerLinks') ?? [];
    const next = previous.filter((link) => link.campaignId !== source.campaignId);
    const adventurer = isPlayerActor(actor)
      ? adventurers.find(({ id }) => id === assignments[actor.id])
      : null;
    if (adventurer) next.push({
      worldId: source.worldId, campaignId: source.campaignId,
      adventurerId: adventurer.id, name: adventurer.name,
    });
    return JSON.stringify(previous) === JSON.stringify(next) ? [] : [{
      _id: actor.id, [`flags.${MODULE_ID}.adventurerLinks`]: next,
    }];
  });
};
