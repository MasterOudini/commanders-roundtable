// `Coral Barrier` — "Defender\nWhen this creature enters, create a 1/1 blue
// Squid creature token with islandwalk." The keyword line is the engine's;
// the def owes the Squid — whose islandwalk is what makes the printing
// distinct (D131: the abilities are identity). M6.4l, D169.

import { CORAL_BARRIER } from '../../../data/fixtures/engineCards';
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
  CORAL_BARRIER,
  "Defender (This creature can't attack.)\nWhen this creature enters, create a 1/1 blue Squid creature token with islandwalk. (It can't be blocked as long as defending player controls an Island.)",
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SQUID = tokenRef('Squid|1/1|U|Creature|islandwalk');

export const CORAL_BARRIER_SCRIPT: CardScript = {
  oracleId: CORAL_BARRIER.oracleId,
  name: CORAL_BARRIER.name,
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
      label: () => 'Coral Barrier — create a 1/1 Squid with islandwalk',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SQUID.oracleId,
          printingId: SQUID.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
