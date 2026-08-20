// `Pretending Poxbearers` — "When this creature dies, create a 1/1
// white Ally creature token." The dies-token on the committed Ally pin.
// D234.

import { PRETENDING_POXBEARERS } from '../../../data/fixtures/engineCards';
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
  PRETENDING_POXBEARERS,
  'When this creature dies, create a 1/1 white Ally creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ALLY = tokenRef('Ally|1/1|W|Creature|');

export const PRETENDING_POXBEARERS_SCRIPT: CardScript = {
  oracleId: PRETENDING_POXBEARERS.oracleId,
  name: PRETENDING_POXBEARERS.name,
  triggers: [
    {
      abilityId: 'dies-ally',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Pretending Poxbearers — create a 1/1 white Ally token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ALLY.oracleId,
          printingId: ALLY.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
