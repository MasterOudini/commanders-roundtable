// `Ant Queen` — "{1}{G}: Create a 1/1 green Insect creature token." The first
// REPEATABLE token ability: no tap in the cost, so mana is the only limit.
// M6.4d, D161.

import { ANT_QUEEN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ANT_QUEEN, '{1}{G}: Create a 1/1 green Insect creature token.');

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const INSECT = tokenRef('Insect|1/1|G|Creature|');

export const ANT_QUEEN_SCRIPT: CardScript = {
  oracleId: ANT_QUEEN.oracleId,
  name: ANT_QUEEN.name,
  activated: [
    {
      ref: `${ANT_QUEEN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: INSECT.oracleId,
          printingId: INSECT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
