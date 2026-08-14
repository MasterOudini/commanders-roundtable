// `Jungleborn Pioneer` — "When this creature enters, create a 1/1 blue
// Merfolk creature token with hexproof." The hexproof Merfolk pin the pool
// already holds (its keyword is its identity, D131). M6.4aa, D183.

import { JUNGLEBORN_PIONEER } from '../../../data/fixtures/engineCards';
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
  JUNGLEBORN_PIONEER,
  'When this creature enters, create a 1/1 blue Merfolk creature token with hexproof. ' +
    "(It can't be the target of spells or abilities your opponents control.)",
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const MERFOLK = tokenRef('Merfolk|1/1|U|Creature|hexproof');

export const JUNGLEBORN_PIONEER_SCRIPT: CardScript = {
  oracleId: JUNGLEBORN_PIONEER.oracleId,
  name: JUNGLEBORN_PIONEER.name,
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
      label: () => 'Jungleborn Pioneer — create a hexproof Merfolk',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: MERFOLK.oracleId,
          printingId: MERFOLK.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
