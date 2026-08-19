// `Martyr of Dusk` — "When this creature dies, create a 1/1 white Vampire
// creature token with lifelink." The dies-token on the batch's new Vampire
// pin — the same token Mavren Fein pays on attack. M6.4ad, D186.

import { MARTYR_OF_DUSK } from '../../../data/fixtures/engineCards';
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
  MARTYR_OF_DUSK,
  'When this creature dies, create a 1/1 white Vampire creature token with lifelink.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const VAMPIRE = tokenRef('Vampire|1/1|W|Creature|lifelink');

export const MARTYR_OF_DUSK_SCRIPT: CardScript = {
  oracleId: MARTYR_OF_DUSK.oracleId,
  name: MARTYR_OF_DUSK.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Martyr of Dusk — create a 1/1 Vampire with lifelink',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: VAMPIRE.oracleId,
          printingId: VAMPIRE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
