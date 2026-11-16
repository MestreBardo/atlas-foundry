import { MODULE_ID } from './person-journal.js';
import { readSource } from './settings.js';

/** Links are local to this Foundry world and retain associations for other campaigns. */
export const getActorLink = (actor, campaignId = readSource().campaignId) =>
  campaignId ? actor.getFlag(MODULE_ID, 'adventurerLinks')?.find((link) => link.campaignId === campaignId) ?? null : null;

export const buildActorLinkUpdates = ({ actors, source, adventurers, assignments }) => {
  const availableIds = new Set(adventurers.map(({ id }) => id));
  const actorIds = new Set(actors.map(({ id }) => id));
  const assignedActors = new Set();
  const fail = (code) => { throw Object.assign(new Error(code), { code }); };
  if (!source.worldId || !source.campaignId) fail('INVALID_LINK');
  for (const [adventurerId, actorId] of Object.entries(assignments)) {
    if (!availableIds.has(adventurerId) || (actorId && !actorIds.has(actorId))) fail('INVALID_LINK');
    if (!actorId) continue;
    if (assignedActors.has(actorId)) fail('DUPLICATE_ACTOR');
    assignedActors.add(actorId);
  }
  return actors.flatMap((actor) => {
    const previous = actor.getFlag(MODULE_ID, 'adventurerLinks') ?? [];
    const next = previous.filter((link) => link.campaignId !== source.campaignId);
    const adventurer = adventurers.find(({ id }) => assignments[id] === actor.id);
    if (adventurer) next.push({
      worldId: source.worldId, campaignId: source.campaignId,
      adventurerId: adventurer.id, name: adventurer.name,
    });
    return JSON.stringify(previous) === JSON.stringify(next) ? [] : [{
      _id: actor.id, [`flags.${MODULE_ID}.adventurerLinks`]: next,
    }];
  });
};
