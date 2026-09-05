// `Grove of the Guardian` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GROVE_OF_THE_GUARDIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GROVE_OF_THE_GUARDIAN, "{T}: Add {C}.\n{3}{G}{W}, {T}, Tap two untapped creatures you control, Sacrifice this land: Create an 8/8 green and white Elemental creature token with vigilance.");
const LINES = PRINTED.split('\n');
const TOKEN_1 = tokenRef("Elemental|8/8|GW|Creature|vigilance");

export const GROVE_OF_THE_GUARDIAN_SCRIPT: CardScript = {
  oracleId: GROVE_OF_THE_GUARDIAN.oracleId,
  name: GROVE_OF_THE_GUARDIAN.name,
  activated: [
    {
      ref: `${GROVE_OF_THE_GUARDIAN.oracleId}#a1`,
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
