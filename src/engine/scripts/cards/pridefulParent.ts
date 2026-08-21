// `Prideful Parent` — "When this creature enters, create a 1/1 white
// Cat creature token." The Vigilance line (and its reminder) is the
// engine's. D235.

import { PRIDEFUL_PARENT } from '../../../data/fixtures/engineCards';
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
  PRIDEFUL_PARENT,
  "Vigilance (Attacking doesn't cause this creature to tap.)\nWhen this creature enters, create a 1/1 white Cat creature token.",
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CAT = tokenRef('Cat|1/1|W|Creature|');

export const PRIDEFUL_PARENT_SCRIPT: CardScript = {
  oracleId: PRIDEFUL_PARENT.oracleId,
  name: PRIDEFUL_PARENT.name,
  triggers: [
    {
      abilityId: 'etb-cat',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Prideful Parent — create a 1/1 white Cat token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: CAT.oracleId,
          printingId: CAT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
