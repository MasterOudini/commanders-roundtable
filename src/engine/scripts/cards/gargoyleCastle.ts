// `Gargoyle Castle` — Land, "{T}: Add {C}.\n{5}, {T}, Sacrifice this land:
// Create a 3/4 colorless Gargoyle artifact creature token with flying."
// Foundry of the Consuls' self-sacrifice token maker, one Gargoyle. M6.4t,
// D176.

import { GARGOYLE_CASTLE } from '../../../data/fixtures/engineCards';
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
  GARGOYLE_CASTLE,
  '{T}: Add {C}.\n{5}, {T}, Sacrifice this land: Create a 3/4 colorless Gargoyle artifact creature token with flying.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GARGOYLE = tokenRef('Gargoyle|3/4||Artifact Creature|flying');

export const GARGOYLE_CASTLE_SCRIPT: CardScript = {
  oracleId: GARGOYLE_CASTLE.oracleId,
  name: GARGOYLE_CASTLE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the Gargoyle as ability 1.
      ref: `${GARGOYLE_CASTLE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: GARGOYLE.oracleId,
          printingId: GARGOYLE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
