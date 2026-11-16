import { MODULE_ID } from './person-journal.js';
import { findLinkedActor, ownershipForSource, profilePermissionSource } from './import-permissions.js';
import { importedEntityKey } from './import-target.js';

export const availableActorTypes = () => {
  const types = game.documentTypes?.Actor ?? Object.keys(globalThis.CONFIG?.Actor?.dataModels ?? {});
  return types.filter((type) => type !== 'base').map((id) => ({
    id, name: game.i18n.localize(globalThis.CONFIG?.Actor?.typeLabels?.[id] ?? id),
  }));
};

export const writeEntityActor = async (kind, entity, scope, target, entry, actorType) => {
  if (!availableActorTypes().some(({ id }) => id === actorType)) {
    throw Object.assign(new Error('INVALID_ACTOR_TYPE'), { code: 'INVALID_ACTOR_TYPE' });
  }
  // An existing player character is never overwritten with an imported snapshot.
  if (!target.actorPack && kind === 'adventurers') {
    const linked = findLinkedActor(scope.id, entity.id);
    if (linked) return { status: 'linked', actor: linked };
  }
  const importKey = importedEntityKey(scope, kind, entity.id);
  const existing = [...target.actors].find((actor) => actor.getFlag(MODULE_ID, 'importKey') === importKey);
  const data = {
    name: entity.name, img: entity.portrait ?? entity.image ?? 'icons/svg/mystery-man.svg',
    flags: { [MODULE_ID]: { importKey, journalUuid: entry.uuid, entityType: kind, entityId: entity.id,
      scopeId: scope.id, scopeType: scope.type } },
  };
  if (existing) {
    // Preserve system statistics, type, ownership and any live campaign link on reimport.
    await existing.update(data);
    return { status: 'updated', actor: existing };
  }
  const actor = await foundry.documents.Actor.create({ ...data, type: actorType,
    ownership: ownershipForSource(profilePermissionSource(kind, entity, scope)),
  }, target.actorPack ? { pack: target.actorPack.collection } : {});
  if (Array.isArray(target.actors) && !target.actors.some(({ id }) => id === actor.id)) target.actors.push(actor);
  return { status: 'created', actor };
};
