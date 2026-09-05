// `Patrol Signaler` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PATROL_SIGNALER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PATROL_SIGNALER, "{1}{W}, {Q}: Create a 1/1 white Kithkin Soldier creature token. ({Q} is the untap symbol.)");
const TOKEN_0 = tokenRef("Kithkin Soldier|1/1|W|Creature|");

export const PATROL_SIGNALER_SCRIPT: CardScript = {
  oracleId: PATROL_SIGNALER.oracleId,
  name: PATROL_SIGNALER.name,
  activated: [
    {
      ref: `${PATROL_SIGNALER.oracleId}#a0`,
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
