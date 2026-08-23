// `Treasure Dredger` — the THREE-PART activation cost, D254's Strands of
// Night shape one verb over: mana, a FIXED life payment (D165's Book of Rass)
// and the tap, all charged by the engine before this def runs. The def only
// says what arrives. D262.

import { TREASURE_DREDGER } from '../../../data/fixtures/engineCards';
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
  TREASURE_DREDGER,
  '{1}, {T}, Pay 1 life: Create a Treasure token. (It\'s an artifact with "{T}, Sacrifice this token: Add one mana of any color.")',
);

const TREASURE = tokenRef('Treasure|/||Artifact|');

export const TREASURE_DREDGER_SCRIPT: CardScript = {
  oracleId: TREASURE_DREDGER.oracleId,
  name: TREASURE_DREDGER.name,
  activated: [
    {
      ref: `${TREASURE_DREDGER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: TREASURE.oracleId,
          printingId: TREASURE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
