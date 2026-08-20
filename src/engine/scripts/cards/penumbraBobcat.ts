// `Penumbra Bobcat` — "When this creature dies, create a 2/1 black Cat
// creature token." The Penumbra dies-shadow. D232.

import { PENUMBRA_BOBCAT } from '../../../data/fixtures/engineCards';
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
  PENUMBRA_BOBCAT,
  'When this creature dies, create a 2/1 black Cat creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CAT = tokenRef('Cat|2/1|B|Creature|');

export const PENUMBRA_BOBCAT_SCRIPT: CardScript = {
  oracleId: PENUMBRA_BOBCAT.oracleId,
  name: PENUMBRA_BOBCAT.name,
  triggers: [
    {
      abilityId: 'dies-shadow',
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
      label: () => 'Penumbra Bobcat — create a 2/1 black Cat',
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
