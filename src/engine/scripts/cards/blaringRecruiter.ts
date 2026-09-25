// `Blaring Recruiter` - an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLARING_RECRUITER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLARING_RECRUITER, "Partner with Blaring Captain (When this creature enters, target player may put Blaring Captain into their hand from their library, then shuffle.)\n{2}{W}: Create a 1/1 white Warrior creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Warrior|1/1|W|Creature|");

export const BLARING_RECRUITER_SCRIPT: CardScript = {
  oracleId: BLARING_RECRUITER.oracleId,
  name: BLARING_RECRUITER.name,
  activated: [
    {
      ref: `${BLARING_RECRUITER.oracleId}#a0`,
      text: LINES[1] as string,
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
