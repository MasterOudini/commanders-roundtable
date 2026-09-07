// `Goblin Warrens` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_WARRENS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_WARRENS, "{2}{R}, Sacrifice two Goblins: Create three 1/1 red Goblin creature tokens.");
const TOKEN_0 = tokenRef("Goblin|1/1|R|Creature|");

export const GOBLIN_WARRENS_SCRIPT: CardScript = {
  oracleId: GOBLIN_WARRENS.oracleId,
  name: GOBLIN_WARRENS.name,
  activated: [
    {
      ref: `${GOBLIN_WARRENS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 3 }, () => ({
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
