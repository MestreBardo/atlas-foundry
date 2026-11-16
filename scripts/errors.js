import { localize } from './localization.js';

export const describeError = (error) => {
  const code = error?.code ?? 'UNKNOWN';
  const key = {
    NETWORK_ERROR: 'Network', HTTP_401: 'Unauthorized', HTTP_403: 'Forbidden',
    SOURCE_NOT_FOUND: 'SourceNotFound', INVALID_LINK: 'InvalidLink', DUPLICATE_ADVENTURER: 'DuplicateAdventurer',
    INVALID_IMPORT_KIND: 'InvalidImportKind', INVALID_ACTOR_TYPE: 'InvalidActorType',
    INVALID_ATLAS_RESPONSE: 'InvalidAtlasResponse', INVALID_DESTINATION: 'InvalidDestination',
    INVALID_PACK_TYPE: 'InvalidPackType', PACK_NOT_PRIVATE: 'PackNotPrivate', PACK_LOCKED: 'PackLocked',
  }[code];
  return localize(`ATLAS.Errors.${key ?? 'Generic'}`, { code });
};
