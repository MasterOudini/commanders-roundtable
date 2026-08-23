// `Watchful Giant` — an EXACT-TEXT TWIN of D266's shipped
// `Voice of the Provinces` with the flying line removed: "When this creature
// enters, create a 1/1 white Human creature token." Written to the same shape
// deliberately, so a twin sweep finds a pair and not a divergence. D268.

import { WATCHFUL_GIANT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  WATCHFUL_GIANT,
  'When this creature enters, create a 1/1 white Human creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const HUMAN = tokenRef('Human|1/1|W|Creature|');

export const WATCHFUL_GIANT_SCRIPT: CardScript = {
  oracleId: WATCHFUL_GIANT.oracleId,
  name: WATCHFUL_GIANT.name,
  triggers: [
    {
      abilityId: 'etb-human',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Watchful Giant — create a 1/1 white Human creature token',
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
