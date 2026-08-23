// `Vessel of Ephemera` — the self-sacrifice for TWO Spirits, which is what
// makes D164's advancing id allocator load-bearing here: a single-read
// allocator would return the same id twice and the second token would
// overwrite the first. The test asserts the ids are DISTINCT. D265.

import { VESSEL_OF_EPHEMERA } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import type { TokenRef } from '../../../data/tokenTable';
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
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TEXT = printed(
  VESSEL_OF_EPHEMERA,
  '{2}{W}, Sacrifice this enchantment: Create two 1/1 white Spirit creature tokens with flying.',
);

const SPIRIT = tokenRef('Spirit|1/1|W|Creature|flying');

export const VESSEL_OF_EPHEMERA_SCRIPT: CardScript = {
  oracleId: VESSEL_OF_EPHEMERA.oracleId,
  name: VESSEL_OF_EPHEMERA.name,
  activated: [
    {
      ref: `${VESSEL_OF_EPHEMERA.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIRIT.oracleId,
          printingId: SPIRIT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIRIT.oracleId,
          printingId: SPIRIT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
