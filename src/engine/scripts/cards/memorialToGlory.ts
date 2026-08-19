// `Memorial to Glory` — Land, "This land enters tapped.\n{T}: Add
// {W}.\n{3}{W}, {T}, Sacrifice this land: Create two 1/1 white Soldier
// creature tokens." Two DISTINCT Soldiers on the t40k pin the fuzz deck has
// carried since D158. M6.4ad, D186.

import { MEMORIAL_TO_GLORY } from '../../../data/fixtures/engineCards';
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
  MEMORIAL_TO_GLORY,
  'This land enters tapped.\n{T}: Add {W}.\n{3}{W}, {T}, Sacrifice this land: Create two 1/1 white Soldier creature tokens.',
);
const TEXT = PRINTED.split('\n')[2] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SOLDIER = tokenRef('Soldier|1/1|W|Creature|');

export const MEMORIAL_TO_GLORY_SCRIPT: CardScript = {
  oracleId: MEMORIAL_TO_GLORY.oracleId,
  name: MEMORIAL_TO_GLORY.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the tokens as ability 1.
      ref: `${MEMORIAL_TO_GLORY.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        [0, 1].map(() => ({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SOLDIER.oracleId,
          printingId: SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
};
