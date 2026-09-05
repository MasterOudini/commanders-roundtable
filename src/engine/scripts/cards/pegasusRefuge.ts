// `Pegasus Refuge` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PEGASUS_REFUGE } from '../../../data/fixtures/engineCards';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(PEGASUS_REFUGE, "{2}, Discard a card: Create a 1/1 white Pegasus creature token with flying.");
const TOKEN_0 = tokenRef("Pegasus|1/1|W|Creature|flying");

export const PEGASUS_REFUGE_SCRIPT: CardScript = {
  oracleId: PEGASUS_REFUGE.oracleId,
  name: PEGASUS_REFUGE.name,
  activated: [
    {
      ref: `${PEGASUS_REFUGE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_0.oracleId,
          printingId: TOKEN_0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
