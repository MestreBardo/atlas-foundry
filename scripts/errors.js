import { localize } from './localization.js';

export const describeError = (error) => {
  const code = error?.code ?? 'UNKNOWN';
  const key = {
    NETWORK_ERROR: 'Network', HTTP_401: 'Unauthorized', HTTP_403: 'Forbidden',
    SOURCE_NOT_FOUND: 'SourceNotFound', INVALID_LINK: 'InvalidLink', DUPLICATE_ADVENTURER: 'DuplicateAdventurer',
  }[code];
  return localize(`ATLAS.Errors.${key ?? 'Generic'}`, { code });
};
