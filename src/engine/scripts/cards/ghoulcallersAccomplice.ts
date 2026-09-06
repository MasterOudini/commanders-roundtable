// `Ghoulcaller's Accomplice` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHOULCALLER_S_ACCOMPLICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GHOULCALLER_S_ACCOMPLICE, "{3}{B}, Exile this card from your graveyard: Create a 2/2 black Zombie creature token. Activate only as a sorcery.");
const TOKEN_0 = tokenRef("Zombie|2/2|B|Creature|");

export const GHOULCALLERS_ACCOMPLICE_SCRIPT: CardScript = {
  oracleId: GHOULCALLER_S_ACCOMPLICE.oracleId,
  name: GHOULCALLER_S_ACCOMPLICE.name,
  activated: [
    {
      ref: `${GHOULCALLER_S_ACCOMPLICE.oracleId}#a0`,
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
