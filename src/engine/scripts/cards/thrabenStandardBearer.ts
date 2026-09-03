// `Thraben Standard Bearer` — two mana, the tap and a discarded card of my
// choice (D286) make a 1/1 white Human Soldier.

import { THRABEN_STANDARD_BEARER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  THRABEN_STANDARD_BEARER,
  '{1}{W}, {T}, Discard a card: Create a 1/1 white Human Soldier creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}
const HUMAN_SOLDIER = tokenRef('Human Soldier|1/1|W|Creature|');

export const THRABEN_STANDARD_BEARER_SCRIPT: CardScript = {
  oracleId: THRABEN_STANDARD_BEARER.oracleId,
  name: THRABEN_STANDARD_BEARER.name,
  activated: [
    {
      ref: `${THRABEN_STANDARD_BEARER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: HUMAN_SOLDIER.oracleId,
          printingId: HUMAN_SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
