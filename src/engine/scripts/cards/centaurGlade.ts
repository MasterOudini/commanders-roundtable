// `Centaur Glade` — "{2}{G}{G}: Create a 3/3 green Centaur creature token."
// The pool's THIRD enchantment, a repeatable no-tap token maker. M6.4j, D167.

import { CENTAUR_GLADE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CENTAUR_GLADE, '{2}{G}{G}: Create a 3/3 green Centaur creature token.');

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CENTAUR = tokenRef('Centaur|3/3|G|Creature|');

export const CENTAUR_GLADE_SCRIPT: CardScript = {
  oracleId: CENTAUR_GLADE.oracleId,
  name: CENTAUR_GLADE.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${CENTAUR_GLADE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: CENTAUR.oracleId,
          printingId: CENTAUR.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
