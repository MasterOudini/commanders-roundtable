// `Voice of the Woods` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VOICE_OF_THE_WOODS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VOICE_OF_THE_WOODS, "Tap five untapped Elves you control: Create a 7/7 green Elemental creature token with trample. (It can deal excess combat damage to the player or planeswalker it's attacking.)");
const TOKEN_0 = tokenRef("Elemental|7/7|G|Creature|trample");

export const VOICE_OF_THE_WOODS_SCRIPT: CardScript = {
  oracleId: VOICE_OF_THE_WOODS.oracleId,
  name: VOICE_OF_THE_WOODS.name,
  activated: [
    {
      ref: `${VOICE_OF_THE_WOODS.oracleId}#a0`,
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
