// `Armada Wurm` — "Trample\nWhen this creature enters, create a 5/5 green
// Wurm creature token with trample." Ambassador Oak's ETB-token shape; the
// Wurm comes from `TOKEN_TABLE` and its printing is pinned in
// `make-engine-fixtures.cjs` (D133's blank-token trap). M6.4e, D162.

import { ARMADA_WURM } from '../../../data/fixtures/engineCards';
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
  ARMADA_WURM,
  'Trample\nWhen this creature enters, create a 5/5 green Wurm creature token with trample.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const WURM = tokenRef('Wurm|5/5|G|Creature|trample');

export const ARMADA_WURM_SCRIPT: CardScript = {
  oracleId: ARMADA_WURM.oracleId,
  name: ARMADA_WURM.name,
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
      label: () => 'Armada Wurm — create a 5/5 Wurm with trample',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: WURM.oracleId,
          printingId: WURM.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
