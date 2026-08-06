// `Draconic Disciple` — "{T}: Add one mana of any color.\n{7}, {T},
// Sacrifice this creature: Create a 5/5 red Dragon creature token with
// flying." The mana line is the engine's; the def owes the self-sacrifice
// Dragon (D159's cost, D160's token). M6.4p, D172.

import { DRACONIC_DISCIPLE } from '../../../data/fixtures/engineCards';
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
  DRACONIC_DISCIPLE,
  '{T}: Add one mana of any color.\n{7}, {T}, Sacrifice this creature: Create a 5/5 red Dragon creature token with flying.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const DRAGON = tokenRef('Dragon|5/5|R|Creature|flying');

export const DRACONIC_DISCIPLE_SCRIPT: CardScript = {
  oracleId: DRACONIC_DISCIPLE.oracleId,
  name: DRACONIC_DISCIPLE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the Dragon as ability 1.
      ref: `${DRACONIC_DISCIPLE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: DRAGON.oracleId,
          printingId: DRAGON.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
