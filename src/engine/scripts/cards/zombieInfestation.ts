// `Zombie Infestation` — two discarded cards of my choice (the D286 chooser
// with a count of two, no mana) make a 2/2 black Zombie.

import { ZOMBIE_INFESTATION } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ZOMBIE_INFESTATION, 'Discard two cards: Create a 2/2 black Zombie creature token.');

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}
const ZOMBIE = tokenRef('Zombie|2/2|B|Creature|');

export const ZOMBIE_INFESTATION_SCRIPT: CardScript = {
  oracleId: ZOMBIE_INFESTATION.oracleId,
  name: ZOMBIE_INFESTATION.name,
  activated: [
    {
      ref: `${ZOMBIE_INFESTATION.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ZOMBIE.oracleId,
          printingId: ZOMBIE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
