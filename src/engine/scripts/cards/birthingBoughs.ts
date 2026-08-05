// `Birthing Boughs` — "{4}, {T}: Create a 2/2 colorless Shapeshifter
// creature token with changeling." An activated TOKEN maker (Ant Queen's
// repeatability, gated by the {T}); the colorless Shapeshifter is its own
// table entry beside the blue one. M6.4g, D164.

import { BIRTHING_BOUGHS } from '../../../data/fixtures/engineCards';
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
  BIRTHING_BOUGHS,
  '{4}, {T}: Create a 2/2 colorless Shapeshifter creature token with changeling. (It is every creature type.)',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SHAPESHIFTER = tokenRef('Shapeshifter|2/2||Creature|changeling');

export const BIRTHING_BOUGHS_SCRIPT: CardScript = {
  oracleId: BIRTHING_BOUGHS.oracleId,
  name: BIRTHING_BOUGHS.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BIRTHING_BOUGHS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SHAPESHIFTER.oracleId,
          printingId: SHAPESHIFTER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
