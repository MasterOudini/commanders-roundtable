// `Meloku the Clouded Mirror` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MELOKU_THE_CLOUDED_MIRROR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MELOKU_THE_CLOUDED_MIRROR, "Flying\n{1}, Return a land you control to its owner's hand: Create a 1/1 blue Illusion creature token with flying.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Illusion|1/1|U|Creature|flying");

export const MELOKU_THE_CLOUDED_MIRROR_SCRIPT: CardScript = {
  oracleId: MELOKU_THE_CLOUDED_MIRROR.oracleId,
  name: MELOKU_THE_CLOUDED_MIRROR.name,
  activated: [
    {
      ref: `${MELOKU_THE_CLOUDED_MIRROR.oracleId}#a0`,
      text: LINES[1] as string,
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
