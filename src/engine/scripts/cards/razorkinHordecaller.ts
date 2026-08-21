// `Razorkin Hordecaller` — "Whenever you attack, create a 1/1 red
// Gremlin creature token." One firing per declaration; the Haste line is
// the engine's. D238.

import { RAZORKIN_HORDECALLER } from '../../../data/fixtures/engineCards';
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
  RAZORKIN_HORDECALLER,
  'Haste\nWhenever you attack, create a 1/1 red Gremlin creature token.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GREMLIN = tokenRef('Gremlin|1/1|R|Creature|');

export const RAZORKIN_HORDECALLER_SCRIPT: CardScript = {
  oracleId: RAZORKIN_HORDECALLER.oracleId,
  name: RAZORKIN_HORDECALLER.name,
  triggers: [
    {
      abilityId: 'attack-gremlin',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ev.attackers.some((a) => ctx.query.controllerOf(a.card) === ctx.query.controllerOf(self)),
      label: () => 'Razorkin Hordecaller — create a 1/1 red Gremlin token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: GREMLIN.oracleId,
          printingId: GREMLIN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
