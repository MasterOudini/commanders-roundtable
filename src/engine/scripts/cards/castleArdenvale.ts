// `Castle Ardenvale` — "This land enters tapped unless you control a
// Plains.\n{T}: Add {W}.\n{2}{W}{W}, {T}: Create a 1/1 white Human creature
// token." The conditional entry is D135's board query and the mana line is
// the engine's; the def owes the token line as ability 1 — the first
// ACTIVATED token maker on a land. M6.4i, D166.

import { CASTLE_ARDENVALE } from '../../../data/fixtures/engineCards';
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
  CASTLE_ARDENVALE,
  'This land enters tapped unless you control a Plains.\n{T}: Add {W}.\n' +
    '{2}{W}{W}, {T}: Create a 1/1 white Human creature token.',
);
const TEXT = PRINTED.split('\n')[2] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const HUMAN = tokenRef('Human|1/1|W|Creature|');

export const CASTLE_ARDENVALE_SCRIPT: CardScript = {
  oracleId: CASTLE_ARDENVALE.oracleId,
  name: CASTLE_ARDENVALE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the token as ability 1.
      ref: `${CASTLE_ARDENVALE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: HUMAN.oracleId,
          printingId: HUMAN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
