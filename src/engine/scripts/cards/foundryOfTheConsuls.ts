// `Foundry of the Consuls` — Land, "{T}: Add {C}.\n{5}, {T}, Sacrifice
// this land: Create two 1/1 colorless Thopter artifact creature tokens with
// flying." The self-sacrifice multi-token on a LAND — two DISTINCT ids
// through D164's allocator. M6.4s, D175.

import { FOUNDRY_OF_THE_CONSULS } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(
  FOUNDRY_OF_THE_CONSULS,
  '{T}: Add {C}.\n{5}, {T}, Sacrifice this land: Create two 1/1 colorless Thopter artifact creature tokens with flying.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const THOPTER = tokenRef('Thopter|1/1||Artifact Creature|flying');

export const FOUNDRY_OF_THE_CONSULS_SCRIPT: CardScript = {
  oracleId: FOUNDRY_OF_THE_CONSULS.oracleId,
  name: FOUNDRY_OF_THE_CONSULS.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the Thopters as ability 1.
      ref: `${FOUNDRY_OF_THE_CONSULS.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: THOPTER.oracleId,
          printingId: THOPTER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
