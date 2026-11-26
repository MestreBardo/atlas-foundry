import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import contract from './helpers/atlas-client-contract.cjs';
import { AtlasClient, AtlasRequestError } from '../scripts/atlas-client.js';

contract.describeAtlasClientContract({ AtlasClient, AtlasRequestError, clientHeader: 'foundry' });

test('the client contract matches the copy in atlas-talespire when it is checked out', async (context) => {
  const own = fileURLToPath(new URL('./helpers/atlas-client-contract.cjs', import.meta.url));
  const sibling = fileURLToPath(
    new URL('../../atlas-talespire/tests/helpers/atlas-client-contract.cjs', import.meta.url),
  );
  const siblingText = await readFile(sibling, 'utf8').catch(() => null);
  if (siblingText === null) {
    context.skip('atlas-talespire is not next to this repository');
    return;
  }
  assert.equal(await readFile(own, 'utf8'), siblingText);
});
