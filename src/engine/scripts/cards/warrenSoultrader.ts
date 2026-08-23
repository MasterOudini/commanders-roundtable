// `Warren Soultrader` — "Pay 1 life, Sacrifice another creature: Create a
// Treasure token."
//
// ⚠️ A TWO-PART cost with NO MANA IN IT AT ALL. D254's Strands of Night proved
// a three-part cost (mana + fixed life + sacrifice); this is that one part
// lighter, and the engine charges both halves. "ANOTHER creature" is the
// chooser's own restriction (Ahriman, Blazing Hellhound, Elite Headhunter and
// Hurler Cyclops all print it), so the Soultrader may never eat itself.
// D268.

import { WARREN_SOULTRADER } from '../../../data/fixtures/engineCards';
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
  WARREN_SOULTRADER,
  'Pay 1 life, Sacrifice another creature: Create a Treasure token. (It\'s an artifact with "{T}, Sacrifice this token: Add one mana of any color.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TREASURE = tokenRef('Treasure|/||Artifact|');

export const WARREN_SOULTRADER_SCRIPT: CardScript = {
  oracleId: WARREN_SOULTRADER.oracleId,
  name: WARREN_SOULTRADER.name,
  activated: [
    {
      ref: `${WARREN_SOULTRADER.oracleId}#a0`,
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
