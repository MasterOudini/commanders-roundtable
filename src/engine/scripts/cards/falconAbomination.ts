// `Falcon Abomination` — "Flying\nWhen this creature enters, create a 2/2
// black Zombie creature token with decayed." The token's decayed rules are
// the TOKEN's own text, disclosed on it by tier3 the same way the Blood
// token's un-chargeable ability is (D164's precedent) — creating it is not
// half-execution, running it would be. M6.4r, D174.

import { FALCON_ABOMINATION } from '../../../data/fixtures/engineCards';
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
  FALCON_ABOMINATION,
  'Flying\nWhen this creature enters, create a 2/2 black Zombie creature token with decayed. ' +
    "(It can't block. When it attacks, sacrifice it at end of combat.)",
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ZOMBIE = tokenRef('Zombie|2/2|B|Creature|decayed');

export const FALCON_ABOMINATION_SCRIPT: CardScript = {
  oracleId: FALCON_ABOMINATION.oracleId,
  name: FALCON_ABOMINATION.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Falcon Abomination — create a 2/2 decayed Zombie',
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
