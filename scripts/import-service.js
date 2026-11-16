import { writeEntityEntry } from './entity-writer.js';
import { availableActorTypes, writeEntityActor } from './actor-writer.js';
import { syncEntryPermissions } from './permission-sync.js';

export const importEntity = async ({ client, scope, kind, id, target, labels, createActors = false, actorType }) => {
  if (createActors && !availableActorTypes().some(({ id: type }) => type === actorType)) {
    throw Object.assign(new Error('INVALID_ACTOR_TYPE'), { code: 'INVALID_ACTOR_TYPE' });
  }
  // Finish every API page before touching an existing import.
  const [entity, documents] = await Promise.all([
    client.findEntity(scope, kind, id), client.listEntityDocuments(scope, kind, id),
  ]);
  if (!entity || entity.id !== id || !entity.name || !Array.isArray(documents)) {
    throw Object.assign(new Error('INVALID_ATLAS_RESPONSE'), { code: 'INVALID_ATLAS_RESPONSE' });
  }
  const journal = await writeEntityEntry(kind, entity, documents, scope, target, labels);
  const actor = createActors ? await writeEntityActor(kind, entity, scope, target, journal.entry, actorType) : null;
  await syncEntryPermissions(journal.entry);
  return { ...journal, actor };
};
