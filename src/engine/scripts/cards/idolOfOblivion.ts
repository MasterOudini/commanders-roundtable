// `Idol of Oblivion` - an activation draw, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IDOL_OF_OBLIVION } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(IDOL_OF_OBLIVION, "{T}: Draw a card. Activate only if you created a token this turn.\n{8}, {T}, Sacrifice this artifact: Create a 10/10 colorless Eldrazi creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_1 = tokenRef("Eldrazi|10/10||Creature|");

export const IDOL_OF_OBLIVION_SCRIPT: CardScript = {
  oracleId: IDOL_OF_OBLIVION.oracleId,
  name: IDOL_OF_OBLIVION.name,
  activated: [
    {
      ref: `${IDOL_OF_OBLIVION.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      ref: `${IDOL_OF_OBLIVION.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_1.oracleId,
          printingId: TOKEN_1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
